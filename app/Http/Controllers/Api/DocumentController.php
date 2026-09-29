<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DocumentController extends Controller
{
    public function index(Request $request, Project $project): JsonResponse
    {
        $this->authorizeProject($request, $project);

        return response()->json([
            'data' => $project->documents()->with('versions')->get(),
        ]);
    }

    public function show(Request $request, Document $document): JsonResponse
    {
        $this->authorizeDocument($request, $document);

        return response()->json([
            'data' => $document->load('versions'),
        ]);
    }

    public function versions(Request $request, Document $document): JsonResponse
    {
        $this->authorizeDocument($request, $document);

        return response()->json([
            'data' => $document->versions()->get(),
        ]);
    }

    /**
     * A manual edit appends a version — it never overwrites one (AGENTS.md §13).
     */
    public function update(Request $request, Document $document): JsonResponse
    {
        $this->authorizeDocument($request, $document);

        $data = $request->validate([
            'content' => ['required', 'string'],
            'change_note' => ['nullable', 'string', 'max:190'],
        ]);

        $next = $document->current_version + 1;

        $version = $document->versions()->create([
            'version' => $next,
            'content' => $data['content'],
            'author' => 'user',
            'change_note' => $data['change_note'] ?? "Suntingan manual v{$next}",
        ]);

        $document->update([
            'current_version' => $next,
            'status' => 'ready',
        ]);

        return response()->json(['data' => $version], 201);
    }

    public function destroy(Request $request, Document $document): JsonResponse
    {
        $this->authorizeDocument($request, $document);

        $document->delete();

        return response()->json(['message' => 'Dokumen dihapus.']);
    }

    private function authorizeProject(Request $request, Project $project): void
    {
        abort_unless($project->user_id === $request->user()->id, 403, 'Akses ditolak.');
    }

    private function authorizeDocument(Request $request, Document $document): void
    {
        $this->authorizeProject($request, $document->project()->firstOrFail());
    }
}
