<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

/**
 * The single writer of audit_logs.
 *
 * Money and privilege decisions (approve/reject, role/plan changes, credit
 * grants, deletions, cost overrides) must leave a trail that survives the
 * request: a structured application log line plus one immutable audit row.
 *
 * Deliberately NOT queued — an audit entry that vanishes because the queue
 * worker was down would defeat the point of having one. The insert is cheap.
 */
final class AuditLogger
{
    /**
     * Record a privileged action. Never throws: auditing must not take the
     * main flow down with it (a failed audit row is logged, not fatal).
     */
    public function record(
        ?User $actor,
        string $action,
        string $description,
        ?Model $subject = null,
        array $changes = [],
        ?string $ip = null,
    ): void {
        try {
            AuditLog::create([
                'actor_id' => $actor?->id,
                'action' => $action,
                'subject_type' => $subject !== null ? $subject::class : null,
                'subject_id' => $subject?->getKey(),
                'description' => $description,
                'changes' => $changes !== [] ? $changes : null,
                'ip' => $ip,
            ]);
        } catch (\Throwable $e) {
            Log::error('audit.write_failed', ['action' => $action, 'error' => $e->getMessage()]);
        }

        // Structured log line, so the trail also exists outside the database.
        Log::info('audit', [
            'action' => $action,
            'actor_id' => $actor?->id,
            'subject' => $subject !== null ? $subject::class.'#'.$subject->getKey() : null,
            'changes' => $changes,
        ]);
    }
}
