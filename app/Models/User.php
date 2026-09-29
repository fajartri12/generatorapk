<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use App\Notifications\ResetPasswordNotification;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'google_id',
        'password',
        'role',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    /**
     * True for accounts created through Google that never set a password.
     * They can only sign in with Google until they reset a password.
     */
    public function isGoogleOnly(): bool
    {
        return $this->password === null && $this->google_id !== null;
    }

    /** Indonesian copy for the framework's password reset mail. */
    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }

    /** @return HasMany<Project, $this> */
    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }

    /** @return HasMany<Generation, $this> */
    public function generations(): HasMany
    {
        return $this->hasMany(Generation::class);
    }

    /** @return HasOne<CreditWallet, $this> */
    public function creditWallet(): HasOne
    {
        return $this->hasOne(CreditWallet::class);
    }

    /**
     * Wallets are provisioned lazily; nothing in the app should have to
     * remember to create one on registration.
     *
     * The wallet starts empty on purpose: the starting balance is granted
     * through the ledger (CreditService::grant), so seeding it here too would
     * credit every new user twice.
     */
    public function wallet(): CreditWallet
    {
        return $this->creditWallet()->firstOrCreate(
            [],
            ['balance' => 0, 'plan' => 'free'],
        );
    }
}
