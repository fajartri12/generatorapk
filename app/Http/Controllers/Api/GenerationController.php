<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\InsufficientCreditsException;
use App\Exceptions\UnsupportedDocumentTypeException;
use App\Http\Controllers\Controller;
use App\Models\Generation;
use App\Models\Project;
use App\Services\CreditService;
use App\Services\GenerationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GenerationController extends Controller
{
    public function __construct(
        private readonly GenerationService $generations,
        private readonly CreditService $credits,
    ) {}

    /**
     * The cost is returned alongside the result so the UI can show it before
     * and after without a second round trip (AGENTS.md §11).
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'integer', 'exists:projects,id'],
            'document_type' => ['required', 'string'],
            'input' => ['nullable', 'array'],
        ]);

        $project = Project::findOrFail($data['project_id']);
        abort_unless($project->user_id === $request->user()->id, 403, 'Akses ditolak.');

        try {
            $generation = $this->generations->queue(
                $request->user(),
                $project,
                $data['document_type'],
                $data['input'] ?? [],
            );
        } catch (InsufficientCreditsException $e) {
            // 402: the balance was read while holding the wallet lock, so this
            // is the authoritative answer, not a stale pre-check (P0-1).
            return response()->json([
                'message' => $e->getMessage(),
                'required' => $e->required,
                'balance' => $e->balance,
            ], 402);
        } catch (UnsupportedDocumentTypeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'data' => $generation->load('document'),
            'credits' => $this->credits->summary($request->user()),
        ], 201);
    }

    /**
     * Cancel a generation that has not finished yet. The reserved credits are
     * refunded; the running job discards its output when it notices.
     */
    public function cancel(Request $request, Generation $generation): JsonResponse
    {
        abort_unless($generation->user_id === $request->user()->id, 403, 'Akses ditolak.');

        $generation->cancel();

        return response()->json([
            'data' => $generation,
            'credits' => $this->credits->summary($request->user()),
        ]);
    }

    public function show(Request $request, Generation $generation): JsonResponse
    {
        abort_unless($generation->user_id === $request->user()->id, 403, 'Akses ditolak.');

        return response()->json(['data' => $generation]);
    }

    public function index(Request $request): JsonResponse
    {
        $generations = $request->user()
            ->generations()
            ->latest()
            ->limit(50)
            ->get();

        return response()->json(['data' => $generations]);
    }
}
