<?php
declare(strict_types=1);

namespace App\Models;

use App\Utils\Database;
use App\Utils\Request;

final class AuditLog
{
    public static function record(?int $userId, string $action, ?string $entityType = null, ?int $entityId = null, ?string $detail = null): void
    {
        try {
            Database::run(
                'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, detail)
                 VALUES (?, ?, ?, ?, ?, ?)',
                [$userId, $action, $entityType, $entityId, Request::ipBinary(), $detail]
            );
        } catch (\Throwable $e) {
            // Auditing must never break the request.
            error_log('[audit] failed: ' . $e->getMessage());
        }
    }
}
