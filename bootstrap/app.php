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
        health: '/up',
        /*
        |----------------------------------------------------------------------
        | SPA fallback (single origin)
        |----------------------------------------------------------------------
        | React Router dan API kini berbagi satu origin, dan hasil build SPA
        | ada di public/build. Path yang TIDAK dikenali Laravel harus dibalas
        | shell SPA, supaya membuka /app/projects langsung (atau menekan
        | refresh di sana) tidak berakhir 404.
        |
        | Dipasang lewat `then` karena Laravel menyisipkan fallback sebagai
        | rute paling akhir: rute web seperti /auth/google/redirect tetap
        | menang, dan /api/* yang salah tetap balas JSON 404 alih-alih HTML.
        | /reset-password/{token} sengaja TIDAK punya rute web lagi — shell
        | SPA ini yang melayaninya (lihat routes/web.php).
        */
        then: function () {
            // Served LAST, after /api/*, web routes and the health check.
            // Dua rute ini hanya penting di layout cPanel, tempat `public/`
            // BUKAN document root: server web melihat `public_html/` saja,
            // sehingga shell SPA dan aset build harus dilayani Laravel.
            // Di layout standar (document root = public/) mereka tidak pernah
            // tersentuh karena Apache/nginx langsung menyajikan berkas
            // statisnya. Lihat routes/spa.php dan DEPLOY.md.
            Route::get('/build/{file}', function (string $file) {
                $path = public_path('build/'.$file);

                abort_unless(is_file($path), 404);

                return response()->file($path);
            })->where('file', '.*');

            Route::get('/', function () {
                $shell = public_path('build/index.html');

                abort_unless(is_file($shell), 404, 'Frontend belum dibangun. Jalankan `npm run build`.');

                return response(file_get_contents($shell))
                    ->header('Content-Type', 'text/html; charset=UTF-8');
            });

            // Jalur front-end yang tidak dikenal dilayani shell SPA. Pola ini
            // menutup /api/* juga, jadi permintaan API yang salah tetap balas
            // JSON 404 dari Laravel dan tidak berubah jadi halaman HTML.
            Route::fallback(function () {
                $shell = public_path('build/index.html');

                abort_unless(is_file($shell), 404, 'Frontend belum dibangun. Jalankan `npm run build`.');

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
