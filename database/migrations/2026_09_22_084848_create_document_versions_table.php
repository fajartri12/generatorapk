<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A generated document is never overwritten in place (AGENTS.md §13).
     * Every generation or manual edit appends a row here.
     */
    public function up(): void
    {
        Schema::create('document_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->longText('content');
            $table->string('author')->default('ai');       // ai | user
            $table->foreignId('generation_id')->nullable();
            $table->string('prompt_version')->nullable();
            $table->string('model')->nullable();
            $table->string('change_note')->nullable();
            $table->timestamps();

            $table->unique(['document_id', 'version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_versions');
    }
};
