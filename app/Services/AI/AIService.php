<?php

namespace App\Services\AI;

use App\Models\Project;
use App\Services\AI\Prompts\ContextBuilder;
use App\Services\AI\Prompts\PromptTemplate;

/**
 * The single entry point feature code uses. It resolves a provider, builds the
 * versioned prompt, and returns a normalised response — callers never see a
 * vendor name (AGENTS.md §10).
 */
final class AIService
{
    public function __construct(
        private readonly ProviderFactory $factory,
        private readonly ContextBuilder $contextBuilder,
    ) {}

    public function contextFor(Project $project): array
    {
        return $this->contextBuilder->build($project);
    }

    public function generate(string $documentType, Project $project, array $input = []): GenerateResponse
    {
        $provider = $this->factory->make();
        $context = $this->contextBuilder->build($project);
        $template = PromptTemplate::get($documentType);

        $values = $context + ['context' => $this->flatten($context)];

        $request = new GenerateRequest(
            documentType: $documentType,
            promptVersion: PromptTemplate::version($documentType),
            systemPrompt: $template['system'],
            userPrompt: PromptTemplate::render($template['user'], $values),
            payload: $input + ['title' => $project->name, 'name' => $project->name],
            context: $context,
        );

        return $provider->generate($request);
    }

    /**
     * @param  array<string, string>  $context
     */
    private function flatten(array $context): string
    {
        $lines = [];

        foreach ($context as $key => $value) {
            if ($value !== '') {
                $lines[] = "### {$key}\n{$value}";
            }
        }

        return implode("\n\n", $lines);
    }
}
