<?php

/**
 * public_html/index.php untuk deploy cPanel (domain utama).
 *
 * Satu-satunya file yang perlu diedit setelah upload: ganti "USERNAME" di
 * tiga tempat di bawah dengan username cPanel Anda (lihat File Manager,
 * path-nya /home/USERNAME/...).
 *
 * Kode aplikasi (app/, vendor/, .env, dst.) TIDAK berada di public_html —
 * semuanya di /home/USERNAME/mdgenerator, sehingga tidak ada yang bisa
 * diunduh lewat browser.
 */

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Ganti USERNAME (3 tempat) dengan username cPanel Anda.
$base = '/home/USERNAME/mdgenerator';

if (file_exists($maintenance = $base.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $base.'/vendor/autoload.php';

/** @var Application $app */
$app = require_once $base.'/bootstrap/app.php';

$app->handleRequest(Request::capture());
