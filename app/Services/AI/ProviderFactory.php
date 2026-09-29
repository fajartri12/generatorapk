<?php

namespace App\Services\AI;

use App\Services\AI\Contracts\AIProvider;
use App\Services\AI\Providers\GeminiProvider;
use App\Services\AI\Providers\MockProvider;
use App\Services\AI\Providers\OpenAICompatibleProvider;
use InvalidArgumentException;

final class ProviderFactory
{
    public function make(?string $name = null): AIProvider
    {
        $name ??= config('ai.default', 'mock');
        $config = config("ai.providers.{$name}");

        if (! $config) {
            throw new InvalidArgumentException("AI provider [{$name}] tidak ditemukan.");
        }

        return match ($config['driver']) {
            'mock' => new MockProvider,
            'gemini' => new GeminiProvider($config),
            'openai', 'openrouter', 'openai-compatible' => new OpenAICompatibleProvider($config),
            default => throw AIProviderException::notConfigured($name),
        };
    }
}
