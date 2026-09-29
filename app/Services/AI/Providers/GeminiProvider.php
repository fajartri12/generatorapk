<?php

namespace App\Services\AI\Providers;

use App\Services\AI\AIProviderException;
use App\Services\AI\Contracts\AIProvider;
use App\Services\AI\GenerateRequest;
use App\Services\AI\GenerateResponse;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Client for Google's Gemini generateContent API.
 *
 * Gemini is not part of the OpenAI Chat Completions contract, so it needs its
 * own shape: the key goes in a query param, the system prompt lives in
 * systemInstruction, and the reply arrives at candidates.0.content.parts.0.text.
 */
final class GeminiProvider implements AIProvider
{
    /**
     * @param array{key?: string|null, model: string, endpoint: string} $config
     */
    public function __construct(private readonly array $config) {}

    public function name(): string
    {
        return 'gemini';
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

        $endpoint = rtrim($this->config['endpoint'], '/').'/'.$this->model().':generateContent';

        try {
            $response = Http::timeout((int) config('ai.timeout', 60))
                ->acceptJson()
                ->asJson()
                ->post($endpoint.'?key='.urlencode($key), [
                    'systemInstruction' => [
                        'parts' => [['text' => $request->systemPrompt]],
                    ],
                    'contents' => [
                        ['role' => 'user', 'parts' => [['text' => $request->userPrompt]]],
                    ],
                    'generationConfig' => ['temperature' => 0.2],
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

        $content = $response->json('candidates.0.content.parts.0.text');

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
