<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Every AI operation is recorded so it stays observable and recoverable
     * (AGENTS.md §9). Records prompt version, model, input, context, output.
     */
    public function up(): void
    {
        Schema::create('generations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('document_id')->nullable()->constrained()->nullOnDelete();
            $table->string('tool');
            $table->string('document_type');
            $table->string('status')->default('pending'); // pending, running, completed, failed
            $table->string('prompt_version');
            $table->string('provider');
            $table->string('model');
            $table->json('input')->nullable();
            $table->json('context_snapshot')->nullable();
            $table->longText('output')->nullable();
            $table->text('error')->nullable();
            $table->unsignedInteger('credits_used')->default(0);
            $table->unsignedInteger('duration_ms')->nullable();
            $table->timestamps();

            $table->index(['project_id', 'document_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('generations');
    }
};
