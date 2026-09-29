<?php

namespace App\Services\AI\Contracts;

use App\Services\AI\GenerateRequest;
use App\Services\AI\GenerateResponse;

/**
 * Every provider — mock, OpenAI, Gemini, OpenRouter — implements exactly this.
 * Adding a provider means adding a class and a config entry, nothing else
 * (AGENTS.md §10).
 */
interface AIProvider
{
    public function name(): string;

    public function model(): string;

    public function generate(GenerateRequest $request): GenerateResponse;
}
