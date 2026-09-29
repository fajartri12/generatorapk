<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * A manual transfer order was impossible to create or move forward.
 * Carries an HTTP status so the controller does not have to guess.
 */
final class PaymentException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 422)
    {
        parent::__construct($message);
    }

    public static function unknownPackage(string $package): self
    {
        return new self("Paket [{$package}] tidak dikenal.", 422);
    }

    public static function duplicateOrder(string $package): self
    {
        return new self("Sudah ada pesanan paket [{$package}] yang belum selesai. Selesaikan atau batalkan dulu.", 409);
    }

    public static function notOpen(string $status): self
    {
        return new self("Pesanan dengan status [{$status}] tidak bisa diubah lagi.", 409);
    }

    public static function expired(): self
    {
        return new self('Pesanan sudah kedaluwarsa. Buat pesanan baru untuk melanjutkan.', 409);
    }

    /** A proof file that is not an image, or bigger than we are willing to store. */
    public static function invalidProof(string $reason): self
    {
        return new self("Bukti transfer tidak diterima: {$reason}", 422);
    }

    public static function proofMissing(): self
    {
        return new self('Pesanan ini belum punya bukti transfer.', 404);
    }

    /** The gateway rail was requested but its credentials are absent. */
    public static function gatewayUnavailable(): self
    {
        return new self('Pembayaran otomatis belum tersedia. Hubungi pengelola atau pakai transfer bank.', 503);
    }

    /**
     * The amount the provider says was paid does not match the order. Granting
     * anyway would sell a Rp40.000 package for whatever the buyer chose, and the
     * overpaid direction is just as wrong: settling more than we billed means
     * the ledger no longer explains the money.
     */
    public static function amountMismatch(int $expected, int $reported): self
    {
        return new self(
            'Nominal pembayaran tidak cocok dengan pesanan. Hubungi pengelola sebelum kredit diberikan.',
            409,
        );
    }
}
