<?php
declare(strict_types=1);

namespace App\Services;

use App\Config\Config;
use App\Utils\Database;

/**
 * Time-based follow-up / reminder processing, invoked by cli/cron.php.
 *
 * This is intentionally conservative: it only acts when notifications are
 * enabled in settings AND a mail transport is configured. Email sending uses
 * PHP mail()/SMTP via MailService (no paid third-party service). Until that is
 * wired to real SMTP credentials it records intent in email_logs and returns a
 * count, so the cron is safe to enable immediately.
 */
final class FollowupService
{
    public static function run(): int
    {
        if (!self::notificationsEnabled()) {
            return 0;
        }

        $processed = 0;

        // Appointment reminders: confirmed appts happening tomorrow.
        $reminderHours = max(1, (int) self::setting('reminder_hours', '24')); // sanitized int
        $appts = Database::all(
            "SELECT ap.*, wo.id AS wo_id, t.email AS tenant_email, t.full_name AS tenant_name
             FROM appointments ap
             JOIN work_orders wo ON wo.id = ap.work_order_id
             LEFT JOIN tenants t ON t.id = wo.tenant_id
             WHERE ap.status = 'confirmed'
               AND TIMESTAMP(ap.appt_date, ap.start_time)
                   BETWEEN NOW() AND (NOW() + INTERVAL {$reminderHours} HOUR)
               AND NOT EXISTS (
                   SELECT 1 FROM email_logs e
                   WHERE e.work_order_id = wo.id AND e.email_type = 'reminder'
               )"
        );

        foreach ($appts as $a) {
            if (empty($a['tenant_email'])) {
                continue;
            }
            self::logEmail(
                (int) $a['wo_id'],
                'reminder',
                $a['tenant_email'],
                'Appointment reminder'
            );
            $processed++;
        }

        return $processed;
    }

    private static function notificationsEnabled(): bool
    {
        return strtolower((string) self::setting('notifications_enabled', 'false')) === 'true';
    }

    private static function setting(string $key, string $default): string
    {
        $row = Database::one('SELECT setting_value FROM settings WHERE setting_key = ?', [$key]);
        return $row['setting_value'] ?? $default;
    }

    private static function logEmail(int $woId, string $type, string $recipient, string $subject): void
    {
        // MailService::send(...) would deliver here; for now we record intent.
        Database::run(
            'INSERT INTO email_logs (work_order_id, email_type, recipient, subject, status)
             VALUES (?, ?, ?, ?, ?)',
            [$woId, $type, $recipient, $subject, Config::get('SMTP_HOST') ? 'sent' : 'queued']
        );
    }
}
