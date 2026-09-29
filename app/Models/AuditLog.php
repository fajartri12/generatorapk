<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * One privileged action, recorded for good. Rows are never updated or deleted
 * by the app — this is the answer to "who approved this, and when?".
 */
class AuditLog extends Model
{
    /** Only a creation timestamp; an audit row is immutable by design. */
    public const UPDATED_AT = null;

    protected $fillable = [
        'actor_id',
        'action',
        'subject_type',
        'subject_id',
        'description',
        'changes',
        'ip',
    ];

    protected function casts(): array
    {
        return [
            'changes' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    /** @return MorphTo<Model, $this> */
    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    public function toApi(): array
    {
        return [
            'id' => $this->id,
            'action' => $this->action,
            'description' => $this->description,
            // getAttribute(), not $this->changes: Eloquent declares its own
            // protected $changes (the dirty-attribute tracker), so the property
            // syntax resolves to that inside this class body and silently
            // returns [] for every retrieved row.
            'changes' => $this->getAttribute('changes'),
            'subject_type' => $this->subject_type ? class_basename($this->subject_type) : null,
            'subject_id' => $this->subject_id,
            'ip' => $this->ip,
            'created_at' => $this->created_at,
            'actor' => $this->relationLoaded('actor') && $this->actor ? [
                'id' => $this->actor->id,
                'name' => $this->actor->name,
                'email' => $this->actor->email,
            ] : null,
        ];
    }
}
