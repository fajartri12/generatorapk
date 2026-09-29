<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ProjectController extends Controller
{
    /**
     * Every query is scoped to the authenticated user's own rows. A user must
     * never reach another user's project by changing an ID (AGENTS.md §18).
     */
    public function index(Request $request): JsonResponse
    {
        $projects = $request->user()
            ->projects()
            ->withCount('documents')
            ->with('context')
            ->latest()
            ->get();

        return response()->json(['data' => $projects]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:2000'],
            'icon' => ['nullable', 'string', 'max:4'],
            'color' => ['nullable', 'string', 'max:9'],
            'tags' => ['nullable', 'array'],
            'context' => ['nullable', 'array'],
            'context.summary' => ['nullable', 'string'],
            'context.audience' => ['nullable', 'string'],
            'context.problem' => ['nullable', 'string'],
            'context.features' => ['nullable', 'string'],
            'context.business_goal' => ['nullable', 'string'],
            'context.tech_stack' => ['nullable', 'array'],
        ]);

        $project = $request->user()->projects()->create([
            'name' => $data['name'],
            'slug' => Str::slug($data['name']).'-'.Str::lower(Str::random(4)),
            'description' => $data['description'] ?? null,
            'icon' => $data['icon'] ?? 'MD',
            'color' => $data['color'] ?? '#4f46e5',
            'tags' => $data['tags'] ?? [],
        ]);

        if (! empty($data['context'])) {
            $project->context()->create($data['context']);
        }

        return response()->json(['data' => $project->load('context')], 201);
    }

    public function show(Request $request, Project $project): JsonResponse
    {
        $this->authorizeProject($request, $project);

        return response()->json([
            'data' => $project->load([
                'context',
                'documents.versions' => fn ($q) => $q->orderByDesc('version')->limit(1),
            ]),
        ]);
    }

    public function update(Request $request, Project $project): JsonResponse
    {
        $this->authorizeProject($request, $project);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:2000'],
            'icon' => ['nullable', 'string', 'max:4'],
            'color' => ['nullable', 'string', 'max:9'],
            'tags' => ['nullable', 'array'],
            'status' => ['nullable', 'in:active,archived'],
        ]);

        $project->update($data);

        return response()->json(['data' => $project]);
    }

    public function destroy(Request $request, Project $project): JsonResponse
    {
        $this->authorizeProject($request, $project);

        $project->delete();

        return response()->json(['message' => 'Proyek dihapus.']);
    }

    public function updateContext(Request $request, Project $project): JsonResponse
    {
        $this->authorizeProject($request, $project);

        $data = $request->validate([
            'summary' => ['nullable', 'string'],
            'audience' => ['nullable', 'string'],
            'problem' => ['nullable', 'string'],
            'features' => ['nullable', 'string'],
            'business_goal' => ['nullable', 'string'],
            'tech_stack' => ['nullable', 'array'],
        ]);

        $context = $project->context()->updateOrCreate([], $data);

        return response()->json(['data' => $context]);
    }

    private function authorizeProject(Request $request, Project $project): void
    {
        abort_unless($project->user_id === $request->user()->id, 403, 'Akses ditolak.');
    }
}
