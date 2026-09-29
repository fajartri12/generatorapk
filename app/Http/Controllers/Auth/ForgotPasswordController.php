<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;

class ForgotPasswordController extends Controller
{
    /**
     * Sends the reset link.
     *
     * Always answers with the same message: telling an anonymous caller which
     * addresses exist would turn this endpoint into an account enumeration tool.
     */
    public function send(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:190'],
        ]);

        Password::sendResetLink(['email' => $data['email']]);

        return response()->json([
            'message' => 'Kalau email itu terdaftar, kami sudah mengirim tautan untuk mengatur ulang password.',
        ]);
    }

    /**
     * Applies the new password.
     *
     * The email and token are what prove ownership, not a session, so this is
     * reachable while logged out.
     */
    public function reset(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email', 'max:190'],
            'password' => ['required', 'string', 'confirmed', PasswordRule::min(8)],
            // `confirmed` only checks this field; it does not put it in the
            // validated array, so it needs its own rule to be carried over.
            'password_confirmation' => ['required', 'string'],
        ]);

        $status = Password::reset(
            [
                'email' => $data['email'],
                'password' => $data['password'],
                'password_confirmation' => $data['password_confirmation'],
                'token' => $data['token'],
            ],
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();

                // Any stolen bearer token dies with the old password.
                $user->tokens()->delete();
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json([
                'message' => match ($status) {
                    Password::INVALID_TOKEN => 'Tautan itu sudah tidak berlaku. Minta tautan baru.',
                    Password::INVALID_USER => 'Email atau password salah.',
                    default => 'Tidak bisa mengatur ulang password. Coba lagi.',
                },
            ], 422);
        }

        return response()->json([
            'message' => 'Password Anda sudah diganti. Silakan masuk dengan password baru.',
        ]);
    }
}
