<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Raised when a user cannot afford a generation. Distinct from a generic
 * RuntimeException so the HTTP layer can answer 402 instead of 422 (P0-1).
 */
class InsufficientCreditsException extends RuntimeException
{
    public function __construct(public readonly int $required, public readonly int $balance)
    {
        parent::__construct("Saldo kredit tidak mencukupi. Dibutuhkan {$required} kredit, tersedia {$balance}.");
    }
}
