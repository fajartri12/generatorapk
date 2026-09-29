<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Origin aplikasi
    |--------------------------------------------------------------------------
    |
    | SPA dan API kini satu origin: Laravel melayani build SPA dari public/build,
    | jadi nilai ini biasanya sama dengan APP_URL. Tetap dipakai agar URL absolut
    | (tautan reset password di email, redirect Google OAuth) benar walau aplikasi
    | di belakang proxy atau punya domain lain dari host internal PHP.
    |
    */

    'frontend_url' => rtrim((string) env('FRONTEND_URL', env('API_FRONTEND_URL', env('APP_URL', 'http://localhost:8000'))), '/'),

    /*
    |--------------------------------------------------------------------------
    | MD Credits
    |--------------------------------------------------------------------------
    |
    | Credit cost per document type and the wallet granted on registration.
    | Keep these values here so no component or service hard-codes them
    | (AGENTS.md §11 and §27).
    |
    */

    'starting_balance' => (int) env('MD_CREDITS_STARTING_BALANCE', 50),

    'refund_failed_generation' => (bool) env('MD_CREDITS_REFUND_FAILED', true),

    /*
    |--------------------------------------------------------------------------
    | Rate limits
    |--------------------------------------------------------------------------
    | A generation spends external AI quota, so the ceiling is a cost control,
    | not just a load control. Enforced by the `generations` limiter in
    | AppServiceProvider (P1-7).
    |
    | Free accounts get a tighter per-minute budget than Pro ones; that is the
    | one capability the `plan` column actually unlocks (everything else is
    | priced in credits).
    |
    */

    'limits' => [
        'generations_per_minute' => (int) env('MD_GENERATIONS_PER_MINUTE', 10),
        'generations_per_minute_free' => (int) env('MD_GENERATIONS_PER_MINUTE_FREE', 3),
        'generations_per_minute_ip' => (int) env('MD_GENERATIONS_PER_MINUTE_IP', 30),
    ],

    'costs' => [
        'brief' => 3,
        'prd' => 5,
        'srs' => 5,
        'sdd' => 6,
        'database' => 5,
        'api' => 5,
        'ui_ux' => 5,
        'wbs' => 5,
        'agents_md' => 6,
        'tasks_md' => 5,
        'readme_md' => 3,
        'user_stories' => 4,
        'tech_stack' => 6,
        'user_flow' => 5,
        'design_system' => 6,
        'figma_prompt' => 4,
        'dev_prompt' => 5,
        'personas' => 5,
        'test_plan' => 6,
        'security_review' => 6,
        'microcopy' => 4,
    ],

    /*
    |--------------------------------------------------------------------------
    | Manual payment (bank transfer)
    |--------------------------------------------------------------------------
    |
    | Buying credits is a manual flow: the user creates an order, transfers to
    | the account below, then submits the transfer reference for an admin to
    | verify. No payment gateway is involved (AGENTS.md §11: credits are only
    | ever granted server-side, through CreditService).
    |
    */

    'packages' => [
        // Plan tunggal yang bisa dibeli. `plan` menandai wallet pembeli setelah
        // pesanannya disetujui (manual maupun Pakasir).
        'pro' => ['label' => 'Pro', 'credits' => 100, 'amount' => 40000, 'plan' => 'pro'],
    ],

    'bank' => [
        'bank' => env('MD_BANK_NAME', 'BCA'),
        'account_number' => env('MD_BANK_ACCOUNT', '1234567890'),
        'account_name' => env('MD_BANK_HOLDER', 'PT MD Generator'),
        'instructions' => env(
            'MD_BANK_INSTRUCTIONS',
            'Transfer sesuai nominal tepat sampai 3 digit terakhir, lalu isi nomor referensi/berita transfer di halaman ini.'
        ),
    ],

    // How long an unpaid order stays valid before it is considered stale.
    'payment_expiry_hours' => (int) env('MD_PAYMENT_EXPIRY_HOURS', 24),

    /*
    |--------------------------------------------------------------------------
    | Pakasir (payment gateway)
    |--------------------------------------------------------------------------
    | Rail kedua di samping transfer manual. Kosongkan slug atau api key untuk
    | menyembunyikan opsi ini sepenuhnya: tombol yang tidak bisa bekerja lebih
    | buruk daripada tidak ada tombol sama sekali.
    |
    | `sandbox` membuat setiap transaksi ditandai is_sandbox di sisi Pakasir,
    | dan TIDAK ada uang riil yang berpindah. Transaksi sandbox tetap harus
    | disimulasikan supaya webhook terkirim, jadi UI menyediakan tombol simulasi
    | yang hanya muncul saat flag ini menyala.
    |
    */

    'pakasir' => [
        'slug' => env('PAKASIR_SLUG'),
        'api_key' => env('PAKASIR_API_KEY'),
        'webhook_secret' => env('PAKASIR_WEBHOOK_SECRET'),
        'sandbox' => (bool) env('PAKASIR_SANDBOX', true),

        'endpoint' => env('PAKASIR_ENDPOINT', 'https://app.pakasir.com'),
        'method' => env('PAKASIR_METHOD', 'payment_link'),

        // Pakasir membatasi 2 request per detik; 10 detik cukup longgar dan
        // tetap gagal cepat kalau endpoint mereka sedang tidak sehat.
        'timeout' => (int) env('PAKASIR_TIMEOUT', 10),

        // Halaman tujuan setelah pembayaran selesai. Diisi frontend saat
        // membuat pesanan, dengan nilai ini sebagai cadangan.
        'redirect_path' => env('PAKASIR_REDIRECT_PATH', '/app/payments'),
    ],

];
