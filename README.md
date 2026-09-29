# MDGenerator

Aplikasi generator dokumen (PRD, SRS, SDD, dan lain-lain) berbasis AI.
**Satu aplikasi Laravel 12** yang melayani API `/api/*` sekaligus UI dalam satu
origin — tidak perlu CORS di produksi.

- Backend & UI: Laravel 12 + PHP 8.2 + MySQL/MariaDB
- UI: hasil build statis di `public/build/`, disajikan Laravel (tanpa Vite/npm)

---

## Kebutuhan

| Komponen | Versi |
|---|---|
| PHP | >= 8.2 (ekstensi: `pdo_mysql`, `mbstring`, `openssl`, `fileinfo`) |
| Composer | 2.x |
| MySQL / MariaDB | 10.4+ |

---

## Instalasi

```bash
composer install
```

Siapkan `.env` (salin dari `.env.example`, lalu sesuaikan):

```bash
cp .env.example .env
php artisan key:generate
```

Isi kredensial database dan set URL aplikasi:

```dotenv
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:8000
API_FRONTEND_URL=http://localhost:8000
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
SANCTUM_STATEFUL_DOMAINS=localhost:8000,127.0.0.1:8000
```

Migrasi dan seed, lalu jalankan server:

```bash
php artisan migrate --seed
php artisan serve --port=8000
```

Buka <http://localhost:8000>. UI sudah ikut di repo di `public/build/` — tidak
ada langkah build.

---

## Menjalankan proses pendukung

Generator berjalan sebagai **queue job**, jadi worker wajib hidup. Buka
terminal terpisah untuk masing-masing:

```bash
# Worker antrian (wajib agar generasi dokumen diproses)
php artisan queue:work --tries=1 --timeout=150

# Scheduler (opsional: pembersihan & tugas terjadwal)
php artisan schedule:work
```

> Setelah mengubah kode PHP, restart worker — worker lama masih memakai kode lama.

---

## Mode pengembangan

Tidak ada dev server terpisah — `php artisan serve --port=8000` melayani UI dan
API sekaligus, jadi cukup buka <http://localhost:8000>.

---

## Cara menyajikan UI

UI adalah berkas statis di `public/build/` (`index.html` + `assets/*`). Berkas
nyata selalu menang, jadi Laravel menyajikannya langsung, dan setiap URL
non-API yang tidak punya berkas dibalas shell `public/build/index.html` lewat
`Route::fallback()` di `bootstrap/app.php` — dengan pengecualian `/api/*` agar
tetap 404 JSON.

> `public/build/` **di-track di git**: itu satu-satunya salinan UI yang
disajikan Laravel. Menghapusnya = aplikasi tanpa tampilan.

---

## Struktur proyek

```
app/                  # kode backend Laravel (Controllers, Models, Services, Jobs, ...)
routes/api.php        # endpoint /api/*
routes/web.php        # route bridge non-API (redirect Google OAuth)
public/build/         # UI hasil build (ditrack di git, disajikan Laravel)
config/md-generator.php  # konfigurasi khusus aplikasi
```

---

## Deploy

Panduan lengkap untuk hosting cPanel (struktur folder, `.env` produksi, cron
queue worker, dan pemecahan masalah) ada di [deploy.md](deploy.md).

---

## Pengujian

```bash
php artisan test
```

---

## Catatan operasional

- **Antrian**: generasi dokumen berjalan asinkron. Tanpa `queue:work`, job akan
  menunggu tanpa batas di tabel `jobs`.
- **Kredit**: kredit dipotong saat job diantrikan dan dikembalikan otomatis bila
  generasi gagal atau dibatalkan.
- **Reset password**: email berisi tautan ke `{FRONTEND_URL}/reset-password/{token}`,
  yang dilayani `routes/web.php` lalu dilanjutkan oleh SPA.
- **Login Google**: callback diarahkan ke `GOOGLE_REDIRECT_URI`; pastikan nilainya
  cocok dengan yang terdaftar di Google Cloud Console.
