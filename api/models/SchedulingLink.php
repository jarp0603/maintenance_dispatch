<?php
declare(strict_types=1);

namespace App\Models;

use App\Utils\Database;

final class SchedulingLink
{
    /**
     * Create a tokenized, expiring scheduling link.
     * Returns [id, rawToken]; only the hash of the token is stored.
     */
    public static function create(int $workOrderId, int $userId, int $ttlHours = 72): array
    {
        $raw = bin2hex(random_bytes(32));
        $hash = hash('sha256', $raw);
        $ttl = max(1, (int) $ttlHours); // sanitized integer, safe to inline
        $id = Database::insert(
            "INSERT INTO scheduling_links (work_order_id, token_hash, created_by, expires_at)
             VALUES (?, ?, ?, (NOW() + INTERVAL {$ttl} HOUR))",
            [$workOrderId, $hash, $userId]
        );
        return [$id, $raw];
    }

    /** Resolve a usable link from a raw token, or null if invalid/expired/used. */
    public static function resolve(string $rawToken): ?array
    {
        $hash = hash('sha256', $rawToken);
        return Database::one(
            'SELECT * FROM scheduling_links
             WHERE token_hash = ? AND revoked_at IS NULL AND used_at IS NULL
               AND expires_at > NOW()
             LIMIT 1',
            [$hash]
        );
    }

    public static function markUsed(int $id): void
    {
        Database::run('UPDATE scheduling_links SET used_at = NOW() WHERE id = ?', [$id]);
    }

    public static function revoke(int $id): void
    {
        Database::run('UPDATE scheduling_links SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL', [$id]);
    }

    public static function listForWorkOrder(int $workOrderId): array
    {
        return Database::all(
            'SELECT id, created_by, expires_at, revoked_at, used_at, created_at
             FROM scheduling_links WHERE work_order_id = ? ORDER BY created_at DESC',
            [$workOrderId]
        );
    }
}
