<?php

/**
 * public_html/index.php untuk deploy cPanel (domain utama).
 *
 * TIDAK PERLU DIEDIT. Folder aplikasi dideteksi otomatis sebagai
 * <satu-level-di-atas-public_html>/mdgenerator. Kalau namanya lain, skrip ini
 * mencari folder yang berisi bootstrap/app.php + vendor/autoload.php.
 *
 * Kode aplikasi (app/, vendor/, .env, dst.) TIDAK berada di public_html — jadi
 * tidak ada yang bisa diunduh lewat browser.
 */

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

$home = dirname(__DIR__);                      // /home/USERNAME
$base = $home.'/mdgenerator';                  // default hasil deploy.md

if (! is_file($base.'/bootstrap/app.php')) {
    $base = null;

    foreach (glob($home.'/*', GLOB_ONLYDIR) as $dir) {
        if (is_file($dir.'/bootstrap/app.php') && is_file($dir.'/vendor/autoload.php')) {
            $base = $dir;
            break;
        }
    }

    if ($base === null) {
        http_response_code(500);
        exit('Folder aplikasi tidak ditemukan. Lihat deploy.md (langkah A2) — kode harus ada di "../mdgenerator".');
    }
}

if (file_exists($maintenance = $base.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $base.'/vendor/autoload.php';

/** @var Application $app */
$app = require_once $base.'/bootstrap/app.php';

$app->handleRequest(Request::capture());
