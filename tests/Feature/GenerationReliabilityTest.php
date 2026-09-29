<?php

namespace Tests\Feature;

use App\Jobs\RunGenerationJob;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

/**
 * Guards the two reliability findings from the 2026-09-26 report:
 *
 *  P1-6: the queue's `retry_after` must outlast the job timeout, otherwise a
 *        legitimate long-running generation gets claimed again and runs twice.
 *  P1-7: POST /generations must be rate limited, because every call spends
 *        external AI provider quota.
 */
class GenerationReliabilityTest extends TestCase
{
    use RefreshDatabase;

    private function fundedUser(int $balance = 100): User
    {
        $user = User::factory()->create();
        $user->wallet()->update(['balance' => $balance]);

        return $user;
    }

    /**
     * Per-minute budget for the plan the test user actually has. Free accounts
     * get the tighter ceiling, so the limit must be read from that key.
     */
    private function limitFor(string $plan = 'free'): int
    {
        $key = $plan === 'pro'
            ? 'md-generator.limits.generations_per_minute'
            : 'md-generator.limits.generations_per_minute_free';

        return (int) config($key);
    }

    protected function setUp(): void
    {
        parent::setUp();

        // The queue runs inline under the testing config (QUEUE_CONNECTION=sync),
        // so pin the provider to mock or these tests would call the real gateway.
        config()->set('ai.default', 'mock');
    }

    public function test_the_queue_reclaim_window_outlasts_the_generation_job_timeout(): void
    {
        $job = new RunGenerationJob(1);

        $retryAfter = (int) config('queue.connections.database.retry_after');

        $this->assertGreaterThan(
            $job->timeout,
            $retryAfter,
            'DB_QUEUE_RETRY_AFTER must exceed RunGenerationJob::$timeout or a running job is reclaimed and run twice.',
        );

        // The whole point of the margin: the job may sit inside an AI HTTP call
        // for up to config('ai.timeout'), so the reclaim window has to cover
        // both the job budget and that call.
        $this->assertGreaterThan(
            $job->timeout + (int) config('ai.timeout'),
            $retryAfter,
            'DB_QUEUE_RETRY_AFTER must also exceed the job timeout plus the AI HTTP timeout.',
        );
    }

    public function test_the_default_retry_after_is_set_even_when_the_env_var_is_absent(): void
    {
        // Reading the shipped config with no DB_QUEUE_RETRY_AFTER set must not
        // fall back to Laravel's 90s default, which is below the job timeout.
        $this->assertNotSame(90, (int) config('queue.connections.database.retry_after'));
    }

    public function test_generation_is_rate_limited_per_user(): void
    {
        $this->travelTo(now());

        $user = $this->fundedUser(100000);
        $project = Project::factory()->for($user)->create();

        $limit = $this->limitFor();

        for ($i = 0; $i < $limit; $i++) {
            $this->actingAs($user)
                ->postJson('/api/generations', ['project_id' => $project->id, 'document_type' => 'prd'])
                ->assertCreated();
        }

        // Request number `limit + 1` is refused before any work is queued.
        $this->actingAs($user)
            ->postJson('/api/generations', ['project_id' => $project->id, 'document_type' => 'prd'])
            ->assertStatus(429);

        RateLimiter::clear('user:'.$user->id);
    }

    public function test_the_rate_limit_is_per_user_not_global(): void
    {
        $this->travelTo(now());

        $first = $this->fundedUser(100000);
        $second = $this->fundedUser(100000);

        $limit = $this->limitFor();

        $projectA = Project::factory()->for($first)->create();
        $projectB = Project::factory()->for($second)->create();

        for ($i = 0; $i < $limit; $i++) {
            $this->actingAs($first)
                ->postJson('/api/generations', ['project_id' => $projectA->id, 'document_type' => 'prd'])
                ->assertCreated();
        }

        $this->actingAs($first)
            ->postJson('/api/generations', ['project_id' => $projectA->id, 'document_type' => 'prd'])
            ->assertStatus(429);

        // A different account still has its own budget.
        $this->actingAs($second)
            ->postJson('/api/generations', ['project_id' => $projectB->id, 'document_type' => 'prd'])
            ->assertCreated();

        RateLimiter::clear('user:'.$first->id);
        RateLimiter::clear('user:'.$second->id);
    }

    public function test_a_throttled_request_spends_no_credits(): void
    {
        $this->travelTo(now());

        $user = $this->fundedUser(100000);
        $project = Project::factory()->for($user)->create();

        $limit = $this->limitFor();

        for ($i = 0; $i < $limit; $i++) {
            $this->actingAs($user)
                ->postJson('/api/generations', ['project_id' => $project->id, 'document_type' => 'prd'])
                ->assertCreated();
        }

        $balanceBefore = $user->wallet()->fresh()->balance;
        $generationsBefore = $user->generations()->count();

        $this->actingAs($user)
            ->postJson('/api/generations', ['project_id' => $project->id, 'document_type' => 'prd'])
            ->assertStatus(429);

        // A rejected request must not debit (P1-7 is a cost control, not a
        // load control) and must not leave a generation behind.
        $this->assertSame($balanceBefore, $user->wallet()->fresh()->balance);
        $this->assertSame($generationsBefore, $user->generations()->count());

        RateLimiter::clear('user:'.$user->id);
    }

    public function test_a_pro_account_gets_a_higher_rate_limit_than_free(): void
    {
        $this->travelTo(now());

        $freeLimit = $this->limitFor('free');
        $proLimit = $this->limitFor('pro');

        // The plan column has to buy something. If both budgets were equal,
        // "paket akun naik ke Pro otomatis" would be a label with no effect.
        $this->assertGreaterThan($freeLimit, $proLimit);

        $user = $this->fundedUser(100000);
        $user->wallet()->update(['plan' => 'pro']);
        $project = Project::factory()->for($user)->create();

        for ($i = 0; $i < $freeLimit; $i++) {
            $this->actingAs($user)
                ->postJson('/api/generations', ['project_id' => $project->id, 'document_type' => 'prd'])
                ->assertCreated();
        }

        // Past the free ceiling and still accepted, because the wallet is Pro.
        $this->actingAs($user)
            ->postJson('/api/generations', ['project_id' => $project->id, 'document_type' => 'prd'])
            ->assertCreated();

        RateLimiter::clear('user:'.$user->id);
    }
}
