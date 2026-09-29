<?php

return [

    /*
    |--------------------------------------------------------------------------
    | AI Provider Layer
    |--------------------------------------------------------------------------
    |
    | Business logic never talks to a provider SDK directly. It resolves an
    | implementation through App\Services\AI\ProviderFactory (AGENTS.md §10).
    |
    */

    'default' => env('AI_DEFAULT_PROVIDER', 'mock'),

    // Single HTTP call budget. Kept well under DB_QUEUE_RETRY_AFTER so the
    // worker can never consider a still-running job abandoned (P1-6).
    'timeout' => (int) env('AI_TIMEOUT_SECONDS', 60),

    'providers' => [

        'mock' => [
            'driver' => 'mock',
        ],

        'openai' => [
            'driver' => 'openai',
            'key' => env('OPENAI_API_KEY'),
            'model' => env('OPENAI_MODEL', 'gpt-4o-mini'),
            'endpoint' => 'https://api.openai.com/v1/chat/completions',
        ],

        'gemini' => [
            'driver' => 'gemini',
            'key' => env('GEMINI_API_KEY'),
            'model' => env('GEMINI_MODEL', 'gemini-2.0-flash'),
            'endpoint' => 'https://generativelanguage.googleapis.com/v1beta/models',
        ],

        'openrouter' => [
            'driver' => 'openrouter',
            'key' => env('OPENROUTER_API_KEY'),
            'model' => env('OPENROUTER_MODEL', 'openrouter/auto'),
            'endpoint' => 'https://openrouter.ai/api/v1/chat/completions',
        ],

        // Any gateway that speaks the OpenAI Chat Completions contract.
        'gateway' => [
            'driver' => 'openai-compatible',
            'key' => env('AI_GATEWAY_KEY'),
            'model' => env('AI_GATEWAY_MODEL', 'gpt-4o-mini'),
            'endpoint' => env('AI_GATEWAY_ENDPOINT', 'https://api.openai.com/v1/chat/completions'),
        ],

    ],

];
