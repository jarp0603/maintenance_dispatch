<?php
declare(strict_types=1);

namespace App\Middleware;

use App\Config\Config;
use App\Utils\Response;

/**
 * Session-based authentication with secure cookies and role checks.
 *
 * A successful login stores the user id, role, and a CSRF token in the PHP
 * session. The session cookie is HttpOnly + SameSite and Secure in production.
 */
final class Auth
{
    private static bool $started = false;

    public static function start(): void
    {
        if (self::$started || session_status() === PHP_SESSION_ACTIVE) {
            self::$started = true;
            return;
        }
        $secure = Config::isProduction(); // require HTTPS cookies in prod
        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'domain'   => '',
            'secure'   => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_name('mdsess');
        session_start();
        self::$started = true;
    }

    /** Establish a logged-in session. */
    public static function login(int $userId, string $role): void
    {
        self::start();
        session_regenerate_id(true); // prevent fixation
        $_SESSION['uid'] = $userId;
        $_SESSION['role'] = $role;
        if (empty($_SESSION['csrf'])) {
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
        }
    }

    public static function logout(): void
    {
        self::start();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
        }
        session_destroy();
    }

    public static function check(): bool
    {
        self::start();
        return !empty($_SESSION['uid']);
    }

    public static function id(): ?int
    {
        self::start();
        return isset($_SESSION['uid']) ? (int) $_SESSION['uid'] : null;
    }

    public static function role(): ?string
    {
        self::start();
        return $_SESSION['role'] ?? null;
    }

    public static function csrfToken(): string
    {
        self::start();
        if (empty($_SESSION['csrf'])) {
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf'];
    }

    /** Require a valid session or emit 401 and exit. */
    public static function requireAuth(): void
    {
        if (!self::check()) {
            Response::error('Unauthorized', 401);
        }
    }

    /** Require one of the given roles or emit 403 and exit. */
    public static function requireRole(string ...$roles): void
    {
        self::requireAuth();
        if (!in_array(self::role(), $roles, true)) {
            Response::error('Forbidden', 403);
        }
    }
}
