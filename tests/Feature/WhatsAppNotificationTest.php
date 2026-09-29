<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\User;
use App\Services\PaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Notifikasi grup WhatsApp untuk pendaftaran baru dan alur pembayaran.
 *
 * HTTP ke Starsender di-fake, jadi tidak ada kirim nyata saat pengujian.
 * Prinsip yang dikunci oleh tes-tes ini:
 * 1. Setiap momen penting menembak endpoint Starsender dengan payload yang benar.
 * 2. Kegagalan jaringan / respons error TIDAK boleh menggagalkan alur utama.
 * 3. Konfigurasi kosong mematikan pengiriman tanpa error.
 */
class WhatsAppNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.starsender', [
            'key' => 'test-key',
            'group' => 'KERJAAN',
            'endpoint' => 'https://api.starsender.online/api/send/grup',
        ]);
    }

    private function user(): User
    {
        $user = User::factory()->create();
        $user->wallet();

        return $user;
    }

    public function test_registration_sends_a_whatsapp_notification(): void
    {
        Http::fake([
            'api.starsender.online/*' => Http::response(['success' => true]),
        ]);

        $this->postJson('/api/auth/register', [
            'name' => 'Budi Registrasi',
            'email' => 'budi@example.test',
            'password' => 'password-aman',
            'password_confirmation' => 'password-aman',
        ])->assertCreated();

        Http::assertSent(function ($request) {
            $payload = $request->data();

            return str_contains($request->url(), 'api.starsender.online')
                && $payload['messageType'] === 'text'
                && $payload['to'] === 'KERJAAN'
                && str_contains($payload['body'], 'Pendaftaran baru')
                && str_contains($payload['body'], 'Budi Registrasi')
                && str_contains($payload['body'], 'budi@example.test');
        });
    }

    public function test_registration_survives_a_whatsapp_outage(): void
    {
        Http::fake([
            'api.starsender.online/*' => Http::response('gateway down', 500),
        ]);

        // 201, bukan 500: notifikasi gagal tidak boleh menjatuhkan pendaftaran.
        $this->postJson('/api/auth/register', [
            'name' => 'Tahan Jaringan',
            'email' => 'tahan@example.test',
            'password' => 'password-aman',
            'password_confirmation' => 'password-aman',
        ])->assertCreated();

        $this->assertDatabaseHas('users', ['email' => 'tahan@example.test']);
    }

    public function test_blank_config_skips_the_whatsapp_call(): void
    {
        config()->set('services.starsender.key', null);

        Http::fake();

        $this->postJson('/api/auth/register', [
            'name' => 'Tanpa Konfigurasi',
            'email' => 'tanpa@example.test',
            'password' => 'password-aman',
            'password_confirmation' => 'password-aman',
        ])->assertCreated();

        Http::assertNothingSent();
    }

    public function test_opening_an_order_notifies_the_group(): void
    {
        Http::fake([
            'api.starsender.online/*' => Http::response(['success' => true]),
        ]);

        $user = $this->user();

        $this->actingAs($user)
            ->postJson('/api/payments', ['package' => 'pro'])
            ->assertCreated();

        Http::assertSent(function ($request) use ($user) {
            $payload = $request->data();

            return $payload['to'] === 'KERJAAN'
                && str_contains($payload['body'], 'Pesanan kredit baru')
                && str_contains($payload['body'], 'Pro')
                && str_contains($payload['body'], 'Rp40.000')
                && str_contains($payload['body'], $user->name);
        });
    }

    public function test_submitting_a_transfer_receipt_notifies_the_group(): void
    {
        Http::fake([
            'api.starsender.online/*' => Http::response(['success' => true]),
        ]);

        $user = $this->user();

        /** @var Payment $payment */
        $payment = app(PaymentService::class)->create($user, 'pro');

        Storage::fake('local');
        app(PaymentService::class)->attachProof(
            $payment,
            UploadedFile::fake()->image('bukti.png'),
        );

        $this->actingAs($user)
            ->postJson("/api/payments/{$payment->id}/submit", [
                'transfer_reference' => 'BCA-20260927-01',
                'note' => 'Sudah ditransfer pagi tadi',
            ])
            ->assertOk();

        Http::assertSent(function ($request) {
            $payload = $request->data();

            return $payload['to'] === 'KERJAAN'
                && str_contains($payload['body'], 'Konfirmasi transfer')
                && str_contains($payload['body'], 'BCA-20260927-01')
                && str_contains($payload['body'], 'Rp40.000');
        });
    }

    public function test_approval_notifies_the_group_with_the_credit_amount(): void
    {
        Http::fake([
            'api.starsender.online/*' => Http::response(['success' => true]),
        ]);

        $user = $this->user();
        $admin = User::factory()->create(['role' => 'admin']);

        /** @var Payment $payment */
        $payment = app(PaymentService::class)->create($user, 'pro');

        app(PaymentService::class)->approve($payment, $admin, null, '127.0.0.1');

        Http::assertSent(function ($request) {
            $payload = $request->data();

            return $payload['to'] === 'KERJAAN'
                && str_contains($payload['body'], 'Pembayaran disetujui')
                && str_contains($payload['body'], 'Kredit masuk: 100');
        });
    }

    public function test_rejection_notifies_the_group_without_credits(): void
    {
        Http::fake([
            'api.starsender.online/*' => Http::response(['success' => true]),
        ]);

        $user = $this->user();
        $admin = User::factory()->create(['role' => 'admin']);

        /** @var Payment $payment */
        $payment = app(PaymentService::class)->create($user, 'pro');

        app(PaymentService::class)->reject($payment, $admin, 'Nominal tidak sesuai', '127.0.0.1');

        Http::assertSent(function ($request) {
            $payload = $request->data();

            return $payload['to'] === 'KERJAAN'
                && str_contains($payload['body'], 'Pembayaran ditolak')
                && str_contains($payload['body'], 'Nominal tidak sesuai');
        });
    }

    public function test_a_failed_starsender_response_does_not_break_the_payment_flow(): void
    {
        Http::fake([
            'api.starsender.online/*' => Http::response('upstream error', 503),
        ]);

        $user = $this->user();
        $admin = User::factory()->create(['role' => 'admin']);

        /** @var Payment $payment */
        $payment = app(PaymentService::class)->create($user, 'pro');

        // Approve tetap sukses meski WA gagal, dan kredit tetap masuk.
        app(PaymentService::class)->approve($payment, $admin, null, '127.0.0.1');

        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => Payment::PAID]);
        $this->assertDatabaseHas('credit_transactions', [
            'credit_wallet_id' => $user->wallet()->id,
            'type' => 'grant',
            'amount' => 100,
        ]);
    }
}
