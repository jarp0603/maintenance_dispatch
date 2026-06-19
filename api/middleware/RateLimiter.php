<?php
declare(strict_types=1);

namespace App\Middleware;

use App\Utils\Database;
use App\Utils\Request;
use App\Utils\Response;

/**
 * Login-attempt throttling backed by the login_attempts table.
 * Blocks after too many recent failures for an IP or username.
 */
final class RateLimiter
{
    private const MAX_FAILURES = 5;
    private const WINDOW_MINUTES = 15;

    /** Throws a 429 if the caller has too many recent failed logins. */
    public static function guardLogin(?string $username): void
    {
        $ipBin = Request::ipBinary();
        $window = (int) self::WINDOW_MINUTES; // class constant, safe to inline
        $sql = "SELECT COUNT(*) AS c FROM login_attempts
                WHERE successful = 0
                  AND attempted_at > (NOW() - INTERVAL {$window} MINUTE)
                  AND (ip_address = ? OR username = ?)";
        $row = Database::one($sql, [$ipBin, $username]);
        if ($row && (int) $row['c'] >= self::MAX_FAILURES) {
            Response::error('Too many login attempts. Please try again later.', 429);
        }
    }

    public static function record(?string $username, bool $success): void
    {
        Database::run(
            'INSERT INTO login_attempts (username, ip_address, successful) VALUES (?, ?, ?)',
            [$username, Request::ipBinary(), $success ? 1 : 0]
        );
    }
}
