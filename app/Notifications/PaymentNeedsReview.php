<?php

namespace App\Notifications;

use App\Models\Payment;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Tells the administrator that a transfer order needs attention — either a new
 * order was opened or the user says they have paid and uploaded a receipt.
 *
 * Database channel only for now: this is an in-app inbox, and it deliberately
 * avoids the queue so the bell updates the moment the user acts.
 */
class PaymentNeedsReview extends Notification
{
    use Queueable;

    /** A brand-new order was opened. */
    public const OPENED = 'opened';

    /** The user submitted a transfer reference, so it is ready to verify. */
    public const SUBMITTED = 'submitted';

    public function __construct(
        private readonly Payment $payment,
        private readonly string $stage,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        $user = $this->payment->user;
        $who = $user?->name ?? 'Pengguna';

        return [
            'kind' => 'payment.review',
            'stage' => $this->stage,
            'title' => $this->stage === self::SUBMITTED
                ? "Konfirmasi transfer {$this->payment->code}"
                : "Pesanan kredit baru {$this->payment->code}",
            'body' => $this->stage === self::SUBMITTED
                ? "{$who} mengonfirmasi transfer {$this->payment->packageInfo()['label']} sebesar Rp".number_format($this->payment->amount, 0, ',', '.').'.'
                : "{$who} membuka pesanan paket {$this->payment->packageInfo()['label']} sebesar Rp".number_format($this->payment->amount, 0, ',', '.').'.',
            'payment_id' => $this->payment->id,
            'code' => $this->payment->code,
            'url' => '/app/manajemen/payments',
        ];
    }
}
