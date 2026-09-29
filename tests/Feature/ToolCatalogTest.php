<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Services\AI\Prompts\PromptTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Tools that previously shipped as "Segera" placeholders now have real
 * generators. Batch 1 (2026-09-26): Development Prompt, Design System, Figma
 * Prompt, User Flow, Tech Stack Architect. Batch 2 (2026-09-26): User Persona,
 * Test Plan, Security Review, UX Writing.
 *
 * These tests guard the wiring that is easy to break later: every advertised
 * tool type must have a prompt, a cost, and be runnable end to end.
 */
class ToolCatalogTest extends TestCase
{
    use RefreshDatabase;

    /** The five generators added in batch 1. */
    private const NEW_TYPES = ['tech_stack', 'user_flow', 'design_system', 'figma_prompt', 'dev_prompt'];

    /** The four generators added in batch 2. */
    private const BATCH_2_TYPES = ['personas', 'test_plan', 'security_review', 'microcopy'];

    /** Every generator that shipped after the original nine-stage catalogue. */
    private const ALL_EXTRA_TYPES = [...self::NEW_TYPES, ...self::BATCH_2_TYPES, 'user_stories', 'tasks_md', 'readme_md'];

    private function fundedUser(int $balance = 500): User
    {
        $user = User::factory()->create();
        $user->wallet()->update(['balance' => $balance]);

        return $user;
    }

    public function test_every_new_tool_type_has_a_prompt_template(): void
    {
        foreach (self::ALL_EXTRA_TYPES as $type) {
            $this->assertTrue(
                PromptTemplate::supports($type),
                "PromptTemplate is missing a template for '{$type}'.",
            );

            $template = PromptTemplate::get($type);

            // A template with no system or user prompt would generate nothing.
            $this->assertNotSame('', trim($template['system']), "Empty system prompt for '{$type}'.");
            $this->assertNotSame('', trim($template['user']), "Empty user prompt for '{$type}'.");
            $this->assertNotSame(ucfirst($type), $template['title'], "Missing title for '{$type}'.");
        }
    }

    public function test_every_new_tool_type_has_a_credit_cost(): void
    {
        $costs = config('md-generator.costs');

        foreach (self::ALL_EXTRA_TYPES as $type) {
            $this->assertArrayHasKey($type, $costs, "config('md-generator.costs') is missing '{$type}'.");
            $this->assertGreaterThan(0, $costs[$type], "'{$type}' must cost at least one credit.");
        }
    }

    /**
     * The cost table is what the frontend reads to decide a tool is runnable.
     * A documented tool without a cost would render as "Segera" forever.
     */
    public function test_the_cost_table_and_prompt_templates_stay_in_sync(): void
    {
        $costs = array_keys(config('md-generator.costs'));

        foreach ($costs as $type) {
            $this->assertTrue(
                PromptTemplate::supports($type),
                "Cost table lists '{$type}' but there is no prompt template for it.",
            );
        }
    }

    public function test_each_new_generator_runs_end_to_end(): void
    {
        // The queue runs inline under the testing config (QUEUE_CONNECTION=sync).
        config()->set('ai.default', 'mock');

        foreach (self::ALL_EXTRA_TYPES as $type) {
            $user = $this->fundedUser();
            $project = Project::factory()->for($user)->create();

            $this->actingAs($user)->postJson('/api/generations', [
                'project_id' => $project->id,
                'document_type' => $type,
            ])->assertCreated();

            $this->assertDatabaseHas('documents', ['project_id' => $project->id, 'type' => $type]);
            $this->assertSame(500 - config("md-generator.costs.{$type}"), $user->wallet()->fresh()->balance);
        }
    }

    /**
     * Downstream prompts read earlier documents by name from the context bag, so
     * a missing key silently renders as "—" instead of the real content.
     */
    public function test_the_context_bag_exposes_every_new_document_type(): void
    {
        $user = $this->fundedUser();
        $project = Project::factory()->for($user)->create();

        $context = app(\App\Services\AI\AIService::class)->contextFor($project);

        foreach ([...self::ALL_EXTRA_TYPES, 'tasks_md', 'agents_md'] as $type) {
            $this->assertArrayHasKey($type, $context, "Context bag is missing '{$type}'.");
        }
    }

    /**
     * Batch 2 prompts cite earlier batch 2 output (security cites SDD/API,
     * microcopy cites UI/UX and user flow). Those placeholders must resolve.
     */
    public function test_batch_2_prompts_only_use_known_placeholders(): void
    {
        $known = [
            'name', 'summary', 'audience', 'problem', 'features', 'business_goal', 'tech_stack', 'context',
            ...self::ALL_EXTRA_TYPES, 'brief', 'prd', 'srs', 'sdd', 'database', 'api', 'ui_ux', 'wbs',
        ];

        foreach (self::BATCH_2_TYPES as $type) {
            $template = PromptTemplate::get($type);
            preg_match_all('/\{(\w+)\}/', $template['system'].' '.$template['user'], $matches);

            foreach (array_unique($matches[1]) as $placeholder) {
                $this->assertContains(
                    $placeholder,
                    $known,
                    "Template '{$type}' references unknown placeholder {{$placeholder}}.",
                );
            }
        }
    }
}
