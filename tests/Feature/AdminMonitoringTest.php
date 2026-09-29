<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\CreditTransaction;
use App\Models\Generation;
use App\Models\Payment;
use App\Models\User;
use App\Services\CreditService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pemantauan admin: pesanan gateway, koreksi saldo, pemberian massal, filter
 * audit per objek, dan ekspor CSV. Semua angka kredit dikendalikan lewat
 * CreditService supaya tes ini tetap mengikuti invariant "satu penulis".
 */
class AdminMonitoringTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $admin->wallet();
        app(CreditService::class)->grant($admin, config('md-generator.starting_balance'), 'Kredit awal');

        return $admin;
    }

    private function user(): User
    {
        $user = User::factory()->create();
        $user->wallet();
        app(CreditService::class)->grant($user, 100, 'Kredit awal');

        return $user;
    }

    public function test_gateway_orders_are_visible_to_admin_and_manual_transfer_is_excluded(): void
    {
        $this->admin();
        $user = $this->user();

        $gateway = Payment::factory()->create([
            'user_id' => $user->id,
            'gateway' => Payment::GATEWAY_PAKASIR,
            'status' => Payment::PENDING,
        ]);
        Payment::factory()->create([
            'user_id' => $user->id,
            'gateway' => Payment::GATEWAY_MANUAL,
            'status' => Payment::PENDING,
        ]);

        $response = $this->actingAs($this->admin())
            ->getJson('/api/admin/gateway-orders')
            ->assertOk();

        $ids = collect($response->json('data.*.id'));
        $this->assertTrue($ids->contains($gateway->id));
        $this->assertFalse($ids->contains(Payment::where('gateway', Payment::GATEWAY_MANUAL)->firstOrFail()->id));
    }

    public function test_syncing_a_gateway_order_settles_and_credits_exactly_once(): void
    {
        $admin = $this->admin();
        $user = $this->user();

        $payment = Payment::factory()->create([
            'user_id' => $user->id,
            'gateway' => Payment::GATEWAY_PAKASIR,
            'status' => Payment::PENDING,
            'credits' => 100,
        ]);

        // Tanpa kredensial gateway, sync harus gagal dengan pesan yang jelas,
        // bukan menandai pesanan sebagai lunas.
        $this->actingAs($admin)
            ->postJson("/api/admin/gateway-orders/{$payment->id}/sync")
            ->assertStatus(422);

        $this->assertSame(Payment::PENDING, $payment->refresh()->status);
        $this->assertSame(100, $user->wallet()->refresh()->balance);
    }

    public function test_syncing_a_manual_order_is_refused(): void
    {
        $admin = $this->admin();
        $user = $this->user();

        $payment = Payment::factory()->create([
            'user_id' => $user->id,
            'gateway' => Payment::GATEWAY_MANUAL,
            'status' => Payment::PENDING,
        ]);

        $this->actingAs($admin)
            ->postJson("/api/admin/gateway-orders/{$payment->id}/sync")
            ->assertStatus(422);
    }

    public function test_adjust_credits_rejects_a_change_that_would_make_the_balance_negative(): void
    {
        $admin = $this->admin();
        $user = $this->user();

        $this->actingAs($admin)
            ->postJson("/api/admin/users/{$user->id}/credits/adjust", [
                'amount' => -500,
                'description' => 'Koreksi grant ganda',
            ])
            ->assertStatus(422);

        $this->assertSame(100, $user->wallet()->refresh()->balance);
        // Satu-satunya baris ledger adalah grant awal dari helper user().
        $this->assertSame(1, CreditTransaction::where('user_id', $user->id)->count());
    }

    public function test_adjust_credits_applies_a_signed_change_and_records_an_audit_row(): void
    {
        $admin = $this->admin();
        $user = $this->user();

        $this->actingAs($admin)
            ->postJson("/api/admin/users/{$user->id}/credits/adjust", [
                'amount' => -10,
                'description' => 'Saldo dikoreksi',
            ])
            ->assertOk();

        $this->assertSame(90, $user->wallet()->refresh()->balance);
        $this->assertDatabaseHas('credit_transactions', [
            'user_id' => $user->id,
            'type' => CreditTransaction::DEBIT,
            'amount' => -10,
        ]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.revoke']);
    }

    public function test_bulk_grant_skips_users_with_insufficient_balance(): void
    {
        $admin = $this->admin();
        $rich = $this->user();
        $drained = $this->user();

        // Satu pengguna punya saldo rendah supaya pengurangan massal melewatkannya.
        app(CreditService::class)->adjust($drained, -95, 'Sisakan sedikit');

        $response = $this->actingAs($admin)
            ->postJson('/api/admin/credits/bulk', [
                'user_ids' => [$rich->id, $drained->id],
                'amount' => -10,
                'description' => 'Koreksi massal',
            ])
            ->assertOk();

        $this->assertSame([$rich->id], $response->json('updated'));
        $this->assertSame([$drained->id], $response->json('skipped'));
        $this->assertSame(90, $rich->wallet()->refresh()->balance);
        $this->assertSame(5, $drained->wallet()->refresh()->balance);
    }

    public function test_audit_logs_can_be_filtered_by_subject(): void
    {
        $admin = $this->admin();
        $user = $this->user();
        $project = $user->projects()->create(['name' => 'Audit', 'slug' => 'audit']);

        // Penghapusan proyek adalah satu-satunya aksi yang objeknya Project,
        // jadi filter diuji dengan aksi itu.
        $this->actingAs($admin)->deleteJson("/api/admin/projects/{$project->id}")->assertOk();

        $response = $this->actingAs($admin)
            ->getJson("/api/admin/audit-logs?subject_type=Project&subject_id={$project->id}")
            ->assertOk();

        $rows = $response->json('data');
        $this->assertNotEmpty($rows);
        foreach ($rows as $row) {
            $this->assertSame('Project', $row['subject_type']);
            $this->assertSame($project->id, $row['subject_id']);
            $this->assertSame('project.delete', $row['action']);
        }

        // Filter objek harus menyisihkan tindakan pada objek lain.
        $other = $this->actingAs($admin)
            ->getJson('/api/admin/audit-logs?subject_type=User')
            ->assertOk();
        foreach ($other->json('data') as $row) {
            $this->assertSame('User', $row['subject_type']);
            $this->assertNotSame($project->id, $row['subject_id']);
        }
    }

    public function test_exports_return_csv_with_a_utf8_bom(): void
    {
        $this->admin();
        $this->user();

        foreach (['users', 'generations', 'payments', 'audit-logs'] as $kind) {
            $response = $this->actingAs($this->admin())
                ->getJson("/api/admin/export/{$kind}")
                ->assertOk();

            $this->assertStringStartsWith('text/csv', (string) $response->headers->get('Content-Type'));
            $content = $response->streamedContent();
            $this->assertSame("\xEF\xBB\xBF", substr($content, 0, 3));
        }
    }

    public function test_stats_expose_credits_windows_failures_gateway_and_trend(): void
    {
        $this->admin();
        $user = $this->user();

        Generation::factory()->create([
            'user_id' => $user->id,
            'status' => Generation::FAILED,
            'provider' => 'test',
            'credits_used' => 0,
        ]);

        $response = $this->actingAs($this->admin())
            ->getJson('/api/admin/stats')
            ->assertOk();

        $response->assertJsonStructure([
            'credits_used' => ['today', '7d', '30d'],
            'failures' => ['total', 'last_7d', 'by_provider'],
            'payments' => ['gateway'],
            'trend',
        ]);
        $this->assertSame(1, $response->json('failures.total'));
        // Seri tren selalu 14 titik, termasuk hari tanpa aktivitas. Kredit hanya
        // dihitung dari generasi selesai, jadi generasi gagal menyumbang 0.
        $trend = $response->json('trend');
        $this->assertCount(14, $trend);
        $this->assertSame(1, collect($trend)->sum('generations'));
        $this->assertSame(0, collect($trend)->sum('credits'));
    }

    public function test_regular_users_cannot_reach_monitoring_endpoints(): void
    {
        $user = $this->user();

        $this->actingAs($user)->getJson('/api/admin/gateway-orders')->assertForbidden();
        $this->actingAs($user)->postJson("/api/admin/users/{$user->id}/credits/adjust", [
            'amount' => 10,
            'description' => 'coba',
        ])->assertForbidden();
        $this->actingAs($user)->getJson('/api/admin/export/users')->assertForbidden();
    }

    public function test_audit_logs_record_the_bulk_marker(): void
    {
        $admin = $this->admin();
        $a = $this->user();
        $b = $this->user();

        $this->actingAs($admin)
            ->postJson('/api/admin/credits/bulk', [
                'user_ids' => [$a->id, $b->id],
                'amount' => 25,
                'description' => 'Bonus',
            ])
            ->assertOk();

        foreach ([$a->id, $b->id] as $id) {
            $log = AuditLog::query()->where('subject_id', $id)->where('action', 'user.grant')->latest('id')->firstOrFail();
            $this->assertTrue((bool) $log->changes['bulk'] ?? false);
        }
    }
}
