<?php

namespace App\Services;

use App\Exceptions\PaymentException;
use App\Models\Payment;
use App\Models\Setting;
use App\Models\User;
use App\Notifications\PaymentDecided;
use App\Notifications\PaymentNeedsReview;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Manual bank-transfer payments (AGENTS.md §11).
 *
 * This service owns the order lifecycle only. It never touches a balance
 * directly — approval delegates to CreditService::grant(), so every credit
 * still has exactly one writer and one ledger row.
 */
final class PaymentService
{
    /** Private disk: a receipt is proof of payment, not a public asset. */
    private const PROOF_DISK = 'local';

    /** Hard ceiling for an uploaded receipt, in kilobytes. */
    public const PROOF_MAX_KB = 2048;

    /** Settings key holding the admin override of the bank account. */
    private const BANK_SETTING_KEY = 'bank_details';

    public function __construct(
        private readonly CreditService $credits,
        private readonly AuditLogger $audit,
        private readonly WhatsAppService $whatsapp,
        private readonly PakasirService $pakasir,
    ) {}

    /** When a fresh order stops being payable. */
    private function expiryFrom(): Carbon
    {
        return now()->addHours((int) config('md-generator.payment_expiry_hours', 24));
    }

    /** Packages the user can buy, straight from config so both sides agree. */
    public function packages(): array
    {
        return collect(config('md-generator.packages', []))
            ->map(fn (array $p, string $key) => ['key' => $key] + $p)
            ->values()
            ->all();
    }

    /**
     * Where to send the money. The settings table wins over config so an admin
     * can move the account from the panel; config stays the default, exactly
     * like the credit cost table.
     */
    public function bankDetails(): array
    {
        $override = Setting::get(self::BANK_SETTING_KEY, []);

        return array_merge(config('md-generator.bank', []), is_array($override) ? $override : []);
    }

    /** Persist the account an admin typed in, merging with whatever is live. */
    public function setBankDetails(array $data): array
    {
        $next = array_merge($this->bankDetails(), $data);

        Setting::set(self::BANK_SETTING_KEY, $next);

        return $next;
    }

    /**
     * Create a pending order. A user may hold several open orders, but never two
     * for the same package at once — that is almost always a double submit.
     */
    public function create(User $user, string $package, string $gateway = Payment::GATEWAY_MANUAL): Payment
    {
        $info = config("md-generator.packages.{$package}");

        if (! is_array($info)) {
            throw PaymentException::unknownPackage($package);
        }

        $payment = DB::transaction(function () use ($user, $package, $info, $gateway) {
            $duplicate = Payment::query()
                ->where('user_id', $user->id)
                ->where('package', $package)
                ->where('status', Payment::PENDING)
                ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
                ->lockForUpdate()
                ->exists();

            if ($duplicate) {
                throw PaymentException::duplicateOrder($package);
            }

            return Payment::create([
                'code' => Payment::makeCode(),
                'user_id' => $user->id,
                'package' => $package,
                'credits' => (int) $info['credits'],
                'amount' => (int) $info['amount'],
                'status' => Payment::PENDING,
                'gateway' => $gateway,
                'expires_at' => $this->expiryFrom(),
            ]);
        });

        // The admin queue should not depend on someone refreshing the tab.
        $this->notifyAdmins(new PaymentNeedsReview($payment, PaymentNeedsReview::OPENED));

        // Grup WhatsApp: pengelola melihat pesanan masuk tanpa membuka panel.
        $this->whatsapp->notifyPaymentOpened(
            $payment->code,
            $user->name,
            $payment->packageInfo()['label'] ?? $payment->package,
            $payment->amount,
        );

        return $payment;
    }

    /**
     * Open a Pakasir order and hand back the payment page to send the buyer to.
     *
     * Structurally the manual flow's twin, with three differences that matter:
     *  - the rail is recorded (`gateway = pakasir`) so the admin queue can skip it;
     *  - there is no receipt: the gateway is the proof, and the webhook is the verdict;
     *  - we keep booking the configured package price as `amount`. `createTransaction`
     *    is find-or-create keyed on (slug, amount), so changing the amount after
     *    the fact would start a second charge instead of updating the first;
     *  - Pakasir adds its fee on top, so `total_payment` is what the buyer sees.
     *    It is surfaced to the UI but not written to the order row.
     *
     * `order_id` sent to Pakasir is our invoice code: it is already unique and it
     * is the only string a webhook will echo back that we can match on.
     */
    public function createGatewayOrder(User $user, string $package, ?string $redirectUrl = null): array
    {
        if (! PakasirService::configured()) {
            throw PaymentException::gatewayUnavailable();
        }

        $payment = $this->create($user, $package, gateway: Payment::GATEWAY_PAKASIR);

        // Pakasir is find-or-create on (slug, order_id); our code is unique per
        // order, so re-calling this after a failure cannot duplicate a charge.
        $txn = $this->pakasir->createTransaction($payment->code, $payment->amount, PakasirService::method());

        $payment->update([
            'gateway_txn_id' => $txn['txn_id'],
            'gateway_method' => $txn['payment_method'],
            'gateway_is_sandbox' => $txn['is_sandbox'],
            // The deadline now follows the gateway's own expiry, not ours —
            // otherwise the UI can claim an order is dead while it is still payable.
            'expires_at' => $txn['expired_at'] ? Carbon::parse($txn['expired_at']) : $payment->expires_at,
        ]);

        // Built once here and also exposed on the payment itself, so the UI can
        // reopen the link later without rebuilding the URL client-side.
        $paymentUrl = filled($txn['payment_link'])
            ? $this->pakasir->paymentUrl($txn['txn_id'], $redirectUrl)
            : null;

        return [
            'payment' => $payment->refresh(),
            'payment_url' => $paymentUrl,
            'qr_string' => $txn['qr_string'],
            'va_number' => $txn['va_number'],
            'total_payment' => $txn['total_payment'],
            'fee' => $txn['fee'],
            'expires_at' => $txn['expired_at'],
            'is_sandbox' => $txn['is_sandbox'],
        ];
    }

    /**
     * THE settlement path for gateway orders. Whatever announced the payment —
     * a webhook, a status poll, or the sandbox simulate button — converges here,
     * so credits can never be granted by two different code paths.
     *
     * Returns the payment untouched (no exception) when it is already settled:
     * Pakasir retries webhooks, and a retry must be a no-op, not a 500.
     */
    public function settleGatewayOrder(Payment $payment, ?string $ip = null, ?int $paidAmount = null): Payment
    {
        if ($payment->gateway !== Payment::GATEWAY_PAKASIR || $payment->gateway_txn_id === null) {
            throw new PaymentException('Pesanan ini bukan pesanan gateway.', 422);
        }

        if ($payment->status !== Payment::PENDING) {
            return $payment;
        }

        // Never grant on a mismatch. `paidAmount` is what the provider itself
        // reported; the buyer cannot influence it, so a dishonest order total
        // cannot be turned into cheap credits.
        if ($paidAmount !== null && $paidAmount !== (int) $payment->amount) {
            $this->audit->record(
                null,
                'payment.amount_mismatch',
                "Nominal Pakasir untuk {$payment->code} tidak cocok: dilaporkan {$paidAmount}, tagihan {$payment->amount}.",
                $payment,
                ['amount' => ['from' => (int) $payment->amount, 'to' => $paidAmount]],
                $ip,
            );

            throw PaymentException::amountMismatch((int) $payment->amount, $paidAmount);
        }

        $payment = DB::transaction(function () use ($payment) {
            $locked = Payment::query()->whereKey($payment->id)->lockForUpdate()->firstOrFail();

            // Re-checked under the lock: two webhooks arriving together must
            // produce exactly one grant.
            if ($locked->status !== Payment::PENDING) {
                return $locked;
            }

            $locked->update([
                'status' => Payment::PAID,
                'submitted_at' => $locked->submitted_at ?? now(),
                'reviewed_at' => now(),
            ]);

            $this->grantAndUpgrade($locked);

            return $locked;
        });

        // Fresh grant only: a retry returned above, so nobody gets a second
        // "payment approved" notification for the same money.
        if ($payment->wasChanged('status')) {
            $payment->user->notify(new PaymentDecided($payment));

            $this->whatsapp->notifyPaymentDecided(
                $payment->code,
                $payment->user?->name ?? 'Pengguna',
                true,
                $payment->credits,
                'Pakasir '.($payment->gateway_is_sandbox ? 'sandbox' : 'live'),
            );

            $this->audit->record(
                null,
                'payment.settle',
                "Pakasir melunasi pesanan {$payment->code} (+{$payment->credits} kredit)",
                $payment,
                ['status' => ['from' => Payment::PENDING, 'to' => Payment::PAID], 'credits' => $payment->credits],
                $ip,
            );
        }

        return $payment;
    }

    /** Re-read the status straight from Pakasir and settle if it is paid. */
    public function refreshGatewayOrder(Payment $payment): Payment
    {
        if ($payment->gateway_txn_id === null) {
            throw new PaymentException('Pesanan ini belum punya transaksi Pakasir.', 422);
        }

        $status = $this->pakasir->transactionStatus($payment->gateway_txn_id);

        if ($status === null) {
            throw new PaymentException('Transaksi tidak ditemukan di Pakasir.', 404);
        }

        if ($status['status'] === 'completed') {
            // The status call is the authoritative word on how much was paid.
            // A body with no amount (`0`) means the provider did not tell us,
            // not that nothing was paid — passing 0 through would refuse every
            // legitimate payment, so treat it as unknown.
            return $this->settleGatewayOrder($payment, null, $status['amount'] ?: null);
        }

        // `canceled` also covers a transaction that passed Pakasir's own 24-hour
        // window, so the local deadline is aligned with theirs.
        if ($status['status'] === 'canceled' && $payment->status === Payment::PENDING) {
            $payment->update(['status' => Payment::EXPIRED, 'reviewed_at' => now()]);

            return $payment->refresh();
        }

        return $payment;
    }

    /** Sandbox only: ask Pakasir to mark the order paid, which fires the webhook. */
    public function simulateGatewayPayment(Payment $payment): bool
    {
        if (! $payment->gateway_is_sandbox) {
            throw new PaymentException('Simulasi hanya berlaku untuk transaksi sandbox.', 409);
        }

        if ($payment->gateway_txn_id === null) {
            throw new PaymentException('Pesanan ini belum punya transaksi Pakasir.', 422);
        }

        return $this->pakasir->simulatePayment($payment->code, $payment->amount);
    }

    /**
     * Store the receipt on the private disk and point the order at it. Uploading
     * a replacement deletes the old file so storage does not accumulate.
     */
    public function attachProof(Payment $payment, UploadedFile $file): Payment
    {
        // A gateway order has no receipt to upload: Pakasir already told us it
        // was paid. Letting one attach here would only create misleading evidence.
        if ($payment->isGateway()) {
            throw new PaymentException('Pesanan Pakasir tidak memakai bukti transfer.', 409);
        }

        if (! $payment->isOpen()) {
            throw $payment->isExpired() ? PaymentException::expired() : PaymentException::notOpen($payment->status);
        }

        $extension = strtolower($file->getClientOriginalExtension() ?: $file->extension());

        if (! in_array($extension, ['jpg', 'jpeg', 'png', 'webp', 'pdf'], true)) {
            throw PaymentException::invalidProof('format harus JPG, PNG, WEBP, atau PDF.');
        }

        $previous = $payment->proof_path;
        $path = $file->store("payments/{$payment->id}", self::PROOF_DISK);

        $payment->update([
            'proof_path' => $path,
            'proof_uploaded_at' => now(),
            'proof_size' => $file->getSize() ?: null,
        ]);

        if ($previous && $previous !== $path) {
            Storage::disk(self::PROOF_DISK)->delete($previous);
        }

        return $payment->refresh();
    }

    /**
     * Stream the receipt back. The caller must have already checked ownership —
     * a receipt lives on the private disk precisely so it is never guessable.
     */
    public function proofContents(Payment $payment): string
    {
        if (! $payment->hasProof() || ! Storage::disk(self::PROOF_DISK)->exists($payment->proof_path)) {
            throw PaymentException::proofMissing();
        }

        return Storage::disk(self::PROOF_DISK)->get($payment->proof_path);
    }

    public function proofName(Payment $payment): string
    {
        return $payment->proof_path ? basename($payment->proof_path) : 'bukti-transfer';
    }

    /** The user tells us they transferred the money. */
    public function submit(Payment $payment, array $data): Payment
    {
        if ($payment->isGateway()) {
            throw new PaymentException('Pesanan Pakasir selesai otomatis setelah pembayaran berhasil.', 409);
        }

        if (! $payment->isOpen()) {
            throw $payment->isExpired() ? PaymentException::expired() : PaymentException::notOpen($payment->status);
        }

        $payment->update([
            'transfer_reference' => $data['transfer_reference'],
            'note' => $data['note'] ?? null,
            'submitted_at' => now(),
            // A submitted order is waiting on us, not on the user, so the
            // deadline restarts — it must not expire while an admin queues it.
            'expires_at' => $this->expiryFrom(),
        ]);

        $this->notifyAdmins(new PaymentNeedsReview($payment->refresh(), PaymentNeedsReview::SUBMITTED));

        // Momen paling penting: ada uang masuk yang perlu diperiksa mutasinya.
        $this->whatsapp->notifyPaymentSubmitted(
            $payment->code,
            $payment->user?->name ?? 'Pengguna',
            $payment->packageInfo()['label'] ?? $payment->package,
            $payment->amount,
            $payment->transfer_reference,
        );

        return $payment->refresh();
    }

    /** The user changes their mind before an admin looks at it. */
    public function cancel(Payment $payment): Payment
    {
        if (! $payment->isOpen()) {
            throw $payment->isExpired() ? PaymentException::expired() : PaymentException::notOpen($payment->status);
        }

        $payment->update(['status' => Payment::CANCELLED, 'reviewed_at' => now()]);

        return $payment->refresh();
    }

    /**
     * Close every pending order whose deadline passed. Idempotent, and it never
     * touches credits — an unpaid order simply stops being payable.
     *
     * @return int the number of orders closed
     */
    public function expireStale(): int
    {
        $stale = Payment::query()
            ->where('status', Payment::PENDING)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->get();

        foreach ($stale as $payment) {
            $payment->update(['status' => Payment::EXPIRED, 'reviewed_at' => now()]);
        }

        return $stale->count();
    }

    /**
     * Grant the package credits and, when the package defines one, upgrade the
     * wallet plan (free → pro). Both happen inside the caller's transaction so
     * a rollback undoes the label too.
     */
    private function grantAndUpgrade(Payment $payment): void
    {
        $info = $payment->packageInfo() ?? [];

        $this->credits->grant(
            $payment->user,
            $payment->credits,
            'Pembelian paket '.($info['label'] ?? $payment->package)." ({$payment->code})"
        );

        if ($plan = $info['plan'] ?? null) {
            $payment->user->wallet()->update(['plan' => $plan]);
        }
    }

    /**
     * Admin approves: mark it paid and grant the credits. Both happen in one
     * transaction, and the status check is re-read under a lock so a double
     * click cannot grant twice.
     */
    public function approve(Payment $payment, User $admin, ?string $note = null, ?string $ip = null): Payment
    {
        $payment = DB::transaction(function () use ($payment, $admin, $note) {
            $locked = Payment::query()->whereKey($payment->id)->lockForUpdate()->firstOrFail();

            if (! $locked->isOpen()) {
                throw $locked->isExpired() ? PaymentException::expired() : PaymentException::notOpen($locked->status);
            }

            $locked->update([
                'status' => Payment::PAID,
                'admin_note' => $note,
                'reviewed_by' => $admin->id,
                'reviewed_at' => now(),
            ]);

            $this->grantAndUpgrade($locked);

            return $locked;
        });

        // After the transaction commits: the ledger row and the inbox entry
        // appear together, and a notification rolled back with a failed grant
        // would be a lie.
        $payment->user->notify(new PaymentDecided($payment));

        $this->whatsapp->notifyPaymentDecided(
            $payment->code,
            $payment->user?->name ?? 'Pengguna',
            true,
            $payment->credits,
            $note,
        );

        $this->audit->record(
            $admin,
            'payment.approve',
            "Menyetujui pesanan {$payment->code} (+{$payment->credits} kredit, Rp".number_format($payment->amount, 0, ',', '.').')',
            $payment,
            ['status' => ['from' => Payment::PENDING, 'to' => Payment::PAID], 'credits' => $payment->credits],
            $ip,
        );

        return $payment;
    }

    /** Admin rejects: no credits, reason stored for the user to read. */
    public function reject(Payment $payment, User $admin, ?string $note = null, ?string $ip = null): Payment
    {
        $payment = DB::transaction(function () use ($payment, $admin, $note) {
            $locked = Payment::query()->whereKey($payment->id)->lockForUpdate()->firstOrFail();

            if (! $locked->isOpen()) {
                throw $locked->isExpired() ? PaymentException::expired() : PaymentException::notOpen($locked->status);
            }

            $locked->update([
                'status' => Payment::REJECTED,
                'admin_note' => $note,
                'reviewed_by' => $admin->id,
                'reviewed_at' => now(),
            ]);

            return $locked;
        });

        $payment->user->notify(new PaymentDecided($payment));

        $this->whatsapp->notifyPaymentDecided(
            $payment->code,
            $payment->user?->name ?? 'Pengguna',
            false,
            0,
            $note,
        );

        $this->audit->record(
            $admin,
            'payment.reject',
            "Menolak pesanan {$payment->code} (".($note ? "alasan: {$note}" : 'tanpa alasan').')',
            $payment,
            ['status' => ['from' => Payment::PENDING, 'to' => Payment::REJECTED]],
            $ip,
        );

        return $payment;
    }

    /** Every administrator gets the review ping; zero admins means nobody is nagged. */
    private function notifyAdmins(PaymentNeedsReview $notification): void
    {
        User::query()->where('role', 'admin')->each(fn (User $admin) => $admin->notify($notification));
    }

    public function forUser(User $user, int $perPage = 20): LengthAwarePaginator
    {
        return Payment::query()
            ->where('user_id', $user->id)
            ->orderByRaw("case when status = 'pending' then 0 else 1 end")
            ->latest()
            ->paginate($perPage);
    }

    public function all(?string $status = null, int $perPage = 30): LengthAwarePaginator
    {
        return Payment::query()
            ->with('user:id,name,email')
            // Gateway orders settle themselves; a human has nothing to verify,
            // so they never enter the review queue.
            ->where('gateway', Payment::GATEWAY_MANUAL)
            ->when($status, fn ($q) => $q->where('status', $status))
            ->latest()
            ->paginate($perPage);
    }

    /** Counts for the admin badge, one query instead of four. */
    public function counts(): array
    {
        $rows = Payment::query()
            ->where('gateway', Payment::GATEWAY_MANUAL)
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return [
            'pending' => (int) ($rows[Payment::PENDING] ?? 0),
            'paid' => (int) ($rows[Payment::PAID] ?? 0),
            'rejected' => (int) ($rows[Payment::REJECTED] ?? 0),
            'cancelled' => (int) ($rows[Payment::CANCELLED] ?? 0),
        ];
    }

    /**
     * Gateway orders are deliberately kept out of `all()` because a human has
     * nothing to verify on them. That leaves a blind spot: when a buyer says
     * "I paid but my credits never arrived", the admin needs to see the order
     * and its transaction id to check it against Pakasir. This is that view.
     */
    public function gatewayOrders(?string $status = null, int $perPage = 30): LengthAwarePaginator
    {
        return Payment::query()
            ->with('user:id,name,email')
            ->where('gateway', '!=', Payment::GATEWAY_MANUAL)
            ->when($status, fn ($q) => $q->where('status', $status))
            ->latest()
            ->paginate($perPage);
    }

    /** Gateway counts, split by status, for the admin sub-tab badge. */
    public function gatewayCounts(): array
    {
        $rows = Payment::query()
            ->where('gateway', '!=', Payment::GATEWAY_MANUAL)
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return [
            'pending' => (int) ($rows[Payment::PENDING] ?? 0),
            'paid' => (int) ($rows[Payment::PAID] ?? 0),
            'cancelled' => (int) ($rows[Payment::CANCELLED] ?? 0),
            'expired' => (int) ($rows[Payment::EXPIRED] ?? 0),
        ];
    }

    /** Orders that are pending but past their deadline, waiting to be swept. */
    public function stalePendingCount(int $hours = 24): int
    {
        return Payment::query()
            ->where('status', Payment::PENDING)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->where('expires_at', '>=', now()->subHours($hours))
            ->count();
    }
}
