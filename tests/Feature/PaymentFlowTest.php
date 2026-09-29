<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\User;
use App\Services\CreditService;
use App\Services\PaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PaymentFlowTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        $user = User::factory()->create();
        $user->wallet();
        app(CreditService::class)->grant($user, config('md-generator.starting_balance'), 'Kredit awal');

        return $user;
    }

    public function test_the_order_page_exposes_packages_and_bank_details(): void
    {
        $response = $this->actingAs($this->user())->getJson('/api/payments');

        $response->assertOk()
            ->assertJsonPath('packages.0.key', 'pro')
            ->assertJsonStructure(['data', 'packages' => [['key', 'label', 'credits', 'amount']], 'bank' => ['bank', 'account_number', 'account_name']]);
    }

    public function test_an_admin_can_change_the_bank_account_and_users_see_it(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $admin->wallet();

        $this->actingAs($admin)->getJson('/api/admin/bank')
            ->assertOk()
            ->assertJsonPath('data.bank', config('md-generator.bank.bank'));

        $this->actingAs($admin)->putJson('/api/admin/bank', [
            'bank' => 'Mandiri',
            'account_number' => '9876543210',
            'account_name' => 'PT Contoh',
            'instructions' => 'Transfer tepat sampai digit terakhir.',
        ])->assertOk()->assertJsonPath('data.bank', 'Mandiri');

        // The buyer's page reads the same value, so an admin change needs no deploy.
        $this->actingAs($this->user())->getJson('/api/payments')
            ->assertOk()
            ->assertJsonPath('bank.bank', 'Mandiri')
            ->assertJsonPath('bank.account_number', '9876543210');

        $this->assertDatabaseHas('settings', ['key' => 'bank_details']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'bank.update']);
    }

    public function test_updating_the_bank_account_requires_every_required_field(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $admin->wallet();

        $this->actingAs($admin)->putJson('/api/admin/bank', ['bank' => 'BCA'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['account_number', 'account_name']);
    }

    public function test_only_an_admin_can_read_or_change_the_bank_account(): void
    {
        $user = $this->user();

        $this->actingAs($user)->getJson('/api/admin/bank')->assertForbidden();
        $this->actingAs($user)->putJson('/api/admin/bank', [
            'bank' => 'BCA',
            'account_number' => '1',
            'account_name' => 'Penyerang',
        ])->assertForbidden();

        $this->assertDatabaseMissing('settings', ['key' => 'bank_details']);
    }

    public function test_a_user_can_open_a_transfer_order(): void
    {
        $user = $this->user();

        $this->actingAs($user)
            ->postJson('/api/payments', ['package' => 'pro'])
            ->assertCreated()
            ->assertJsonPath('data.status', Payment::PENDING)
            ->assertJsonPath('data.amount', 40000)
            ->assertJsonPath('data.credits', 100);

        $this->assertDatabaseHas('payments', ['user_id' => $user->id, 'package' => 'pro', 'status' => Payment::PENDING]);
    }

    public function test_an_unknown_package_is_rejected(): void
    {
        $this->actingAs($this->user())
            ->postJson('/api/payments', ['package' => 'gratis-selamanya'])
            ->assertStatus(422);
    }

    public function test_two_open_orders_for_the_same_package_are_refused(): void
    {
        $user = $this->user();

        $this->actingAs($user)->postJson('/api/payments', ['package' => 'pro'])->assertCreated();

        $this->actingAs($user)
            ->postJson('/api/payments', ['package' => 'pro'])
            ->assertStatus(409);
    }

    public function test_submitting_a_reference_moves_the_order_to_review(): void
    {
        $user = $this->user();
        $payment = Payment::factory()->for($user)->create();

        $this->actingAs($user)
            ->postJson("/api/payments/{$payment->id}/submit", ['transfer_reference' => 'TRF-123456'])
            ->assertOk()
            ->assertJsonPath('data.transfer_reference', 'TRF-123456');

        $this->assertNotNull($payment->refresh()->submitted_at);
    }

    public function test_a_submitted_order_still_has_not_granted_any_credits(): void
    {
        $user = $this->user();
        $before = $user->wallet()->balance;
        $payment = Payment::factory()->for($user)->create();

        $this->actingAs($user)->postJson("/api/payments/{$payment->id}/submit", ['transfer_reference' => 'TRF-1'])->assertOk();

        $this->assertSame($before, $user->wallet()->refresh()->balance, 'Saldo tidak boleh berubah sebelum admin menyetujui.');
    }

    public function test_an_approved_order_grants_the_credits(): void
    {
        $user = $this->user();
        $admin = User::factory()->create(['role' => 'admin']);
        $admin->wallet();

        $before = $user->wallet()->balance;
        $payment = Payment::factory()->for($user)->create(['credits' => 100, 'package' => 'pro']);

        $this->actingAs($admin)
            ->postJson("/api/admin/payments/{$payment->id}/approve", ['note' => 'Transfer masuk'])
            ->assertOk()
            ->assertJsonPath('data.status', Payment::PAID);

        $this->assertSame($before + 100, $user->wallet()->refresh()->balance);
        $this->assertDatabaseHas('credit_transactions', [
            'user_id' => $user->id,
            'type' => 'grant',
            'amount' => 100,
        ]);
    }

    public function test_approving_a_pro_order_upgrades_the_wallet_plan(): void
    {
        $user = $this->user();
        $admin = User::factory()->create(['role' => 'admin']);
        $admin->wallet();

        $this->assertSame('free', $user->wallet()->plan);

        $payment = app(PaymentService::class)->create($user, 'pro');
        app(PaymentService::class)->approve($payment, $admin, null, '127.0.0.1');

        $this->assertSame('pro', $user->wallet()->refresh()->plan);
        $this->assertSame(40000, $payment->amount);
        $this->assertSame(100, $payment->credits);
    }

    public function test_approving_twice_grants_credits_only_once(): void
    {
        $user = $this->user();
        $admin = User::factory()->create(['role' => 'admin']);
        $admin->wallet();

        $before = $user->wallet()->balance;
        $payment = Payment::factory()->for($user)->create(['credits' => 100]);

        $this->actingAs($admin)->postJson("/api/admin/payments/{$payment->id}/approve")->assertOk();
        $this->actingAs($admin)->postJson("/api/admin/payments/{$payment->id}/approve")->assertStatus(409);

        $this->assertSame($before + 100, $user->wallet()->refresh()->balance);
        $this->assertSame(
            1,
            $user->wallet()->transactions()->where('type', 'grant')->where('amount', 100)->count(),
            'Persetujuan kedua tidak boleh menambah kredit lagi.'
        );
    }

    public function test_a_rejected_order_grants_nothing(): void
    {
        $user = $this->user();
        $admin = User::factory()->create(['role' => 'admin']);
        $admin->wallet();

        $before = $user->wallet()->balance;
        $payment = Payment::factory()->for($user)->create(['credits' => 200]);

        $this->actingAs($admin)
            ->postJson("/api/admin/payments/{$payment->id}/reject", ['note' => 'Nominal tidak sesuai'])
            ->assertOk()
            ->assertJsonPath('data.status', Payment::REJECTED);

        $this->assertSame($before, $user->wallet()->refresh()->balance);
    }

    public function test_a_user_cannot_touch_someone_elses_order(): void
    {
        $owner = $this->user();
        $other = $this->user();
        $payment = Payment::factory()->for($owner)->create();

        $this->actingAs($other)->getJson("/api/payments/{$payment->id}")->assertForbidden();
        $this->actingAs($other)->postJson("/api/payments/{$payment->id}/submit", ['transfer_reference' => 'X'])->assertForbidden();
        $this->actingAs($other)->postJson("/api/payments/{$payment->id}/cancel")->assertForbidden();
    }

    public function test_a_non_admin_cannot_approve_an_order(): void
    {
        $user = $this->user();
        $payment = Payment::factory()->for($user)->create();

        $this->actingAs($user)->postJson("/api/admin/payments/{$payment->id}/approve")->assertForbidden();
    }

    public function test_the_admin_queue_can_be_filtered_by_status(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $admin->wallet();
        Payment::factory()->create(['status' => Payment::PENDING]);
        Payment::factory()->paid()->create();

        $this->actingAs($admin)
            ->getJson('/api/admin/payments?status=pending')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', Payment::PENDING)
            ->assertJsonPath('counts.pending', 1)
            ->assertJsonPath('counts.paid', 1);
    }

    public function test_a_user_can_cancel_their_own_pending_order(): void
    {
        $user = $this->user();
        $payment = Payment::factory()->for($user)->create();

        $this->actingAs($user)
            ->postJson("/api/payments/{$payment->id}/cancel")
            ->assertOk()
            ->assertJsonPath('data.status', Payment::CANCELLED);
    }

    // ── Kedaluwarsa ─────────────────────────────────────────────────────────

    public function test_a_new_order_gets_a_deadline(): void
    {
        $this->actingAs($this->user())->postJson('/api/payments', ['package' => 'pro'])->assertCreated();

        $payment = Payment::firstOrFail();
        $hours = (int) config('md-generator.payment_expiry_hours');

        $this->assertNotNull($payment->expires_at, 'Pesanan baru harus punya batas waktu.');
        $this->assertSame(
            $hours,
            (int) round(now()->diffInHours($payment->expires_at, false)),
            "Batas waktu harus {$hours} jam dari sekarang."
        );
    }

    public function test_an_order_past_its_deadline_reads_as_expired(): void
    {
        $payment = Payment::factory()->create(['expires_at' => now()->subMinute()]);

        $this->assertTrue($payment->isExpired());
        $this->assertFalse($payment->isOpen(), 'Pesanan lewat batas waktu tidak boleh dianggap terbuka.');
        $this->assertSame(Payment::EXPIRED, $payment->effectiveStatus());
        $this->assertSame(0, $payment->hoursRemaining());
    }

    public function test_submitting_and_cancelling_an_overdue_order_are_refused(): void
    {
        $user = $this->user();
        $payment = Payment::factory()->for($user)->create(['expires_at' => now()->subMinute()]);

        $this->actingAs($user)
            ->postJson("/api/payments/{$payment->id}/submit", ['transfer_reference' => 'TRF-1'])
            ->assertStatus(409);

        $this->actingAs($user)
            ->postJson("/api/payments/{$payment->id}/cancel")
            ->assertStatus(409);

        $this->assertSame(Payment::PENDING, $payment->refresh()->status, 'Status baris tidak berubah, hanya efektifnya.');
    }

    public function test_an_overdue_order_cannot_be_approved(): void
    {
        $user = $this->user();
        $admin = User::factory()->create(['role' => 'admin']);
        $admin->wallet();

        $before = $user->wallet()->balance;
        $payment = Payment::factory()->for($user)->create(['credits' => 100, 'expires_at' => now()->subMinute()]);

        $this->actingAs($admin)
            ->postJson("/api/admin/payments/{$payment->id}/approve", ['note' => 'Transfer masuk'])
            ->assertStatus(409);

        $this->assertSame($before, $user->wallet()->refresh()->balance, 'Pesanan kedaluwarsa tidak boleh menambah kredit.');
    }

    public function test_the_expire_command_closes_overdue_orders_without_touching_credits(): void
    {
        $user = $this->user();
        $before = $user->wallet()->balance;

        $stale = Payment::factory()->for($user)->create(['expires_at' => now()->subHour()]);
        $fresh = Payment::factory()->for($user)->create(['expires_at' => now()->addHour()]);

        $this->artisan('payments:expire')->assertSuccessful();

        $this->assertSame(Payment::EXPIRED, $stale->refresh()->status);
        $this->assertNotNull($stale->reviewed_at);
        $this->assertSame(Payment::PENDING, $fresh->refresh()->status, 'Pesanan yang belum lewat batas waktu tidak boleh disentuh.');
        $this->assertSame($before, $user->wallet()->refresh()->balance);
    }

    public function test_the_expire_command_is_idempotent(): void
    {
        Payment::factory()->create(['expires_at' => now()->subHour()]);

        $this->artisan('payments:expire')->assertSuccessful();
        $this->artisan('payments:expire')->assertSuccessful();

        $this->assertSame(1, Payment::where('status', Payment::EXPIRED)->count());
    }

    public function test_an_expired_order_does_not_block_a_new_one(): void
    {
        $user = $this->user();
        Payment::factory()->for($user)->create(['package' => 'pro', 'expires_at' => now()->subMinute()]);

        $this->actingAs($user)->postJson('/api/payments', ['package' => 'pro'])->assertCreated();
    }

    public function test_the_admin_queue_can_filter_expired_orders(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $admin->wallet();
        Payment::factory()->create(['status' => Payment::EXPIRED]);

        $this->actingAs($admin)
            ->getJson('/api/admin/payments?status=expired')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', Payment::EXPIRED);
    }

    // ── Bukti transfer ──────────────────────────────────────────────────────

    public function test_a_user_can_upload_a_receipt_for_their_order(): void
    {
        Storage::fake('local');
        $user = $this->user();
        $payment = Payment::factory()->for($user)->create();

        $this->actingAs($user)
            ->post("/api/payments/{$payment->id}/proof", [
                'proof' => UploadedFile::fake()->image('bukti.jpg', 600, 400),
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.proof', true);

        $payment->refresh();
        $this->assertNotNull($payment->proof_path);
        $this->assertSame('jpg', pathinfo($payment->proof_path, PATHINFO_EXTENSION));
        $this->assertNotNull($payment->proof_uploaded_at);
        $this->assertGreaterThan(0, $payment->proof_size);
        Storage::disk('local')->assertExists($payment->proof_path);
    }

    public function test_an_oversized_or_wrong_filetype_receipt_is_refused(): void
    {
        Storage::fake('local');
        $user = $this->user();
        $payment = Payment::factory()->for($user)->create();

        $this->actingAs($user)
            ->post("/api/payments/{$payment->id}/proof", [
                'proof' => UploadedFile::fake()->create('virus.exe', 10),
            ], ['Accept' => 'application/json'])
            ->assertStatus(422);

        $maxKb = PaymentService::PROOF_MAX_KB;

        $this->actingAs($user)
            ->post("/api/payments/{$payment->id}/proof", [
                'proof' => UploadedFile::fake()->image('besar.jpg')->size($maxKb + 1),
            ], ['Accept' => 'application/json'])
            ->assertStatus(422);

        $this->assertNull($payment->refresh()->proof_path);
    }

    public function test_uploading_a_receipt_for_someone_elses_order_is_forbidden(): void
    {
        Storage::fake('local');
        $owner = $this->user();
        $other = $this->user();
        $payment = Payment::factory()->for($owner)->create();

        $this->actingAs($other)
            ->post("/api/payments/{$payment->id}/proof", [
                'proof' => UploadedFile::fake()->image('bukti.jpg'),
            ], ['Accept' => 'application/json'])
            ->assertForbidden();

        $this->assertNull($payment->refresh()->proof_path);
    }

    public function test_a_receipt_is_only_visible_to_its_owner_and_the_admin(): void
    {
        Storage::fake('local');
        $owner = $this->user();
        $other = $this->user();
        $admin = User::factory()->create(['role' => 'admin']);
        $admin->wallet();
        $payment = Payment::factory()->for($owner)->create();

        $this->actingAs($owner)
            ->post("/api/payments/{$payment->id}/proof", [
                'proof' => UploadedFile::fake()->image('bukti.jpg'),
            ], ['Accept' => 'application/json'])
            ->assertOk();

        $this->actingAs($owner)->get("/api/payments/{$payment->id}/proof")->assertOk();
        $this->actingAs($other)->get("/api/payments/{$payment->id}/proof")->assertForbidden();
        $this->actingAs($admin)->get("/api/admin/payments/{$payment->id}/proof")->assertOk();
    }

    public function test_downloading_a_receipt_that_was_never_uploaded_is_a_404(): void
    {
        Storage::fake('local');
        $user = $this->user();
        $payment = Payment::factory()->for($user)->create();

        $this->actingAs($user)->getJson("/api/payments/{$payment->id}/proof")->assertNotFound();
    }

    public function test_an_approved_order_carries_its_receipt_along(): void
    {
        Storage::fake('local');
        $user = $this->user();
        $admin = User::factory()->create(['role' => 'admin']);
        $admin->wallet();
        $payment = Payment::factory()->for($user)->create(['credits' => 200]);

        $this->actingAs($user)->post("/api/payments/{$payment->id}/proof", [
            'proof' => UploadedFile::fake()->image('bukti.jpg'),
        ], ['Accept' => 'application/json'])->assertOk();

        $this->actingAs($admin)
            ->postJson("/api/admin/payments/{$payment->id}/approve", ['note' => 'Transfer masuk'])
            ->assertOk();

        $this->assertNotNull($payment->refresh()->proof_path, 'Bukti transfer harus tetap tersimpan sebagai arsip.');
    }
}
