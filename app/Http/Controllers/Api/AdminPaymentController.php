<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\PaymentException;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Setting;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Admin review queue for manual bank transfers. Approving here is the ONLY way
 * a purchase becomes credits.
 */
class AdminPaymentController extends Controller
{
    public function __construct(private readonly PaymentService $payments) {}

    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status');
        $status = in_array($status, Payment::STATUSES, true) ? $status : null;

        $orders = $this->payments->all($status);

        return response()->json([
            'data' => collect($orders->items())->map->toApi(),
            'meta' => [
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
                'total' => $orders->total(),
            ],
            'counts' => $this->payments->counts(),
            'expiring' => $this->payments->stalePendingCount(),
            'scheduler' => $this->schedulerHealth(),
        ]);
    }

    /**
     * Gateway orders never reach the review queue (nothing for a human to
     * verify), which used to make them invisible. Buyers who paid but got no
     * credits had no trace an admin could look at. This is that view: read-only
     * plus a manual re-check against the provider.
     */
    public function gatewayIndex(Request $request): JsonResponse
    {
        $status = $request->query('status');
        $status = in_array($status, Payment::STATUSES, true) ? $status : null;

        $orders = $this->payments->gatewayOrders($status);

        return response()->json([
            'data' => collect($orders->items())->map->toApi(),
            'meta' => [
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
                'total' => $orders->total(),
            ],
            'counts' => $this->payments->gatewayCounts(),
        ]);
    }

    /**
     * Ask the provider again. Settlement itself still goes through the single
     * `settleGatewayOrder` path, so this cannot double-credit.
     */
    public function gatewaySync(Request $request, Payment $payment): JsonResponse
    {
        if (! $payment->isGateway()) {
            return response()->json(['message' => 'Pesanan ini bukan pesanan gateway.'], 422);
        }

        try {
            $payment = $this->payments->refreshGatewayOrder($payment);
        } catch (PaymentException $e) {
            return response()->json(['message' => $e->getMessage()], $e->status);
        }

        $this->auditSync($request, $payment);

        return response()->json([
            'message' => "Status pesanan {$payment->code} diperiksa ulang: {$payment->status}.",
            'data' => $payment->toApi(),
        ]);
    }

    /** Narrow helper so gatewaySync stays readable. */
    private function auditSync(Request $request, Payment $payment): void
    {
        app(\App\Services\AuditLogger::class)->record(
            $request->user(),
            'payment.sync',
            "Memeriksa ulang status pesanan gateway {$payment->code} ({$payment->gateway}): {$payment->status}.",
            $payment,
            ['status' => $payment->status, 'gateway' => $payment->gateway],
            $request->ip(),
        );
    }

    /**
     * Whether the hourly `payments:expire` sweep is actually running. Recorded
     * by the command itself, so a stale timestamp means the schedule is dead and
     * expired orders are piling up unseen.
     */
    private function schedulerHealth(): array
    {
        $lastRun = Setting::get('payments.expire_last_run');

        return [
            'last_run_at' => $lastRun['at'] ?? null,
            'last_run_count' => $lastRun['count'] ?? null,
            'stale' => $lastRun === null || now()->diffInHours($lastRun['at'] ?? now()->subYears(10)) >= 6,
        ];
    }

    public function approve(Request $request, Payment $payment): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:500']]);

        try {
            $payment = $this->payments->approve($payment, $request->user(), $data['note'] ?? null, $request->ip());
        } catch (PaymentException $e) {
            return response()->json(['message' => $e->getMessage()], $e->status);
        }

        return response()->json([
            'message' => "Pesanan {$payment->code} disetujui. {$payment->credits} kredit ditambahkan.",
            'data' => $payment->toApi(),
        ]);
    }

    public function reject(Request $request, Payment $payment): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:500']]);

        try {
            $payment = $this->payments->reject($payment, $request->user(), $data['note'] ?? null, $request->ip());
        } catch (PaymentException $e) {
            return response()->json(['message' => $e->getMessage()], $e->status);
        }

        return response()->json([
            'message' => "Pesanan {$payment->code} ditolak.",
            'data' => $payment->toApi(),
        ]);
    }

    /**
     * The reviewer is allowed to see any receipt: it is their job to check it.
     * The file still lives off the public disk, so only this route serves it.
     */
    public function proof(Payment $payment): StreamedResponse|JsonResponse
    {
        try {
            $contents = $this->payments->proofContents($payment);
        } catch (PaymentException $e) {
            return response()->json(['message' => $e->getMessage()], $e->status);
        }

        $name = $this->payments->proofName($payment);
        $mime = str_ends_with(strtolower($name), '.pdf') ? 'application/pdf' : 'image/'.pathinfo($name, PATHINFO_EXTENSION);

        return response()->streamDownload(fn () => print $contents, $name, ['Content-Type' => $mime]);
    }
}
