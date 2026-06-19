<?php
declare(strict_types=1);

namespace App\Config;

/**
 * Minimal .env loader + config accessor.
 *
 * Loads KEY=VALUE pairs from a .env file (kept OUTSIDE web root when possible)
 * into an internal store. Falls back to real environment variables. Never echo
 * these values to clients.
 */
final class Config
{
    /** @var array<string,string> */
    private static array $store = [];
    private static bool $loaded = false;

    public static function load(string $envPath): void
    {
        if (self::$loaded) {
            return;
        }
        self::$loaded = true;

        // Allow an override path outside public_html via APP_ENV_PATH.
        $override = getenv('APP_ENV_PATH');
        if ($override !== false && is_file($override)) {
            $envPath = $override;
        }

        if (is_file($envPath) && is_readable($envPath)) {
            $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#') {
                    continue;
                }
                $pos = strpos($line, '=');
                if ($pos === false) {
                    continue;
                }
                $key = trim(substr($line, 0, $pos));
                $val = trim(substr($line, $pos + 1));
                // Strip surrounding quotes
                if (strlen($val) >= 2
                    && (($val[0] === '"' && substr($val, -1) === '"')
                        || ($val[0] === "'" && substr($val, -1) === "'"))) {
                    $val = substr($val, 1, -1);
                }
                self::$store[$key] = $val;
            }
        }
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        if (array_key_exists($key, self::$store)) {
            return self::$store[$key];
        }
        $env = getenv($key);
        if ($env !== false) {
            return $env;
        }
        return $default;
    }

    public static function bool(string $key, bool $default = false): bool
    {
        $v = self::get($key);
        if ($v === null) {
            return $default;
        }
        return in_array(strtolower($v), ['1', 'true', 'yes', 'on'], true);
    }

    public static function int(string $key, int $default = 0): int
    {
        $v = self::get($key);
        return $v === null || $v === '' ? $default : (int) $v;
    }

    public static function isProduction(): bool
    {
        return strtolower((string) self::get('APP_ENV', 'production')) === 'production';
    }
}
