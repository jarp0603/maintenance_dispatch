<?php
declare(strict_types=1);

namespace App\Middleware;

use App\Utils\Request;
use App\Utils\Response;

/**
 * CSRF protection for state-changing requests (POST/PUT/PATCH/DELETE).
 * The SPA reads the token from GET /auth/csrf (or /auth/me) and sends it back
 * in the X-CSRF-Token header. Compared against the session token.
 */
final class Csrf
{
    public static function verify(): void
    {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
            return; // safe methods
        }
        $sent = Request::header('X-CSRF-Token') ?? (string) Request::input('_csrf', '');
        $expected = Auth::csrfToken();
        if ($sent === '' || !hash_equals($expected, $sent)) {
            Response::error('Invalid or missing CSRF token', 419);
        }
    }
}
