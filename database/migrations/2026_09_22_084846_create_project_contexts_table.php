<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The reusable context every generator reads from (AGENTS.md §7).
     * One project has exactly one context, so downstream tools never ask the
     * user to repeat information.
     */
    public function up(): void
    {
        Schema::create('project_contexts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->unique()->constrained()->cascadeOnDelete();
            $table->text('summary')->nullable();
            $table->text('audience')->nullable();
            $table->text('problem')->nullable();
            $table->text('features')->nullable();
            $table->text('business_goal')->nullable();
            $table->json('tech_stack')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_contexts');
    }
};
