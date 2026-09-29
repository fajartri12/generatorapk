<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Pakasir — link pembayaran QRIS/VA sebagai rail kedua di samping transfer
 * manual.
 *
 * Kelas ini hanya berbicara dengan API Pakasir dan tidak pernah menyentuh
 * saldo: kredit tetap hanya diberikan lewat CreditService dari satu tempat,
 * yaitu PaymentService::settleGatewayOrder(). Sama seperti WhatsAppService,
 * kegagalan API tidak boleh menjatuhkan alur pengguna — pemanggil menerima
 * exception bermakna dan memutuskan sendiri.
 *
 * Yang mudah salah, dicatat di sini:
 *  - Auth lewat header `X-Api-Key` (BUKAN `Authorization: Bearer`).
 *  - Transaksi ditandai sandbox/nyata oleh konfigurasi PROYEK di sisi Pakasir,
 *    bukan oleh parameter request. Field `is_sandbox` pada response dan webhook
 *    karena itu harus dipercaya apa adanya.
 *  - `amount` tidak ditambah fee oleh kita: `total_payment` yang dikembalikan
 *    Pakasir sudah termasuk fee, dan itulah nominal yang harus dibayar pembeli.
 */
final class PakasirService
{
    public const METHOD_PAYMENT_LINK = 'payment_link';

    /** Satu-satunya metode yang didukung UI saat ini. */
    public const METHOD_QRIS = 'qris';

    // ── Konfigurasi ────────────────────────────────────────────────────────

    public static function slug(): ?string
    {
        return filled(config('md-generator.pakasir.slug')) ? (string) config('md-generator.pakasir.slug') : null;
    }

    public static function apiKey(): ?string
    {
        return filled(config('md-generator.pakasir.api_key')) ? (string) config('md-generator.pakasir.api_key') : null;
    }

    public static function webhookSecret(): ?string
    {
        return filled(config('md-generator.pakasir.webhook_secret'))
            ? (string) config('md-generator.pakasir.webhook_secret')
            : null;
    }

    public static function sandbox(): bool
    {
        return (bool) config('md-generator.pakasir.sandbox', true);
    }

    /**
     * Gateway hanya tersedia kalau slug DAN api key terisi. Setengah
     * konfigurasi berarti tombolnya tidak muncul sama sekali.
     */
    public static function configured(): bool
    {
        return self::slug() !== null && self::apiKey() !== null;
    }

    /** Metode yang dipakai untuk transaksi baru. */
    public static function method(): string
    {
        $method = (string) config('md-generator.pakasir.method', self::METHOD_PAYMENT_LINK);

        return $method === self::METHOD_QRIS ? self::METHOD_QRIS : self::METHOD_PAYMENT_LINK;
    }

    // ── API ───────────────────────────────────────────────────────────────

    /**
     * Buat transaksi. Bersifat find-or-create di sisi Pakasir: memanggil ulang
     * dengan slug + order_id yang sama mengembalikan transaksi yang sama, jadi
     * menekan tombol dua kali tidak menghasilkan dua tagihan.
     *
     * @return array{txn_id:string,payment_link:?string,qr_string:?string,va_number:?string,fee:int,total_payment:int,payment_method:string,expired_at:?string,is_sandbox:bool,status:string}
     */
    public function createTransaction(string $orderId, int $amount, ?string $method = null): array
    {
        $method ??= self::method();

        $body = $this->request()
            ->post($this->url("/api/v2/create-transaction/{$this->slugSegment()}/{$orderId}"), [
                'method' => $method,
                'amount' => $amount,
            ]);

        if (! $body->successful()) {
            throw $this->failure('membuat transaksi', $body->status(), $body->body());
        }

        $data = $body->json() ?? [];

        if (blank($data['txn_id'] ?? null)) {
            throw new RuntimeException('Pakasir tidak mengembalikan txn_id. Cek kembali slug dan API key proyek.');
        }

        return $this->normalize($data, $amount);
    }

    /**
     * Cek status langsung ke Pakasir. Dipakai sebagai jalur pemulihan saat
     * webhook tidak sampai (mis. webhook URL belum didaftarkan di sisi mereka).
     *
     * @return array{txn_id:string,status:string,amount:int,is_sandbox:bool,completed_at:?string}|null
     */
    public function transactionStatus(string $txnId): ?array
    {
        $body = $this->request()->get($this->url("/api/v2/transaction-status/{$this->slugSegment()}/{$txnId}"));

        if ($body->status() === 404) {
            return null;
        }

        if (! $body->successful()) {
            throw $this->failure('memeriksa status transaksi', $body->status(), $body->body());
        }

        $data = $body->json() ?? [];

        return [
            'txn_id' => (string) ($data['txn_id'] ?? $txnId),
            'order_id' => $data['order_id'] ?? null,
            'status' => (string) ($data['status'] ?? 'pending'),
            'amount' => (int) ($data['amount'] ?? 0),
            'is_sandbox' => (bool) ($data['is_sandbox'] ?? false),
            'completed_at' => $data['completed_at'] ?? null,
        ];
    }

    /**
     * Simulasi pembayaran — HANYA berarti saat proyek masih di mode sandbox,
     * dan Pakasir akan menolaknya kalau proyek sudah go live. Ini yang memicu
     * webhook, jadi tanpanya alur sandbox tidak pernah bisa diselesaikan.
     */
    public function simulatePayment(string $orderId, int $amount): bool
    {
        $body = $this->request()->post($this->url('/api/v2/paymentsimulation'), [
            'project' => self::slug(),
            'order_id' => $orderId,
            'amount' => $amount,
        ]);

        if (! $body->successful()) {
            throw $this->failure('menjalankan simulasi pembayaran', $body->status(), $body->body());
        }

        return true;
    }

    /**
     * URL halaman pembayaran untuk sebuah txn_id. `?redirect=` membuat tombol
     * "Kembali ke merchant" mendarat di pesanan yang benar, bukan halaman
     * sebelumnya.
     */
    public function paymentUrl(string $txnId, ?string $redirect = null): string
    {
        $url = $this->url("/pay-v2/{$txnId}");

        if (filled($redirect)) {
            $url .= '?redirect='.urlencode($redirect);
        }

        return $url;
    }

    // ── Internal ──────────────────────────────────────────────────────────

    /** Slug dipakai sebagai path segment, jadi jangan sampai kosong. */
    private function slugSegment(): string
    {
        $slug = self::slug();

        if ($slug === null) {
            throw new RuntimeException('Pakasir belum dikonfigurasi: PAKASIR_SLUG kosong.');
        }

        return $slug;
    }

    private function request(): PendingRequest
    {
        return Http::timeout((int) config('md-generator.pakasir.timeout', 10))
            ->acceptJson()
            ->withHeaders([
                'X-Api-Key' => (string) self::apiKey(),
            ]);
    }

    private function url(string $path): string
    {
        return rtrim((string) config('md-generator.pakasir.endpoint', 'https://app.pakasir.com'), '/').$path;
    }

    /**
     * Pakasir melakukan additive fee: `amount` adalah yang kita terima,
     * `total_payment` yang dibayar pembeli. Body responsnya kita rapikan jadi
     * satu bentuk yang stabil supaya pemanggil tidak menebak-nebak field.
     */
    private function normalize(array $data, int $amount): array
    {
        return [
            'txn_id' => (string) $data['txn_id'],
            'order_id' => $data['order_id'] ?? null,
            'payment_link' => $data['payment_link'] ?? null,
            'qr_string' => $data['qr_string'] ?? null,
            'va_number' => $data['va_number'] ?? null,
            'amount' => (int) ($data['amount'] ?? $amount),
            'fee' => (int) ($data['fee'] ?? 0),
            'total_payment' => (int) ($data['total_payment'] ?? $amount),
            'payment_method' => (string) ($data['payment_method'] ?? self::method()),
            'expired_at' => $data['expired_at'] ?? null,
            'is_sandbox' => (bool) ($data['is_sandbox'] ?? false),
            'status' => (string) ($data['status'] ?? 'pending'),
        ];
    }

    private function failure(string $action, int $status, string $body): RuntimeException
    {
        Log::warning('pakasir.request_failed', [
            'action' => $action,
            'status' => $status,
            'body' => mb_substr($body, 0, 500),
        ]);

        return new RuntimeException("Gagal {$action} ke Pakasir (HTTP {$status}). Cek kredensial dan coba lagi.");
    }
}
