<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Exceptions\PaymentException;
use App\Models\Payment;
use App\Services\PakasirService;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Receives Pakasir's payment webhook. Public by necessity: Pakasir's server
 * cannot authenticate as a user, so the shared secret in the X-Secret header is
 * what makes this endpoint safe to expose.
 *
 * It always answers 200 once the payload was understood. Replying 4xx/5xx makes
 * Pakasir retry, which is only desirable for genuine transport failures — a
 * signature miss or an unknown order_id must be logged and dropped instead, or
 * a misconfigured secret turns into an infinite retry loop on their side.
 */
class PakasirWebhookController extends Controller
{
    public function __construct(private readonly PaymentService $payments) {}

    public function handle(Request $request): JsonResponse
    {
        // 1) The shared secret. Pakasir sends it in X-Secret; a request without
        //    it, or with the wrong value, is not from Pakasir — log and drop.
        $secret = PakasirService::webhookSecret();
        $given = (string) $request->header('X-Secret', '');

        if ($secret === null) {
            Log::warning('pakasir.webhook_rejected', ['reason' => 'secret belum dikonfigurasi']);

            return response()->json(['message' => 'Webhook belum dikonfigurasi.'], 503);
        }

        if (! hash_equals($secret, $given)) {
            Log::warning('pakasir.webhook_rejected', ['reason' => 'X-Secret tidak cocok']);

            // Deliberately 200: a wrong secret is a configuration problem, not a
            // transient failure, and retrying cannot fix it.
            return response()->json(['message' => 'Secret tidak valid.']);
        }

        $payload = $request->json()->all();

        $txnId = (string) ($payload['txn_id'] ?? '');
        $orderId = (string) ($payload['order_id'] ?? '');

        if ($txnId === '' || $orderId === '') {
            Log::warning('pakasir.webhook_rejected', ['reason' => 'payload tidak lengkap']);

            return response()->json(['message' => 'Payload tidak lengkap.']);
        }

        // 2) Match the order. The webhook echoes our invoice code as order_id;
        //    txn_id is the authoritative key, order_id only narrows the lookup.
        $payment = Payment::query()
            ->where('gateway', Payment::GATEWAY_PAKASIR)
            ->where('gateway_txn_id', $txnId)
            ->first();

        if ($payment === null && filled($orderId)) {
            $payment = Payment::query()
                ->where('gateway', Payment::GATEWAY_PAKASIR)
                ->where('code', $orderId)
                ->first();
        }

        if ($payment === null) {
            // Common while a project points at the wrong environment — log it
            // loudly, but do not 4xx or Pakasir will hammer this endpoint.
            Log::warning('pakasir.webhook_unmatched', ['txn_id' => $txnId, 'order_id' => $orderId]);

            return response()->json(['message' => 'Pesanan tidak ditemukan.']);
        }

        // 3) Only a completed payment settles. `pending` and `canceled` are
        //    informational here; expiry of a stale order is expiryStale()'s job
        //    so one path owns state transitions.
        if (($payload['status'] ?? '') === 'completed') {
            // A completed webhook with no `amount` is still worth settling: the
            // payload carries txn_id, and the status endpoint can confirm the
            // figure later. Verifying a value we do not have would just drop a
            // legitimate payment.
            $reported = isset($payload['amount']) ? (int) $payload['amount'] : null;

            try {
                $this->payments->settleGatewayOrder($payment, $request->ip(), $reported);
            } catch (PaymentException $e) {
                // A mismatch must NOT be answered 200: Pakasir would treat it as
                // delivered and the payment would sit uncredited forever with
                // nobody alerted. 409 is deliberate, signalling a condition a
                // retry will not fix, while the log tells us to look.
                Log::error('pakasir.settlement_refused', [
                    'code' => $payment->code,
                    'txn_id' => $txnId,
                    'reason' => $e->getMessage(),
                ]);

                return response()->json(['message' => $e->getMessage()], $e->status);
            }
        }

        return response()->json(['message' => 'OK']);
    }
}
