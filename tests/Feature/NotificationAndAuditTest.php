<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Payment;
use App\Models\User;
use App\Services\CreditService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * #3 — the inbox must say something, so nobody opens a duplicate order to find
 * out what happened. #4 — every money/privilege change leaves a trail.
 */
class NotificationAndAuditTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        $user = User::factory()->create();
        $user->wallet();
        app(CreditService::class)->grant($user, config('md-generator.starting_balance'), 'Kredit awal');

        return $user;
    }

    private function admin(): User
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $admin->wallet();

        return $admin;
    }

    private function order(User $user, string $package = 'pro'): Payment
    {
        return Payment::query()->create([
            'code' => Payment::makeCode(),
            'user_id' => $user->id,
            'package' => $package,
            'credits' => 100,
            'amount' => 40000,
            'status' => Payment::PENDING,
            'expires_at' => now()->addHour(),
        ]);
    }

    /* ---------------------------------------------------------------- #3 --- */

    public function test_opening_an_order_notifies_every_admin(): void
    {
        $admin = $this->admin();

        $this->actingAs($this->user())->postJson('/api/payments', ['package' => 'pro'])->assertCreated();

        $this->assertSame(1, $admin->fresh()->notifications()->count());
        $this->assertSame('PaymentNeedsReview', class_basename($admin->notifications()->first()->type));
    }

    public function test_submitting_an_order_notifies_the_admin(): void
    {
        $admin = $this->admin();
        $user = $this->user();
        $payment = $this->order($user);

        $this->actingAs($user)->postJson("/api/payments/{$payment->id}/submit", ['transfer_reference' => 'TRF-123'])->assertOk();

        $latest = $admin->fresh()->notifications()->first();
        $this->assertSame('submitted', $latest->data['stage']);
    }

    public function test_approval_notifies_the_buyer_and_nobody_else(): void
    {
        $admin = $this->admin();
        $user = $this->user();
        $payment = $this->order($user);

        $this->actingAs($admin)->postJson("/api/admin/payments/{$payment->id}/approve")->assertOk();

        $notification = $user->fresh()->notifications()->first();
        $this->assertNotNull($notification);
        $this->assertSame('payment.decision', $notification->data['kind']);
        $this->assertTrue($notification->data['approved']);
        $this->assertSame(100, $notification->data['credits']);

        // The admin who decided is not the audience for a decision notice.
        $this->assertSame(0, $admin->fresh()->unreadNotifications()->where('data->kind', 'payment.decision')->count());
    }

    public function test_rejection_notifies_the_buyer_with_the_reason(): void
    {
        $user = $this->user();
        $payment = $this->order($user);

        $this->actingAs($this->admin())
            ->postJson("/api/admin/payments/{$payment->id}/reject", ['note' => 'Nominal tidak cocok'])
            ->assertOk();

        $notification = $user->fresh()->notifications()->first();
        $this->assertFalse($notification->data['approved']);
        $this->assertStringContainsString('Nominal tidak cocok', $notification->data['body']);
    }

    public function test_the_inbox_lists_notifications_with_an_unread_count(): void
    {
        $user = $this->user();
        $user->notify(new \App\Notifications\PaymentDecided($this->order($user)));

        $this->actingAs($user)
            ->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread', 1)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.type', 'PaymentDecided');
    }

    public function test_one_notification_can_be_marked_read(): void
    {
        $user = $this->user();
        $user->notify(new \App\Notifications\PaymentDecided($this->order($user)));
        $id = $user->notifications()->first()->id;

        $this->actingAs($user)->postJson("/api/notifications/{$id}/read")->assertOk();

        $this->assertSame(0, $user->fresh()->unreadNotifications()->count());
    }

    public function test_mark_all_read_clears_the_badge(): void
    {
        $user = $this->user();
        $user->notify(new \App\Notifications\PaymentDecided($this->order($user)));
        $user->notify(new \App\Notifications\PaymentDecided($this->order($user, 'pro')));

        $this->actingAs($user)->postJson('/api/notifications/read-all')->assertOk();
        $this->assertSame(0, $user->fresh()->unreadNotifications()->count());
    }

    public function test_a_user_cannot_mark_someone_elses_notification_read(): void
    {
        $victim = $this->user();
        $victim->notify(new \App\Notifications\PaymentDecided($this->order($victim)));
        $id = $victim->notifications()->first()->id;

        $this->actingAs($this->user())->postJson("/api/notifications/{$id}/read")->assertNotFound();
        $this->assertSame(1, $victim->fresh()->unreadNotifications()->count());
    }

    public function test_the_unread_endpoint_is_cheap_and_accurate(): void
    {
        $user = $this->user();

        $this->actingAs($user)->getJson('/api/notifications/unread')->assertOk()->assertJsonPath('unread', 0);

        $user->notify(new \App\Notifications\PaymentDecided($this->order($user)));

        $this->actingAs($user)->getJson('/api/notifications/unread')->assertOk()->assertJsonPath('unread', 1);
    }

    /* ---------------------------------------------------------------- #4 --- */

    public function test_approving_an_order_is_audited(): void
    {
        $admin = $this->admin();
        $payment = $this->order($this->user());

        $this->actingAs($admin)->postJson("/api/admin/payments/{$payment->id}/approve")->assertOk();

        $log = AuditLog::query()->where('action', 'payment.approve')->firstOrFail();
        $this->assertSame($admin->id, $log->actor_id);
        $this->assertSame(Payment::class, $log->subject_type);
        $this->assertSame($payment->id, $log->subject_id);
        $this->assertSame(Payment::PENDING, $log->changes['status']['from']);
        $this->assertSame(Payment::PAID, $log->changes['status']['to']);
    }

    public function test_rejecting_an_order_is_audited(): void
    {
        $this->actingAs($this->admin())->postJson('/api/admin/payments/'.$this->order($this->user())->id.'/reject')->assertOk();

        $this->assertDatabaseHas('audit_logs', ['action' => 'payment.reject']);
    }

    public function test_a_double_approve_writes_no_second_audit_row(): void
    {
        $admin = $this->admin();
        $payment = $this->order($this->user());

        $this->actingAs($admin)->postJson("/api/admin/payments/{$payment->id}/approve")->assertOk();
        $this->actingAs($admin)->postJson("/api/admin/payments/{$payment->id}/approve")->assertStatus(409);

        $this->assertSame(1, AuditLog::query()->where('action', 'payment.approve')->count());
    }

    public function test_role_plan_and_grant_changes_are_audited(): void
    {
        $admin = $this->admin();
        $target = $this->user();

        $this->actingAs($admin)->putJson("/api/admin/users/{$target->id}/role", ['role' => 'pro'])->assertOk();
        $this->actingAs($admin)->putJson("/api/admin/users/{$target->id}/plan", ['plan' => 'pro'])->assertOk();
        $this->actingAs($admin)->postJson("/api/admin/users/{$target->id}/credits", ['amount' => 50])->assertOk();

        $this->assertSame('user', AuditLog::query()->where('action', 'user.role')->first()->changes['role']['from']);
        $this->assertSame('pro', AuditLog::query()->where('action', 'user.role')->first()->changes['role']['to']);
        $this->assertSame('free', AuditLog::query()->where('action', 'user.plan')->first()->changes['plan']['from']);
        $this->assertSame(50, AuditLog::query()->where('action', 'user.grant')->first()->changes['amount']);
    }

    public function test_deleting_a_project_and_updating_costs_are_audited(): void
    {
        $admin = $this->admin();
        $user = $this->user();
        $project = $user->projects()->create(['name' => 'Proyek Uji', 'description' => null]);

        $this->actingAs($admin)->deleteJson("/api/admin/projects/{$project->id}")->assertOk();
        $this->actingAs($admin)->putJson('/api/admin/costs', ['costs' => ['generation' => 7]])->assertOk();

        $log = AuditLog::query()->where('action', 'project.delete')->firstOrFail();
        $this->assertSame('Proyek Uji', $log->changes['name']);
        // The subject row is gone; the human-readable description is all that
        // survives, which is exactly why it is stored alongside the id.
        $this->assertStringContainsString('Proyek Uji', $log->description);
        $this->assertSame($project->id, $log->subject_id);

        $this->assertSame(7, AuditLog::query()->where('action', 'costs.update')->first()->changes['costs']['to']['generation']);
    }

    public function test_the_audit_trail_is_admin_only_and_lists_newest_first(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin)->putJson('/api/admin/users/'.$this->user()->id.'/role', ['role' => 'pro'])->assertOk();

        $this->actingAs($admin)
            ->getJson('/api/admin/audit-logs')
            ->assertOk()
            ->assertJsonPath('data.0.action', 'user.role')
            ->assertJsonPath('data.0.actor.id', $admin->id)
            ->assertJsonStructure(['data' => [['id', 'action', 'description', 'changes', 'subject_type', 'subject_id', 'created_at', 'actor']], 'meta']);

        $this->actingAs($this->user())->getJson('/api/admin/audit-logs')->assertForbidden();
    }

    /**
     * Regression: toApi() used $this->changes, which silently resolves to
     * Eloquent's own protected $changes (dirty-attribute tracker) instead of
     * the column, so the API returned "changes": [] for every row.
     */
    public function test_the_audit_trail_api_returns_the_changes_payload(): void
    {
        $admin = $this->admin();
        $target = $this->user();

        $this->actingAs($admin)->putJson("/api/admin/users/{$target->id}/role", ['role' => 'pro'])->assertOk();

        $this->actingAs($admin)
            ->getJson('/api/admin/audit-logs')
            ->assertOk()
            ->assertJsonPath('data.0.changes.role.from', 'user')
            ->assertJsonPath('data.0.changes.role.to', 'pro');
    }

    public function test_the_audit_trail_can_be_filtered_by_action(): void
    {
        $admin = $this->admin();
        $target = $this->user();

        $this->actingAs($admin)->putJson("/api/admin/users/{$target->id}/role", ['role' => 'pro'])->assertOk();
        $this->actingAs($admin)->putJson("/api/admin/users/{$target->id}/plan", ['plan' => 'pro'])->assertOk();

        $this->actingAs($admin)
            ->getJson('/api/admin/audit-logs?action=user.plan')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.action', 'user.plan');
    }
}
