<?php

namespace Tests\Feature;

use App\Models\Generation;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GenerationFlowTest extends TestCase
{
    use RefreshDatabase;

    private function fundedUser(int $balance = 100): User
    {
        $user = User::factory()->create();
        $user->wallet()->update(['balance' => $balance]);

        return $user;
    }

    public function test_generation_requires_authentication(): void
    {
        $this->postJson('/api/generations', ['project_id' => 1, 'document_type' => 'prd'])
            ->assertUnauthorized();
    }

    public function test_generation_rejects_a_project_owned_by_someone_else(): void
    {
        $owner = $this->fundedUser();
        $project = Project::factory()->for($owner)->create();
        $intruder = $this->fundedUser();

        $this->actingAs($intruder)
            ->postJson('/api/generations', ['project_id' => $project->id, 'document_type' => 'prd'])
            ->assertForbidden();
    }

    public function test_generation_rejects_an_unsupported_document_type(): void
    {
        $user = $this->fundedUser();
        $project = Project::factory()->for($user)->create();

        $this->actingAs($user)
            ->postJson('/api/generations', ['project_id' => $project->id, 'document_type' => 'not_a_tool'])
            ->assertStatus(422);

        // The unsupported request must not create anything or spend credits.
        $this->assertSame(100, $user->wallet()->fresh()->balance);
        $this->assertDatabaseCount('generations', 0);
    }

    public function test_generation_returns_402_without_spending_when_balance_is_short(): void
    {
        $user = $this->fundedUser(1);
        $project = Project::factory()->for($user)->create();

        $this->actingAs($user)
            ->postJson('/api/generations', ['project_id' => $project->id, 'document_type' => 'prd'])
            ->assertStatus(402)
            ->assertJsonPath('balance', 1);

        // P0-1: a rejected reserve leaves no orphan Generation row behind.
        $this->assertSame(1, $user->wallet()->fresh()->balance);
        $this->assertDatabaseCount('generations', 0);
    }

    public function test_a_successful_generation_debits_credits_and_appends_a_version(): void
    {
        // The queue runs inline under the testing config (QUEUE_CONNECTION=sync).
        config()->set('ai.default', 'mock');

        $user = $this->fundedUser(100);
        $project = Project::factory()->for($user)->create();
        $cost = config('md-generator.costs.prd');

        $response = $this->actingAs($user)->postJson('/api/generations', [
            'project_id' => $project->id,
            'document_type' => 'prd',
        ])->assertCreated();

        $generationId = $response->json('data.id');
        $generation = Generation::findOrFail($generationId);

        $this->assertSame(Generation::COMPLETED, $generation->status);
        $this->assertSame(100 - $cost, $user->wallet()->fresh()->balance);

        // The output is stored as a version, never overwriting anything.
        $this->assertDatabaseHas('document_versions', [
            'document_id' => $generation->document_id,
            'version' => 1,
            'author' => 'ai',
        ]);
        $this->assertSame(1, $generation->document->fresh()->current_version);
    }

    public function test_a_failed_generation_refunds_the_credits(): void
    {
        // Point the provider at a key-less gateway so the call fails fast.
        config()->set('ai.default', 'gateway');
        config()->set('ai.providers.gateway.key', '');

        $user = $this->fundedUser(100);
        $project = Project::factory()->for($user)->create();
        $cost = config('md-generator.costs.prd');

        // The job runs inline and rethrows; the HTTP layer is not part of this
        // assertion — what matters is the wallet and generation state.
        try {
            $this->actingAs($user)->postJson('/api/generations', [
                'project_id' => $project->id,
                'document_type' => 'prd',
            ]);
        } catch (\Throwable $e) {
            // swallow: the failure is the point of the test
        }

        $this->assertSame(100, $user->wallet()->fresh()->balance, 'credits must be refunded');
        $this->assertSame(Generation::FAILED, Generation::firstOrFail()->status);
        $this->assertDatabaseHas('credit_transactions', ['type' => 'refund']);
    }

    public function test_cancel_refunds_an_unfinished_generation(): void
    {
        $user = $this->fundedUser(50);
        $project = Project::factory()->for($user)->create();

        $generation = Generation::factory()->for($user)->for($project)->create([
            'status' => Generation::RUNNING,
            'credits_used' => 20,
        ]);
        app(\App\Services\CreditService::class)->debit($user, 20, $generation);

        $this->actingAs($user)
            ->postJson("/api/generations/{$generation->id}/cancel")
            ->assertOk();

        $this->assertSame(Generation::CANCELLED, $generation->fresh()->status);
        $this->assertSame(50, $user->wallet()->fresh()->balance);
    }

    public function test_a_user_cannot_cancel_someone_elses_generation(): void
    {
        $owner = User::factory()->create();
        $generation = Generation::factory()->for($owner)->create();

        $this->actingAs($this->fundedUser())
            ->postJson("/api/generations/{$generation->id}/cancel")
            ->assertForbidden();
    }
}
