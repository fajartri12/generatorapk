<?php

namespace App\Services\AI\Prompts;

use App\Models\Project;

/**
 * Turns a project (plus whatever documents already exist) into the context
 * bag every prompt reads from. This is the "never repeat information you
 * already have" rule from AGENTS.md §7 made concrete.
 */
final class ContextBuilder
{
    private const MAX_DOCUMENT_CHARS = 6000;

    /**
     * @return array<string, string>
     */
    public function build(Project $project): array
    {
        $context = $project->context;
        $documents = $project->documents()->with('versions')->get()->keyBy('type');

        $latest = fn (string $type): string => $documents->get($type)?->latestVersion()?->content ?? '';

        return [
            'name' => (string) $project->name,
            'summary' => (string) ($context?->summary ?? $project->description ?? ''),
            'audience' => (string) ($context?->audience ?? ''),
            'problem' => (string) ($context?->problem ?? ''),
            'features' => (string) ($context?->features ?? ''),
            'business_goal' => (string) ($context?->business_goal ?? ''),
            'tech_stack' => implode(', ', $context?->tech_stack ?? []),
            'brief' => $this->trim($latest('brief')),
            'prd' => $this->trim($latest('prd')),
            'srs' => $this->trim($latest('srs')),
            'sdd' => $this->trim($latest('sdd')),
            'database' => $this->trim($latest('database')),
            'api' => $this->trim($latest('api')),
            'ui_ux' => $this->trim($latest('ui_ux')),
            'wbs' => $this->trim($latest('wbs')),
            'user_stories' => $this->trim($latest('user_stories')),
            'tasks_md' => $this->trim($latest('tasks_md')),
            'readme_md' => $this->trim($latest('readme_md')),
            'agents_md' => $this->trim($latest('agents_md')),
            'tech_stack' => $this->trim($latest('tech_stack')) ?: implode(', ', $context?->tech_stack ?? []),
            'user_flow' => $this->trim($latest('user_flow')),
            'design_system' => $this->trim($latest('design_system')),
            'figma_prompt' => $this->trim($latest('figma_prompt')),
            'dev_prompt' => $this->trim($latest('dev_prompt')),
            'personas' => $this->trim($latest('personas')),
            'test_plan' => $this->trim($latest('test_plan')),
            'security_review' => $this->trim($latest('security_review')),
            'microcopy' => $this->trim($latest('microcopy')),
        ];
    }

    /**
     * A whole PRD plus an SDD plus an API spec will not fit in one prompt.
     * Downstream prompts only need the shape of earlier work, so cap it.
     */
    private function trim(string $content): string
    {
        return mb_strlen($content) > self::MAX_DOCUMENT_CHARS
            ? mb_substr($content, 0, self::MAX_DOCUMENT_CHARS)."\n\n[…] dipotong"
            : $content;
    }
}
