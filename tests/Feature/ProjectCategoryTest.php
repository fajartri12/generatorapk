<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Kategori proyek disimpan di kolom `tags` yang sudah ada, jadi tidak ada kolom
 * baru untuk dijaga. Yang perlu dipastikan hanya dua: label yang dikirim klien
 * benar-benar tersimpan, dan label itu tidak pernah bisa ditafsirkan sebagai
 * markup saat dibaca kembali.
 */
class ProjectCategoryTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        return User::factory()->create();
    }

    public function test_a_project_keeps_the_categories_sent_on_create(): void
    {
        $user = $this->user();

        $response = $this->actingAs($user)->postJson('/api/projects', [
            'name' => 'Kasir Kelontong',
            'tags' => ['Web App', 'Dashboard'],
        ])->assertCreated();

        $this->assertSame(['Web App', 'Dashboard'], $response->json('data.tags'));

        // Dibaca ulang dari database, bukan hanya dari payload respons.
        $this->assertSame(
            ['Web App', 'Dashboard'],
            Project::query()->where('name', 'Kasir Kelontong')->firstOrFail()->tags,
        );
    }

    public function test_a_project_without_categories_defaults_to_an_empty_list(): void
    {
        $user = $this->user();

        $response = $this->actingAs($user)->postJson('/api/projects', [
            'name' => 'Tanpa Kategori',
        ])->assertCreated();

        $this->assertSame([], $response->json('data.tags'));
    }

    public function test_categories_can_be_changed_after_creation(): void
    {
        $user = $this->user();
        $project = $user->projects()->create(['name' => 'Awal', 'slug' => 'awal']);

        $this->actingAs($user)
            ->putJson("/api/projects/{$project->id}", ['tags' => ['Mobile App']])
            ->assertOk()
            ->assertJsonPath('data.tags', ['Mobile App']);

        $this->assertSame(['Mobile App'], $project->refresh()->tags);
    }

    /** Kategori adalah data yang ditampilkan, bukan HTML yang dijalankan. */
    public function test_categories_are_stored_as_plain_text(): void
    {
        $user = $this->user();

        $response = $this->actingAs($user)->postJson('/api/projects', [
            'name' => 'Proyek Normal',
            'tags' => ['<script>alert(1)</script>'],
        ])->assertCreated();

        $this->assertSame('<script>alert(1)</script>', $response->json('data.tags.0'));
        $this->assertStringContainsString('application/json', $response->headers->get('Content-Type'));
    }

    /** Kategori bukan vektor untuk menulis kolom lain. */
    public function test_categories_cannot_carry_extra_columns(): void
    {
        $user = $this->user();
        $victim = $this->user();

        $this->actingAs($user)->postJson('/api/projects', [
            'name' => 'Proyek Aman',
            'tags' => ['Web App'],
            'user_id' => $victim->id,
            'status' => 'archived',
        ])->assertCreated();

        $this->assertDatabaseHas('projects', [
            'name' => 'Proyek Aman',
            'user_id' => $user->id,
            'status' => 'active',
        ]);
    }

    public function test_categories_are_returned_in_the_project_list(): void
    {
        $user = $this->user();
        $user->projects()->create(['name' => 'Daftar', 'slug' => 'daftar', 'tags' => ['Landing Page']]);

        $this->actingAs($user)
            ->getJson('/api/projects')
            ->assertOk()
            ->assertJsonPath('data.0.tags', ['Landing Page']);
    }
}
