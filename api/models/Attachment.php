<?php
declare(strict_types=1);

namespace App\Models;

use App\Utils\Database;

final class Attachment
{
    public static function create(int $workOrderId, ?int $userId, string $storedName, string $originalName, string $mime, int $size, bool $isCompletion): int
    {
        return Database::insert(
            'INSERT INTO attachments
               (work_order_id, uploaded_by, stored_name, original_name, mime_type, size_bytes, is_completion)
             VALUES (?,?,?,?,?,?,?)',
            [$workOrderId, $userId, $storedName, $originalName, $mime, $size, $isCompletion ? 1 : 0]
        );
    }

    public static function find(int $id): ?array
    {
        return Database::one('SELECT * FROM attachments WHERE id = ? LIMIT 1', [$id]);
    }
}
