<?php

namespace Database\Seeders;

use App\Models\Project;
use App\Models\User;
use App\Services\CreditService;
use App\Services\GenerationService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Seeds a demo account that already contains real projects, contexts and one
 * generated document, so the frontend has something meaningful to render.
 *
 * Login: demo@mdgenerator.test / password
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'admin@mdgenerator.test'],
            ['name' => 'Admin MDGenerator', 'password' => Hash::make('password'), 'role' => 'admin'],
        )->wallet();

        $user = User::updateOrCreate(
            ['email' => 'demo@mdgenerator.test'],
            ['name' => 'Demo User', 'password' => Hash::make('password')],
        );

        $wallet = $user->wallet();
        $wallet->update(['plan' => 'pro']);

        // Top the wallet up to the 320 the dashboard mock showed.
        $credits = app(CreditService::class);
        $target = 320;

        if ($wallet->balance < $target) {
            $credits->grant($user, $target - $wallet->balance, 'Kredit demo');
        }

        $projects = [
            [
                'name' => 'Rental Management System',
                'description' => 'Sistem penyewaan kendaraan lengkap dengan pelacakan unit, kontrak, dan pembayaran.',
                'icon' => 'RM',
                'color' => '#4f46e5',
                'tags' => ['web', 'laravel', 'mysql'],
                'context' => [
                    'summary' => 'Platform untuk mengelola penyewaan mobil dan motor harian maupun bulanan.',
                    'audience' => 'Pemilik usaha rental skala kecil hingga menengah.',
                    'problem' => 'Pencatatan sewa masih manual sehingga jadwal unit bentrok dan pendapatan sulit dilacak.',
                    'features' => "Kalender ketersediaan unit\nManajemen kontrak sewa\nPencatatan pembayaran dan denda\nLaporan pendapatan bulanan",
                    'business_goal' => 'Mengurangi jadwal bentrok dan mempercepat proses checkout pelanggan.',
                    'tech_stack' => ['Laravel', 'React', 'MySQL'],
                ],
                'documents' => ['brief', 'prd', 'srs'],
            ],
            [
                'name' => 'Inventory Dashboard',
                'description' => 'Dashboard stok barang dengan peringatan stok minimum dan riwayat pergerakan.',
                'icon' => 'ID',
                'color' => '#7c3aed',
                'tags' => ['dashboard', 'react'],
                'context' => [
                    'summary' => 'Alat pemantauan stok untuk gudang dan toko ritel.',
                    'audience' => 'Staf gudang dan pemilik toko.',
                    'problem' => 'Stok sering kosong tanpa peringatan sehingga penjualan hilang.',
                    'features' => "Peringatan stok minimum\nRiwayat masuk-keluar barang\nEkspor laporan CSV",
                    'business_goal' => 'Menekan kejadian kehabisan stok.',
                    'tech_stack' => ['React', 'Laravel', 'MySQL'],
                ],
                'documents' => ['brief', 'prd'],
            ],
            [
                'name' => 'Finance Tracker',
                'description' => 'Pencatat pemasukan dan pengeluaran pribadi dengan ringkasan bulanan.',
                'icon' => 'FT',
                'color' => '#0ea5e9',
                'tags' => ['mobile', 'fintech'],
                'context' => [
                    'summary' => 'Aplikasi sederhana untuk melacak keuangan pribadi.',
                    'audience' => 'Individu yang ingin mengontrol pengeluaran.',
                    'problem' => 'Pengeluaran kecil tidak tercatat sehingga tabungan bocor.',
                    'features' => "Kategorisasi transaksi\nRingkasan bulanan\nTarget tabungan",
                    'business_goal' => 'Membantu pengguna menabung secara konsisten.',
                    'tech_stack' => ['React Native', 'Laravel'],
                ],
                'documents' => ['brief'],
            ],
        ];

        $generations = app(GenerationService::class);

        foreach ($projects as $definition) {
            $documents = $definition['documents'];
            unset($definition['documents']);

            $project = $user->projects()->updateOrCreate(
                ['name' => $definition['name']],
                [
                    'slug' => \Illuminate\Support\Str::slug($definition['name']),
                    'description' => $definition['description'],
                    'icon' => $definition['icon'],
                    'color' => $definition['color'],
                    'tags' => $definition['tags'],
                ],
            );

            $project->context()->updateOrCreate([], $definition['context']);

            foreach ($documents as $type) {
                // Skip regeneration so re-running the seeder stays idempotent.
                if ($project->documents()->where('type', $type)->exists()) {
                    continue;
                }

                $generations->generate($user, $project, $type);
            }
        }
    }
}
