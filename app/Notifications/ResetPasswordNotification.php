<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Indonesian copy for the framework's reset mail.
 *
 * Overriding the notification (instead of the broker) keeps Laravel's token
 * table, hashing, expiry and throttling exactly as shipped.
 */
class ResetPasswordNotification extends ResetPassword
{
    public function toMail($notifiable): MailMessage
    {
        // Tautan diarahkan langsung ke rute SPA (satu origin dengan API).
        // Dulu perlu mampir ke /reset-password/{token} milik backend karena
        // SPA hidup di origin lain; sekarang keduanya host yang sama.
        $url = sprintf(
            '%s/reset-password/%s?email=%s',
            rtrim(config('md-generator.frontend_url'), '/'),
            $this->token,
            urlencode($notifiable->getEmailForPasswordReset()),
        );

        $minutes = (int) config('auth.passwords.'.config('auth.defaults.passwords').'.expire', 60);

        return (new MailMessage)
            ->subject('Atur ulang password MDGenerator')
            ->greeting('Halo '.$notifiable->name.',')
            ->line('Kami menerima permintaan untuk mengatur ulang password akun Anda.')
            ->action('Atur ulang password', $url)
            ->line('Tautan ini berlaku '.$minutes.' menit dan hanya bisa dipakai sekali.')
            ->line('Kalau Anda tidak meminta ini, abaikan saja email ini. Password Anda tidak berubah.');
    }
}
