<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\CreditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Turns a browser-completed Google OAuth handshake into the same bearer token
 * the password flow issues.
 *
 * The handshake lives in a *web* route (the provider needs the session to store
 * the `state` nonce), but the SPA is stateless and sends `Authorization: Bearer`.
 * So the callback stashes a one-time code and redirects back to the SPA, which
 * trades that code for a token here.
 */
class SocialAuthController extends Controller
{
    public function __construct(private readonly CreditService $credits) {}

    /** The SPA calls this when it lands on /auth/google/callback?code=... */
    public function exchange(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string'],
        ]);

        $userId = Cache::pull($this->cacheKey($data['code']));

        // Cache::pull already consumed it, so a replay lands here as a null.
        if (! $userId) {
            return response()->json(['message' => 'Kode masuk sudah kedaluwarsa. Coba lagi.'], 401);
        }

        $user = User::find($userId);

        if (! $user) {
            return response()->json(['message' => 'Akun tidak ditemukan.'], 401);
        }

        $user->wallet();

        return response()->json([
            'user' => $user->only(['id', 'name', 'email', 'role']),
            'token' => $user->createToken('spa')->plainTextToken,
        ]);
    }

    /** Whether the SPA should render the Google button at all. */
    public function status(): JsonResponse
    {
        return response()->json([
            'enabled' => self::configured(),
        ]);
    }

    /**
     * Called by the web callback once Google has confirmed the identity.
     * Keeps the OAuth specifics out of the route file.
     */
    public static function issueLoginCode(User $user): string
    {
        $code = Str::random(48);

        Cache::put(self::cacheKey($code), $user->id, now()->addMinutes(2));

        return $code;
    }

    public static function configured(): bool
    {
        return filled(config('services.google.client_id'))
            && filled(config('services.google.client_secret'));
    }

    public static function resolveRedirect(): string
    {
        $redirect = (string) config('services.google.redirect');

        return Str::startsWith($redirect, ['http://', 'https://']) ? $redirect : url($redirect);
    }

    private static function cacheKey(string $code): string
    {
        return 'google-login:'.$code;
    }
}
