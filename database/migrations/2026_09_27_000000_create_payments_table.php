<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A manual bank-transfer top-up. The user picks a package, transfers the
     * money outside the app, then proves it with a reference number. An admin
     * reviews and either approves (credits are granted through CreditService)
     * or rejects. Nothing here mutates a balance on its own.
     */
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();          // invoice number shown to the user
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('package');                 // key into config('md-generator.packages')
            $table->integer('credits');
            $table->integer('amount');                 // IDR, integer rupiah
            $table->string('status')->default('pending'); // pending | paid | rejected | cancelled
            $table->string('transfer_reference')->nullable();
            $table->string('proof_path')->nullable();  // uploaded receipt, optional
            $table->text('note')->nullable();          // user note on submit
            $table->text('admin_note')->nullable();    // reason on approve/reject
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
