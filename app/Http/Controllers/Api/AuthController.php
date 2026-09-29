<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\CreditService;
use App\Services\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private readonly CreditService $credits,
        private readonly WhatsAppService $whatsapp,
    ) {}

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = User::create($data);

        // Every new account gets a wallet with the starting balance.
        $user->wallet();
        $this->credits->grant($user, config('md-generator.starting_balance'), 'Kredit awal pendaftaran');

        // Pengelola perlu tahu ada akun baru; kegagalannya tidak boleh
        // membatalkan pendaftaran yang sudah tersimpan.
        $this->whatsapp->notifyNewUser($user->name, $user->email, 'email');

        $token = $user->createToken('spa')->plainTextToken;

        return response()->json([
            'user' => $user->only(['id', 'name', 'email', 'role']),
            'token' => $token,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if ($user && $user->isGoogleOnly()) {
            throw ValidationException::withMessages([
                'email' => ['Akun ini dibuat dengan Google. Pakai tombol Masuk dengan Google.'],
            ]);
        }

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Email atau password salah.'],
            ]);
        }

        $user->wallet();

        return response()->json([
            'user' => $user->only(['id', 'name', 'email', 'role']),
            'token' => $user->createToken('spa')->plainTextToken,
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'user' => $user->only(['id', 'name', 'email', 'role']),
            'credits' => $this->credits->summary($user),
        ]);
    }

    /**
     * Email is intentionally not editable here: changing it would invalidate
     * the login identity without a verification flow.
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
        ]);

        $user->update($data);

        return response()->json([
            'user' => $user->only(['id', 'name', 'email', 'role']),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Berhasil keluar.']);
    }
}
