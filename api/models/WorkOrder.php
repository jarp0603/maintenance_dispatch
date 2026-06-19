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
    public const PRIORITIES = ['low', 'medium', 'high', 'urgent', 'emergency'];

    private const SORTABLE = ['created_at', 'updated_at', 'scheduled_date', 'priority', 'status'];

    private const SELECT = "SELECT wo.id, wo.wo_number, wo.tenant_name, wo.tenant_email,
                wo.unit_number, wo.address, wo.issue_type, wo.description, wo.priority,
                wo.status, wo.scheduled_date, wo.scheduled_time, wo.notes, wo.source,
                wo.assigned_to, wo.created_at, wo.updated_at, wo.completed_at,
                u.full_name AS technician_name
            FROM work_orders wo
            LEFT JOIN users u ON u.id = wo.assigned_to";

    /**
     * Filtered + paginated list. Returns ['data' => rows, 'total' => int].
     * Recognized filters: status, priority, issue_type, assigned_to, search,
     * scheduled_date, created_from/to, completed_from/to, include_archived,
     * page, limit, sort, order.
     */
    public static function list(array $f): array
    {
        $where = [];
        $params = [];

        if (empty($f['include_archived'])) {
            $where[] = 'wo.archived_at IS NULL';
        }
        $eq = [
            'status'         => 'wo.status = ?',
            'priority'       => 'wo.priority = ?',
            'issue_type'     => 'wo.issue_type = ?',
            'assigned_to'    => 'wo.assigned_to = ?',
            'scheduled_date' => 'wo.scheduled_date = ?',
        ];
        foreach ($eq as $key => $clause) {
            if (isset($f[$key]) && $f[$key] !== '') {
                $where[] = $clause;
                $params[] = $f[$key];
            }
        }
        if (!empty($f['created_from']))   { $where[] = 'wo.created_at >= ?';   $params[] = $f['created_from']; }
        if (!empty($f['created_to']))     { $where[] = 'wo.created_at <= ?';   $params[] = $f['created_to']; }
        if (!empty($f['completed_from'])) { $where[] = 'wo.completed_at >= ?'; $params[] = $f['completed_from']; }
        if (!empty($f['completed_to']))   { $where[] = 'wo.completed_at <= ?'; $params[] = $f['completed_to']; }
        if (!empty($f['search'])) {
            $where[] = '(wo.wo_number LIKE ? OR wo.tenant_name LIKE ? OR wo.unit_number LIKE ?
                         OR wo.address LIKE ? OR wo.description LIKE ?)';
            $like = '%' . $f['search'] . '%';
            array_push($params, $like, $like, $like, $like, $like);
        }
        $whereSql = $where !== [] ? (' WHERE ' . implode(' AND ', $where)) : '';

        // Total (for pagination)
        $totalRow = Database::one('SELECT COUNT(*) AS c FROM work_orders wo' . $whereSql, $params);
        $total = (int) ($totalRow['c'] ?? 0);

        // Sort (whitelisted) + order
        $sort = in_array($f['sort'] ?? '', self::SORTABLE, true) ? $f['sort'] : 'created_at';
        $order = strtoupper($f['order'] ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';

        // Pagination (clamped)
        $limit = isset($f['limit']) ? max(1, min(100, (int) $f['limit'])) : 25;
        $page  = isset($f['page']) ? max(1, (int) $f['page']) : 1;
        $offset = ($page - 1) * $limit;

        $sql = self::SELECT . $whereSql . " ORDER BY wo.{$sort} {$order} LIMIT {$limit} OFFSET {$offset}";
        $rows = Database::all($sql, $params);

        return ['data' => $rows, 'total' => $total];
    }

    public static function find(int $id): ?array
    {
        $wo = Database::one(self::SELECT . ' WHERE wo.id = ? LIMIT 1', [$id]);
        if (!$wo) {
            return null;
        }
        $wo['email_logs'] = Database::all(
            'SELECT id, email_type, recipient, status, sent_at
             FROM email_logs WHERE work_order_id = ? ORDER BY sent_at DESC',
            [$id]
        );
        $wo['note_history'] = Database::all(
            'SELECT n.id, n.note, n.is_completion, n.created_at, u.full_name AS author
             FROM work_order_notes n LEFT JOIN users u ON u.id = n.user_id
             WHERE n.work_order_id = ? ORDER BY n.created_at DESC',
            [$id]
        );
        $wo['status_history'] = Database::all(
            'SELECT h.from_status, h.to_status, h.changed_at, u.full_name AS changed_by_name
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

    private const WRITABLE = [
        'tenant_name', 'tenant_email', 'unit_number', 'address', 'notes',
        'issue_type', 'description', 'priority', 'status',
        'scheduled_date', 'scheduled_time', 'assigned_to',
        'property_id', 'unit_id', 'tenant_id',
    ];

    public static function create(array $d, int $userId): int
    {
        $cols = ['wo_number', 'created_by', 'source'];
        $vals = [self::nextNumber(), $userId, $d['source'] ?? 'manual'];
        foreach (self::WRITABLE as $f) {
            if (array_key_exists($f, $d)) {
                $cols[] = $f;
                $vals[] = $d[$f] === '' ? null : $d[$f];
            }
        }
        $status = $d['status'] ?? 'new';
        if (!in_array('status', $cols, true)) {
            $cols[] = 'status';
            $vals[] = $status;
        }
        $placeholders = implode(',', array_fill(0, count($cols), '?'));
        $id = Database::insert(
            'INSERT INTO work_orders (' . implode(',', $cols) . ") VALUES ({$placeholders})",
            $vals
        );
        self::addHistory($id, null, $status, $userId);
        return $id;
    }

    public static function update(int $id, array $d, int $userId): void
    {
        $current = Database::one('SELECT status FROM work_orders WHERE id = ?', [$id]);
        $set = [];
        $params = [];
        foreach (self::WRITABLE as $f) {
            if (array_key_exists($f, $d)) {
                $set[] = "$f = ?";
                $params[] = $d[$f] === '' ? null : $d[$f];
            }
        }
        if ($set === []) {
            return;
        }
        $params[] = $id;
        Database::run('UPDATE work_orders SET ' . implode(', ', $set) . ' WHERE id = ?', $params);

        if (isset($d['status']) && $current && $d['status'] !== $current['status']) {
            self::addHistory($id, $current['status'], $d['status'], $userId);
            if ($d['status'] === 'completed') {
                Database::run('UPDATE work_orders SET completed_at = NOW() WHERE id = ? AND completed_at IS NULL', [$id]);
            }
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

    /** Status -> rows map for the Kanban board. */
    public static function board(): array
    {
        $rows = self::list(['limit' => 100, 'page' => 1])['data'];
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
