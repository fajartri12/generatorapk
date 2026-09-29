<?php

namespace Database\Factories;

use App\Models\Generation;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Generation>
 */
class GenerationFactory extends Factory
{
    protected $model = Generation::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'project_id' => Project::factory(),
            'tool' => 'prd',
            'document_type' => 'prd',
            'status' => Generation::COMPLETED,
            'stage' => Generation::STAGE_DONE,
            'prompt_version' => 'PRD_V1',
            'provider' => 'mock',
            'model' => 'mock-1',
            'credits_used' => 5,
        ];
    }
}
