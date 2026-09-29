<?php

/**
 * Installer cPanel — jalankan SEKALI di Terminal cPanel setelah ekstrak ZIP:
 *
 *     cd ~/mdgenerator
 *     php deploy/install.php
 *
 * Yang dilakukan: siapkan .env, install dependensi Composer, generate APP_KEY
 * (hanya jika belum ada), migrasi, cache config/route/view, dan permission
 * storage. Aman dijalankan ulang — langkah yang sudah selesai dilewati.
 *
 * Setelah selesai: isi nilai produksi di .env (DB, APP_URL, dst.), lalu
 * jalankan ulang `php deploy/install.php` agar cache config dibuat ulang.
 */

$root = dirname(__DIR__);
chdir($root);

function step(string $label, callable $fn): void
{
    echo "== {$label}\n";
    $fn();
}

step('Cek PHP >= 8.2', function () {
    if (version_compare(PHP_VERSION, '8.2.0', '<')) {
        exit("PHP ".PHP_VERSION." terlalu lama. Pilih PHP 8.2/8.3 di MultiPHP Manager, lalu ulangi.\n");
    }
    echo '   PHP '.PHP_VERSION."\n";
});

$freshEnv = ! is_file($root.'/.env');

if ($freshEnv) {
    copy($root.'/.env.example', $root.'/.env');
    echo "== .env dibuat dari .env.example\n";
}

$vendor = $root.'/vendor/autoload.php';

// installed.json hanya ada kalau composer install benar-benar selesai —
// autoload.php sendirian bisa berarti upload vendor/ terpotong.
$vendorOk = is_file($vendor) && is_file($root.'/vendor/composer/installed.json');

if (! $vendorOk) {
    echo "== composer install --no-dev --optimize-autoloader\n";
    passthru('composer install --no-dev --optimize-autoloader 2>&1', $code);
    if ($code !== 0 || ! is_file($root.'/vendor/composer/installed.json')) {
        exit("Composer gagal/tidak ada (atau folder vendor/ tidak lengkap). Alternatif: jalankan deploy/make-zip.ps1 TANPA -NoVendor di lokal, upload ulang vendor/, lalu ulangi skrip ini.\n");
    }
} else {
    echo "== vendor/ lengkap, composer install dilewati\n";
}

echo "== direktori runtime + permission\n";
$dirs = [
    'storage/app/private',
    'storage/app/public',
    'storage/framework/cache/data',
    'storage/framework/sessions',
    'storage/framework/testing',
    'storage/framework/views',
    'storage/logs',
    'bootstrap/cache',
];

foreach ($dirs as $dir) {
    @mkdir($root.'/'.$dir, 0775, true);
}

@chmod($root.'/storage', 0775);

foreach ($dirs as $dir) {
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root.'/'.$dir, FilesystemIterator::SKIP_DOTS)) as $f) {
        @chmod($f->getPathname(), is_dir($f) ? 0775 : 0664);
    }
    @chmod($root.'/'.$dir, 0775);
}

$env = (string) file_get_contents($root.'/.env');

if (! preg_match('/^APP_KEY=\S/m', $env)) {
    echo "== php artisan key:generate\n";
    passthru('php artisan key:generate --force');
} else {
    echo "== APP_KEY sudah ada, dilewati\n";
}

if ($freshEnv) {
    echo <<<TXT

== BERHENTI DI SINI
   .env masih berisi nilai contoh (DB_DATABASE=mdgenerator, DB_USERNAME=root).
   Migrasi pasti gagal. Langkah berikutnya:

     1. Buat database + user di cPanel -> MySQL Databases.
     2. Isi .env: DB_DATABASE, DB_USERNAME, DB_PASSWORD, APP_URL,
        FRONTEND_URL, API_FRONTEND_URL, SESSION_DOMAIN, APP_ENV=production,
        APP_DEBUG=false, QUEUE_CONNECTION=database.
        (Lihat deploy.md langkah A5 untuk daftar lengkap.)
     3. Jalankan ulang: php deploy/install.php

TXT;
    exit(0);
}

echo "== php artisan migrate --force\n";
passthru('php artisan migrate --force');

foreach (['config', 'route'] as $what) {
    echo "== php artisan {$what}:cache\n";
    passthru("php artisan {$what}:cache");
}

// Aplikasi ini tidak punya resources/views (UI-nya statis di public/build),
// jadi view:cache hanya akan melempar DirectoryNotFoundException.
if (is_dir($root.'/resources/views')) {
    echo "== php artisan view:cache\n";
    passthru('php artisan view:cache');
}

echo "\nSelesai.\n";
echo "Jika migrate tadi gagal: isi DB_* produksi di .env, lalu jalankan ulang: php deploy/install.php\n";
echo "Jangan lupa pasang CRON (cPanel > Cron Jobs), lihat deploy.md bagian 'Wajib: Cron Job'.\n";
