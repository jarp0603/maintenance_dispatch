<?php
declare(strict_types=1);

namespace App\Models;

use App\Utils\Database;

final class Property
{
    public static function list(): array
    {
        return Database::all(
            "SELECT p.*, (SELECT COUNT(*) FROM units u WHERE u.property_id = p.id) AS unit_count
             FROM properties p ORDER BY p.name LIMIT 500"
        );
    }

    public static function find(int $id): ?array
    {
        $p = Database::one('SELECT * FROM properties WHERE id = ? LIMIT 1', [$id]);
        if (!$p) {
            return null;
        }
        $p['units'] = Database::all(
            'SELECT * FROM units WHERE property_id = ? ORDER BY unit_number',
            [$id]
        );
        return $p;
    }

    public static function create(array $d): int
    {
        return Database::insert(
            'INSERT INTO properties (name, address, city, state, postal_code, notes) VALUES (?,?,?,?,?,?)',
            [$d['name'], $d['address'], $d['city'] ?? null, $d['state'] ?? null, $d['postal_code'] ?? null, $d['notes'] ?? null]
        );
    }

    public static function update(int $id, array $d): void
    {
        $fields = [];
        $params = [];
        foreach (['name', 'address', 'city', 'state', 'postal_code', 'notes'] as $f) {
            if (array_key_exists($f, $d)) {
                $fields[] = "$f = ?";
                $params[] = $d[$f] === '' ? null : $d[$f];
            }
        }
        if ($fields === []) {
            return;
        }
        $params[] = $id;
        Database::run('UPDATE properties SET ' . implode(', ', $fields) . ' WHERE id = ?', $params);
    }

    public static function addUnit(int $propertyId, array $d): int
    {
        return Database::insert(
            'INSERT INTO units (property_id, unit_number, beds, baths, notes) VALUES (?,?,?,?,?)',
            [$propertyId, $d['unit_number'], $d['beds'] ?? null, $d['baths'] ?? null, $d['notes'] ?? null]
        );
    }
}
