<?php

namespace Tests\Feature;

use App\Exceptions\InsufficientCreditsException;
use App\Models\CreditTransaction;
use App\Models\Generation;
use App\Models\User;
use App\Services\CreditService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The credit ledger is the one thing that must never be wrong: it gates every
 * paid action. These tests pin the guarantees AGENTS.md §11 promises.
 */
class CreditServiceTest extends TestCase
{
    use RefreshDatabase;

    private function user(int $balance = 100): User
    {
        $user = User::factory()->create();
        $user->wallet()->update(['balance' => $balance]);

        return $user;
    }

    public function test_registration_grants_the_starting_balance(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Budi',
            'email' => 'budi@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated();

        $user = User::where('email', 'budi@example.com')->firstOrFail();

        $this->assertSame(config('md-generator.starting_balance'), $user->wallet()->balance);
        $this->assertDatabaseHas('credit_transactions', ['user_id' => $user->id, 'type' => CreditTransaction::GRANT]);
    }

    public function test_debit_reduces_balance_and_writes_a_ledger_row(): void
    {
        $user = $this->user(50);
        $credits = app(CreditService::class);

        $credits->debit($user, 20, null, 'Uji debit');

        $this->assertSame(30, $user->wallet()->fresh()->balance);
        $this->assertDatabaseHas('credit_transactions', [
            'user_id' => $user->id,
            'type' => CreditTransaction::DEBIT,
            'amount' => -20,
            'balance_after' => 30,
        ]);
    }

    public function test_debit_beyond_the_balance_throws_and_changes_nothing(): void
    {
        $user = $this->user(10);

        $this->expectException(InsufficientCreditsException::class);

        try {
            app(CreditService::class)->debit($user, 25);
        } finally {
            // Balance and ledger must be untouched by the rejected debit.
            $this->assertSame(10, $user->wallet()->fresh()->balance);
            $this->assertDatabaseCount('credit_transactions', 0);
        }
    }

    public function test_refund_restores_balance_once(): void
    {
        $user = $this->user(0);
        $credits = app(CreditService::class);
        $generation = Generation::factory()->for($user)->create(['credits_used' => 15]);

        $credits->refund($user, 15, $generation, 'Refund uji');
        // A second refund for the same generation must be a no-op.
        $credits->refund($user, 15, $generation, 'Refund ganda');

        $this->assertSame(15, $user->wallet()->fresh()->balance);
        $this->assertSame(1, $user->wallet()->transactions()->where('type', CreditTransaction::REFUND)->count());
    }

    public function test_cost_overrides_survive_a_cache_clear(): void
    {
        $credits = app(CreditService::class);
        $credits->setCosts(['prd' => 42]);

        $this->assertSame(42, $credits->costFor('prd'));

        // The old cache-backed implementation silently reverted here.
        cache()->flush();

        $this->assertSame(42, app(CreditService::class)->costFor('prd'));
        $this->assertDatabaseHas('settings', ['key' => 'credit_costs']);
    }
}
