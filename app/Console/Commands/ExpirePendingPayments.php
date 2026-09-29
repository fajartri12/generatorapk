<?php

namespace App\Console\Commands;

use App\Models\Setting;
use App\Services\PaymentService;
use Illuminate\Console\Command;

/**
 * Closes manual-transfer orders that were never paid. Runs on a schedule, but is
 * safe to run by hand: it only touches pending rows past their deadline and never
 * moves credits.
 *
 * Also stamps its last run into settings so the admin panel can tell the
 * difference between "no expired orders" and "the schedule never runs here".
 */
class ExpirePendingPayments extends Command
{
    protected $signature = 'payments:expire';

    protected $description = 'Tandai pesanan transfer yang melewati batas waktu sebagai kedaluwarsa';

    public function handle(PaymentService $payments): int
    {
        $count = $payments->expireStale();

        Setting::set('payments.expire_last_run', ['at' => now()->toIso8601String(), 'count' => $count]);

        $this->info($count === 0
            ? 'Tidak ada pesanan kedaluwarsa.'
            : "{$count} pesanan ditandai kedaluwarsa.");

        return self::SUCCESS;
    }
}
