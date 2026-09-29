# MDGenerator

Aplikasi generator dokumen (PRD, SRS, SDD, dan lain-lain) berbasis AI.
**Satu aplikasi Laravel 12 yang melayani API sekaligus frontend SPA** dalam satu origin.

- Backend: Laravel 12 + PHP 8.2 + MySQL/MariaDB
- Frontend: Vite 7 + React 19 + TypeScript + Tailwind v4 (sumber di `src/`, `index.html`)
- API dan SPA dilayani dari proses yang sama — tidak perlu CORS di produksi.

---

## Kebutuhan

| Komponen | Versi |
|---|---|
| PHP | >= 8.2 (ekstensi: `pdo_mysql`, `mbstring`, `openssl`, `fileinfo`) |
| Composer | 2.x |
| Node.js | >= 20 (dites di Node 24) |
| MySQL / MariaDB | 10.4+ |

---

## Instalasi

```bash
composer install
npm install
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

# Frontend (dipakai oleh Vite)
VITE_API_URL=
VITE_DEV_BACKEND=http://localhost:8000
```

Migrasi dan seed:

```bash
php artisan migrate --seed
```

Build frontend, lalu jalankan server:

```bash
npm run build
php artisan serve --port=8000
```

Buka <http://localhost:8000>.

> `VITE_API_URL` sengaja dibiarkan **kosong**: artinya frontend memanggil API
> secara relatif (`/api/...`) pada origin yang sama. Hanya isi bila API berada
> di host berbeda.

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

Frontend punya Vite dev server dengan HMR di port **5173**. Server itu mem-proxy
`/api`, `/auth`, `/storage`, dan `/up` ke Laravel di port 8000.

Terminal 1 — backend:

```bash
php artisan serve --port=8000
```

Terminal 2 — frontend:

```bash
npm run dev
```

Buka <http://localhost:5173> untuk mengembangkan UI. Semua permintaan API tetap
diarahkan ke Laravel 8000 lewat proxy, jadi tidak ada masalah CORS.

Perintah lain:

```bash
npm run typecheck   # tsc --noEmit
npm run build       # tsc --noEmit && vite build  -> public/build
npm run preview     # pratinjau hasil build
```

---

## Cara deploy SPA

Hasil `npm run build` ditulis ke `public/build/` (aset diberi prefix `/build/`).
Laravel melayani `public/build/index.html` sebagai shell SPA untuk setiap URL
non-API melalui `Route::fallback()` yang didaftarkan di `bootstrap/app.php`,
dengan pengecualian `/api/*` agar tetap mengembalikan 404 JSON.

Konsekuensinya: **jalankan `npm run build` setiap kali frontend berubah** sebelum
deploy, karena produksi tidak memakai Vite dev server.

---

## Struktur proyek

```
app/                  # kode backend Laravel (Controllers, Models, Services, Jobs, ...)
routes/api.php        # endpoint /api/*
routes/web.php        # route bridge non-API (halaman reset password, redirect Google)
src/                  # sumber frontend React
  app/                # definisi route SPA
  components/         # komponen UI & layout
  features/           # fitur per-domain (landing, dashboard, projects, workspace, admin)
  lib/                # api client, hooks, auth provider
public/build/         # hasil build SPA (dibuat oleh npm run build)
vite.config.ts        # konfigurasi build & dev proxy
config/md-generator.php  # konfigurasi khusus aplikasi
```

---

## Deploy

Panduan lengkap untuk hosting cPanel (struktur folder, `.env` produksi, cron
queue worker, dan pemecahan masalah) ada di [deploy.md](deploy.md).

---

## Pengujian

```bash
# Suite backend (PHPUnit)
php artisan test

# Pemeriksaan tipe frontend
npm run typecheck
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
