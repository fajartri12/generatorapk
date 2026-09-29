<?php

/*
|--------------------------------------------------------------------------
| Shared hosting: rack the first parameter, serve the second
|--------------------------------------------------------------------------
| A "PassthruController" is a method that serves the value of the first
| route parameter from the given directory. This route is how the cPanel
| deploy serves the SPA shell and its assets while the application code
| lives OUTSIDE the document root:
|
|   1. /build/... and /build  -> public_html/build, uploaded by FTP only
|   2. anything else          -> the fallback below, which returns the SPA
|                                shell so React Router deep links survive a
|                                refresh, exactly like the local fallback.
|
| Keep this file, `web.php` and the SPA fallback in `bootstrap/app.php` in
| sync: the placeholder pattern is deliberately the same in all three.
|
| Because the real /build directory does not exist on the server, Apache
| never short-circuits these rewrites, and no .htaccess or index.php in the
| public folder has to be edited.
*/

use Illuminate\Support\Facades\Route;

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
