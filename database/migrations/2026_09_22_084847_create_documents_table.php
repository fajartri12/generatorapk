<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('type');          // brief, prd, srs, sdd, database, api, ui_ux, wbs, agents_md
            $table->string('title');
            $table->string('status')->default('draft'); // draft, generating, ready, failed, archived
            $table->unsignedInteger('current_version')->default(0);
            $table->timestamps();

            $table->unique(['project_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
