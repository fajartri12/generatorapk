<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CreditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CreditController extends Controller
{
    public function __construct(private readonly CreditService $credits) {}

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'data' => [
                ...$this->credits->summary($user),
                'transactions' => $user->wallet()->transactions()->limit(50)->get(),
            ],
        ]);
    }

    public function transactions(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->wallet()->transactions()->paginate(20),
        ]);
    }

    /**
     * The cost table lives in config, not in the frontend (AGENTS.md §27).
     */
    public function costs(): JsonResponse
    {
        return response()->json([
            'data' => $this->credits->costs(),
            'starting_balance' => config('md-generator.starting_balance'),
        ]);
    }
}
