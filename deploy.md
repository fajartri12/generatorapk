# Panduan Deploy ke cPanel

Panduan ini menjelaskan cara men-deploy MDGenerator ke shared hosting cPanel.

Karena aplikasi ini **satu origin** (Laravel melayani API `/api/*` sekaligus UI
statis dari `public/build`), deploy-nya lebih sederhana: tidak ada CORS, tidak
ada dua aplikasi yang harus disinkronkan, dan tidak ada langkah build (UI sudah
berupa berkas statis di dalam repo).

> **Penting — keamanan.** Jangan pernah meng-upload seluruh proyek ke
> `public_html`. Folder `app/`, `config/`, `vendor/`, `storage/`, dan file
> `.env` berisi kode serta kredensial; kalau berada di dalam document root,
> semuanya bisa diakses lewat browser. Lihat dua opsi di bawah.

---

## Pilihan opsi deploy

| | Opsi A — `public_html` + edit `index.php` | Opsi B — Document Root kustom |
|---|---|---|
| Butuh ubah Document Root? | Tidak | Ya (butuh addon domain/subdomain) |
| Ubah file? | Edit `public_html/index.php` (3 baris) | Tidak ada |
| Struktur folder | `public/` dipecah ke `public_html/` | `public/` tetap utuh |
| Tahan update framework | Cukup | Paling baik |
| Cocok untuk | Domain utama yang terkunci ke `public_html` | Addon domain / subdomain |

Domain utama di cPanel umumnya **terkunci** ke `public_html`, jadi Opsi A adalah
jalur yang paling sering dipakai. Pilih **satu**, jangan campur.

---

## Opsi A — Upload ke `public_html` (domain utama)

Struktur target:

```
/home/USERNAME/
├── mdgenerator/          ← kode aplikasi (DI LUAR webroot)
│   ├── app/  bootstrap/  config/  routes/  public/
│   ├── vendor/
│   ├── storage/          ← wajib writable
│   └── .env              ← kredensial, tidak boleh publik
└── public_html/          ← document root domain
    ├── index.php         ← diedit (menunjuk ke ../mdgenerator)
    ├── .htaccess         ← milik Laravel, JANGAN dihapus
    ├── favicon.svg
    ├── robots.txt
    └── build/            ← UI statis (ditrack git, ikut di-upload)
```

Karena Document Root tetap `public_html` dan `public/` tetap bernama `public/`,
tidak ada masalah dengan `public_path()` Laravel.

### A1. Siapkan arsip di lokal

UI sudah berupa berkas statis di `public/build/` dan di-track di git, jadi
**tidak ada langkah build** — `npm`/Vite tidak dipakai lagi.

Buat arsip yang akan di-upload (kecualikan `.git` dan folder sisa `mdgenerator`):

```powershell
cd c:\xampp\htdocs\generator
tar -a -c -f ..\mdgenerator.zip `
  --exclude=.git --exclude=mdgenerator `
  vendor app bootstrap config database public routes storage tests `
  artisan composer.json composer.lock .env.example .htaccess
```

> Kalau bisa menjalankan Composer di server (langkah A4), `vendor` tidak perlu
> ikut di-upload — arsipnya jadi jauh lebih kecil.

### A2. Upload & ekstrak

Di cPanel → **File Manager**:

1. Upload ZIP ke `/home/USERNAME/`, lalu **Extract** menjadi `mdgenerator/`.
2. Masuk ke `mdgenerator/public/`, pilih semua isinya (**Ctrl+A**) → **Move** ke
   `public_html/`.
3. Kembali ke `public_html/`, hapus file bawaan cPanel (`index.html`,
   `default.php`) — tetapi **pertahankan** `.htaccess` milik Laravel.

### A3. Edit `public_html/index.php`

Hanya 3 baris yang berubah: semua path relatif `__DIR__.'/../'` diganti absolut
ke folder aplikasi.

```php
<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

if (file_exists($maintenance = '/home/USERNAME/mdgenerator/storage/framework/maintenance.php')) {
    require $maintenance;
}

require '/home/USERNAME/mdgenerator/vendor/autoload.php';

(require_once '/home/USERNAME/mdgenerator/bootstrap/app.php')
    ->handleRequest(Request::capture());
```

Ganti `USERNAME` dengan username cPanel Anda (cek di File Manager: `/home/mdgen/...`).

### A4. Install dependensi & siapkan `.env`

Buka cPanel → **Terminal** (atau SSH):

```bash
cd ~/mdgenerator
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
```

> **Tanpa Terminal/SSH?** Upload folder `vendor/` dari lokal, lalu generate
> `APP_KEY` di lokal (`php artisan key:generate`) dan salin nilainya ke `.env`.

### A5. Isi `.env` produksi

```dotenv
APP_NAME=MDGenerator
APP_ENV=production
APP_DEBUG=false                      # WAJIB false di produksi
APP_URL=https://domainanda.com

FRONTEND_URL=https://domainanda.com
API_FRONTEND_URL=https://domainanda.com

DB_CONNECTION=mysql
DB_HOST=localhost                    # di cPanel umumnya localhost
DB_DATABASE=namauser_mdgenerator
DB_USERNAME=namauser_mduser
DB_PASSWORD=passwordkuat

SESSION_DRIVER=database
SESSION_DOMAIN=domainanda.com
SESSION_SECURE_COOKIE=true           # butuh HTTPS

QUEUE_CONNECTION=database            # jangan 'sync' di produksi
CACHE_STORE=database

GOOGLE_REDIRECT_URI=https://domainanda.com/auth/google/callback
```

Buat database & user MySQL lebih dulu di cPanel → **MySQL Databases**, lalu:

```bash
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### A6. Permission

```bash
chmod -R 775 storage bootstrap/cache
```

Di File Manager: klik kanan folder → **Change Permissions** → `775`, centang
**Recurse into subdirectories**.

---

## Opsi B — Document Root kustom (lebih bersih)

Kalau hosting mengizinkan Document Root kustom untuk addon domain/subdomain
(cPanel → **Domains** → kolom **Document Root**):

1. Upload seluruh proyek ke `/home/USERNAME/mdgenerator` (struktur tetap utuh,
   `public/` tidak dipindah).
2. Set Document Root domain ke `/home/USERNAME/mdgenerator/public`.

Tidak ada file yang diubah, tidak ada path absolut, dan `public/` tetap di posisi
yang diharapkan Laravel — paling tahan terhadap update framework.

Sisanya sama: langkah **A1**, **A4**, **A5**, **A6**.

---

## Wajib: Cron Job

Aplikasi ini punya pekerjaan latar yang **tidak akan berjalan tanpa cron**:

- **Queue worker** — generasi dokumen diproses sebagai job. Tanpa worker, job
  menggantung selamanya di tabel `jobs` dan pengguna melihat status "pending"
  tanpa akhir.
- **Scheduler** — `payments:expire` dijalankan tiap jam (`routes/console.php`).

cPanel → **Cron Jobs** → tambahkan:

```cron
* * * * * cd /home/USERNAME/mdgenerator && /usr/local/bin/php artisan schedule:run >> /dev/null 2>&1

*/5 * * * * cd /home/USERNAME/mdgenerator && /usr/local/bin/php artisan queue:work --stop-when-empty --tries=1 --timeout=150 >> /dev/null 2>&1
```

`--stop-when-empty` penting di shared hosting: worker berhenti sendiri setelah
antrian kosong, sehingga cron yang menjalankannya ulang tiap 5 menit membuat
worker praktis selalu hidup tanpa proses menggantung.

> **Path PHP** — ganti `/usr/local/bin/php` sesuai yang tertera di bagian atas
> halaman **Cron Jobs**. Sering berupa `/usr/bin/php` atau path versi spesifik
> seperti `/opt/cpanel/ea-php82/root/usr/bin/php`. Jalankan
> `which php` di Terminal untuk memastikan.

---

## Setting PHP di cPanel

- **MultiPHP Manager** — pilih PHP **8.2 / 8.3** untuk domain Anda.
- **Select PHP Version** — pastikan ekstensi aktif:
  `pdo_mysql`, `mbstring`, `openssl`, `fileinfo`, `curl`, `zip`, `tokenizer`,
  `xml`, `ctype`, `json`, `bcmath`.
- Naikkan `upload_max_filesize` dan `post_max_size` minimal **4M** (untuk upload
  bukti transfer). Batas ukuran file di aplikasi berasal dari
  `config/md-generator.php` (`payments.proof_max_kb`); nilai PHP harus lebih
  besar dari itu, jika tidak upload akan gagal sebelum sampai ke Laravel.

---

## Checklist pasca-deploy

- [ ] `https://domainanda.com` → landing page muncul
- [ ] `https://domainanda.com/app/manajemen` + **refresh keras** → halaman login
      (bukan 404 — ini menguji fallback SPA)
- [ ] `https://domainanda.com/api/credits/costs` → balasan **JSON**
      (bukan HTML — ini menguji pengecualian `/api/*`)
- [ ] `https://domainanda.com/nope-xyz` → halaman 404 milik SPA
- [ ] Login berhasil, dashboard admin memuat data
- [ ] Buat satu generasi dokumen → status berubah dari `pending` ke `done`
      (memastikan cron queue worker jalan)
- [ ] Upload bukti transfer berhasil (memastikan permission `storage/` benar)
- [ ] `APP_DEBUG=false` — halaman error tidak membocorkan stack trace

---

## Setelah ada perubahan kode

UI adalah berkas statis di `public/build/` (ditrack di git), jadi tidak ada
langkah build. Kalau UI berubah, unggah ulang isi `public/build/` ke
`public_html/build/`.

Untuk perubahan backend, setelah meng-upload file, bersihkan cache:

```bash
cd ~/mdgenerator
php artisan config:clear
php artisan route:clear
php artisan view:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

> Kalau memakai `config:cache`, setiap kali `.env` berubah cache **harus**
> dibersihkan ulang — kalau tidak, nilai lama akan terus dipakai.

---

## Pemecahan masalah

| Gejala | Penyebab & solusi |
|---|---|
| **404** di `/app/...` saat refresh | Fallback SPA tidak jalan. Pastikan `.htaccess` Laravel ada di `public_html/` dan `build/index.html` sudah ter-upload. |
| **500** di semua halaman | Path di `public_html/index.php` salah, atau `storage/` tidak writable. Cek `storage/logs/laravel.log`. |
| Halaman tampil tanpa CSS/JS | Isi `public/build/` belum di-upload ke `public_html/build/`. |
| `/api/*` balas HTML, bukan JSON | `.htaccess` hilang atau `mod_rewrite` mati. Hubungi hosting untuk mengaktifkannya. |
| Generasi menggantung di `pending` | Cron queue worker belum jalan atau path PHP-nya salah. Cek **Cron Jobs**. |
| Upload bukti transfer gagal | `upload_max_filesize` / `post_max_size` di bawah batas, atau permission `storage/` bukan `775`. |
| Login Google gagal | `GOOGLE_REDIRECT_URI` harus persis sama dengan yang terdaftar di Google Cloud Console, termasuk skema `https` dan tanpa trailing slash. |
| Perubahan `.env` tidak berefek | Cache konfigurasi masih lama — jalankan `php artisan config:clear`. |
| Tautan reset password mengarah ke `localhost` | `FRONTEND_URL` / `APP_URL` di `.env` belum diubah ke domain produksi, atau `config:cache` belum dibersihkan. |

---

## Ringkasan perintah

```bash
# Di server (Terminal cPanel)
cd ~/mdgenerator
composer install --no-dev --optimize-autoloader
cp .env.example .env      # lalu isi nilainya
php artisan key:generate
php artisan migrate --force
php artisan config:cache && php artisan route:cache && php artisan view:cache
chmod -R 775 storage bootstrap/cache
```
