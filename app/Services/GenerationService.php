<?php

namespace App\Services;

use App\Exceptions\InsufficientCreditsException;
use App\Exceptions\UnsupportedDocumentTypeException;
use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\Generation;
use App\Models\Project;
use App\Models\User;
use App\Services\AI\AIService;
use App\Services\AI\Prompts\PromptTemplate;
use Illuminate\Support\Facades\DB;

/**
 * Orchestrates one AI generation end to end (AGENTS.md §11 + §13):
 *
 *   verify balance → show cost → create Generation → debit atomically →
 *   call AIService → append DocumentVersion (never overwrite) → mark ready →
 *   record usage; on failure mark failed, preserve input, refund.
 *
 * `queue()` reserves the credits and returns immediately; the heavy call runs
 * in RunGenerationJob so the HTTP request never sits open for a minute
 * (AGENTS.md §24). `run()` performs the work and is safe to re-run.
 */
final class GenerationService
{
    public function __construct(
        private readonly AIService $ai,
        private readonly CreditService $credits,
    ) {}

    /**
     * Reserve credits and hand the actual work to the queue.
     *
     * @param  array<string, mixed>  $input
     */
    public function queue(User $user, Project $project, string $documentType, array $input = []): Generation
    {
        $cost = $this->authorize($user, $documentType);
        $generation = $this->reserve($user, $project, $documentType, $input, $cost);

        \App\Jobs\RunGenerationJob::dispatch($generation->id);

        return $generation;
    }

    /**
     * Run the generation inline and return once it is finished. Kept for
     * callers that genuinely want to block (tests, console).
     *
     * @param  array<string, mixed>  $input
     */
    public function generate(User $user, Project $project, string $documentType, array $input = []): Generation
    {
        $cost = $this->authorize($user, $documentType);
        $generation = $this->reserve($user, $project, $documentType, $input, $cost);

        return $this->run($generation);
    }

    /**
     * Validate the request and return the credit cost for it. The balance is
     * read while holding the wallet row lock, so this check cannot pass and
     * then be undercut by a concurrent debit.
     */
    private function authorize(User $user, string $documentType): int
    {
        if (! PromptTemplate::supports($documentType)) {
            throw new UnsupportedDocumentTypeException($documentType);
        }

        $cost = $this->credits->costFor($documentType);
        $balance = $this->credits->lockedBalance($user);

        if ($balance < $cost) {
            throw new InsufficientCreditsException($cost, $balance);
        }

        return $cost;
    }

    /**
     * Create the Generation row and debit the wallet atomically.
     *
     * The row and the debit share one transaction so a rejected debit leaves
     * no orphan generation behind (P0-1). The wallet row lock inside debit()
     * serialises concurrent requests, so the balance check here is the single
     * source of truth even under a race.
     *
     * @param  array<string, mixed>  $input
     */
    private function reserve(User $user, Project $project, string $documentType, array $input, int $cost): Generation
    {
        return DB::transaction(function () use ($user, $project, $documentType, $input, $cost) {
            $document = Document::firstOrCreate(
                ['project_id' => $project->id, 'type' => $documentType],
                ['title' => PromptTemplate::title($documentType), 'status' => 'draft'],
            );

            $generation = Generation::create([
                'user_id' => $user->id,
                'project_id' => $project->id,
                'document_id' => $document->id,
                'tool' => $documentType,
                'document_type' => $documentType,
                'status' => Generation::PENDING,
                'stage' => Generation::STAGE_QUEUED,
                'prompt_version' => PromptTemplate::version($documentType),
                'provider' => config('ai.default', 'mock'),
                'model' => '',
                'input' => $input,
                'context_snapshot' => $this->ai->contextFor($project),
                'credits_used' => $cost,
            ]);

            // Reserve credits before doing the work. A throw here rolls the
            // Generation insert back with it.
            $this->credits->debit($user, $cost, $generation, "Generasi {$documentType}");

            return $generation;
        });
    }

    /**
     * Do the actual work. Called by the job, or inline by `generate()`.
     */
    public function run(Generation $generation): Generation
    {
        // A previous attempt already finished, or the user cancelled it.
        if (in_array($generation->status, [Generation::COMPLETED, Generation::CANCELLED], true)) {
            return $generation;
        }

        $user = $generation->user;
        $cost = $generation->credits_used;
        $documentType = $generation->document_type;

        $generation->update(['status' => Generation::RUNNING, 'stage' => Generation::STAGE_CONTEXT]);

        try {
            $project = $generation->project;

            if (! $project) {
                throw new \RuntimeException('Proyek sudah tidak ada.');
            }

            $generation->update(['stage' => Generation::STAGE_MODEL]);

            $response = $this->ai->generate($documentType, $project, $generation->input ?? []);

            // The user may have cancelled while the model was answering. The
            // credits are already back, so discard the output.
            $generation->refresh();
            if ($generation->status === Generation::CANCELLED) {
                return $generation;
            }

            $generation->update(['stage' => Generation::STAGE_SAVING]);

            $this->appendVersion($generation->document, $generation, $response->content, PromptTemplate::version($documentType), $response->model);

            $generation->update([
                'status' => Generation::COMPLETED,
                'stage' => Generation::STAGE_DONE,
                'output' => $response->content,
                'provider' => $response->provider,
                'model' => $response->model,
                'duration_ms' => $response->durationMs,
            ]);

            return $generation;
        } catch (\Throwable $e) {
            $generation->update([
                'status' => Generation::FAILED,
                'stage' => Generation::STAGE_FAILED,
                'error' => $e->getMessage(),
            ]);

            $this->credits->refund($user, $cost, $generation, "Refund generasi {$documentType} gagal");

            throw $e;
        }
    }

    private function appendVersion(Document $document, Generation $generation, string $content, ?string $promptVersion, ?string $model): DocumentVersion
    {
        return DB::transaction(function () use ($document, $generation, $content, $promptVersion, $model) {
            $next = $document->current_version + 1;

            $version = $document->versions()->create([
                'version' => $next,
                'content' => $content,
                'author' => 'ai',
                'generation_id' => $generation->id,
                'prompt_version' => $promptVersion,
                'model' => $model,
                'change_note' => "Generasi {$document->type} v{$next}",
            ]);

            $document->update([
                'current_version' => $next,
                'status' => 'ready',
            ]);

            return $version;
        });
    }
}
