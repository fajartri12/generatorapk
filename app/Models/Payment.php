<?php

namespace App\Models;

use App\Services\PakasirService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use HasFactory;

    public const PENDING = 'pending';
    public const PAID = 'paid';
    public const REJECTED = 'rejected';
    public const CANCELLED = 'cancelled';
    public const EXPIRED = 'expired';

    /** Which rail an order belongs to. Gateway orders settle by webhook, not by a human. */
    public const GATEWAY_MANUAL = 'manual';
    public const GATEWAY_PAKASIR = 'pakasir';

    /** Every status the admin review queue can filter on. */
    public const STATUSES = [self::PENDING, self::PAID, self::REJECTED, self::CANCELLED, self::EXPIRED];

    protected $fillable = [
        'code',
        'user_id',
        'package',
        'credits',
        'amount',
        'status',
        'gateway',
        'gateway_txn_id',
        'gateway_method',
        'gateway_is_sandbox',
        'transfer_reference',
        'proof_path',
        'proof_uploaded_at',
        'proof_size',
        'note',
        'admin_note',
        'reviewed_by',
        'submitted_at',
        'expires_at',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'credits' => 'integer',
            'amount' => 'integer',
            'proof_size' => 'integer',
            'gateway_is_sandbox' => 'boolean',
            'submitted_at' => 'datetime',
            'expires_at' => 'datetime',
            'proof_uploaded_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** The admin who reviewed it. */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * Only a pending order can be acted on. An order past its deadline is stale
     * even if the scheduled command has not run yet, so it already reads as
     * closed here — the UI and the API agree without waiting for the cron.
     */
    public function isOpen(): bool
    {
        return $this->status === self::PENDING && ! $this->isExpired();
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    /**
     * The status to show for a pending-but-overdue order. A real expiry is only
     * written by the scheduled command, so this keeps the UI honest in between.
     */
    public function effectiveStatus(): string
    {
        return $this->status === self::PENDING && $this->isExpired() ? self::EXPIRED : $this->status;
    }

    /** Hours left before the deadline, floored at zero. */
    public function hoursRemaining(): int
    {
        if ($this->expires_at === null) {
            return (int) config('md-generator.payment_expiry_hours', 24);
        }

        return max(0, (int) ceil(now()->diffInHours($this->expires_at, false)));
    }

    public function hasProof(): bool
    {
        return filled($this->proof_path);
    }

    /** True when the money went through a payment gateway rather than a transfer. */
    public function isGateway(): bool
    {
        return $this->gateway !== self::GATEWAY_MANUAL;
    }

    /** Package metadata (label, credits, price) from config. */
    public function packageInfo(): ?array
    {
        return config("md-generator.packages.{$this->package}");
    }

    /** Invoice number, e.g. MD-20260927-0007. */
    public static function makeCode(): string
    {
        return 'MD-'.now()->format('Ymd').'-'.str_pad((string) random_int(1, 9999), 4, '0', STR_PAD_LEFT);
    }

    public function toApi(): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'package' => $this->package,
            'package_label' => $this->packageInfo()['label'] ?? $this->package,
            'credits' => $this->credits,
            'amount' => $this->amount,
            'status' => $this->effectiveStatus(),
            'gateway' => $this->gateway,
            'gateway_is_sandbox' => $this->gateway_is_sandbox,
            'gateway_method' => $this->gateway_method,
            // Tautan bayar dibangun di sini supaya UI tidak perlu tahu host
            // gateway, yang bisa berubah tanpa deploy frontend.
            'payment_url' => $this->gateway_txn_id
                ? app(PakasirService::class)->paymentUrl($this->gateway_txn_id)
                : null,
            'transfer_reference' => $this->transfer_reference,
            'proof' => $this->hasProof(),
            'proof_size' => $this->proof_size,
            'proof_uploaded_at' => $this->proof_uploaded_at,
            'note' => $this->note,
            'admin_note' => $this->admin_note,
            'submitted_at' => $this->submitted_at,
            'expires_at' => $this->expires_at,
            'hours_remaining' => $this->status === self::PENDING ? $this->hoursRemaining() : null,
            'reviewed_at' => $this->reviewed_at,
            'created_at' => $this->created_at,
            'user' => $this->relationLoaded('user') ? [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
            ] : null,
        ];
    }
}
