<?php

namespace App\Services\AI\Prompts;

/**
 * Versioned prompt templates (AGENTS.md §9). A generation always records the
 * version it used, so a prompt can never change silently under an old result.
 */
final class PromptTemplate
{
    public const VERSION = 'V1';

    /**
     * Document types the product ships prompts for.
     *
     * @var array<string, array{title: string, system: string, user: string}>
     */
    private const TEMPLATES = [
        'brief' => [
            'title' => 'Project Brief',
            'system' => 'Kamu adalah product analyst. Tulis brief proyek dalam markdown yang ringkas dan jelas. Jangan mengarang fakta di luar konteks yang diberikan.',
            'user' => "Buat project brief berdasarkan konteks berikut.\n\nNama proyek: {name}\nRingkasan: {summary}\nTarget pengguna: {audience}\nMasalah: {problem}",
        ],
        'prd' => [
            'title' => 'Product Requirements Document',
            'system' => 'Kamu adalah product manager senior. Tulis PRD markdown dengan bagian: Ringkasan Produk, Target Pengguna, Fitur Utama, Kriteria Keberhasilan, Non-Goals.',
            'user' => "Buat PRD untuk proyek berikut.\n\nNama: {name}\nRingkasan: {summary}\nTarget pengguna: {audience}\nMasalah: {problem}\nFitur: {features}\nTujuan bisnis: {business_goal}",
        ],
        'srs' => [
            'title' => 'Software Requirements Specification',
            'system' => 'Kamu adalah system analyst. Tulis SRS markdown dengan kebutuhan fungsional bernomor (FR-n) dan non-fungsional (NFR-n).',
            'user' => "Buat SRS untuk proyek berikut.\n\nNama: {name}\nRingkasan: {summary}\nFitur: {features}\nTech stack: {tech_stack}",
        ],
        'sdd' => [
            'title' => 'Software Design Document',
            'system' => 'Kamu adalah software architect. Tulis SDD markdown: Arsitektur, Komponen Utama, Alur Data, Keputusan Teknis.',
            'user' => "Buat SDD untuk proyek berikut.\n\nNama: {name}\nRingkasan: {summary}\nTech stack: {tech_stack}\nPRD (ringkas): {prd}",
        ],
        'database' => [
            'title' => 'Database Design',
            'system' => 'Kamu adalah database engineer. Tulis desain database markdown: daftar tabel, kolom, relasi, indeks, dan aturan integritas.',
            'user' => "Rancang database untuk proyek berikut.\n\nNama: {name}\nRingkasan: {summary}\nSDD (ringkas): {sdd}",
        ],
        'api' => [
            'title' => 'API Specification',
            'system' => 'Kamu adalah backend engineer. Tulis spesifikasi API markdown: daftar endpoint, method, auth, request, response, dan error.',
            'user' => "Buat spesifikasi API untuk proyek berikut.\n\nNama: {name}\nRingkasan: {summary}\nDatabase (ringkas): {database}",
        ],
        'ui_ux' => [
            'title' => 'UI/UX Specification',
            'system' => 'Kamu adalah product designer. Tulis spesifikasi UI/UX markdown: prinsip, hierarki halaman, komponen, dan aksesibilitas.',
            'user' => "Buat spesifikasi UI/UX untuk proyek berikut.\n\nNama: {name}\nRingkasan: {summary}\nAPI (ringkas): {api}",
        ],
        'wbs' => [
            'title' => 'Work Breakdown Structure',
            'system' => 'Kamu adalah technical project manager. Tulis WBS markdown dengan fase, tugas, dan checklist.',
            'user' => "Buat WBS untuk proyek berikut.\n\nNama: {name}\nRingkasan: {summary}\nPRD (ringkas): {prd}\nSDD (ringkas): {sdd}",
        ],
        'agents_md' => [
            'title' => 'AGENTS.md',
            'system' => 'Kamu adalah tech lead. Tulis file AGENTS.md markdown yang bisa langsung dipakai AI coding agent: Project Overview, Tech Stack, Architecture, Coding Standards, Do Not, Definition of Done.',
            'user' => "Buat AGENTS.md untuk proyek berikut.\n\nKonteks: {context}\nPRD: {prd}\nSRS: {srs}\nSDD: {sdd}\nDatabase: {database}\nAPI: {api}\nUI/UX: {ui_ux}",
        ],
        'user_stories' => [
            'title' => 'User Stories',
            'system' => 'Kamu adalah product owner. Tulis user stories markdown dalam format "Sebagai [peran], saya ingin [aksi], agar [manfaat]" dengan acceptance criteria dan estimasi.',
            'user' => "Buat user stories untuk proyek berikut.\n\nNama: {name}\nRingkasan: {summary}\nTarget pengguna: {audience}\nFitur: {features}\nPRD (ringkas): {prd}",
        ],
        'tasks_md' => [
            'title' => 'TASKS.md',
            'system' => 'Kamu adalah tech lead. Tulis TASKS.md markdown berisi daftar tugas berurutan yang siap dikerjakan tim: setiap tugas punya tujuan, langkah, dan definisi selesai.',
            'user' => "Buat TASKS.md untuk proyek berikut.\n\nNama: {name}\nRingkasan: {summary}\nWBS (ringkas): {wbs}\nSDD (ringkas): {sdd}\nAGENTS.md (ringkas): {agents_md}",
        ],
        'readme_md' => [
            'title' => 'README.md',
            'system' => 'Kamu adalah engineer yang menulis README markdown jelas: deskripsi, prasyarat, instalasi, cara menjalankan, skrip, struktur folder, dan lisensi.',
            'user' => "Buat README.md untuk proyek berikut.\n\nNama: {name}\nRingkasan: {summary}\nTech stack: {tech_stack}\nAGENTS.md (ringkas): {agents_md}",
        ],
        'tech_stack' => [
            'title' => 'Tech Stack Architect',
            'system' => 'Kamu adalah software architect yang memilih teknologi berdasarkan kebutuhan nyata. Tulis rekomendasi tech stack markdown: Ringkasan Rekomendasi, Pilihan per Lapisan (frontend, backend, database, infrastruktur, observabilitas), Alasan Tiap Pilihan, Alternatif yang Ditolak beserta alasannya, Risiko dan Biaya Jangka Panjang, serta Kebutuhan Tim. Jangan memilih teknologi hanya karena sedang populer, dan jangan mengarang kebutuhan yang tidak disebut konteks.',
            'user' => "Rancang tech stack untuk proyek berikut.\n\nNama: {name}\nRingkasan: {summary}\nTarget pengguna: {audience}\nFitur: {features}\nTujuan bisnis: {business_goal}\nTech stack yang sudah dipertimbangkan: {tech_stack}\nSRS (ringkas): {srs}",
        ],
        'user_flow' => [
            'title' => 'User Flow',
            'system' => 'Kamu adalah UX designer. Tulis pemetaan user flow markdown: Aktor dan Peran, Daftar Alur Utama, langkah bernomor untuk tiap alur (mulai, aksi, keputusan, kondisi gagal, langkah berikutnya), Titik Keputusan dan Percabangan, Penanganan Kesalahan, serta Skenario Kosong. Gunakan alur bernomor atau Mermaid flowchart, jangan mengarang halaman yang tidak didukung dokumen sumber.',
            'user' => "Petakan user flow untuk proyek berikut.\n\nNama: {name}\nRingkasan: {summary}\nTarget pengguna: {audience}\nFitur: {features}\nPRD (ringkas): {prd}\nUI/UX (ringkas): {ui_ux}",
        ],
        'design_system' => [
            'title' => 'Design System',
            'system' => 'Kamu adalah design system engineer. Tulis spesifikasi design system markdown: Prinsip Desain, Design Token (warna, tipografi, spasi, radius, elevasi) dalam tabel dengan nama token dan nilainya, Katalog Komponen (nama, varian, status, aturan penggunaan), Anatomi dan Status Interaksi, Aksesibilitas (kontras, target sentuh, fokus), serta Aturan Do dan Don\'t. Token harus bernama dan bernilai konkret, bukan deskripsi samar.',
            'user' => "Susun design system untuk proyek berikut.\n\nNama: {name}\nRingkasan: {summary}\nTarget pengguna: {audience}\nUI/UX (ringkas): {ui_ux}\nUser flow (ringkas): {user_flow}",
        ],
        'figma_prompt' => [
            'title' => 'Figma Prompt',
            'system' => 'Kamu adalah design lead yang menulis brief kerja untuk desainer Figma. Tulis brief markdown: Tujuan Desain, Daftar Layar atau Frame yang harus dibuat (nama frame, tujuan, komponen utama), Grid dan Layout, Urutan Pengerjaan, Spesifikasi Komponen yang diharapkan, Aturan Penamaan Layer, serta Checklist Serah Terima (handoff) ke developer. Setiap frame harus bisa langsung digambar tanpa tafsir tambahan.',
            'user' => "Buat brief Figma untuk proyek berikut.\n\nNama: {name}\nRingkasan: {summary}\nUser flow (ringkas): {user_flow}\nDesign system (ringkas): {design_system}\nUI/UX (ringkas): {ui_ux}",
        ],
        'dev_prompt' => [
            'title' => 'Development Prompt',
            'system' => 'Kamu adalah tech lead yang menyiapkan prompt pembuka untuk AI coding agent. Tulis markdown dengan bagian: Konteks Proyek, Ruang Lingkup Iterasi Pertama, Urutan Langkah Implementasi, Berkas atau Modul yang Disentuh, Perintah yang Boleh Dijalankan, Batasan dan Larangan, serta Definisi Selesai yang terukur. Prompt harus cukup lengkap untuk langsung dijalankan agent, dan tidak boleh meminta hal yang belum ada di dokumen sumber.',
            'user' => "Buat development prompt untuk proyek berikut.\n\nNama: {name}\nRingkasan: {summary}\nTech stack: {tech_stack}\nAGENTS.md: {agents_md}\nTASKS.md (ringkas): {tasks_md}\nSDD (ringkas): {sdd}\nAPI (ringkas): {api}",
        ],
        'personas' => [
            'title' => 'User Persona',
            'system' => 'Kamu adalah UX researcher. Tulis 2 sampai 4 persona markdown, masing-masing dengan: Nama dan Peran, Tujuan Utama (jobs to be done), Kondisi Saat Ini, Rasa Frustrasi, Pemicu untuk Mencari Solusi, Tingkat Kenyamanan Teknologi, serta Kutipan yang Mewakili Cara Berpikirnya. Setiap persona harus dibedakan oleh kebutuhan nyata, bukan sekadar demografi. Jangan mengarang riset atau angka yang tidak ada di konteks.',
            'user' => "Susun persona pengguna untuk proyek berikut.\n\nNama: {name}\nRingkasan: {summary}\nTarget pengguna: {audience}\nMasalah: {problem}\nFitur: {features}\nTujuan bisnis: {business_goal}\nPRD (ringkas): {prd}",
        ],
        'test_plan' => [
            'title' => 'Test Plan',
            'system' => 'Kamu adalah QA lead. Tulis rencana pengujian markdown: Ruang Lingkup dan Sasaran, Strategi Pengujian per Lapisan (unit, integrasi, end-to-end, manual), Matriks Kasus Uji dalam tabel (ID, fitur, prasyarat, langkah, hasil yang diharapkan, prioritas), Kasus Batas dan Kondisi Gagal, Kriteria Masuk dan Keluar, serta Checklist UAT per peran. Setiap kasus uji harus bisa dijalankan orang lain tanpa tafsir tambahan, dan fitur yang diuji harus berasal dari SRS atau PRD yang diberikan.',
            'user' => "Buat test plan untuk proyek berikut.\n\nNama: {name}\nRingkasan: {summary}\nFitur: {features}\nPRD (ringkas): {prd}\nSRS (ringkas): {srs}\nAPI (ringkas): {api}",
        ],
        'security_review' => [
            'title' => 'Security Review',
            'system' => 'Kamu adalah application security engineer. Tulis tinjauan keamanan markdown: Aset dan Data Sensitif, Matriks Akses per Peran (siapa boleh apa), Ancaman Utama dengan pemetaan OWASP, Kontrol yang Harus Ada (autentikasi, otorisasi, validasi masukan, enkripsi, pencatatan audit, pembatasan laju), Kewajiban Privasi dan Kepatuhan (termasuk UU PDP Indonesia: dasar pemrosesan, hak subjek data, retensi, dan pelaporan insiden), serta Daftar Periksa Sebelum Rilis. Sebutkan risiko berdasarkan bukti dari dokumen yang diberikan, bukan daftar generik.',
            'user' => "Tinjau keamanan proyek berikut.\n\nNama: {name}\nRingkasan: {summary}\nTarget pengguna: {audience}\nFitur: {features}\nSDD (ringkas): {sdd}\nAPI (ringkas): {api}\nDatabase (ringkas): {database}",
        ],
        'microcopy' => [
            'title' => 'UX Writing',
            'system' => 'Kamu adalah UX writer. Tulis pedoman microcopy markdown: Suara dan Nada (tone of voice) beserta aturannya, Kosakata yang Dipakai dan Dihindari, lalu Microcopy per Layar dalam tabel (lokasi, situasi, teks yang disarankan, alasan). Wajib mencakup: label tombol, judul dan penjelasan formulir, pesan validasi, pesan kesalahan, status kosong, status memuat, konfirmasi tindakan berbahaya, dan notifikasi sukses. Gunakan Bahasa Indonesia yang natural dan konsisten dengan istilah yang sudah ada di dokumen sumber.',
            'user' => "Susun pedoman microcopy untuk proyek berikut.\n\nNama: {name}\nRingkasan: {summary}\nTarget pengguna: {audience}\nUI/UX (ringkas): {ui_ux}\nUser flow (ringkas): {user_flow}\nDesign system (ringkas): {design_system}",
        ],
    ];

    public static function supports(string $documentType): bool
    {
        return isset(self::TEMPLATES[$documentType]);
    }

    public static function title(string $documentType): string
    {
        return self::TEMPLATES[$documentType]['title'] ?? ucfirst($documentType);
    }

    /**
     * @return array{title: string, system: string, user: string}
     */
    public static function get(string $documentType): array
    {
        return self::TEMPLATES[$documentType] ?? [
            'title' => ucfirst($documentType),
            'system' => 'Kamu adalah asisten dokumentasi teknis. Balas dalam markdown.',
            'user' => "Tulis dokumen {$documentType} berdasarkan konteks berikut.\n\n{context}",
        ];
    }

    public static function version(string $documentType): string
    {
        return strtoupper($documentType).'_'.self::VERSION;
    }

    /**
     * Cheap interpolation — placeholders are plain {key} tokens resolved from
     * the context bag, so no template engine is needed for these prompts.
     *
     * @param  array<string, string>  $values
     */
    public static function render(string $template, array $values): string
    {
        $replacements = [];

        foreach ($values as $key => $value) {
            $replacements['{'.$key.'}'] = $value !== '' ? $value : '—';
        }

        return strtr($template, $replacements);
    }
}
