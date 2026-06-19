<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\Auth;
use App\Middleware\Csrf;
use App\Models\Attachment;
use App\Models\AuditLog;
use App\Models\WorkOrder;
use App\Utils\Request;
use App\Utils\Response;

final class AttachmentController
{
    private const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
    private const ALLOWED = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
        'image/heic' => 'heic',
        'application/pdf' => 'pdf',
    ];

    private static function uploadDir(): string
    {
        return API_ROOT . '/uploads';
    }

    /** POST /work-orders/{id}/attachments  (multipart/form-data, field: file) */
    public function upload(array $params): void
    {
        Auth::requireAuth();
        Csrf::verify();

        $woId = (int) $params['id'];
        $wo = WorkOrder::find($woId);
        if (!$wo) {
            Response::error('Work order not found', 404);
        }
        if (Auth::role() === 'technician' && (int) $wo['assigned_to'] !== Auth::id()) {
            Response::error('Forbidden', 403);
        }

        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            Response::error('No file uploaded or upload error', 400);
        }
        $file = $_FILES['file'];

        if ($file['size'] <= 0 || $file['size'] > self::MAX_BYTES) {
            Response::error('File must be between 1 byte and 10 MB', 422);
        }

        // Detect the REAL mime type from content, not the client-supplied name.
        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = (string) $finfo->file($file['tmp_name']);
        if (!isset(self::ALLOWED[$mime])) {
            Response::error('Unsupported file type. Allowed: JPG, PNG, WEBP, HEIC, PDF.', 422);
        }
        $ext = self::ALLOWED[$mime];

        // Randomized, unpredictable filename. Never trust the original name.
        $stored = bin2hex(random_bytes(16)) . '.' . $ext;
        $dir = self::uploadDir();
        if (!is_dir($dir)) {
            @mkdir($dir, 0750, true);
        }
        $dest = $dir . '/' . $stored;
        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            Response::error('Could not store file', 500);
        }
        @chmod($dest, 0640);

        $originalSafe = mb_substr(preg_replace('/[^\w.\- ]/u', '_', (string) $file['name']), 0, 255);
        $isCompletion = (string) Request::query('completion', '') === '1';

        $id = Attachment::create($woId, (int) Auth::id(), $stored, $originalSafe, $mime, (int) $file['size'], $isCompletion);
        AuditLog::record(Auth::id(), 'attachment.upload', 'work_order', $woId);
        Response::created([
            'attachment' => [
                'id'           => $id,
                'originalName' => $originalSafe,
                'mimeType'     => $mime,
                'sizeBytes'    => (int) $file['size'],
            ],
        ]);
    }

    /** GET /attachments/{id}  — authenticated download (uploads dir is protected). */
    public function download(array $params): void
    {
        Auth::requireAuth();
        $att = Attachment::find((int) $params['id']);
        if (!$att) {
            Response::error('Attachment not found', 404);
        }
        if (Auth::role() === 'technician') {
            $wo = WorkOrder::find((int) $att['work_order_id']);
            if (!$wo || (int) $wo['assigned_to'] !== Auth::id()) {
                Response::error('Forbidden', 403);
            }
        }
        $path = self::uploadDir() . '/' . basename($att['stored_name']);
        if (!is_file($path)) {
            Response::error('File missing', 404);
        }
        header('Content-Type: ' . $att['mime_type']);
        header('Content-Length: ' . (string) filesize($path));
        header('Content-Disposition: inline; filename="' . $att['original_name'] . '"');
        header('X-Content-Type-Options: nosniff');
        readfile($path);
        exit;
    }
}
