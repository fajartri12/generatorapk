<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Append-only trail for privileged actions: who changed what, on which
     * record, and what the values were before and after.
     *
     * `actor_id` is nullable with nullOnDelete so deleting an admin account
     * never erases the history of what they did — an audit row whose actor
     * vanished must survive, not cascade away.
     */
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');                       // e.g. payment.approve
            $table->string('subject_type')->nullable();     // model class
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('description');
            $table->json('changes')->nullable();            // ['status' => ['from' => 'pending', 'to' => 'paid']]
            $table->string('ip', 45)->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['action', 'created_at']);
            $table->index(['subject_type', 'subject_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
