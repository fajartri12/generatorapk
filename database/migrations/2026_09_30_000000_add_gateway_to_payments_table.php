<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Pakasir (payment gateway) alongside the manual bank transfer.
     *
     * `gateway` records which rail an order belongs to. A manual order keeps
     * waiting for a human; a Pakasir order is settled by a webhook, so the admin
     * queue must be able to tell them apart and exclude the latter.
     *
     * `gateway_txn_id` is Pakasir's own id for the transaction. It is the only
     * key a webhook can be matched on: the invoice `code` never leaves our side
     * except inside the order_id, and a status lookup needs the txn id, not ours.
     * `gateway_method` and `gateway_is_sandbox` are stored so the UI can state
     * exactly what happened without another API call.
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->string('gateway', 20)->default('manual')->after('status');
            $table->string('gateway_txn_id', 60)->nullable()->after('gateway');
            $table->string('gateway_method', 30)->nullable()->after('gateway_txn_id');
            $table->boolean('gateway_is_sandbox')->default(false)->after('gateway_method');

            $table->index('gateway_txn_id');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex(['gateway_txn_id']);
            $table->dropColumn(['gateway', 'gateway_txn_id', 'gateway_method', 'gateway_is_sandbox']);
        });
    }
};
