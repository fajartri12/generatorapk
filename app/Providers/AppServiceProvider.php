<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Login/register throttle: 10 attempts per minute per IP+email pair,
        // so one noisy IP cannot lock out every account.
        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute(10)->by($request->ip().'|'.(string) $request->input('email'));
        });

        // Generation throttle: every call spends external AI provider quota, so
        // this protects the bill, not just the server. Keyed by user, with a
        // looser per-IP ceiling so one account hopping IPs cannot multiply it.
        // Free accounts get the tighter budget; the plan column is what
        // distinguishes them (see config comment).
        RateLimiter::for('generations', function (Request $request) {
            $plan = $request->user()?->wallet()->plan ?? 'free';
            $perMinute = $plan === 'pro'
                ? (int) config('md-generator.limits.generations_per_minute', 10)
                : (int) config('md-generator.limits.generations_per_minute_free', 3);

            return [
                Limit::perMinute($perMinute)->by('user:'.($request->user()?->id ?? $request->ip())),
                Limit::perMinute((int) config('md-generator.limits.generations_per_minute_ip', 30))
                    ->by('ip:'.$request->ip()),
            ];
        });
    }
}
