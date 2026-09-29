<?php

namespace App\Jobs;

use App\Models\Generation;
use App\Services\GenerationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Runs one generation outside the HTTP request so the browser can poll for
 * progress instead of holding a connection open for a minute (AGENTS.md §24).
 *
 * `$tries = 1` on purpose: GenerationService already marks the run failed and
 * refunds the credits, so a queue retry would double-charge the story.
 */
class RunGenerationJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 150;

    public bool $failOnTimeout = true;

    public function __construct(public readonly int $generationId) {}

    public function handle(GenerationService $generations): void
    {
        $generation = Generation::find($this->generationId);

        if (! $generation) {
            return;
        }

        $generations->run($generation);
    }
}
