<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Progress stages so a long generation is observable while it runs
     * (AGENTS.md §17). `stage` is advanced server-side; the UI only reads it.
     */
    public function up(): void
    {
        Schema::table('generations', function (Blueprint $table) {
            $table->string('stage')->default('queued')->after('status');
            $table->timestamp('cancelled_at')->nullable()->after('error');
        });
    }

    public function down(): void
    {
        Schema::table('generations', function (Blueprint $table) {
            $table->dropColumn(['stage', 'cancelled_at']);
        });
    }
};
