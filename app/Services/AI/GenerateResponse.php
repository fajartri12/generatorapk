<?php

namespace App\Services\AI;

final class GenerateResponse
{
    public function __construct(
        public readonly string $content,
        public readonly string $provider,
        public readonly string $model,
        public readonly int $durationMs,
    ) {}
}
