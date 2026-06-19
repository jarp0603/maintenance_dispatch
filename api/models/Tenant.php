<?php
declare(strict_types=1);

namespace App\Models;

use App\Utils\Database;

final class Tenant
{
    public static function list(?string $search = null): array
    {
        if ($search) {
            $like = '%' . $search . '%';
            return Database::all(
                "SELECT t.*, un.unit_number, p.name AS property_name
                 FROM tenants t
                 LEFT JOIN units un ON un.id = t.unit_id
                 LEFT JOIN properties p ON p.id = un.property_id
                 WHERE t.full_name LIKE ? OR t.email LIKE ? OR t.phone LIKE ?
                 ORDER BY t.full_name LIMIT 500",
                [$like, $like, $like]
            );
        }
        return Database::all(
            "SELECT t.*, un.unit_number, p.name AS property_name
             FROM tenants t
             LEFT JOIN units un ON un.id = t.unit_id
             LEFT JOIN properties p ON p.id = un.property_id
             ORDER BY t.full_name LIMIT 500"
        );
    }

    public static function find(int $id): ?array
    {
        $t = Database::one(
            "SELECT t.*, un.unit_number, p.name AS property_name
             FROM tenants t
             LEFT JOIN units un ON un.id = t.unit_id
             LEFT JOIN properties p ON p.id = un.property_id
             WHERE t.id = ? LIMIT 1",
            [$id]
        );
        if (!$t) {
            return null;
        }
        $t['work_orders'] = Database::all(
            'SELECT id, wo_number, status, priority, created_at
             FROM work_orders WHERE tenant_id = ? ORDER BY created_at DESC',
            [$id]
        );
        return $t;
    }

    public static function create(array $d): int
    {
        return Database::insert(
            'INSERT INTO tenants (unit_id, full_name, phone, email, notes) VALUES (?,?,?,?,?)',
            [$d['unit_id'] ?? null, $d['full_name'], $d['phone'] ?? null, $d['email'] ?? null, $d['notes'] ?? null]
        );
    }

    public static function update(int $id, array $d): void
    {
        $fields = [];
        $params = [];
        foreach (['unit_id', 'full_name', 'phone', 'email', 'notes'] as $f) {
            if (array_key_exists($f, $d)) {
                $fields[] = "$f = ?";
                $params[] = $d[$f] === '' ? null : $d[$f];
            }
        }
        if ($fields === []) {
            return;
        }
        $params[] = $id;
        Database::run('UPDATE tenants SET ' . implode(', ', $fields) . ' WHERE id = ?', $params);
    }
}
