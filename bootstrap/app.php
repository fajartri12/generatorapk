<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Support\Facades\Route;
use App\Http\Middleware\EnsureUserIsAdmin;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        /*
        |----------------------------------------------------------------------
        | SPA fallback (single origin)
        |----------------------------------------------------------------------
        | UI adalah hasil build yang tinggal di public/build dan disajikan
        | Laravel — tidak ada lagi Vite/npm. Path yang TIDAK dikenali Laravel
        | dibalas shell SPA, supaya membuka /app/projects langsung (atau
        | menekan refresh di sana) tidak berakhir 404.
        |
        | Hanya fallback ini yang perlu: berkas nyata di public/ (termasuk
        | public/build/*) dan rute web seperti /auth/google/redirect selalu
        | menang, dan /api/* yang salah tetap balas JSON 404, bukan HTML.
        | /reset-password/{token} dilayani shell ini juga (lihat routes/web.php).
        */
        then: function () {
            Route::fallback(function () {
                $shell = public_path('build/index.html');

                abort_unless(is_file($shell), 404, 'Frontend belum dibangun.');

                return response(file_get_contents($shell))
                    ->header('Content-Type', 'text/html; charset=UTF-8');
            })->where('fallbackPlaceholder', '^(?!api(?:/|$)).*$');
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'admin' => EnsureUserIsAdmin::class,
        ]);

        // Ini API murni: tidak ada route bernama "login". Tanpa ini, request
        // tamu tanpa header "Accept: application/json" akan error 500
        // (RouteNotFoundException) alih-alih 401 yang benar.
        $middleware->redirectGuestsTo(fn () => '/');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
