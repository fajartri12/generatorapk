<?php

namespace App\Notifications;

use App\Models\Payment;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Tells the buyer what an admin decided, so they stop wondering (and stop
 * opening a duplicate order to find out).
 *
 * Queued? No: an approval changes a balance, and the notification must be in
 * the inbox by the time the admin sees the success toast.
 */
class PaymentDecided extends Notification
{
    use Queueable;

    public function __construct(private readonly Payment $payment) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        $approved = $this->payment->status === Payment::PAID;
        $reason = filled($this->payment->admin_note) ? " Catatan admin: {$this->payment->admin_note}" : '';

        return [
            'kind' => 'payment.decision',
            'approved' => $approved,
            'title' => $approved
                ? "Pembayaran {$this->payment->code} disetujui"
                : "Pembayaran {$this->payment->code} ditolak",
            'body' => $approved
                ? "{$this->payment->credits} kredit sudah masuk ke saldo Anda."
                : 'Transfer Anda belum dapat kami verifikasi.'.$reason,
            'credits' => $this->payment->credits,
            'payment_id' => $this->payment->id,
            'code' => $this->payment->code,
            'url' => '/app/payments',
        ];
    }
}
