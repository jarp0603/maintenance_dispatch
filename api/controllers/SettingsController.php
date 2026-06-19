<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\Auth;
use App\Middleware\Csrf;
use App\Models\AuditLog;
use App\Models\User;
use App\Utils\Database;
use App\Utils\Request;
use App\Utils\Response;

final class SettingsController
{
    /** GET /settings */
    public function get(array $params): void
    {
        Auth::requireAuth();
        $rows = Database::all('SELECT setting_key, setting_value FROM settings');
        $out = [];
        foreach ($rows as $r) {
            $out[$r['setting_key']] = $r['setting_value'];
        }
        Response::ok(['settings' => $out]);
    }

    /** PUT /settings — admin only */
    public function update(array $params): void
    {
        Auth::requireRole('administrator');
        Csrf::verify();
        $data = Request::json();
        foreach ($data as $key => $value) {
            if (!is_string($key) || !preg_match('/^[a-z0-9_]{1,100}$/', $key)) {
                continue;
            }
            Database::run(
                'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
                [$key, is_scalar($value) ? (string) $value : json_encode($value)]
            );
        }
        AuditLog::record(Auth::id(), 'settings.update', 'settings', null);
        $this->get($params);
    }

    /** GET /users/assignable — list techs/admins for assignment dropdowns */
    public function assignableUsers(array $params): void
    {
        Auth::requireAuth();
        Response::ok(['users' => User::listAssignable()]);
    }
}
