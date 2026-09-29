<?php

use App\Http\Controllers\Api\SocialAuthController;
use App\Models\User;
use App\Services\CreditService;
use App\Services\WhatsAppService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;

/*
|--------------------------------------------------------------------------
| Web routes: browser redirects only
|--------------------------------------------------------------------------
| UI adalah hasil build statis di public/build, disajikan Laravel langsung
| (berkas nyata menang atas fallback) — tidak ada Vite/npm. Yang tersisa di
| sini hanya rute yang memang harus dimiliki browser: handshake OAuth
| (Socialite menyimpan nonce `state` di sesi, yang tidak bisa dipegang SPA
| berbasis token).
*/

/*
|--------------------------------------------------------------------------
| Google OAuth
|--------------------------------------------------------------------------
| These must be web routes: Socialite stores its `state` nonce in the session.
| The SPA never renders these pages, it is redirected away and back.
*/
Route::get('/auth/google/redirect', function () {
    abort_unless(SocialAuthController::configured(), 404);

    return Socialite::driver('google')
        ->redirectUrl(SocialAuthController::resolveRedirect())
        ->redirect();
})->middleware('throttle:auth');

Route::get('/auth/google/callback', function () {
    abort_unless(SocialAuthController::configured(), 404);

    try {
        $google = Socialite::driver('google')
            ->redirectUrl(SocialAuthController::resolveRedirect())
            ->user();
    } catch (Throwable) {
        return redirect(config('md-generator.frontend_url').'/login?google=error');
    }

    $email = $google->getEmail();

    // Some Google accounts expose no email. Without one there is nothing to key
    // the account on, so refuse rather than create a half-account.
    if (blank($email)) {
        return redirect(config('md-generator.frontend_url').'/login?google=no-email');
    }

    $user = User::where('google_id', $google->getId())->first()
        ?? User::where('email', $email)->first();

    if ($user) {
        // Linking on Google's verified email also upgrades password accounts.
        if (! $user->google_id) {
            $user->forceFill(['google_id' => $google->getId()])->save();
        }
    } else {
        // email_verified_at is trustworthy here: Google already proved ownership.
        $user = User::create([
            'name' => $google->getName() ?: Str::before($email, '@'),
            'email' => $email,
            'google_id' => $google->getId(),
            'email_verified_at' => now(),
        ]);

        $user->wallet();
        app(CreditService::class)->grant(
            $user,
            config('md-generator.starting_balance'),
            'Kredit awal pendaftaran',
        );

        // Akun Google juga pendaftaran baru, jadi pengelola perlu notifikasi
        // yang sama seperti alur email.
        app(WhatsAppService::class)->notifyNewUser($user->name, $user->email, 'google');
    }

    // Redirect to a distinct SPA path: reusing /auth/google/callback would hit
    // this same route again and restart the handshake.
    return redirect(config('md-generator.frontend_url').'/auth/google/done?code='.SocialAuthController::issueLoginCode($user));
})->middleware('throttle:auth');

