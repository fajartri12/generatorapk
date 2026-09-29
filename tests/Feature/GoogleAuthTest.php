<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\CreditService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class GoogleAuthTest extends TestCase
{
    use RefreshDatabase;

    private function caller(): User
    {
        $user = User::factory()->create();
        $user->wallet();
        app(CreditService::class)->grant($user, config('md-generator.starting_balance'), 'Kredit awal');

        return $user;
    }

    public function test_status_reports_disabled_without_credentials(): void
    {
        config(['services.google.client_id' => null, 'services.google.client_secret' => null]);

        $this->getJson('/api/auth/google/status')
            ->assertOk()
            ->assertExactJson(['enabled' => false]);
    }

    public function test_status_reports_enabled_once_both_credentials_are_set(): void
    {
        config([
            'services.google.client_id' => 'client-id',
            'services.google.client_secret' => 'client-secret',
        ]);

        $this->getJson('/api/auth/google/status')
            ->assertOk()
            ->assertExactJson(['enabled' => true]);
    }

    public function test_a_half_configured_client_stays_disabled(): void
    {
        // A client id with no secret cannot complete the handshake, so the
        // button must not appear.
        config(['services.google.client_id' => 'client-id', 'services.google.client_secret' => null]);

        $this->getJson('/api/auth/google/status')
            ->assertOk()
            ->assertExactJson(['enabled' => false]);
    }

    public function test_exchange_trades_a_valid_code_for_a_token(): void
    {
        $user = $this->caller();
        $code = \App\Http\Controllers\Api\SocialAuthController::issueLoginCode($user);

        $response = $this->postJson('/api/auth/google/exchange', ['code' => $code])
            ->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.email', $user->email)
            ->assertJsonStructure(['user' => ['id', 'name', 'email', 'role'], 'token']);

        $token = $response->json('token');
        $this->assertDatabaseHas('personal_access_tokens', ['tokenable_id' => $user->id]);

        // The issued token must actually work as a bearer credential.
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('user.id', $user->id);
    }

    public function test_a_code_cannot_be_replayed(): void
    {
        $user = $this->caller();
        $code = \App\Http\Controllers\Api\SocialAuthController::issueLoginCode($user);

        $this->postJson('/api/auth/google/exchange', ['code' => $code])->assertOk();

        $this->postJson('/api/auth/google/exchange', ['code' => $code])
            ->assertStatus(401)
            ->assertJsonPath('message', 'Kode masuk sudah kedaluwarsa. Coba lagi.');
    }

    public function test_an_unknown_code_is_rejected(): void
    {
        $this->postJson('/api/auth/google/exchange', ['code' => str_repeat('a', 48)])
            ->assertStatus(401);
    }

    public function test_exchange_requires_a_code(): void
    {
        $this->postJson('/api/auth/google/exchange', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('code');
    }

    public function test_a_code_for_a_deleted_account_is_rejected(): void
    {
        $user = $this->caller();
        $code = \App\Http\Controllers\Api\SocialAuthController::issueLoginCode($user);

        $user->delete();

        $this->postJson('/api/auth/google/exchange', ['code' => $code])
            ->assertStatus(401)
            ->assertJsonPath('message', 'Akun tidak ditemukan.');
    }

    public function test_the_oauth_routes_are_hidden_while_unconfigured(): void
    {
        config(['services.google.client_id' => null, 'services.google.client_secret' => null]);

        $this->get('/auth/google/redirect')->assertNotFound();
        $this->get('/auth/google/callback')->assertNotFound();
    }

    public function test_the_login_codes_expire(): void
    {
        $user = $this->caller();
        $code = \App\Http\Controllers\Api\SocialAuthController::issueLoginCode($user);

        Cache::flush();

        $this->postJson('/api/auth/google/exchange', ['code' => $code])
            ->assertStatus(401);
    }
}
