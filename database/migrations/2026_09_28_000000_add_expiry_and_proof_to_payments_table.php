<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * An unpaid order used to live forever: config('md-generator.payment_expiry_hours')
     * was sent to the UI but nothing enforced it. `expires_at` is set when the order
     * is created, extended when the user submits a reference, and a scheduled command
     * closes whatever is still pending past the deadline.
     *
     * `proof_path` already existed (unused); the upload endpoint is what finally
     * writes to it, and `proof_uploaded_at` lets the review queue show how stale a
     * receipt is. `proof_size` is stored so the admin screen can render a size
     * without touching the disk.
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->timestamp('expires_at')->nullable()->after('submitted_at');
            $table->timestamp('proof_uploaded_at')->nullable()->after('proof_path');
            $table->unsignedInteger('proof_size')->nullable()->after('proof_uploaded_at');

            $table->index(['status', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex(['status', 'expires_at']);
            $table->dropColumn(['expires_at', 'proof_uploaded_at', 'proof_size']);
        });
    }
};
