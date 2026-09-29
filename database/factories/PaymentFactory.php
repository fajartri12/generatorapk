<?php

namespace Database\Factories;

use App\Models\Payment;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Payment>
 */
class PaymentFactory extends Factory
{
    protected $model = Payment::class;

    public function definition(): array
    {
        return [
            'code' => Payment::makeCode(),
            'user_id' => User::factory(),
            'package' => 'pro',
            'credits' => 100,
            'amount' => 40000,
            'status' => Payment::PENDING,
        ];
    }

    public function paid(): static
    {
        return $this->state(fn () => [
            'status' => Payment::PAID,
            'transfer_reference' => 'TRF-'.random_int(100000, 999999),
            'submitted_at' => now(),
            'reviewed_at' => now(),
        ]);
    }

    /** A Pakasir order: paid by gateway, so no reference and no receipt. */
    public function gateway(): static
    {
        return $this->state(fn () => [
            'gateway' => Payment::GATEWAY_PAKASIR,
            'gateway_txn_id' => 'txn_'.random_int(100000, 999999),
            'gateway_method' => 'payment_link',
            'gateway_is_sandbox' => true,
        ]);
    }
}
