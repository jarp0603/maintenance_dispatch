<?php
declare(strict_types=1);

namespace App\Models;

use App\Utils\Database;

final class WorkOrder
{
    public const STATUSES = [
        'new', 'pending', 'contacted', 'scheduled',
        'in_progress', 'completed', 'no_response', 'cancelled',
    ];
    public const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

    /**
     * Filtered list. $filters may contain: status, property_id, unit_id,
     * tenant_id, assigned_to, priority, scheduled_date, created_from,
     * created_to, completed_from, completed_to, search, include_archived.
     */
    public static function list(array $filters): array
    {
        $where = [];
        $params = [];

        if (empty($filters['include_archived'])) {
            $where[] = 'wo.archived_at IS NULL';
        }
        $map = [
            'status'         => 'wo.status = ?',
            'priority'       => 'wo.priority = ?',
            'property_id'    => 'wo.property_id = ?',
            'unit_id'        => 'wo.unit_id = ?',
            'tenant_id'      => 'wo.tenant_id = ?',
            'assigned_to'    => 'wo.assigned_to = ?',
            'scheduled_date' => 'wo.scheduled_date = ?',
        ];
        foreach ($map as $key => $clause) {
            if (isset($filters[$key]) && $filters[$key] !== '') {
                $where[] = $clause;
                $params[] = $filters[$key];
            }
        }
        if (!empty($filters['created_from'])) { $where[] = 'wo.created_at >= ?'; $params[] = $filters['created_from']; }
        if (!empty($filters['created_to']))   { $where[] = 'wo.created_at <= ?'; $params[] = $filters['created_to']; }
        if (!empty($filters['completed_from'])) { $where[] = 'wo.completed_at >= ?'; $params[] = $filters['completed_from']; }
        if (!empty($filters['completed_to']))   { $where[] = 'wo.completed_at <= ?'; $params[] = $filters['completed_to']; }
        if (!empty($filters['search'])) {
            $where[] = '(wo.wo_number LIKE ? OR wo.description LIKE ? OR t.full_name LIKE ?)';
            $like = '%' . $filters['search'] . '%';
            array_push($params, $like, $like, $like);
        }

        $sql = "SELECT wo.*, t.full_name AS tenant_name, p.name AS property_name,
                       un.unit_number, u.full_name AS technician_name
                FROM work_orders wo
                LEFT JOIN tenants t   ON t.id = wo.tenant_id
                LEFT JOIN properties p ON p.id = wo.property_id
                LEFT JOIN units un    ON un.id = wo.unit_id
                LEFT JOIN users u     ON u.id = wo.assigned_to";
        if ($where !== []) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY wo.created_at DESC LIMIT 500';
        return Database::all($sql, $params);
    }

    public static function find(int $id): ?array
    {
        $wo = Database::one(
            "SELECT wo.*, t.full_name AS tenant_name, t.email AS tenant_email,
                    t.phone AS tenant_phone, p.name AS property_name, p.address AS property_address,
                    un.unit_number, u.full_name AS technician_name
             FROM work_orders wo
             LEFT JOIN tenants t   ON t.id = wo.tenant_id
             LEFT JOIN properties p ON p.id = wo.property_id
             LEFT JOIN units un    ON un.id = wo.unit_id
             LEFT JOIN users u     ON u.id = wo.assigned_to
             WHERE wo.id = ? LIMIT 1",
            [$id]
        );
        if (!$wo) {
            return null;
        }
        $wo['notes'] = Database::all(
            'SELECT n.*, u.full_name AS author
             FROM work_order_notes n LEFT JOIN users u ON u.id = n.user_id
             WHERE n.work_order_id = ? ORDER BY n.created_at DESC',
            [$id]
        );
        $wo['status_history'] = Database::all(
            'SELECT h.*, u.full_name AS changed_by_name
             FROM work_order_status_history h LEFT JOIN users u ON u.id = h.changed_by
             WHERE h.work_order_id = ? ORDER BY h.changed_at DESC',
            [$id]
        );
        $wo['attachments'] = Database::all(
            'SELECT id, original_name, mime_type, size_bytes, is_completion, created_at
             FROM attachments WHERE work_order_id = ? ORDER BY created_at DESC',
            [$id]
        );
        return $wo;
    }

    public static function nextNumber(): string
    {
        $year = date('Y');
        $row = Database::one(
            "SELECT wo_number FROM work_orders WHERE wo_number LIKE ? ORDER BY id DESC LIMIT 1",
            ["WO-{$year}-%"]
        );
        $seq = 1;
        if ($row && preg_match('/WO-\d{4}-(\d+)/', $row['wo_number'], $m)) {
            $seq = (int) $m[1] + 1;
        }
        return sprintf('WO-%s-%04d', $year, $seq);
    }

    public static function create(array $d, int $userId): int
    {
        $number = self::nextNumber();
        $id = Database::insert(
            "INSERT INTO work_orders
              (wo_number, property_id, unit_id, tenant_id, created_by, assigned_to,
               issue_type, description, priority, status, scheduled_date, scheduled_time, source)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [
                $number,
                $d['property_id'] ?? null,
                $d['unit_id'] ?? null,
                $d['tenant_id'] ?? null,
                $userId,
                $d['assigned_to'] ?? null,
                $d['issue_type'] ?? 'general',
                $d['description'] ?? null,
                $d['priority'] ?? 'medium',
                $d['status'] ?? 'new',
                $d['scheduled_date'] ?? null,
                $d['scheduled_time'] ?? null,
                $d['source'] ?? 'manual',
            ]
        );
        self::addHistory($id, null, $d['status'] ?? 'new', $userId);
        return $id;
    }

    public static function update(int $id, array $d, int $userId): void
    {
        $current = Database::one('SELECT status FROM work_orders WHERE id = ?', [$id]);
        $fields = [];
        $params = [];
        $allowed = ['property_id', 'unit_id', 'tenant_id', 'assigned_to', 'issue_type',
            'description', 'priority', 'status', 'scheduled_date', 'scheduled_time'];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $d)) {
                $fields[] = "$f = ?";
                $params[] = $d[$f] === '' ? null : $d[$f];
            }
        }
        if ($fields === []) {
            return;
        }
        $params[] = $id;
        Database::run('UPDATE work_orders SET ' . implode(', ', $fields) . ' WHERE id = ?', $params);

        if (isset($d['status']) && $current && $d['status'] !== $current['status']) {
            self::addHistory($id, $current['status'], $d['status'], $userId);
        }
    }

    public static function complete(int $id, string $note, int $userId): void
    {
        $current = Database::one('SELECT status FROM work_orders WHERE id = ?', [$id]);
        Database::beginTransaction();
        try {
            Database::run("UPDATE work_orders SET status = 'completed', completed_at = NOW() WHERE id = ?", [$id]);
            Database::run(
                'INSERT INTO work_order_notes (work_order_id, user_id, note, is_completion) VALUES (?,?,?,1)',
                [$id, $userId, $note]
            );
            self::addHistory($id, $current['status'] ?? null, 'completed', $userId);
            Database::commit();
        } catch (\Throwable $e) {
            Database::rollBack();
            throw $e;
        }
    }

    public static function archive(int $id): void
    {
        Database::run('UPDATE work_orders SET archived_at = NOW() WHERE id = ?', [$id]);
    }

    public static function addNote(int $id, string $note, int $userId): int
    {
        return Database::insert(
            'INSERT INTO work_order_notes (work_order_id, user_id, note) VALUES (?,?,?)',
            [$id, $userId, $note]
        );
    }

    private static function addHistory(int $id, ?string $from, string $to, int $userId): void
    {
        Database::run(
            'INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by)
             VALUES (?,?,?,?)',
            [$id, $from, $to, $userId]
        );
    }

    public static function stats(): array
    {
        $row = Database::one(
            "SELECT
               SUM(status NOT IN ('completed','cancelled')) AS open_count,
               SUM(status = 'scheduled' AND scheduled_date = CURDATE()) AS scheduled_today,
               SUM(status = 'completed' AND completed_at >= (NOW() - INTERVAL 7 DAY)) AS completed_week,
               SUM(status NOT IN ('completed','cancelled')
                   AND scheduled_date IS NOT NULL AND scheduled_date < CURDATE()) AS overdue
             FROM work_orders WHERE archived_at IS NULL"
        );
        return [
            'open'           => (int) ($row['open_count'] ?? 0),
            'scheduledToday' => (int) ($row['scheduled_today'] ?? 0),
            'completedWeek'  => (int) ($row['completed_week'] ?? 0),
            'overdue'        => (int) ($row['overdue'] ?? 0),
        ];
    }

    public static function board(): array
    {
        $rows = self::list([]);
        $board = [];
        foreach (self::STATUSES as $s) {
            $board[$s] = [];
        }
        foreach ($rows as $r) {
            $board[$r['status']][] = $r;
        }
        return $board;
    }
}
