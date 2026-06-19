<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Utils\Database;
use App\Utils\Response;

final class HealthController
{
    /** GET /health — liveness + DB connectivity check (no secrets). */
    public function check(array $params): void
    {
        $db = 'unknown';
        try {
            Database::one('SELECT 1');
            $db = 'ok';
        } catch (\Throwable $e) {
            $db = 'error';
            error_log('[health] db check failed: ' . $e->getMessage());
        }
        Response::ok(['status' => 'ok', 'database' => $db, 'time' => date('c')]);
    }
}
