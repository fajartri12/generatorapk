<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\InsufficientCreditsException;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\CreditTransaction;
use App\Models\Generation;
use App\Models\Payment;
use App\Models\Project;
use App\Models\Setting;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\CreditService;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminController extends Controller
{
    /**
     * Subject types an admin may filter the audit trail by. Taken from the real
     * class names so a typo cannot silently return an empty list.
     */
    private const AUDIT_SUBJECTS = [User::class, Project::class, Payment::class];

    public function __construct(
        private readonly CreditService $credits,
        private readonly AuditLogger $audit,
        private readonly PaymentService $payments,
    ) {}

    /** Daftar semua user dengan wallet dan jumlah proyek. */
    public function users(Request $request): JsonResponse
    {
        $inactive = $request->boolean('inactive');

        $users = User::withCount('projects')
            ->with('creditWallet')
            // "Registered but never started" is the population worth chasing;
            // keeping it in SQL avoids shipping every user just to filter.
            ->when($inactive, fn ($q) => $q->having('projects_count', '=', 0))
            ->latest()
            ->get()
            ->map(fn($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role,
                'plan' => $u->creditWallet?->plan ?? 'free',
                'balance' => $u->creditWallet?->balance ?? 0,
                'projects_count' => $u->projects_count,
                'created_at' => $u->created_at,
            ]);

        return response()->json(['data' => $users]);
    }

    /** Ubah role user. */
    public function updateUserRole(Request $request, User $user): JsonResponse
    {
        $data = $request->validate(['role' => ['required', 'string', 'in:user,pro,admin']]);

        $from = $user->role;
        $user->update($data);

        $this->audit->record(
            $request->user(),
            'user.role',
            "Mengubah role {$user->name} dari {$from} menjadi {$data['role']}.",
            $user,
            ['role' => ['from' => $from, 'to' => $data['role']]],
            $request->ip(),
        );

        return response()->json(['data' => ['id' => $user->id, 'role' => $user->role]]);
    }

    /** Tambah kredit ke user. */
    public function grantCredits(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'integer', 'min:1', 'max:100000'],
            'description' => ['nullable', 'string', 'max:255'],
        ]);

        $before = $user->wallet()->balance;
        $this->credits->grant($user, $data['amount'], $data['description'] ?? 'Grant admin');

        $this->audit->record(
            $request->user(),
            'user.grant',
            "Menambah {$data['amount']} kredit ke {$user->name}.",
            $user,
            ['balance' => ['from' => $before, 'to' => $before + $data['amount']], 'amount' => $data['amount']],
            $request->ip(),
        );

        return response()->json(['message' => 'Kredit berhasil ditambahkan.', 'balance' => $user->wallet()->balance]);
    }

    /**
     * Koreksi saldo: tambah atau kurangi kredit di luar alur generasi.
     *
     * grant() hanya bisa menambah, jadi salah ketik atau pemakaian keliru tidak
     * punya jalan pulang selain mengutak-atik database. Amount boleh negatif;
     * deskripsi wajib supaya baris ledger selalu bisa dipertanggungjawabkan.
     */
    public function adjustCredits(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'integer', 'min:-100000', 'max:100000', 'not_in:0'],
            'description' => ['required', 'string', 'max:255'],
        ]);

        $before = $user->wallet()->balance;

        try {
            $this->credits->adjust($user, $data['amount'], $data['description']);
        } catch (InsufficientCreditsException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $action = $data['amount'] > 0 ? 'user.grant' : 'user.revoke';
        $verb = $data['amount'] > 0 ? 'Menambah' : 'Mengurangi';

        $this->audit->record(
            $request->user(),
            $action,
            "{$verb} ".abs($data['amount'])." kredit pada {$user->name}: {$data['description']}",
            $user,
            ['balance' => ['from' => $before, 'to' => $before + $data['amount']], 'amount' => $data['amount']],
            $request->ip(),
        );

        return response()->json([
            'message' => $verb.' '.abs($data['amount']).' kredit berhasil.',
            'balance' => $user->wallet()->balance,
        ]);
    }

    /**
     * Satu nominal untuk banyak pengguna. Setiap perubahan tetap lewat
     * CreditService satu per satu supaya lock, ledger, dan riwayat tetap utuh;
     * satu baris audit per pengguna agar jejaknya bisa dilacak per akun.
     */
    public function bulkGrantCredits(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_ids' => ['required', 'array', 'min:1', 'max:100'],
            'user_ids.*' => ['integer', 'exists:users,id'],
            'amount' => ['required', 'integer', 'min:-100000', 'max:100000', 'not_in:0'],
            'description' => ['required', 'string', 'max:255'],
        ]);

        $updated = [];
        $skipped = [];

        foreach (User::whereIn('id', $data['user_ids'])->get() as $user) {
            $before = $user->wallet()->balance;

            try {
                $this->credits->adjust($user, $data['amount'], $data['description']);
            } catch (InsufficientCreditsException) {
                $skipped[] = $user->id;
                continue;
            }

            $updated[] = $user->id;

            $this->audit->record(
                $request->user(),
                $data['amount'] > 0 ? 'user.grant' : 'user.revoke',
                ($data['amount'] > 0 ? 'Menambah ' : 'Mengurangi ').abs($data['amount'])." kredit (massal) pada {$user->name}: {$data['description']}",
                $user,
                ['balance' => ['from' => $before, 'to' => $before + $data['amount']], 'amount' => $data['amount'], 'bulk' => true],
                $request->ip(),
            );
        }

        $count = count($updated);
        $message = "{$count} pengguna diperbarui.";
        if ($skipped !== []) {
            $message .= ' '.count($skipped).' pengguna dilewati karena saldo tidak mencukupi.';
        }

        return response()->json(['message' => $message, 'updated' => $updated, 'skipped' => $skipped]);
    }

    /** Ubah plan wallet user. */
    public function updatePlan(Request $request, User $user): JsonResponse
    {
        $data = $request->validate(['plan' => ['required', 'string', 'in:free,pro']]);

        $wallet = $user->wallet();
        $from = $wallet->plan;
        $wallet->update(['plan' => $data['plan']]);

        $this->audit->record(
            $request->user(),
            'user.plan',
            "Mengubah plan {$user->name} dari {$from} menjadi {$data['plan']}.",
            $user,
            ['plan' => ['from' => $from, 'to' => $data['plan']]],
            $request->ip(),
        );

        return response()->json(['message' => 'Plan berhasil diubah.']);
    }

    /**
     * Statistik global.
     *
     * `total_credits_used` menghitung generasi selesai (yang benar-benar
     * memotong saldo). Untuk melihat pemakaian terkini, jendela waktu dihitung
     * dari baris ledger `debit` sehingga refund ikut terlihat apa adanya.
     */
    public function stats(): JsonResponse
    {
        $windows = [
            'today' => now()->startOfDay(),
            '7d' => now()->subDays(7),
            '30d' => now()->subDays(30),
        ];

        $usage = [];
        foreach ($windows as $key => $since) {
            $usage[$key] = (int) abs(CreditTransaction::query()
                ->where('type', CreditTransaction::DEBIT)
                ->where('created_at', '>=', $since)
                ->sum('amount'));
        }

        $failures = Generation::query()
            ->where('status', Generation::FAILED)
            ->selectRaw('provider, count(*) as total')
            ->groupBy('provider')
            ->pluck('total', 'provider');

        $recentFailures = Generation::query()
            ->where('status', Generation::FAILED)
            ->where('created_at', '>=', now()->subDays(7))
            ->count();

        return response()->json([
            'total_users' => User::count(),
            'total_projects' => Project::count(),
            'total_generations' => Generation::count(),
            'total_credits_used' => Generation::where('status', 'completed')->sum('credits_used'),
            'credits_used' => $usage,
            'failures' => [
                'total' => (int) $failures->sum(),
                'last_7d' => $recentFailures,
                'by_provider' => $failures->map(fn ($total, $provider) => ['provider' => $provider ?: 'tidak diketahui', 'total' => (int) $total])->values(),
            ],
            'payments' => $this->payments->counts() + ['gateway' => $this->payments->gatewayCounts()],
            'expiring_soon' => $this->payments->stalePendingCount(),
            'trend' => $this->trend(),
        ]);
    }

    /**
     * Deret 14 hari untuk grafik ringkasan. Dua query agregat, bukan satu query
     * per hari, lalu hari tanpa data diisi nol supaya grafiknya tidak berlubang.
     */
    private function trend(int $days = 14): array
    {
        $from = now()->subDays($days - 1)->startOfDay();

        $generations = Generation::query()
            ->where('created_at', '>=', $from)
            ->selectRaw('date(created_at) as day, count(*) as total, sum(credits_used) as credits')
            ->groupBy('day')
            ->pluck('total', 'day');
        $credits = Generation::query()
            ->where('created_at', '>=', $from)
            ->where('status', Generation::COMPLETED)
            ->selectRaw('date(created_at) as day, sum(credits_used) as credits')
            ->groupBy('day')
            ->pluck('credits', 'day');

        $series = [];
        for ($i = 0; $i < $days; $i++) {
            $day = $from->copy()->addDays($i)->toDateString();
            $series[] = [
                'date' => $day,
                'generations' => (int) ($generations[$day] ?? 0),
                'credits' => (int) ($credits[$day] ?? 0),
            ];
        }

        return $series;
    }

    /** Semua proyek (global). */
    public function projects(): JsonResponse
    {
        $projects = Project::with('user:id,name,email')->withCount('documents')->latest()->get();

        return response()->json(['data' => $projects]);
    }

    /** Hapus proyek milik siapa pun. */
    public function deleteProject(Request $request, Project $project): JsonResponse
    {
        $this->audit->record(
            $request->user(),
            'project.delete',
            "Menghapus proyek \"{$project->name}\" milik ".($project->user?->name ?? 'pengguna tak dikenal').'.',
            $project,
            ['name' => $project->name, 'owner' => $project->user_id],
            $request->ip(),
        );

        $project->delete();

        return response()->json(['message' => 'Proyek berhasil dihapus.']);
    }

    /**
     * Riwayat generasi. Generasi gagal ikut membawa pesan error dan durasinya,
     * karena kegagalan yang tidak terlihat tidak akan pernah diperbaiki.
     */
    public function generations(Request $request): JsonResponse
    {
        $statuses = [Generation::PENDING, Generation::RUNNING, Generation::COMPLETED, Generation::FAILED, Generation::CANCELLED];
        $status = $request->query('status');
        $status = in_array($status, $statuses, true) ? $status : null;

        $gens = Generation::with('user:id,name,email')
            ->when($status, fn ($q) => $q->where('status', $status))
            ->latest()
            ->limit(200)
            ->get()
            ->map(fn (Generation $g) => [
                'id' => $g->id,
                'document_type' => $g->document_type,
                'status' => $g->status,
                'stage' => $g->stage,
                'error' => $g->error,
                'credits_used' => $g->credits_used,
                'provider' => $g->provider,
                'model' => $g->model,
                'duration_ms' => $g->duration_ms,
                'project_id' => $g->project_id,
                'document_id' => $g->document_id,
                'user' => $g->user ? ['id' => $g->user->id, 'name' => $g->user->name, 'email' => $g->user->email] : null,
                'created_at' => $g->created_at,
            ]);

        return response()->json(['data' => $gens]);
    }

    /** Buat user baru (admin bypass). */
    public function createUser(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['sometimes', 'string', 'in:user,pro,admin'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role' => $data['role'] ?? 'user',
        ]);

        $user->wallet();

        return response()->json(['data' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'role' => $user->role]], 201);
    }

    /** Update konfigurasi biaya kredit (persisten via cache). */
    public function updateCosts(Request $request): JsonResponse
    {
        $data = $request->validate([
            'costs' => ['required', 'array'],
            'costs.*' => ['integer', 'min:0', 'max:100'],
        ]);

        $before = $this->credits->costs();
        $costs = $this->credits->setCosts($data['costs']);

        $this->audit->record(
            $request->user(),
            'costs.update',
            'Memperbarui tabel biaya kredit.',
            null,
            ['costs' => ['from' => $before, 'to' => $costs]],
            $request->ip(),
        );

        return response()->json(['message' => 'Biaya diperbarui.', 'costs' => $costs]);
    }

    /**
     * Rekening tujuan transfer manual. Disimpan di tabel settings supaya
     * pengelola bisa memindahkan rekening tanpa redeploy: config hanya jadi
     * nilai awal, sama seperti tabel biaya.
     */
    public function bankSettings(): JsonResponse
    {
        return response()->json(['data' => $this->payments->bankDetails()]);
    }

    public function updateBankSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'bank' => ['required', 'string', 'max:60'],
            'account_number' => ['required', 'string', 'max:40'],
            'account_name' => ['required', 'string', 'max:120'],
            'instructions' => ['nullable', 'string', 'max:500'],
        ]);

        $before = $this->payments->bankDetails();
        $after = $this->payments->setBankDetails($data);

        $this->audit->record(
            $request->user(),
            'bank.update',
            'Memperbarui rekening tujuan transfer.',
            null,
            ['bank' => ['from' => $before, 'to' => $after]],
            $request->ip(),
        );

        return response()->json(['message' => 'Rekening diperbarui.', 'data' => $after]);
    }

    /**
     * Jejak audit, terbaru dulu.
     *
     * Bisa disaring per aksi, atau per objek ("lihat riwayat objek ini") —
     * kolom morph sudah ada sejak awal, yang kurang hanya caranya bertanya.
     */
    public function auditLogs(Request $request): JsonResponse
    {
        $action = $request->query('action');

        $logs = $this->auditQuery($request)
            ->with('actor:id,name,email')
            ->when(is_string($action) && $action !== '', fn ($q) => $q->where('action', $action))
            ->latest('id')
            ->paginate(30);

        return response()->json([
            'data' => collect($logs->items())->map->toApi(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'total' => $logs->total(),
            ],
        ]);
    }

    /** Query dasar jejak audit, termasuk saringan per objek. */
    private function auditQuery(Request $request)
    {
        $type = $request->query('subject_type');
        $id = $request->query('subject_id');

        // Hanya kelas yang memang punya objek diaudit boleh masuk filter, dan
        // nama pendek ("User") diterjemahkan ke FQCN yang tersimpan di kolom.
        $class = null;
        foreach (self::AUDIT_SUBJECTS as $candidate) {
            if ($type === $candidate || $type === class_basename($candidate)) {
                $class = $candidate;
                break;
            }
        }

        return AuditLog::query()
            ->when($class, fn ($q) => $q->where('subject_type', $class))
            ->when($class && is_numeric($id), fn ($q) => $q->where('subject_id', (int) $id));
    }

    /** Ekspor jejak audit sebagai CSV. */
    public function exportAudit(Request $request): StreamedResponse    {
        $action = $request->query('action');

        return $this->csv('audit-log', [
            'ID', 'Waktu', 'Pelaku', 'Aksi', 'Keterangan', 'Objek', 'Objek ID',
        ], $this->auditQuery($request)
            ->with('actor:id,name,email')
            ->when(is_string($action) && $action !== '', fn ($q) => $q->where('action', $action))
            ->latest('id')
            ->limit(5000)
            ->get()
            ->map(fn (AuditLog $log) => [
                $log->id,
                optional($log->created_at)->toIso8601String(),
                $log->actor?->email ?? 'sistem',
                $log->action,
                $log->description,
                class_basename((string) $log->subject_type) ?: '',
                $log->subject_id,
            ]));
    }

    /** Ekspor pengguna: siapa punya saldo berapa dan memakai berapa. */
    public function exportUsers(): StreamedResponse
    {
        $rows = User::withCount('projects')
            ->with('creditWallet')
            ->latest()
            ->get()
            ->map(fn (User $u) => [
                $u->id,
                $u->name,
                $u->email,
                $u->role,
                $u->creditWallet?->plan ?? 'free',
                $u->creditWallet?->balance ?? 0,
                $u->projects_count,
                optional($u->created_at)->toIso8601String(),
            ]);

        return $this->csv('pengguna', [
            'ID', 'Nama', 'Email', 'Role', 'Paket', 'Saldo', 'Jumlah proyek', 'Terdaftar',
        ], $rows);
    }

    /** Ekspor riwayat generasi, termasuk kegagalan dan pesan errornya. */
    public function exportGenerations(): StreamedResponse
    {
        $rows = Generation::with('user:id,name,email')
            ->latest()
            ->limit(5000)
            ->get()
            ->map(fn (Generation $g) => [
                $g->id,
                $g->user?->email ?? 'sistem',
                $g->document_type,
                $g->status,
                $g->provider,
                $g->model,
                $g->credits_used,
                $g->duration_ms,
                $g->error,
                optional($g->created_at)->toIso8601String(),
            ]);

        return $this->csv('generasi', [
            'ID', 'Pengguna', 'Jenis dokumen', 'Status', 'Provider', 'Model', 'Kredit', 'Durasi (ms)', 'Error', 'Waktu',
        ], $rows);
    }

    /** Ekspor pesanan pembayaran, termasuk pesanan gateway. */
    public function exportPayments(): StreamedResponse
    {
        $rows = Payment::with('user:id,name,email')
            ->latest()
            ->limit(5000)
            ->get()
            ->map(fn (Payment $p) => [
                $p->id,
                $p->code,
                $p->user?->email ?? '',
                $p->package_label,
                $p->amount,
                $p->credits,
                $p->status,
                $p->gateway,
                $p->transfer_reference,
                $p->gateway_txn_id,
                optional($p->created_at)->toIso8601String(),
            ]);

        return $this->csv('pembayaran', [
            'ID', 'Invoice', 'Pengguna', 'Paket', 'Nominal', 'Kredit', 'Status', 'Gateway', 'Referensi', 'Txn ID', 'Waktu',
        ], $rows);
    }

    /**
     * Satu pembungkus CSV untuk semua ekspor, supaya tidak ada yang lupa BOM
     * (Excel perlu BOM untuk membaca UTF-8) atau delimiter.
     */
    private function csv(string $name, array $header, iterable $rows): StreamedResponse
    {
        return response()->streamDownload(function () use ($header, $rows) {
            $out = fopen('php://output', 'w');

            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, $header);

            foreach ($rows as $row) {
                fputcsv($out, array_map(fn ($cell) => $this->csvCell($cell), $row));
            }

            fclose($out);
        }, $name.'-'.now()->format('Y-m-d-Hi').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * Netralkan CSV injection (CWE-1236). Excel/LibreOffice menjalankan sel yang
     * diawali `=`, `+`, `-`, `@`, tab, atau CR, sehingga nama atau referensi
     * transfer yang diketik pengguna bisa jadi perintah bila file dibuka admin.
     *
     * Hanya string yang disentuh: angka tetap apa adanya supaya nominal negatif
     * seperti -10 tidak berubah menjadi teks "'-10".
     */
    private function csvCell(mixed $value): mixed
    {
        if (! is_string($value) || $value === '') {
            return $value;
        }

        return preg_match('/^[=+\-@\t\r]/', $value) === 1 ? "'".$value : $value;
    }
}