<?php
declare(strict_types=1);

namespace App\Models;

use App\Utils\Database;

final class User
{
    public static function findByUsername(string $username): ?array
    {
        return Database::one(
            'SELECT u.*, r.name AS role_name
             FROM users u JOIN roles r ON r.id = u.role_id
             WHERE u.username = ? LIMIT 1',
            [$username]
        );
    }

    public static function findByEmail(string $email): ?array
    {
        return Database::one(
            'SELECT u.*, r.name AS role_name
             FROM users u JOIN roles r ON r.id = u.role_id
             WHERE u.email = ? LIMIT 1',
            [$email]
        );
    }

    public static function find(int $id): ?array
    {
        return Database::one(
            'SELECT u.id, u.username, u.email, u.full_name, u.phone, u.is_active,
                    u.last_login_at, r.name AS role_name
             FROM users u JOIN roles r ON r.id = u.role_id
             WHERE u.id = ? LIMIT 1',
            [$id]
        );
    }

    public static function touchLogin(int $id): void
    {
        Database::run('UPDATE users SET last_login_at = NOW() WHERE id = ?', [$id]);
    }

    public static function updatePassword(int $id, string $hash): void
    {
        Database::run('UPDATE users SET password_hash = ? WHERE id = ?', [$hash, $id]);
    }

    /** Technicians + admins for assignment dropdowns. */
    public static function listAssignable(): array
    {
        return Database::all(
            "SELECT u.id, u.username, u.full_name, r.name AS role_name
             FROM users u JOIN roles r ON r.id = u.role_id
             WHERE u.is_active = 1
             ORDER BY u.full_name"
        );
    }
}
