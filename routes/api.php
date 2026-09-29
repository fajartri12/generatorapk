<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AdminPaymentController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Auth\ForgotPasswordController;
use App\Http\Controllers\Api\CreditController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\GenerationController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PakasirWebhookController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\SocialAuthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public routes
|--------------------------------------------------------------------------
*/

// Credential endpoints are throttled to blunt brute-force and signup spam.
Route::middleware('throttle:auth')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/forgot-password', [ForgotPasswordController::class, 'send']);
    Route::post('/auth/reset-password', [ForgotPasswordController::class, 'reset']);
});

// Whether Google sign-in is offered. Read once by the SPA on the auth page.
Route::get('/auth/google/status', [SocialAuthController::class, 'status']);

// Exchanges the one-time code from the OAuth callback for a Sanctum token.
Route::post('/auth/google/exchange', [SocialAuthController::class, 'exchange'])->middleware('throttle:auth');

// Cost table is public so the landing page can show pricing without a token.
Route::get('/credits/costs', [CreditController::class, 'costs']);

/*
|--------------------------------------------------------------------------
| Pakasir webhook
|--------------------------------------------------------------------------
| Pakasir's server cannot hold a Sanctum token, so this route is public and is
| authenticated by the X-Secret header instead (verified inside the controller
| with hash_equals). Throttled so a burst cannot be used to probe order codes.
*/
Route::post('/pakasir/webhook', [PakasirWebhookController::class, 'handle'])->middleware('throttle:auth');

/*
|--------------------------------------------------------------------------
| Authenticated routes
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::apiResource('projects', ProjectController::class);
    Route::put('/projects/{project}/context', [ProjectController::class, 'updateContext']);

    Route::get('/projects/{project}/documents', [DocumentController::class, 'index']);
    Route::get('/documents/{document}', [DocumentController::class, 'show']);
    Route::get('/documents/{document}/versions', [DocumentController::class, 'versions']);
    Route::put('/documents/{document}', [DocumentController::class, 'update']);
    Route::delete('/documents/{document}', [DocumentController::class, 'destroy']);

    // Generation costs real provider quota, so it is rate limited per user (P1-7).
    Route::post('/generations', [GenerationController::class, 'store'])->middleware('throttle:generations');
    Route::get('/generations', [GenerationController::class, 'index']);
    Route::get('/generations/{generation}', [GenerationController::class, 'show']);
    Route::post('/generations/{generation}/cancel', [GenerationController::class, 'cancel']);

    Route::get('/credits', [CreditController::class, 'show']);
    Route::get('/credits/transactions', [CreditController::class, 'transactions']);

    /*
    |--------------------------------------------------------------------------
    | In-app notification inbox
    |--------------------------------------------------------------------------
    */
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread', [NotificationController::class, 'unread']);
    Route::post('/notifications/read-all', [NotificationController::class, 'readAll']);
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'read']);

    /*
    |--------------------------------------------------------------------------
    | Manual bank-transfer payments
    |--------------------------------------------------------------------------
    | The user creates an order, transfers outside the app, then submits a
    | reference. Credits are only granted when an admin approves.
    */
    Route::get('/payments', [PaymentController::class, 'index']);
    Route::post('/payments', [PaymentController::class, 'store']);

    // Pakasir rail: create a gateway order, re-check its status, and (sandbox
    // only) simulate a payment so the flow can be completed without real money.
    Route::post('/payments/pakasir/checkout', [PaymentController::class, 'checkout']);
    Route::post('/payments/{payment}/sync', [PaymentController::class, 'sync']);
    Route::post('/payments/{payment}/simulate', [PaymentController::class, 'simulate']);

    Route::get('/payments/{payment}', [PaymentController::class, 'show']);
    Route::post('/payments/{payment}/submit', [PaymentController::class, 'submit']);
    Route::post('/payments/{payment}/cancel', [PaymentController::class, 'cancel']);
    // Receipt upload + read. Files land on the private disk, so this authorised
    // route is the only way to see them.
    Route::post('/payments/{payment}/proof', [PaymentController::class, 'proof']);
    Route::get('/payments/{payment}/proof', [PaymentController::class, 'proofFile']);

    /*
    |--------------------------------------------------------------------------
    | Administrator routes (auth:sanctum + admin)
    |--------------------------------------------------------------------------
    */
    Route::middleware('admin')->prefix('admin')->group(function () {
        Route::get('/stats', [AdminController::class, 'stats']);
        Route::get('/users', [AdminController::class, 'users']);
        Route::post('/users', [AdminController::class, 'createUser']);
        Route::put('/users/{user}/role', [AdminController::class, 'updateUserRole']);
        Route::put('/users/{user}/plan', [AdminController::class, 'updatePlan']);
        Route::post('/users/{user}/credits', [AdminController::class, 'grantCredits']);
        // Koreksi saldo (boleh negatif) + versi massal untuk banyak pengguna.
        Route::post('/users/{user}/credits/adjust', [AdminController::class, 'adjustCredits']);
        Route::post('/credits/bulk', [AdminController::class, 'bulkGrantCredits']);
        Route::get('/projects', [AdminController::class, 'projects']);
        Route::delete('/projects/{project}', [AdminController::class, 'deleteProject']);
        Route::get('/generations', [AdminController::class, 'generations']);
        Route::put('/costs', [AdminController::class, 'updateCosts']);
        Route::get('/bank', [AdminController::class, 'bankSettings']);
        Route::put('/bank', [AdminController::class, 'updateBankSettings']);
        Route::get('/audit-logs', [AdminController::class, 'auditLogs']);

        // Ekspor CSV. Tanpa parameter filter tambahan: berkasnya untuk arsip.
        Route::get('/export/users', [AdminController::class, 'exportUsers']);
        Route::get('/export/generations', [AdminController::class, 'exportGenerations']);
        Route::get('/export/payments', [AdminController::class, 'exportPayments']);
        Route::get('/export/audit-logs', [AdminController::class, 'exportAudit']);

        // Manual transfer review queue.
        Route::get('/payments', [AdminPaymentController::class, 'index']);
        Route::post('/payments/{payment}/approve', [AdminPaymentController::class, 'approve']);
        Route::post('/payments/{payment}/reject', [AdminPaymentController::class, 'reject']);
        Route::get('/payments/{payment}/proof', [AdminPaymentController::class, 'proof']);

        // Pesanan gateway (Pakasir) tidak masuk antrean verifikasi, jadi
        // punya tampilannya sendiri plus tombol periksa ulang.
        Route::get('/gateway-orders', [AdminPaymentController::class, 'gatewayIndex']);
        Route::post('/gateway-orders/{payment}/sync', [AdminPaymentController::class, 'gatewaySync']);
    });
});
