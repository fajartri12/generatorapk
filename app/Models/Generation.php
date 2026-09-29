<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Generation extends Model
{
    use HasFactory;

    public const PENDING = 'pending';
    public const RUNNING = 'running';
    public const COMPLETED = 'completed';
    public const FAILED = 'failed';
    public const CANCELLED = 'cancelled';

    // Progress stages, advanced server-side as the work moves along.
    public const STAGE_QUEUED = 'queued';
    public const STAGE_CONTEXT = 'context';
    public const STAGE_MODEL = 'model';
    public const STAGE_SAVING = 'saving';
    public const STAGE_DONE = 'done';
    public const STAGE_FAILED = 'failed';

    protected $fillable = [
        'user_id',
        'project_id',
        'document_id',
        'tool',
        'document_type',
        'status',
        'stage',
        'prompt_version',
        'provider',
        'model',
        'input',
        'context_snapshot',
        'output',
        'error',
        'credits_used',
        'duration_ms',
        'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'input' => 'array',
            'context_snapshot' => 'array',
            'cancelled_at' => 'datetime',
        ];
    }

    /**
     * Mark the generation cancelled and refund the reserved credits.
     * Safe to call more than once — the refund is idempotent.
     */
    public function cancel(): void
    {
        if (in_array($this->status, [self::COMPLETED, self::CANCELLED], true)) {
            return;
        }

        $this->update([
            'status' => self::CANCELLED,
            'stage' => self::STAGE_FAILED,
            'cancelled_at' => now(),
        ]);

        app(\App\Services\CreditService::class)->refund(
            $this->user,
            $this->credits_used,
            $this,
            "Refund generasi {$this->document_type} dibatalkan",
        );
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Project, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /** @return BelongsTo<Document, $this> */
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }
}
