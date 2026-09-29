<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CreditWallet extends Model
{
    protected $fillable = [
        'user_id',
        'balance',
        'plan',
    ];

    protected function casts(): array
    {
        return [
            'balance' => 'integer',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<CreditTransaction, $this> */
    public function transactions(): HasMany
    {
        return $this->hasMany(CreditTransaction::class)->orderByDesc('id');
    }
}
