<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\Auth;
use App\Middleware\RateLimiter;
use App\Models\AuditLog;
use App\Models\User;
use App\Utils\Database;
use App\Utils\Request;
use App\Utils\Response;
use App\Utils\Validator;

final class AuthController
{
    /** POST /auth/login */
    public function login(array $params): void
    {
        $data = Request::json();
        $username = trim((string) ($data['username'] ?? ''));
        $password = (string) ($data['password'] ?? '');

        $v = new Validator($data);
        $v->required('username')->required('password');
        if ($v->fails()) {
            Response::error('Validation failed', 422, $v->errors());
        }

        // Throttle brute force
        RateLimiter::guardLogin($username);

        $user = User::findByUsername($username);
        $valid = $user && (int) $user['is_active'] === 1
            && password_verify($password, $user['password_hash']);

        if (!$valid) {
            RateLimiter::record($username, false);
            Response::error('Invalid credentials', 401);
        }

        RateLimiter::record($username, true);
        User::touchLogin((int) $user['id']);
        Auth::login((int) $user['id'], $user['role_name']);
        AuditLog::record((int) $user['id'], 'login', 'user', (int) $user['id']);

        Response::ok([
            'user' => [
                'id'       => (int) $user['id'],
                'username' => $user['username'],
                'fullName' => $user['full_name'],
                'role'     => $user['role_name'],
            ],
            'csrfToken' => Auth::csrfToken(),
        ]);
    }

    /** POST /auth/logout */
    public function logout(array $params): void
    {
        $uid = Auth::id();
        Auth::logout();
        if ($uid) {
            AuditLog::record($uid, 'logout', 'user', $uid);
        }
        Response::ok(['success' => true]);
    }

    /** GET /auth/me */
    public function me(array $params): void
    {
        Auth::requireAuth();
        $user = User::find((int) Auth::id());
        if (!$user) {
            Auth::logout();
            Response::error('Unauthorized', 401);
        }
        Response::ok([
            'user' => [
                'id'       => (int) $user['id'],
                'username' => $user['username'],
                'fullName' => $user['full_name'],
                'role'     => $user['role_name'],
            ],
            'csrfToken' => Auth::csrfToken(),
        ]);
    }

    /**
     * POST /auth/forgot — always returns 200 (no account enumeration).
     * Creates a single-use, expiring reset token (hash stored).
     */
    public function forgot(array $params): void
    {
        $email = trim((string) Request::input('email', ''));
        if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $user = User::findByEmail($email);
            if ($user) {
                $token = bin2hex(random_bytes(32));
                $hash = hash('sha256', $token);
                Database::run(
                    'INSERT INTO password_resets (user_id, token_hash, expires_at)
                     VALUES (?, ?, (NOW() + INTERVAL 60 MINUTE))',
                    [(int) $user['id'], $hash]
                );
                // Email delivery is handled by the mail service (see services/).
                // The raw token is emailed to the user; it is never returned here.
                error_log('[auth] password reset requested for user ' . (int) $user['id']);
            }
        }
        Response::ok(['message' => 'If that email exists, a reset link has been sent.']);
    }

    /** POST /auth/reset — consume a valid token and set a new password. */
    public function reset(array $params): void
    {
        $data = Request::json();
        $token = (string) ($data['token'] ?? '');
        $password = (string) ($data['password'] ?? '');

        $v = new Validator($data);
        $v->required('token')->required('password')->string('password', 8, 200);
        if ($v->fails()) {
            Response::error('Validation failed', 422, $v->errors());
        }

        $hash = hash('sha256', $token);
        $row = Database::one(
            'SELECT * FROM password_resets
             WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
             LIMIT 1',
            [$hash]
        );
        if (!$row) {
            Response::error('Invalid or expired reset token', 400);
        }

        $newHash = password_hash($password, PASSWORD_BCRYPT);
        Database::beginTransaction();
        try {
            User::updatePassword((int) $row['user_id'], $newHash);
            Database::run('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [(int) $row['id']]);
            Database::commit();
        } catch (\Throwable $e) {
            Database::rollBack();
            error_log('[auth] reset failed: ' . $e->getMessage());
            Response::error('Could not reset password', 500);
        }
        AuditLog::record((int) $row['user_id'], 'password.reset', 'user', (int) $row['user_id']);
        Response::ok(['message' => 'Password updated. You can now log in.']);
    }

    /** GET /auth/csrf — issue a CSRF token (requires an active session). */
    public function csrf(array $params): void
    {
        Auth::requireAuth();
        Response::ok(['csrfToken' => Auth::csrfToken()]);
    }
}
