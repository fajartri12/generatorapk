<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\PaymentException;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Services\PakasirService;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Manual bank-transfer top-ups from the user's side.
 */
class PaymentController extends Controller
{
    public function __construct(private readonly PaymentService $payments) {}

    /** Packages, bank account, and the user's own orders in one round trip. */
    public function index(Request $request): JsonResponse
    {
        $orders = $this->payments->forUser($request->user());

        return response()->json([
            'data' => collect($orders->items())->map->toApi(),
            'meta' => [
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
                'total' => $orders->total(),
            ],
            'packages' => $this->payments->packages(),
            'bank' => $this->payments->bankDetails(),
            'expiry_hours' => config('md-generator.payment_expiry_hours'),
            'proof_max_kb' => PaymentService::PROOF_MAX_KB,
            'pakasir' => [
                'enabled' => PakasirService::configured(),
                'sandbox' => PakasirService::sandbox(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'package' => ['required', 'string', 'max:40'],
        ]);

        try {
            $payment = $this->payments->create($request->user(), $data['package']);
        } catch (PaymentException $e) {
            return response()->json(['message' => $e->getMessage()], $e->status);
        }

        return response()->json(['data' => $payment->toApi()], 201);
    }

    /**
     * Checkout lewat Pakasir. Redirect URL dikirim frontend supaya setelah
     * pembayaran pembeli kembali ke pesanan yang benar, bukan halaman kosong.
     */
    public function checkout(Request $request): JsonResponse
    {
        $data = $request->validate([
            'package' => ['required', 'string', 'max:40'],
            'redirect_url' => ['nullable', 'url', 'max:255'],
        ]);

        try {
            $result = $this->payments->createGatewayOrder(
                $request->user(),
                $data['package'],
                $data['redirect_url'] ?? null,
            );
        } catch (PaymentException $e) {
            return response()->json(['message' => $e->getMessage()], $e->status);
        } catch (\RuntimeException $e) {
            // Pakasir menolak requestnya; pesanan lokal sudah dibuat, jadi
            // sebutkan kode invoice supaya pengguna bisa mencoba lagi.
            return response()->json(['message' => $e->getMessage()], 502);
        }

        return response()->json([
            'payment_url' => $result['payment_url'],
            'qr_string' => $result['qr_string'],
            'va_number' => $result['va_number'],
            'total_payment' => $result['total_payment'],
            'fee' => $result['fee'],
            'expires_at' => $result['expires_at'],
            'is_sandbox' => $result['is_sandbox'],
            'data' => $result['payment']->toApi(),
        ], 201);
    }

    /**
     * Sandbox only. Pakasir tidak mengirim webhook sampai transaksi ditandai
     * lunas, jadi tombol ini yang menutup alur di mode pengembangan.
     */
    public function simulate(Request $request, Payment $payment): JsonResponse
    {
        $this->authorizeOwnership($request, $payment);

        try {
            $this->payments->simulateGatewayPayment($payment);
        } catch (PaymentException $e) {
            return response()->json(['message' => $e->getMessage()], $e->status);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }

        // Webhook Pakasir datang terpisah ke /api/pakasir/webhook. Kalau URL
        // webhook belum didaftarkan, sinkronkan langsung supaya tombol ini
        // tetap berguna; kalau webhook sudah jalan, panggilan ini menjadi no-op
        // karena settlement bersifat idempoten.
        try {
            $payment = $this->payments->refreshGatewayOrder($payment->refresh());
        } catch (\RuntimeException) {
            // Pakasir belum menandai lunas dalam hitungan detik ini; biarkan
            // webhook yang menyelesaikannya.
        }

        return response()->json([
            'message' => 'Simulasi pembayaran dijalankan.',
            'data' => $payment->toApi(),
        ]);
    }

    public function show(Request $request, Payment $payment): JsonResponse
    {
        $this->authorizeOwnership($request, $payment);

        return response()->json(['data' => $payment->toApi()]);
    }

    /**
     * Tarik status langsung dari Pakasir. Ini jaring pengaman kalau webhook
     * tidak sampai, dan satu-satunya cara UI tahu sebuah payment_link sudah
     * dibayar tanpa me-refresh halaman.
     */
    public function sync(Request $request, Payment $payment): JsonResponse
    {
        $this->authorizeOwnership($request, $payment);

        try {
            $payment = $this->payments->refreshGatewayOrder($payment);
        } catch (PaymentException $e) {
            return response()->json(['message' => $e->getMessage()], $e->status);
        } catch (\RuntimeException $e) {
            Log::warning('pakasir.sync_failed', ['code' => $payment->code, 'reason' => $e->getMessage()]);

            return response()->json(['message' => $e->getMessage()], 502);
        }

        return response()->json(['data' => $payment->toApi()]);
    }

    /** The user confirms the transfer with a reference number. */
    public function submit(Request $request, Payment $payment): JsonResponse
    {
        $this->authorizeOwnership($request, $payment);

        $data = $request->validate([
            'transfer_reference' => ['required', 'string', 'max:120'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        try {
            $payment = $this->payments->submit($payment, $data);
        } catch (PaymentException $e) {
            return response()->json(['message' => $e->getMessage()], $e->status);
        }

        return response()->json([
            'message' => 'Konfirmasi transfer diterima. Menunggu verifikasi admin.',
            'data' => $payment->toApi(),
        ]);
    }

    public function cancel(Request $request, Payment $payment): JsonResponse
    {
        $this->authorizeOwnership($request, $payment);

        try {
            $payment = $this->payments->cancel($payment);
        } catch (PaymentException $e) {
            return response()->json(['message' => $e->getMessage()], $e->status);
        }

        return response()->json(['message' => 'Pesanan dibatalkan.', 'data' => $payment->toApi()]);
    }

    /**
     * Attach a screenshot or PDF of the transfer. Optional, but without it the
     * admin has only the reference number to go on.
     */
    public function proof(Request $request, Payment $payment): JsonResponse
    {
        $this->authorizeOwnership($request, $payment);

        $maxKb = PaymentService::PROOF_MAX_KB;

        $request->validate([
            'proof' => ['required', 'file', "max:{$maxKb}", 'mimes:jpg,jpeg,png,webp,pdf'],
        ], [
            'proof.required' => 'Pilih file bukti transfer.',
            'proof.max' => "Ukuran bukti transfer maksimal {$maxKb} KB.",
            'proof.mimes' => 'Format bukti transfer harus JPG, PNG, WEBP, atau PDF.',
        ]);

        try {
            $payment = $this->payments->attachProof($payment, $request->file('proof'));
        } catch (PaymentException $e) {
            return response()->json(['message' => $e->getMessage()], $e->status);
        }

        return response()->json([
            'message' => 'Bukti transfer diunggah.',
            'data' => $payment->toApi(),
        ]);
    }

    /**
     * Serve the receipt. It lives on the private disk so this authorised route is
     * the only way to read it.
     */
    public function proofFile(Request $request, Payment $payment): StreamedResponse|JsonResponse
    {
        $this->authorizeOwnership($request, $payment);

        try {
            $contents = $this->payments->proofContents($payment);
        } catch (PaymentException $e) {
            return response()->json(['message' => $e->getMessage()], $e->status);
        }

        $name = $this->payments->proofName($payment);
        $mime = str_ends_with(strtolower($name), '.pdf') ? 'application/pdf' : 'image/'.pathinfo($name, PATHINFO_EXTENSION);

        return response()->streamDownload(fn () => print $contents, $name, ['Content-Type' => $mime]);
    }

    /** A user must never see or touch another user's order. */
    private function authorizeOwnership(Request $request, Payment $payment): void
    {
        abort_unless($payment->user_id === $request->user()->id, 403, 'Pesanan ini bukan milik Anda.');
    }
}
