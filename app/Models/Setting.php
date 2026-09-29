<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/**
 * Small key/value store for admin-tunable settings (currently the credit cost
 * table). Values live in the database so `php artisan cache:clear` can never
 * silently revert them; the cache layer is only a read-through shortener.
 */
class Setting extends Model
{
    public $timestamps = false;

    protected $fillable = ['key', 'value'];

    protected function casts(): array
    {
        return ['value' => 'array'];
    }

    private static function cacheKey(string $key): string
    {
        return "md-generator.setting.{$key}";
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return Cache::rememberForever(self::cacheKey($key), function () use ($key, $default) {
            return static::query()->where('key', $key)->value('value') ?? $default;
        });
    }

    public static function set(string $key, mixed $value): void
    {
        static::query()->updateOrCreate(['key' => $key], ['value' => $value]);

        Cache::forever(self::cacheKey($key), $value);
    }
}
