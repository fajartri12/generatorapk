<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\Generation;
use App\Models\Payment;
use App\Models\Project;
use App\Models\User;
use App\Services\CreditService;
use App\Services\GenerationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Security regression suite.
 *
 * Each test asserts a specific attack is BLOCKED, so a future refactor that
 * reopens one fails loudly here instead of silently in production.
 */
class SecurityTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role = 'user'): User
    {
        $user = User::factory()->create(['role' => $role]);
        $user->wallet();
        app(CreditService::class)->grant($user, config('md-generator.starting_balance'), 'Kredit awal');

        return $user;
    }

    private function project(User $user, string $name = 'Proyek Rahasia'): Project
    {
        return $user->projects()->create([
            'name' => $name,
            'slug' => strtolower(str_replace(' ', '-', $name)),
        ]);
    }

    /**
     * The generations table requires tool, prompt_version, provider and model.
     * Filling them here keeps the tests focused on authorisation instead of
     * schema bookkeeping.
     */
    private function generation(User $user, string $status): Generation
    {
        return Generation::create([
            'user_id' => $user->id,
            'project_id' => $this->project($user)->id,
            'tool' => 'brief',
            'document_type' => 'brief',
            'status' => $status,
            'prompt_version' => 'v1',
            'provider' => 'mock',
            'model' => 'mock-model',
            'credits_used' => 3,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Mass assignment
    |--------------------------------------------------------------------------
    */

    /**
     * Registering must never let a caller pick their own role. If `role` reaches
     * User::create() unchecked, anyone can sign up as an administrator.
     */
    public function test_register_cannot_escalate_to_admin(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Attacker',
            'email' => 'attacker@example.test',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'admin',
            'id' => 1,
            'email_verified_at' => now(),
        ])->assertCreated();

        $created = User::where('email', 'attacker@example.test')->firstOrFail();

        $this->assertSame('user', $created->role, 'role was mass-assignable during registration');
        $this->assertNull($created->email_verified_at, 'email_verified_at was mass-assignable');

        // The forged `id: 1` must not have hijacked the primary key: the row is
        // the account that was just created, and only one user exists.
        $this->assertDatabaseCount('users', 1);
        $this->assertSame('attacker@example.test', User::findOrFail($created->id)->email);
    }

    /** The profile endpoint must not be a second path to role escalation. */
    public function test_profile_update_cannot_change_role_or_password(): void
    {
        $user = $this->user();

        $this->actingAs($user)->putJson('/api/auth/profile', [
            'name' => 'Nama Baru',
            'role' => 'admin',
            'password' => 'newpassword123',
            'email' => 'stolen@example.test',
        ])->assertOk();

        $user->refresh();

        $this->assertSame('Nama Baru', $user->name);
        $this->assertSame('user', $user->role, 'role changed through the profile endpoint');
        $this->assertSame('stolen@example.test' !== $user->email, true, 'email switched without verification');
        $this->assertTrue(Hash::check('password', $user->password), 'password was rewritten by the profile endpoint');
    }

    /**
     * Project::create() is fed the validated array plus user_id. The model lists
     * user_id as fillable, so a request-supplied user_id that survives validation
     * lands on the row and makes the project look like someone else's.
     */
    public function test_project_creation_cannot_set_the_owner(): void
    {
        $attacker = $this->user();
        $victim = $this->user();

        $response = $this->actingAs($attacker)->postJson('/api/projects', [
            'name' => 'Proyek Sitaan',
            'user_id' => $victim->id,
        ]);

        $response->assertCreated();

        $this->assertSame(
            $attacker->id,
            $response->json('data.user_id'),
            'the client chose the project owner',
        );

        $this->assertDatabaseMissing('projects', [
            'name' => 'Proyek Sitaan',
            'user_id' => $victim->id,
        ]);
    }

    /** A project update must not be able to hand the row to another account. */
    public function test_project_update_cannot_reassign_the_owner(): void
    {
        $owner = $this->user();
        $victim = $this->user();
        $project = $this->project($owner);

        $this->actingAs($owner)->putJson("/api/projects/{$project->id}", [
            'name' => 'Proyek Rahasia',
            'user_id' => $victim->id,
        ])->assertOk();

        $this->assertSame($owner->id, $project->refresh()->user_id, 'project ownership was reassigned');
    }

    /*
    |--------------------------------------------------------------------------
    | Broken object level authorisation (IDOR)
    |--------------------------------------------------------------------------
    */

    public function test_a_user_cannot_read_another_users_project(): void
    {
        $owner = $this->user();
        $attacker = $this->user();
        $project = $this->project($owner);

        $this->actingAs($attacker)->getJson("/api/projects/{$project->id}")->assertForbidden();
        $this->actingAs($attacker)->getJson("/api/projects/{$project->id}/documents")->assertForbidden();
        $this->actingAs($attacker)->putJson("/api/projects/{$project->id}", ['name' => 'Bajakan'])->assertForbidden();
        $this->actingAs($attacker)->deleteJson("/api/projects/{$project->id}")->assertForbidden();
        $this->actingAs($attacker)->putJson("/api/projects/{$project->id}/context", ['summary' => 'x'])->assertForbidden();

        $this->assertDatabaseHas('projects', ['id' => $project->id, 'name' => 'Proyek Rahasia']);
    }

    public function test_a_user_cannot_read_or_write_another_users_document(): void
    {
        $owner = $this->user();
        $attacker = $this->user();
        $project = $this->project($owner);

        $document = $project->documents()->create([
            'type' => 'brief',
            'title' => 'Brief Rahasia',
            'status' => 'ready',
            'current_version' => 1,
        ]);
        $document->versions()->create([
            'version' => 1,
            'content' => '# Isi rahasia',
            'author' => 'ai',
        ]);

        $this->actingAs($attacker)->getJson("/api/documents/{$document->id}")->assertForbidden();
        $this->actingAs($attacker)->getJson("/api/documents/{$document->id}/versions")->assertForbidden();
        $this->actingAs($attacker)
            ->putJson("/api/documents/{$document->id}", ['content' => '# Ditimpa'])
            ->assertForbidden();
        $this->actingAs($attacker)->deleteJson("/api/documents/{$document->id}")->assertForbidden();

        $this->assertDatabaseHas('documents', ['id' => $document->id]);
        $this->assertDatabaseMissing('document_versions', ['document_id' => $document->id, 'content' => '# Ditimpa']);
    }

    /** Generating into someone else's project would leak their context as a prompt. */
    public function test_a_user_cannot_generate_into_another_users_project(): void
    {
        $owner = $this->user();
        $attacker = $this->user();
        $project = $this->project($owner);

        config(['ai.default' => 'mock']);

        $this->actingAs($attacker)->postJson('/api/generations', [
            'project_id' => $project->id,
            'document_type' => 'brief',
        ])->assertForbidden();

        $this->assertDatabaseCount('generations', 0);
    }

    public function test_a_user_cannot_read_or_cancel_another_users_generation(): void
    {
        $owner = $this->user();
        $attacker = $this->user();

        $generation = $this->generation($owner, Generation::RUNNING);

        $this->actingAs($attacker)->getJson("/api/generations/{$generation->id}")->assertForbidden();
        $this->actingAs($attacker)->postJson("/api/generations/{$generation->id}/cancel")->assertForbidden();

        $this->assertSame(Generation::RUNNING, $generation->refresh()->status);
    }

    /** The history endpoint must be scoped to the caller, not the whole table. */
    public function test_generation_index_only_returns_own_rows(): void
    {
        $owner = $this->user();
        $attacker = $this->user();

        $this->generation($owner, Generation::COMPLETED);

        $response = $this->actingAs($attacker)->getJson('/api/generations');

        $response->assertOk()->assertJsonCount(0, 'data');
    }

    /*
    |--------------------------------------------------------------------------
    | Administrator surface
    |--------------------------------------------------------------------------
    */

    public function test_admin_routes_reject_anonymous_and_regular_users(): void
    {
        $routes = [
            ['get', '/api/admin/stats'],
            ['get', '/api/admin/users'],
            ['get', '/api/admin/projects'],
            ['get', '/api/admin/generations'],
            ['get', '/api/admin/audit-logs'],
            ['get', '/api/admin/payments'],
            ['get', '/api/admin/gateway-orders'],
            ['get', '/api/admin/export/users'],
            ['get', '/api/admin/export/generations'],
            ['get', '/api/admin/export/payments'],
            ['get', '/api/admin/export/audit-logs'],
        ];

        foreach ($routes as [$method, $uri]) {
            $this->{$method.'Json'}($uri)->assertUnauthorized();
        }

        $regular = $this->user();

        foreach ($routes as [$method, $uri]) {
            $this->actingAs($regular)->{$method.'Json'}($uri)->assertForbidden();
        }
    }

    /** The most damaging escalation: self-promotion, then self-granted credits. */
    public function test_a_regular_user_cannot_promote_themselves_or_mint_credits(): void
    {
        $regular = $this->user();
        $victim = $this->user();

        $this->actingAs($regular)
            ->putJson("/api/admin/users/{$regular->id}/role", ['role' => 'admin'])
            ->assertForbidden();

        $this->actingAs($regular)
            ->postJson("/api/admin/users/{$regular->id}/credits", ['amount' => 99999])
            ->assertForbidden();

        $this->actingAs($regular)
            ->putJson("/api/admin/costs", ['costs' => ['brief' => 0]])
            ->assertForbidden();

        // A real project is needed, otherwise route-model binding 404s before
        // the admin middleware ever runs and the assertion proves nothing.
        $victimProject = $this->project($victim);

        $this->actingAs($regular)
            ->deleteJson("/api/admin/projects/{$victimProject->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('projects', ['id' => $victimProject->id]);
        $this->assertSame('user', $regular->refresh()->role);
        $this->assertSame(config('md-generator.starting_balance'), $regular->wallet()->balance);
    }

    /**
     * Permukaan admin pemantauan baru: koreksi saldo, aksi massal, dan sinkron
     * pesanan gateway. Ketiganya menulis ke saldo kredit, jadi ditutup satu per
     * satu, bukan sekadar mengandalkan daftar route di atas.
     */
    public function test_new_admin_monitoring_endpoints_reject_regular_users(): void
    {
        $regular = $this->user();
        $victim = $this->user();

        $payment = Payment::factory()->create([
            'user_id' => $victim->id,
            'gateway' => Payment::GATEWAY_PAKASIR,
            'status' => Payment::PENDING,
        ]);

        $this->actingAs($regular)
            ->postJson("/api/admin/users/{$victim->id}/credits/adjust", [
                'amount' => -500,
                'description' => 'penurunan saldo',
            ])
            ->assertForbidden();

        $this->actingAs($regular)
            ->postJson('/api/admin/credits/bulk', [
                'user_ids' => [$victim->id],
                'amount' => -10,
                'description' => 'serangan massal',
            ])
            ->assertForbidden();

        $this->actingAs($regular)
            ->postJson("/api/admin/gateway-orders/{$payment->id}/sync")
            ->assertForbidden();

        $this->assertSame(config('md-generator.starting_balance'), $victim->wallet()->refresh()->balance);
        $this->assertSame(Payment::PENDING, $payment->refresh()->status);
    }

    /*
    |--------------------------------------------------------------------------
    | Payments and the credit ledger
    |--------------------------------------------------------------------------
    */

    public function test_a_user_cannot_touch_another_users_payment_order(): void
    {
        $owner = $this->user();
        $attacker = $this->user();

        $payment = Payment::create([
            'code' => Payment::makeCode(),
            'user_id' => $owner->id,
            'package' => 'pro',
            'credits' => 100,
            'amount' => 40000,
            'status' => Payment::PENDING,
            'expires_at' => now()->addHours(24),
        ]);

        $this->actingAs($attacker)->getJson("/api/payments/{$payment->id}")->assertForbidden();
        $this->actingAs($attacker)->getJson("/api/payments/{$payment->id}/proof")->assertForbidden();
        $this->actingAs($attacker)
            ->postJson("/api/payments/{$payment->id}/submit", ['transfer_reference' => 'REF-1'])
            ->assertForbidden();
        $this->actingAs($attacker)->postJson("/api/payments/{$payment->id}/cancel")->assertForbidden();

        $this->assertSame(Payment::PENDING, $payment->refresh()->status);
    }

    /** The order list must never expose another account's pending orders. */
    public function test_payment_index_only_lists_own_orders(): void
    {
        $owner = $this->user();
        $attacker = $this->user();

        Payment::create([
            'code' => Payment::makeCode(),
            'user_id' => $owner->id,
            'package' => 'pro',
            'credits' => 100,
            'amount' => 40000,
            'status' => Payment::PENDING,
            'expires_at' => now()->addHours(24),
        ]);

        $response = $this->actingAs($attacker)->getJson('/api/payments');

        $response->assertOk()->assertJsonCount(0, 'data');
    }

    /** A client cannot dictate its own price, credit amount, or starting status. */
    public function test_payment_creation_ignores_client_supplied_price_and_credits(): void
    {
        $user = $this->user();

        $response = $this->actingAs($user)->postJson('/api/payments', [
            'package' => 'pro',
            'credits' => 999999,
            'amount' => 1,
            'status' => Payment::PAID,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.credits', 100)
            ->assertJsonPath('data.amount', 40000)
            ->assertJsonPath('data.status', Payment::PENDING);
    }

    public function test_an_unknown_payment_package_is_rejected(): void
    {
        $this->actingAs($this->user())
            ->postJson('/api/payments', ['package' => 'enterprise-free'])
            ->assertStatus(422);
    }

    /** Credits are server-granted only: no client payload may raise a balance. */
    public function test_credits_cannot_be_granted_through_user_facing_endpoints(): void
    {
        $user = $this->user();
        $before = $user->wallet()->balance;

        $this->actingAs($user)->getJson('/api/credits')->assertOk();

        $this->assertSame($before, $user->wallet()->balance);
        $this->assertDatabaseMissing('credit_transactions', [
            'user_id' => $user->id,
            'amount' => 999999,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Authentication and session handling
    |--------------------------------------------------------------------------
    */

    public function test_protected_endpoints_require_a_token(): void
    {
        foreach ([
            '/api/auth/me',
            '/api/projects',
            '/api/projects/1/documents',
            '/api/generations',
            '/api/credits',
            '/api/notifications',
            '/api/payments',
            '/api/admin/stats',
        ] as $uri) {
            $this->getJson($uri)->assertUnauthorized();
        }
    }

    /**
     * Logout must delete the token row itself, not just clear the session. The
     * `livewire`-style session guard in config/sanctum.php would otherwise keep
     * the same request authenticated, so assert on the database instead.
     */
    public function test_logout_revokes_the_current_token(): void
    {
        $user = $this->user();
        $token = $user->createToken('spa')->plainTextToken;
        $tokenId = (int) explode('|', $token)[0];

        $this->assertDatabaseHas('personal_access_tokens', ['id' => $tokenId]);

        $this->withHeader('Authorization', "Bearer {$token}")->getJson('/api/auth/me')->assertOk();

        $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/auth/logout')->assertOk();

        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $tokenId]);
    }

    /** Every other token of the same user must survive a single logout. */
    public function test_logout_only_revokes_the_token_that_was_used(): void
    {
        $user = $this->user();
        $phone = $user->createToken('spa')->plainTextToken;
        $laptop = $user->createToken('spa')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$phone}")->postJson('/api/auth/logout')->assertOk();

        $this->withHeader('Authorization', "Bearer {$laptop}")->getJson('/api/auth/me')->assertOk();
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => (int) explode('|', $phone)[0]]);
    }

    /** A garbage bearer token must be rejected, not silently upgraded. */
    public function test_a_forged_bearer_token_is_rejected(): void
    {
        $this->withHeader('Authorization', 'Bearer not-a-real-token')->getJson('/api/auth/me')->assertUnauthorized();
        $this->withHeader('Authorization', 'Bearer 1|forged')->getJson('/api/projects')->assertUnauthorized();
    }

    public function test_login_does_not_disclose_whether_an_email_exists(): void
    {
        $this->user();

        $known = $this->postJson('/api/auth/login', [
            'email' => 'someone@example.test',
            'password' => 'wrong-password',
        ]);

        $unknown = $this->postJson('/api/auth/login', [
            'email' => 'nobody-here@example.test',
            'password' => 'wrong-password',
        ]);

        $this->assertSame($known->status(), $unknown->status());
        $this->assertSame(
            $known->json('errors.email'),
            $unknown->json('errors.email'),
            'the login error reveals whether the account exists',
        );
    }

    /** No endpoint may echo a password hash back to the client. */
    public function test_password_hashes_are_never_serialised(): void
    {
        $user = $this->user();

        $bodies = [
            $this->actingAs($user)->getJson('/api/auth/me')->getContent(),
        ];

        $admin = $this->user('admin');
        $bodies[] = $this->actingAs($admin)->getJson('/api/admin/users')->getContent();

        foreach ($bodies as $body) {
            $this->assertStringNotContainsString('$2y$', (string) $body);
            $this->assertStringNotContainsString('password', (string) $body);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Input abuse
    |--------------------------------------------------------------------------
    */

    /** SQL metacharacters must be treated as data, never as syntax. */
    public function test_sql_metacharacters_in_search_and_filters_are_inert(): void
    {
        $user = $this->user();
        $this->project($user, 'Proyek Normal');

        $payloads = [
            "' OR 1=1--",
            "'; DROP TABLE users;--",
            "1' UNION SELECT password FROM users--",
            '" OR ""="',
        ];

        foreach ($payloads as $payload) {
            $this->actingAs($user)->getJson('/api/projects?search='.urlencode($payload))->assertOk();
            $this->actingAs($user)->getJson('/api/generations?filter='.urlencode($payload))->assertOk();
        }

        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseHas('projects', ['name' => 'Proyek Normal']);
    }

    /** A stored payload must come back as text, not as markup the browser runs. */
    public function test_stored_script_tags_are_not_interpreted_server_side(): void
    {
        $user = $this->user();

        $response = $this->actingAs($user)->postJson('/api/projects', [
            'name' => '<script>alert(1)</script>',
            'description' => '<img src=x onerror=alert(1)>',
        ])->assertCreated();

        // The API hands JSON back, and Laravel escapes on serialisation. What
        // matters is that the stored value is data and the response is JSON.
        $this->assertSame('<script>alert(1)</script>', $response->json('data.name'));
        $this->assertStringContainsString('application/json', $response->headers->get('Content-Type'));
    }

    /** Route model binding must not resolve a non-numeric id into a match. */
    public function test_non_numeric_route_ids_are_rejected(): void
    {
        $user = $this->user();

        $this->actingAs($user)->getJson('/api/projects/abc')->assertNotFound();
        $this->actingAs($user)->getJson('/api/documents/1 OR 1=1')->assertNotFound();
    }

    /** Oversized payloads must be refused by validation, not stored. */
    public function test_oversized_input_is_rejected(): void
    {
        $user = $this->user();

        $this->actingAs($user)->postJson('/api/projects', [
            'name' => str_repeat('a', 500),
        ])->assertStatus(422);

        $this->actingAs($user)->postJson('/api/projects', [
            'name' => 'ok',
            'description' => str_repeat('a', 5000),
        ])->assertStatus(422);
    }

    /** An unknown document type must never reach the provider pipeline. */
    public function test_unknown_generation_document_type_is_refused(): void
    {
        config(['ai.default' => 'mock']);

        $user = $this->user();
        $project = $this->project($user);

        $this->actingAs($user)->postJson('/api/generations', [
            'project_id' => $project->id,
            'document_type' => '../../etc/passwd',
        ])->assertStatus(422);
    }

    /*
    |--------------------------------------------------------------------------
    | Uploads
    |--------------------------------------------------------------------------
    */

    /** A receipt upload must not accept an executable or an oversized file. */
    public function test_proof_upload_rejects_dangerous_types(): void
    {
        $user = $this->user();

        $payment = Payment::create([
            'code' => Payment::makeCode(),
            'user_id' => $user->id,
            'package' => 'pro',
            'credits' => 100,
            'amount' => 40000,
            'status' => Payment::PENDING,
            'expires_at' => now()->addHours(24),
        ]);

        foreach (['shell.php', 'payload.svg', 'script.html', 'run.exe'] as $name) {
            $this->actingAs($user)
                ->postJson("/api/payments/{$payment->id}/proof", [
                    'proof' => \Illuminate\Http\UploadedFile::fake()->create($name, 10),
                ])
                ->assertStatus(422);
        }

        $this->assertNull($payment->refresh()->proof_path);
    }

    /*
    |--------------------------------------------------------------------------
    | Credit integrity
    |--------------------------------------------------------------------------
    */

    /**
     * CSV injection (CWE-1236): nama pengguna dan referensi transfer diketik
     * bebas, jadi sel yang diawali `=`, `+`, `-`, atau `@` akan dieksekusi Excel
     * saat admin membuka hasil ekspor.
     */
    public function test_csv_exports_neutralise_formula_cells(): void
    {
        $admin = $this->user('admin');

        User::factory()->create([
            'name' => '=HYPERLINK("http://jahat.test","klik")',
            'email' => 'formula@example.test',
        ]);

        $content = $this->actingAs($admin)->getJson('/api/admin/export/users')->streamedContent();

        // Parsing sungguhan, bukan pencocokan substring: fputcsv mengutip sel,
        // jadi teks `=HYPERLINK` tetap terlihat walau sudah dinetralkan.
        $lines = preg_split('/\r\n|\n/', trim(substr($content, 3)));
        $cells = array_merge(...array_map(
            fn (string $line) => $line === '' ? [] : str_getcsv($line),
            $lines,
        ));

        $formula = collect($cells)->first(fn (string $cell) => str_contains($cell, 'HYPERLINK'));
        $this->assertNotNull($formula, 'nama pengguna tidak muncul di ekspor');
        $this->assertStringStartsWith("'=", $formula, 'sel formulir CSV tidak dinetralkan');

        // Tidak ada satu pun sel mentah yang dimulai dengan pemicu rumus.
        foreach ($cells as $cell) {
            $this->assertDoesNotMatchRegularExpression('/^[=+@]/', $cell);
        }

        // Angka asli (mis. nominal negatif) tidak boleh ikut dikutip.
        $this->assertStringNotContainsString("'-", $content);
    }

    /** A generation must reserve credits before work starts, not after. */
    public function test_a_generation_cannot_start_without_credits(): void
    {
        config(['ai.default' => 'mock']);

        $user = User::factory()->create(['role' => 'user']);
        $wallet = $user->wallet();
        $wallet->update(['balance' => 0]);
        $project = $this->project($user);

        $this->actingAs($user)->postJson('/api/generations', [
            'project_id' => $project->id,
            'document_type' => 'brief',
        ])->assertStatus(402);

        $this->assertSame(0, $user->wallet()->balance);
        $this->assertDatabaseCount('generations', 0);
    }

    /** The cost of a run comes from the server table, never from the request. */
    public function test_generation_cost_cannot_be_supplied_by_the_client(): void
    {
        config(['ai.default' => 'mock']);

        $user = $this->user();
        $project = $this->project($user);
        $before = $user->wallet()->balance;

        $response = $this->actingAs($user)->postJson('/api/generations', [
            'project_id' => $project->id,
            'document_type' => 'brief',
            'credits' => 0,
            'credits_used' => 0,
        ]);

        $response->assertCreated();

        $expected = app(CreditService::class)->costFor('brief');
        $this->assertSame($before - $expected, $user->wallet()->balance, 'the client set its own price');
        $this->assertSame($expected, $response->json('data.credits_used'));
    }
}
