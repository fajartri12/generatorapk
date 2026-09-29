<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * Backend ini hanya melayani API, jadi akar situs bukan lagi halaman SPA.
     * Yang tetap harus hidup adalah health check bawaan Laravel.
     */
    public function test_the_health_endpoint_returns_a_successful_response(): void
    {
        $response = $this->get('/up');

        $response->assertStatus(200);
    }
}
