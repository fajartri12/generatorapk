<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
| An unpaid transfer order is only valid for config('md-generator.payment_expiry_hours').
| Nothing else closes it, so without this the pending queue grows forever.
| Needs `php artisan schedule:work` (or a cron entry) to actually fire.
*/
Schedule::command('payments:expire')->hourly()->withoutOverlapping();
