<?php

namespace Tests\Unit;

use App\Services\AI\ProviderFactory;
use App\Services\AI\Providers\GeminiProvider;
use App\Services\AI\Providers\MockProvider;
use App\Services\AI\Providers\OpenAICompatibleProvider;
use Tests\TestCase;

class ProviderFactoryTest extends TestCase
{
    public function test_it_resolves_a_provider_for_every_configured_driver(): void
    {
        $factory = new ProviderFactory;

        foreach (array_keys(config('ai.providers', [])) as $name) {
            $this->assertNotNull($factory->make($name), "Provider [{$name}] gagal di-resolve.");
        }
    }

    public function test_it_maps_drivers_to_the_right_class(): void
    {
        $factory = new ProviderFactory;

        $this->assertInstanceOf(MockProvider::class, $factory->make('mock'));
        $this->assertInstanceOf(GeminiProvider::class, $factory->make('gemini'));
        $this->assertInstanceOf(OpenAICompatibleProvider::class, $factory->make('openai'));
        $this->assertInstanceOf(OpenAICompatibleProvider::class, $factory->make('openrouter'));
        $this->assertInstanceOf(OpenAICompatibleProvider::class, $factory->make('gateway'));
    }
}
