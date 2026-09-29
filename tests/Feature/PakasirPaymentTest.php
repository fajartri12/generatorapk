<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\User;
use App\Services\CreditService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Pakasir rail: a second payment method beside the manual bank transfer.
 *
 * Everything here runs against Http::fake, so no sandbox credentials are needed
 * and the suite never talks to the outside world.
 *
 * The invariant under test is that credits are granted exactly once, no matter
 * how many times Pakasir announces the same payment (webhook retries, the
 * simulate button, and a manual status sync can all fire for one order).
 */
class PakasirPaymentTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        $user = User::factory()->create();
        $user->wallet();
        app(CreditService::class)->grant($user, config('md-generator.starting_balance'), 'Kredit awal');

        return $user;
    }

    private function configurePakasir(): void
    {
        config([
            'md-generator.pakasir.slug' => 'proyek-uji',
            'md-generator.pakasir.api_key' => 'kunci-uji',
            'md-generator.pakasir.webhook_secret' => 'rahasia-uji',
            'md-generator.pakasir.sandbox' => true,
            'md-generator.pakasir.method' => 'payment_link',
        ]);
    }

    /** The success shape of POST /api/v2/create-transaction. */
    private function fakeCreate(): void
    {
        Http::fake([
            '*/api/v2/create-transaction/*' => Http::response([
                'txn_id' => 'txn_abc123',
                'order_id' => null,
                'amount' => 40000,
                'fee' => 1500,
                'total_payment' => 50500,
                'payment_method' => 'payment_link',
                'payment_link' => 'link-harap-diabaikan',
                'expired_at' => now()->addDay()->toIso8601String(),
                'is_sandbox' => true,
                'status' => 'pending',
            ]),
        ]);
    }

    private function fakeStatus(string $status): void
    {
        Http::fake([
            '*/api/v2/transaction-status/*' => Http::response([
                'txn_id' => 'txn_abc123',
                'order_id' => null,
                'amount' => 40000,
                'is_sandbox' => true,
                'status' => $status,
                'completed_at' => $status === 'completed' ? now()->toIso8601String() : null,
            ]),
        ]);
    }

    // ── Checkout ────────────────────────────────────────────────────────────

    public function test_checkout_returns_a_payment_link_and_records_the_transaction(): void
    {
        $this->configurePakasir();
        $this->fakeCreate();

        $user = $this->user();

        $response = $this->actingAs($user)
            ->postJson('/api/payments/pakasir/checkout', [
                'package' => 'pro',
                'redirect_url' => 'http://localhost/app/payments',
            ])
            ->assertCreated()
            ->assertJsonPath('is_sandbox', true)
            ->assertJsonPath('total_payment', 50500)
            ->assertJsonPath('data.gateway', Payment::GATEWAY_PAKASIR)
            ->assertJsonPath('data.status', Payment::PENDING);

        // The link must point at Pakasir's own pay page, not their landing page.
        $url = $response->json('payment_url');
        $this->assertIsString($url);
        $this->assertStringContainsString('/pay-v2/txn_abc123', $url);
        $this->assertStringContainsString('redirect=', $url);

        $this->assertDatabaseHas('payments', [
            'user_id' => $user->id,
            'gateway' => Payment::GATEWAY_PAKASIR,
            'gateway_txn_id' => 'txn_abc123',
        ]);
    }

    public function test_checkout_sends_the_api_key_header(): void
    {
        $this->configurePakasir();
        $this->fakeCreate();

        $this->actingAs($this->user())
            ->postJson('/api/payments/pakasir/checkout', ['package' => 'pro'])
            ->assertCreated();

        // Pakasir authenticates with X-Api-Key, not a Bearer token.
        Http::assertSent(fn ($request) => $request->hasHeader('X-Api-Key', 'kunci-uji')
            && ! $request->hasHeader('Authorization'));
    }

    public function test_checkout_is_refused_while_pakasir_is_unconfigured(): void
    {
        config(['md-generator.pakasir.slug' => null, 'md-generator.pakasir.api_key' => null]);
        Http::fake();

        $this->actingAs($this->user())
            ->postJson('/api/payments/pakasir/checkout', ['package' => 'pro'])
            ->assertStatus(503);

        Http::assertNothingSent();
    }

    public function test_the_order_page_reports_whether_pakasir_is_available(): void
    {
        $this->configurePakasir();

        $this->actingAs($this->user())
            ->getJson('/api/payments')
            ->assertOk()
            ->assertJsonPath('pakasir.enabled', true)
            ->assertJsonPath('pakasir.sandbox', true);
    }

    // ── Webhook ─────────────────────────────────────────────────────────────

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function webhookBody(string $status = 'completed', string $txnId = 'txn_abc123', array $overrides = []): array
    {
        return array_merge([
            'txn_id' => $txnId,
            'order_id' => Payment::query()->value('code'),
            'amount' => 40000,
            'is_sandbox' => true,
            'status' => $status,
            'completed_at' => now()->toIso8601String(),
        ], $overrides);
    }

    public function test_a_completed_webhook_grants_the_credits(): void
    {
        $this->configurePakasir();

        $user = $this->user();
        $before = $user->wallet()->balance;
        Payment::factory()->for($user)->gateway()->create(['credits' => 100]);

        $this->postJson('/api/pakasir/webhook', $this->webhookBody(), ['X-Secret' => 'rahasia-uji'])
            ->assertOk();

        $this->assertSame($before + 100, $user->wallet()->refresh()->balance);
        $this->assertSame(Payment::PAID, Payment::firstOrFail()->status);
        $this->assertDatabaseHas('audit_logs', ['action' => 'payment.settle']);
    }

    public function test_a_webhook_reporting_the_wrong_amount_grants_nothing(): void
    {
        $this->configurePakasir();

        $user = $this->user();
        $before = $user->wallet()->balance;
        Payment::factory()->for($user)->gateway()->create(['credits' => 100, 'amount' => 40000]);

        // Underpaying is the obvious attack; the order must stay unpaid and the
        // rejection has to be visible (409), not a silent 200.
        $this->postJson('/api/pakasir/webhook', $this->webhookBody(overrides: ['amount' => 5000]), ['X-Secret' => 'rahasia-uji'])
            ->assertStatus(409);

        $this->assertSame($before, $user->wallet()->refresh()->balance);
        $this->assertSame(Payment::PENDING, Payment::firstOrFail()->status);
        $this->assertDatabaseHas('audit_logs', ['action' => 'payment.amount_mismatch']);
    }

    public function test_a_webhook_overpaying_is_refused_too(): void
    {
        $this->configurePakasir();

        $user = $this->user();
        $before = $user->wallet()->balance;
        Payment::factory()->for($user)->gateway()->create(['credits' => 100, 'amount' => 40000]);

        // Settling more than we billed would make the ledger stop explaining
        // the money, so the overpaid direction is refused as well.
        $this->postJson('/api/pakasir/webhook', $this->webhookBody(overrides: ['amount' => 90000]), ['X-Secret' => 'rahasia-uji'])
            ->assertStatus(409);

        $this->assertSame($before, $user->wallet()->refresh()->balance);
        $this->assertSame(Payment::PENDING, Payment::firstOrFail()->status);
    }

    public function test_syncing_an_order_whose_paid_amount_differs_grants_nothing(): void
    {
        $this->configurePakasir();

        $user = $this->user();
        $before = $user->wallet()->balance;
        $payment = Payment::factory()->for($user)->gateway()->create(['credits' => 100, 'amount' => 40000]);

        // The status endpoint is authoritative here, so a completed status that
        // reports a different amount must not settle either. NB: Http::fake()
        // with an array APPENDS stubs, so this must be the only stub registered
        // for this URL or an earlier 40000 response would win the match.
        Http::fake([
            '*/api/v2/transaction-status/*' => Http::response([
                'txn_id' => 'txn_abc123',
                'order_id' => null,
                'amount' => 1000,
                'is_sandbox' => true,
                'status' => 'completed',
                'completed_at' => now()->toIso8601String(),
            ]),
        ]);

        $this->actingAs($user)
            ->postJson("/api/payments/{$payment->id}/sync")
            ->assertStatus(409);

        $this->assertSame($before, $user->wallet()->refresh()->balance);
        $this->assertSame(Payment::PENDING, $payment->refresh()->status);
    }

    public function test_a_repeated_webhook_grants_credits_only_once(): void
    {
        $this->configurePakasir();

        $user = $this->user();
        $before = $user->wallet()->balance;
        Payment::factory()->for($user)->gateway()->create(['credits' => 100]);

        $body = $this->webhookBody();

        $this->postJson('/api/pakasir/webhook', $body, ['X-Secret' => 'rahasia-uji'])->assertOk();
        $this->postJson('/api/pakasir/webhook', $body, ['X-Secret' => 'rahasia-uji'])->assertOk();
        $this->postJson('/api/pakasir/webhook', $body, ['X-Secret' => 'rahasia-uji'])->assertOk();

        $this->assertSame($before + 100, $user->wallet()->refresh()->balance, 'Webhook berulang harus idempoten.');
        $this->assertSame(1, $user->wallet()->transactions()->where('type', 'grant')->where('amount', 100)->count());
    }

    public function test_a_webhook_with_a_wrong_secret_changes_nothing(): void
    {
        $this->configurePakasir();

        $user = $this->user();
        $before = $user->wallet()->balance;
        Payment::factory()->for($user)->gateway()->create(['credits' => 100]);

        $this->postJson('/api/pakasir/webhook', $this->webhookBody(), ['X-Secret' => 'secret-palsu'])
            ->assertOk();

        $this->assertSame($before, $user->wallet()->refresh()->balance);
        $this->assertSame(Payment::PENDING, Payment::firstOrFail()->status);
    }

    public function test_a_webhook_without_a_secret_header_changes_nothing(): void
    {
        $this->configurePakasir();

        $user = $this->user();
        $before = $user->wallet()->balance;
        Payment::factory()->for($user)->gateway()->create(['credits' => 100]);

        $this->postJson('/api/pakasir/webhook', $this->webhookBody())->assertOk();

        $this->assertSame($before, $user->wallet()->refresh()->balance);
    }

    public function test_an_unknown_transaction_is_acknowledged_without_error(): void
    {
        $this->configurePakasir();

        // 200, not 4xx: Pakasir retries anything else, and a wrong txn_id is not
        // something a retry can fix.
        $this->postJson('/api/pakasir/webhook', $this->webhookBody(txnId: 'txn_tidak_ada'), ['X-Secret' => 'rahasia-uji'])
            ->assertOk();
    }

    public function test_a_pending_webhook_leaves_the_order_alone(): void
    {
        $this->configurePakasir();

        $user = $this->user();
        Payment::factory()->for($user)->gateway()->create(['credits' => 100]);

        $this->postJson('/api/pakasir/webhook', $this->webhookBody('pending'), ['X-Secret' => 'rahasia-uji'])->assertOk();

        $this->assertSame(Payment::PENDING, Payment::firstOrFail()->status);
    }

    public function test_the_webhook_does_not_need_a_logged_in_user(): void
    {
        $this->configurePakasir();

        $user = $this->user();
        Payment::factory()->for($user)->gateway()->create(['credits' => 100]);

        // No actingAs anywhere: Pakasir has no account here.
        $this->postJson('/api/pakasir/webhook', $this->webhookBody(), ['X-Secret' => 'rahasia-uji'])->assertOk();

        $this->assertSame(Payment::PAID, Payment::firstOrFail()->status);
    }

    // ── Status sync ─────────────────────────────────────────────────────────

    public function test_syncing_a_completed_order_settles_it(): void
    {
        $this->configurePakasir();
        $this->fakeStatus('completed');

        $user = $this->user();
        $before = $user->wallet()->balance;
        $payment = Payment::factory()->for($user)->gateway()->create(['credits' => 100]);

        $this->actingAs($user)
            ->postJson("/api/payments/{$payment->id}/sync")
            ->assertOk()
            ->assertJsonPath('data.status', Payment::PAID);

        $this->assertSame($before + 100, $user->wallet()->refresh()->balance);
    }

    public function test_syncing_a_cancelled_order_expires_it(): void
    {
        $this->configurePakasir();
        $this->fakeStatus('canceled');

        $user = $this->user();
        $payment = Payment::factory()->for($user)->gateway()->create();

        $this->actingAs($user)
            ->postJson("/api/payments/{$payment->id}/sync")
            ->assertOk()
            ->assertJsonPath('data.status', Payment::EXPIRED);

        $this->assertSame(Payment::EXPIRED, $payment->refresh()->status);
    }

    public function test_syncing_a_pending_order_changes_nothing(): void
    {
        $this->configurePakasir();
        $this->fakeStatus('pending');

        $user = $this->user();
        $payment = Payment::factory()->for($user)->gateway()->create();

        $this->actingAs($user)->postJson("/api/payments/{$payment->id}/sync")->assertOk();

        $this->assertSame(Payment::PENDING, $payment->refresh()->status);
    }

    public function test_a_user_cannot_sync_someone_elses_order(): void
    {
        $this->configurePakasir();
        $this->fakeStatus('completed');

        $owner = $this->user();
        $other = $this->user();
        $payment = Payment::factory()->for($owner)->gateway()->create();

        $this->actingAs($other)->postJson("/api/payments/{$payment->id}/sync")->assertForbidden();
    }

    // ── Simulate (sandbox only) ─────────────────────────────────────────────

    public function test_simulating_a_sandbox_order_settles_it(): void
    {
        $this->configurePakasir();

        Http::fake([
            '*/api/v2/paymentsimulation' => Http::response(['status' => 'ok']),
            '*/api/v2/transaction-status/*' => Http::response([
                'txn_id' => 'txn_abc123', 'order_id' => null, 'amount' => 40000,
                'is_sandbox' => true, 'status' => 'completed', 'completed_at' => now()->toIso8601String(),
            ]),
        ]);

        $user = $this->user();
        $before = $user->wallet()->balance;
        $payment = Payment::factory()->for($user)->gateway()->create(['credits' => 100]);

        $this->actingAs($user)
            ->postJson("/api/payments/{$payment->id}/simulate")
            ->assertOk()
            ->assertJsonPath('data.status', Payment::PAID);

        $this->assertSame($before + 100, $user->wallet()->refresh()->balance);
    }

    public function test_a_live_order_cannot_be_simulated(): void
    {
        $this->configurePakasir();
        Http::fake();

        $user = $this->user();
        $payment = Payment::factory()->for($user)->gateway()->create(['gateway_is_sandbox' => false]);

        $this->actingAs($user)
            ->postJson("/api/payments/{$payment->id}/simulate")
            ->assertStatus(409);

        Http::assertNothingSent();
    }

    // ── The manual rail must not interfere ──────────────────────────────────

    public function test_a_gateway_order_rejects_a_transfer_reference(): void
    {
        $this->configurePakasir();

        $user = $this->user();
        $payment = Payment::factory()->for($user)->gateway()->create();

        $this->actingAs($user)
            ->postJson("/api/payments/{$payment->id}/submit", ['transfer_reference' => 'TRF-999'])
            ->assertStatus(409);
    }

    public function test_a_gateway_order_rejects_a_receipt_upload(): void
    {
        $this->configurePakasir();

        $user = $this->user();
        $payment = Payment::factory()->for($user)->gateway()->create();

        // The file is a real upload, so only the gateway guard can produce this
        // status — a validation failure would return 422 instead.
        $this->actingAs($user)
            ->post("/api/payments/{$payment->id}/proof", [
                'proof' => UploadedFile::fake()->image('struk.jpg'),
            ], ['Accept' => 'application/json'])
            ->assertStatus(409);
    }

    public function test_the_admin_queue_hides_gateway_orders(): void
    {
        $this->configurePakasir();

        $admin = User::factory()->create(['role' => 'admin']);
        $admin->wallet();

        Payment::factory()->create(['status' => Payment::PENDING]);
        Payment::factory()->gateway()->create(['status' => Payment::PENDING]);

        $this->actingAs($admin)
            ->getJson('/api/admin/payments')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.gateway', Payment::GATEWAY_MANUAL);
    }
}
