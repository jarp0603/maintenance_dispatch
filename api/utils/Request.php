<?php
declare(strict_types=1);

namespace App\Utils;

/**
 * Request helpers: path normalization, JSON body parsing, query/header access.
 */
final class Request
{
    private static ?array $jsonCache = null;

    /**
     * The request path relative to the API root, without query string,
     * with a leading slash and no trailing slash (except "/").
     * e.g. /api/work-orders/12?x=1 -> /work-orders/12
     */
    public static function path(): string
    {
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        $path = parse_url($uri, PHP_URL_PATH) ?: '/';

        // Strip a leading /api (the front controller lives under /api).
        if (strpos($path, '/api') === 0) {
            $path = substr($path, 4);
        }
        if ($path === '' || $path === false) {
            $path = '/';
        }
        // Normalize trailing slash
        if ($path !== '/' && substr($path, -1) === '/') {
            $path = rtrim($path, '/');
        }
        return $path;
    }

    /** Parsed JSON body as an associative array (empty array if none/invalid). */
    public static function json(): array
    {
        if (self::$jsonCache !== null) {
            return self::$jsonCache;
        }
        $raw = file_get_contents('php://input') ?: '';
        $decoded = json_decode($raw, true);
        self::$jsonCache = is_array($decoded) ? $decoded : [];
        return self::$jsonCache;
    }

    /** Single body field. */
    public static function input(string $key, $default = null)
    {
        $body = self::json();
        return $body[$key] ?? $default;
    }

    /** Query-string parameter. */
    public static function query(string $key, $default = null)
    {
        return $_GET[$key] ?? $default;
    }

    public static function header(string $name): ?string
    {
        $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        return $_SERVER[$key] ?? null;
    }

    /** Client IP in binary form for storage (inet_pton); null if invalid. */
    public static function ipBinary(): ?string
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $bin = @inet_pton($ip);
        return $bin === false ? null : $bin;
    }

    public static function ip(): string
    {
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
}
