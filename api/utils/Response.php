<?php
declare(strict_types=1);

namespace App\Utils;

/**
 * JSON response helpers. Centralizes status codes and output escaping
 * (JSON encoding) so controllers never echo raw data.
 */
final class Response
{
    public static function json($data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function ok($data = null): void
    {
        self::json($data ?? ['success' => true], 200);
    }

    public static function created($data = null): void
    {
        self::json($data ?? ['success' => true], 201);
    }

    public static function noContent(): void
    {
        http_response_code(204);
        exit;
    }

    /**
     * Error response. `message` is safe, client-facing text only — never raw
     * SQL or exception internals. Optional field-level validation `errors`.
     */
    public static function error(string $message, int $status = 400, array $errors = []): void
    {
        $body = ['error' => $message];
        if ($errors !== []) {
            $body['errors'] = $errors;
        }
        self::json($body, $status);
    }
}
