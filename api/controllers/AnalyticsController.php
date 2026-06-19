<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\Auth;
use App\Models\WorkOrder;
use App\Utils\Database;
use App\Utils\Response;

final class AnalyticsController
{
    /** GET /analytics/overview */
    public function overview(array $params): void
    {
        Auth::requireRole('administrator');
        $byStatus = Database::all(
            'SELECT status, COUNT(*) AS count FROM work_orders
             WHERE archived_at IS NULL GROUP BY status'
        );
        $byPriority = Database::all(
            'SELECT priority, COUNT(*) AS count FROM work_orders
             WHERE archived_at IS NULL GROUP BY priority'
        );
        Response::ok([
            'stats'      => WorkOrder::stats(),
            'byStatus'   => $byStatus,
            'byPriority' => $byPriority,
        ]);
    }

    /** GET /analytics/by-type */
    public function byType(array $params): void
    {
        Auth::requireRole('administrator');
        Response::ok(['byType' => Database::all(
            'SELECT issue_type, COUNT(*) AS count FROM work_orders
             WHERE archived_at IS NULL GROUP BY issue_type ORDER BY count DESC'
        )]);
    }

    /** GET /analytics/by-day  — created counts for the last 30 days */
    public function byDay(array $params): void
    {
        Auth::requireRole('administrator');
        Response::ok(['byDay' => Database::all(
            "SELECT DATE(created_at) AS day, COUNT(*) AS count
             FROM work_orders
             WHERE created_at >= (CURDATE() - INTERVAL 30 DAY)
             GROUP BY DATE(created_at) ORDER BY day"
        )]);
    }

    /** GET /analytics/resolution-time  — avg hours to completion */
    public function resolutionTime(array $params): void
    {
        Auth::requireRole('administrator');
        $row = Database::one(
            "SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, completed_at)) AS avg_hours
             FROM work_orders WHERE completed_at IS NOT NULL"
        );
        Response::ok(['avgResolutionHours' => $row && $row['avg_hours'] !== null
            ? round((float) $row['avg_hours'], 1) : null]);
    }
}
