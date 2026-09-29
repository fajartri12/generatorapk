<?php

namespace App\Services\AI\Providers;

use App\Services\AI\Contracts\AIProvider;
use App\Services\AI\GenerateRequest;
use App\Services\AI\GenerateResponse;

/**
 * Deterministic stand-in so the whole product runs with zero API keys.
 * Produces a believable markdown document per type from the request context.
 * Swap AI_DEFAULT_PROVIDER to a real vendor when keys are available.
 */
class MockProvider implements AIProvider
{
    public function name(): string
    {
        return 'mock';
    }

    public function model(): string
    {
        return 'mock-1';
    }

    public function generate(GenerateRequest $request): GenerateResponse
    {
        $start = hrtime(true);

        $content = match ($request->documentType) {
            'brief' => $this->brief($request),
            'prd' => $this->prd($request),
            'srs' => $this->srs($request),
            'sdd' => $this->sdd($request),
            'database' => $this->database($request),
            'api' => $this->api($request),
            'ui_ux' => $this->uiUx($request),
            'wbs' => $this->wbs($request),
            'agents_md' => $this->agentsMd($request),
            default => $this->generic($request),
        };

        $duration = (int) ((hrtime(true) - $start) / 1_000_000);

        return new GenerateResponse($content, $this->name(), $this->model(), $duration);
    }

    private function title(GenerateRequest $request): string
    {
        return $request->payload['title'] ?? $request->payload['name'] ?? 'Dokumen';
    }

    private function summary(GenerateRequest $request): string
    {
        return $request->context['summary'] ?? $request->payload['summary'] ?? 'Belum ada ringkasan.';
    }

    private function brief(GenerateRequest $request): string
    {
        $t = $this->title($request);
        $s = $this->summary($request);

        return <<<MD
# Brief — {$t}

## Ringkasan
{$s}

## Tujuan
Dokumen ini menjadi titik awal pengembangan {$t}.

## Ruang Lingkup
- Definisi masalah dan peluang
- Target pengguna
- Kriteria keberhasilan

## Catatan
Dokumen dihasilkan oleh provider *mock*. Ganti `AI_DEFAULT_PROVIDER` di `.env` untuk memakai model sungguhan.
MD;
    }

    private function prd(GenerateRequest $request): string
    {
        $t = $this->title($request);
        $s = $this->summary($request);
        $audience = $request->context['audience'] ?? 'Pengguna utama';
        $features = $request->context['features'] ?? 'Fitur inti';

        return <<<MD
# Product Requirements Document — {$t}

## 1. Ringkasan Produk
{$s}

## 2. Target Pengguna
{$audience}

## 3. Fitur Utama
{$features}

## 4. Kriteria Keberhasilan
- Pengguna dapat menyelesaikan alur inti tanpa hambatan
- Waktu muat halaman di bawah 2 detik
- Dukungan aksesibilitas WCAG 2.1 AA

## 5. Non-Goals
- Fitur yang tidak terkait alur inti ditunda ke rilis berikutnya
MD;
    }

    private function srs(GenerateRequest $request): string
    {
        $t = $this->title($request);

        return <<<MD
# Software Requirements Specification — {$t}

## 1. Pendahuluan
Spesifikasi kebutuhan perangkat lunak untuk {$t}.

## 2. Kebutuhan Fungsional
- FR-1: Autentikasi pengguna (registrasi, login, logout)
- FR-2: Manajemen proyek (buat, baca, ubah, hapus)
- FR-3: Generasi dokumen dengan sistem kredit
- FR-4: Riwayat versi dokumen

## 3. Kebutuhan Non-Fungsional
- NFR-1: Kinerja — respons API < 300 ms
- NFR-2: Keamanan — otorisasi per proyek
- NFR-3: Aksesibilitas — WCAG 2.1 AA
MD;
    }

    private function sdd(GenerateRequest $request): string
    {
        $t = $this->title($request);

        return <<<MD
# Software Design Document — {$t}

## 1. Arsitektur
- Frontend: React + Vite + TypeScript
- Backend: Laravel REST API
- Database: MySQL

## 2. Komponen Utama
- Modul proyek: wadah konteks utama
- Modul dokumen: versi, regenerasi, ekspor
- Modul kredit: dompet + buku besar transaksi
- Lapisan AI: AIService → ProviderFactory → provider

## 3. Alur Generasi
1. Verifikasi saldo kredit
2. Tampilkan biaya
3. Potong kredit secara atomik
4. Jalankan generasi
5. Catat pemakaian
6. Refund bila gagal
MD;
    }

    private function database(GenerateRequest $request): string
    {
        $t = $this->title($request);

        return <<<MD
# Desain Database — {$t}

## Tabel Utama
| Tabel | Keterangan |
| --- | --- |
| users | Pengguna terdaftar |
| projects | Proyek milik pengguna |
| documents | Dokumen per proyek |
| document_versions | Riwayat versi dokumen |
| generations | Catatan setiap operasi AI |
| credit_wallets | Saldo kredit pengguna |
| credit_transactions | Buku besar perubahan saldo |

## Aturan
- Setiap proyek memiliki satu konteks (project_contexts)
- Dokumen tidak pernah ditimpa; selalu menambah versi
- Saldo kredit tidak boleh negatif
MD;
    }

    private function api(GenerateRequest $request): string
    {
        $t = $this->title($request);

        return <<<MD
# Spesifikasi API — {$t}

## Autentikasi
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout` (auth)
- `GET /api/auth/me` (auth)

## Proyek
- `GET|POST /api/projects`
- `GET|PATCH|DELETE /api/projects/{project}`

## Dokumen
- `GET|POST /api/projects/{project}/documents`
- `GET /api/documents/{document}/versions`

## Generasi & Kredit
- `POST /api/generations`
- `GET /api/generations/{generation}`
- `GET /api/credits`
MD;
    }

    private function uiUx(GenerateRequest $request): string
    {
        $t = $this->title($request);

        return <<<MD
# Spesifikasi UI/UX — {$t}

## Prinsip Desain
- Token warna: primary `#4F46E5`, accent `#7C3AED`
- Latar `#F8FAFC`, teks `#0F172A`, muted `#64748B`
- Hindari gradien berlebihan

## Komponen
- Sidebar menjadi drawer di mobile
- Kartu menjadi satu kolom di layar kecil
- Toolbar dokumen menjadi kompak

## Aksesibilitas
- Navigasi keyboard penuh
- Fokus terlihat
- Kontras WCAG 2.1 AA
MD;
    }

    private function wbs(GenerateRequest $request): string
    {
        $t = $this->title($request);

        return <<<MD
# Work Breakdown Structure — {$t}

## Fase 1 — Fondasi
- [ ] Setup proyek & lingkungan
- [ ] Autentikasi pengguna

## Fase 2 — Inti Produk
- [ ] Manajemen proyek
- [ ] Generasi dokumen
- [ ] Sistem kredit

## Fase 3 — Penyempurnaan
- [ ] Riwayat versi
- [ ] Ekspor & berbagi
- [ ] Pengujian & peluncuran
MD;
    }

    private function agentsMd(GenerateRequest $request): string
    {
        $t = $this->title($request);

        return <<<MD
# AGENTS.md — {$t}

## Project Overview
{$this->summary($request)}

## Tech Stack
- Frontend: React, Vite, TypeScript, Tailwind CSS
- Backend: Laravel, PHP, REST API, Sanctum
- Database: MySQL

## Architecture
Browser → React → Laravel API → Database + AI Provider Layer

## Coding Standards
- TypeScript strict mode
- Logika bisnis di hooks/services, bukan komponen presentasi
- Prompt & skema output di luar komponen

## Do Not
- Jangan menimpa dokumen tanpa menyimpan versi sebelumnya
- Jangan hard-code biaya kredit
- Jangan menaruh API key di frontend
MD;
    }

    private function generic(GenerateRequest $request): string
    {
        $t = $this->title($request);

        return <<<MD
# {$t}

{$this->summary($request)}

Dokumen dihasilkan oleh provider *mock*.
MD;
    }
}
