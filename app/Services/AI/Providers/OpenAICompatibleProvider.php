<?php

namespace App\Services\AI\Providers;

use App\Services\AI\AIProviderException;
use App\Services\AI\Contracts\AIProvider;
use App\Services\AI\GenerateRequest;
use App\Services\AI\GenerateResponse;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Client for providers that expose the OpenAI Chat Completions contract.
 * The endpoint, key, and model stay in environment-backed config.
 */
final class OpenAICompatibleProvider implements AIProvider
{
    /**
     * @param array{key?: string|null, model: string, endpoint: string} $config
     */
    public function __construct(private readonly array $config) {}

    public function name(): string
    {
        return 'openai-compatible';
    }

    public function model(): string
    {
        return $this->config['model'];
    }

    public function generate(GenerateRequest $request): GenerateResponse
    {
        $startedAt = hrtime(true);
        $key = $this->config['key'] ?? null;

        if (! is_string($key) || trim($key) === '') {
            throw AIProviderException::notConfigured($this->name());
        }

        try {
            $response = Http::timeout((int) config('ai.timeout', 60))
                ->withToken($key)
                ->acceptJson()
                ->asJson()
                ->post($this->config['endpoint'], [
                    'model' => $this->model(),
                    'messages' => [
                        ['role' => 'system', 'content' => $request->systemPrompt],
                        ['role' => 'user', 'content' => $request->userPrompt],
                    ],
                    'temperature' => 0.2,
                ]);
        } catch (Throwable $e) {
            throw AIProviderException::failed($this->name(), $e->getMessage());
        }

        if ($response->failed()) {
            $reason = $response->json('error.message')
                ?? $response->json('message')
                ?? $response->body();

            throw AIProviderException::failed($this->name(), "HTTP {$response->status()}: {$reason}");
        }

        $content = $response->json('choices.0.message.content');

        if (! is_string($content) || trim($content) === '') {
            throw AIProviderException::failed($this->name(), 'Respons tidak berisi content yang valid.');
        }

        return new GenerateResponse(
            content: trim($content),
            provider: $this->name(),
            model: $this->model(),
            durationMs: (int) ((hrtime(true) - $startedAt) / 1_000_000),
        );
    }
}
