<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Notifikasi operasional ke grup WhatsApp lewat Starsender.
 *
 * Dipakai untuk hal-hal yang harus diketahui pengelola saat itu juga:
 * pendaftaran baru dan setiap perubahan status pesanan kredit.
 *
 * Sengaja TIDAK menaruh alur utama pada risiko: kalau API gagal, lambat, atau
 * kredensialnya kosong, request pengguna tetap sukses dan kegagalannya hanya
 * tercatat di log. Notifikasi yang gagal tidak boleh membatalkan pendaftaran
 * atau menggagalkan approve pembayaran.
 */
final class WhatsAppService
{
    /** Batas tunggu, dalam detik. Kegagalan cepat lebih baik daripada halaman yang menggantung. */
    private const TIMEOUT = 5;

    /**
     * Kirim satu pesan teks ke grup tujuan.
     *
     * @return bool true kalau API menerima pesan, false kalau tidak dikonfigurasi atau gagal.
     */
    public function send(string $body): bool
    {
        if (! self::configured()) {
            return false;
        }

        try {
            $response = Http::timeout(self::TIMEOUT)
                // Starsender mau key mentah di header Authorization, TANPA
                // prefix "Bearer " — withToken() menambahkan prefix itu dan
                // API menjawab 401 "Invalid API Key" kalau dipakai.
                ->withHeaders(['Authorization' => self::apiKey()])
                ->acceptJson()
                ->post(self::endpoint(), [
                    'messageType' => 'text',
                    'to' => self::group(),
                    'body' => $body,
                ]);
        } catch (\Throwable $e) {
            // Koneksi putus / DNS gagal / timeout: catat, jangan lempar.
            Log::warning('whatsapp.send_failed', ['error' => $e->getMessage()]);

            return false;
        }

        if (! $response->successful()) {
            Log::warning('whatsapp.send_failed', [
                'status' => $response->status(),
                'body' => mb_substr($response->body(), 0, 500),
            ]);

            return false;
        }

        return true;
    }

    /**
     * Satu baris ringkas dengan awalan yang konsisten supaya mudah dipindai
     * di dalam grup. Baris berikutnya opsional.
     *
     * @param  array<int, string>  $lines
     */
    public function sendAlert(string $headline, array $lines = []): bool
    {
        $body = '*'.self::APP_LABEL.'*'."\n".$headline;

        foreach ($lines as $line) {
            $body .= "\n".$line;
        }

        return $this->send($body);
    }

    /** Label aplikasi di dalam grup. */
    private const APP_LABEL = 'MDGenerator';

    /**
     * Notifikasi pendaftaran akun baru.
     *
     * Dipanggil dari AuthController::register() dan alur Google, jadi jangan
     * bergantung pada objek request maupun sesi.
     */
    public function notifyNewUser(string $name, string $email, string $source = 'email'): bool
    {
        $via = $source === 'google' ? 'Google' : 'email';

        return $this->sendAlert('Pendaftaran baru', [
            'Nama: '.$name,
            'Email: '.$email,
            'Metode: '.$via,
            'Waktu: '.now()->format('d/m/Y H:i'),
        ]);
    }

    /** Pesanan kredit baru dibuka, belum tentu sudah dibayar. */
    public function notifyPaymentOpened(string $code, string $userName, string $package, int $amount): bool
    {
        return $this->sendAlert('Pesanan kredit baru', [
            'Kode: '.$code,
            'Paket: '.$package,
            'Nominal: Rp'.number_format($amount, 0, ',', '.'),
            'Pemesan: '.$userName,
        ]);
    }

    /**
     * User menyatakan sudah transfer. Ini yang paling penting: pengelola perlu
     * memeriksa mutasi sebelum kredit diberikan.
     */
    public function notifyPaymentSubmitted(
        string $code,
        string $userName,
        string $package,
        int $amount,
        ?string $reference = null,
    ): bool {
        $lines = [
            'Kode: '.$code,
            'Paket: '.$package,
            'Nominal: Rp'.number_format($amount, 0, ',', '.'),
            'Pemesan: '.$userName,
        ];

        if (filled($reference)) {
            $lines[] = 'Referensi: '.$reference;
        }

        $lines[] = 'Bukti transfer sudah diunggah, mohon diverifikasi.';

        return $this->sendAlert('Konfirmasi transfer', $lines);
    }

    /** Keputusan akhir pengelola, supaya grup tahu pesanan sudah selesai. */
    public function notifyPaymentDecided(string $code, string $userName, bool $approved, int $credits, ?string $note = null): bool
    {
        $lines = [
            'Kode: '.$code,
            'Pemesan: '.$userName,
        ];

        $lines[] = $approved
            ? 'Kredit masuk: '.$credits
            : 'Kredit: tidak diberikan';

        if (filled($note)) {
            $lines[] = 'Catatan: '.$note;
        }

        return $this->sendAlert($approved ? 'Pembayaran disetujui' : 'Pembayaran ditolak', $lines);
    }

    /**
     * Aktif hanya kalau API key dan tujuan sama-sama terisi. Deployment yang
     * belum mengonfigurasi WhatsApp tidak boleh menembak endpoint kosong.
     */
    public static function configured(): bool
    {
        return filled(self::apiKey()) && filled(self::group());
    }

    /** Nama grup tujuan, mis. "KERJAAN". */
    private static function group(): string
    {
        return (string) config('services.starsender.group');
    }

    private static function apiKey(): string
    {
        return (string) config('services.starsender.key');
    }

    private static function endpoint(): string
    {
        return (string) config('services.starsender.endpoint');
    }
}
