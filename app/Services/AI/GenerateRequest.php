<?php

namespace App\Services\AI;

/**
 * The only shape the rest of the app knows about. Feature code builds one of
 * these and hands it to AIService; it never learns which vendor answered
 * (AGENTS.md §10).
 */
final class GenerateRequest
{
    /**
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>  $context
     */
    public function __construct(
        public readonly string $documentType,
        public readonly string $promptVersion,
        public readonly string $systemPrompt,
        public readonly string $userPrompt,
        public readonly array $payload = [],
        public readonly array $context = [],
    ) {}
}
