<?php

namespace App\Services;

use App\Exceptions\InsufficientCreditsException;
use App\Models\CreditTransaction;
use App\Models\CreditWallet;
use App\Models\Generation;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Owns every mutation of a credit balance. Nothing else may write to
 * credit_wallets (AGENTS.md §11).
 *
 * Guarantees:
 *  - balance never goes negative, even under concurrent requests
 *  - every change is explained by an append-only ledger row
 *  - failures are refunded according to policy
 */
final class CreditService
{
    /** Config key that holds the admin cost overrides in the settings table. */
    private const COSTS_SETTING_KEY = 'credit_costs';

    /** Effective cost table: DB overrides (if any) on top of the config defaults. */
    public function costs(): array
    {
        $overrides = Setting::get(self::COSTS_SETTING_KEY, []);

        return array_merge(config('md-generator.costs'), is_array($overrides) ? $overrides : []);
    }

    /**
     * Persist an admin cost override. These live in the database (not the
     * cache) so they survive a cache clear and are never silently reverted.
     */
    public function setCosts(array $costs): array
    {
        $merged = array_merge(config('md-generator.costs'), $costs);
        Setting::set(self::COSTS_SETTING_KEY, $merged);

        return $merged;
    }

    public function costFor(string $documentType): int
    {
        return (int) ($this->costs()[$documentType] ?? 5);
    }

    /**
     * @return array{balance: int, plan: string}
     */
    public function summary(User $user): array
    {
        $wallet = $user->wallet();

        return ['balance' => $wallet->balance, 'plan' => $wallet->plan];
    }

    /**
     * Authoritative balance check that takes the same row lock debit() takes,
     * so a caller can never pass this check and then lose the race to debit
     * (P0-1). Returns the balance observed while holding the lock.
     */
    public function lockedBalance(User $user): int
    {
        return DB::transaction(function () use ($user) {
            return (int) CreditWallet::query()
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->value('balance');
        });
    }

    /**
     * Atomically reserve credits before a generation runs. Locks the wallet row
     * for the duration of the transaction so two simultaneous requests cannot
     * both pass the balance check (AGENTS.md §11).
     */
    public function debit(User $user, int $amount, ?Generation $generation = null, ?string $description = null): CreditTransaction
    {
        return DB::transaction(function () use ($user, $amount, $generation, $description) {
            $wallet = CreditWallet::query()
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($wallet->balance < $amount) {
                throw new InsufficientCreditsException($amount, $wallet->balance);
            }

            $wallet->balance -= $amount;
            $wallet->save();

            return $wallet->transactions()->create([
                'user_id' => $user->id,
                'generation_id' => $generation?->id,
                'type' => CreditTransaction::DEBIT,
                'amount' => -$amount,
                'balance_after' => $wallet->balance,
                'description' => $description ?? 'Pemakaian kredit',
            ]);
        });
    }

    /**
     * Give credits back after a failed generation. Refunding twice for the same
     * generation is a bug we can detect, so we refuse to do it.
     */
    public function refund(User $user, int $amount, ?Generation $generation = null, ?string $description = null): ?CreditTransaction
    {
        if (! config('md-generator.refund_failed_generation', true)) {
            return null;
        }

        return DB::transaction(function () use ($user, $amount, $generation, $description) {
            $wallet = CreditWallet::query()
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($generation && $wallet->transactions()->where('generation_id', $generation->id)->where('type', CreditTransaction::REFUND)->exists()) {
                return null;
            }

            $wallet->balance += $amount;
            $wallet->save();

            return $wallet->transactions()->create([
                'user_id' => $user->id,
                'generation_id' => $generation?->id,
                'type' => CreditTransaction::REFUND,
                'amount' => $amount,
                'balance_after' => $wallet->balance,
                'description' => $description ?? 'Refund generasi gagal',
            ]);
        });
    }

    /**
     * Used by registration and the seeder. Not exposed through any API route —
     * credits are only granted server-side.
     */
    public function grant(User $user, int $amount, ?string $description = null): CreditTransaction
    {
        return DB::transaction(function () use ($user, $amount, $description) {
            $wallet = CreditWallet::query()
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->firstOrFail();

            $wallet->balance += $amount;
            $wallet->save();

            return $wallet->transactions()->create([
                'user_id' => $user->id,
                'type' => CreditTransaction::GRANT,
                'amount' => $amount,
                'balance_after' => $wallet->balance,
                'description' => $description ?? 'Kredit awal',
            ]);
        });
    }

    /**
     * Admin correction: add OR remove credits outside the generation flow.
     *
     * grant() only ever adds, which leaves no way to undo a mistyped grant or a
     * misused balance without opening the database. The ledger records the sign
     * (debit for a reduction), so history stays readable after a correction.
     *
     * Throws rather than clamping: silently turning "-50" into "-balance" would
     * make the audit row and the ledger disagree about what happened.
     */
    public function adjust(User $user, int $amount, string $description): CreditTransaction
    {
        return DB::transaction(function () use ($user, $amount, $description) {
            $wallet = CreditWallet::query()
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($wallet->balance + $amount < 0) {
                throw new InsufficientCreditsException(-$amount, $wallet->balance);
            }

            $wallet->balance += $amount;
            $wallet->save();

            return $wallet->transactions()->create([
                'user_id' => $user->id,
                'type' => $amount >= 0 ? CreditTransaction::GRANT : CreditTransaction::DEBIT,
                'amount' => $amount,
                'balance_after' => $wallet->balance,
                'description' => $description,
            ]);
        });
    }
}
