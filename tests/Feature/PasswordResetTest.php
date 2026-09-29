<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        return User::factory()->create([
            'email' => 'budi@example.test',
            'password' => Hash::make('password-lama'),
        ]);
    }

    public function test_forgot_password_returns_a_neutral_message_for_unknown_email(): void
    {
        Notification::fake();

        $this->postJson('/api/auth/forgot-password', ['email' => 'tidak-ada@example.test'])
            ->assertOk()
            ->assertJsonPath('message', 'Kalau email itu terdaftar, kami sudah mengirim tautan untuk mengatur ulang password.');

        Notification::assertNothingSent();
    }

    public function test_forgot_password_sends_a_link_to_a_known_email(): void
    {
        Notification::fake();
        $user = $this->user();

        $this->postJson('/api/auth/forgot-password', ['email' => $user->email])->assertOk();

        // The fake indexes by exact class, so the app's subclass is what is recorded.
        Notification::assertSentTo($user, ResetPasswordNotification::class);
    }

    public function test_the_reset_mail_points_at_the_spa_reset_route(): void
    {
        $user = $this->user();
        $token = Password::createToken($user);

        $mail = (new ResetPasswordNotification($token))->toMail($user);
        $url = $mail->actionUrl;

        // The link must land on the SPA route the frontend serves, otherwise
        // the catch-all would swallow it and render the landing page.
        $this->assertStringContainsString('/reset-password/'.$token, $url);
    }

    public function test_forgot_password_validates_the_email(): void
    {
        $this->postJson('/api/auth/forgot-password', ['email' => 'bukan-email'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_reset_password_changes_the_password_and_clears_old_tokens(): void
    {
        $user = $this->user();
        $user->createToken('spa');
        $token = Password::createToken($user);

        $this->postJson('/api/auth/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'password-baru-123',
            'password_confirmation' => 'password-baru-123',
        ])->assertOk();

        $this->assertTrue(Hash::check('password-baru-123', $user->fresh()->password));
        $this->assertDatabaseCount('personal_access_tokens', 0);

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password-baru-123',
        ])->assertOk()->assertJsonStructure(['user', 'token']);
    }

    public function test_reset_password_rejects_an_invalid_token(): void
    {
        $user = $this->user();

        $this->postJson('/api/auth/reset-password', [
            'token' => 'token-palsu',
            'email' => $user->email,
            'password' => 'password-baru-123',
            'password_confirmation' => 'password-baru-123',
        ])->assertStatus(422);

        $this->assertTrue(Hash::check('password-lama', $user->fresh()->password));
    }

    public function test_reset_password_validates_the_confirmation(): void
    {
        $user = $this->user();
        $token = Password::createToken($user);

        $this->postJson('/api/auth/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'password-baru-123',
            'password_confirmation' => 'beda-sama-sekali',
        ])->assertStatus(422)->assertJsonValidationErrors('password');
    }

    public function test_reset_password_issues_a_token_that_cannot_be_reused(): void
    {
        $user = $this->user();
        $token = Password::createToken($user);

        $payload = [
            'token' => $token,
            'email' => $user->email,
            'password' => 'password-baru-123',
            'password_confirmation' => 'password-baru-123',
        ];

        $this->postJson('/api/auth/reset-password', $payload)->assertOk();
        $this->postJson('/api/auth/reset-password', $payload)->assertStatus(422);
    }

    public function test_google_only_account_gets_a_helpful_login_message(): void
    {
        $user = User::factory()->create([
            'email' => 'google@example.test',
            'password' => null,
            'google_id' => '1234567890',
        ]);

        $this->assertTrue($user->isGoogleOnly());

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'apa-saja',
        ])
            ->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'Akun ini dibuat dengan Google. Pakai tombol Masuk dengan Google.');
    }

    public function test_account_with_a_password_still_logs_in_normally(): void
    {
        $user = $this->user();

        $this->assertFalse($user->isGoogleOnly());

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password-lama',
        ])->assertOk();
    }

    public function test_a_google_only_user_can_set_a_password_through_the_reset_flow(): void
    {
        $user = User::factory()->create([
            'email' => 'google@example.test',
            'password' => null,
            'google_id' => '1234567890',
        ]);

        $token = Password::createToken($user);

        $this->postJson('/api/auth/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'password-baru-123',
            'password_confirmation' => 'password-baru-123',
        ])->assertOk();

        $this->assertFalse($user->fresh()->isGoogleOnly());

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password-baru-123',
        ])->assertOk();
    }
}
