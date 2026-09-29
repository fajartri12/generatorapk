<?php

namespace App\Services\AI;

/**
 * Thrown when a provider cannot fulfil a request. Callers use this to decide
 * whether the user's credits should be refunded (AGENTS.md §11).
 */
class AIProviderException extends \RuntimeException
{
    public static function notConfigured(string $provider): self
    {
        return new self("AI provider [{$provider}] belum dikonfigurasi. Tambahkan API key-nya di .env.");
    }

    public static function failed(string $provider, string $reason): self
    {
        return new self("AI provider [{$provider}] gagal: {$reason}");
    }
}
