<?php
/**
 * Bluehost cron entry point.
 *
 * Replaces the old Node `node-cron` scheduler. Configure a Bluehost cron job to
 * run this on a schedule, e.g. hourly:
 *
 *   0 * * * * /usr/local/bin/php /home/USER/path/to/api/cli/cron.php >> /home/USER/cron.log 2>&1
 *
 * It performs time-based housekeeping:
 *   - expire stale scheduling links (defensive; queries already check expiry)
 *   - flag overdue / no-response work orders
 *   - (hook) send follow-up / reminder emails via FollowupService
 *
 * Runs only from the command line.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Forbidden\n");
}

define('API_ROOT', dirname(__DIR__));

spl_autoload_register(function (string $class): void {
    $prefix = 'App\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $parts = explode('\\', $relative);
    $className = array_pop($parts);
    $dir = strtolower(implode('/', $parts));
    $path = API_ROOT . '/' . ($dir !== '' ? $dir . '/' : '') . $className . '.php';
    if (is_file($path)) {
        require $path;
    }
});

use App\Config\Config;
use App\Services\FollowupService;
use App\Utils\Database;

Config::load(API_ROOT . '/.env');

$log = static function (string $msg): void {
    echo '[' . date('Y-m-d H:i:s') . '] ' . $msg . PHP_EOL;
};

try {
    // 1) No-response: scheduled in the past, never completed -> mark no_response
    $n = Database::run(
        "UPDATE work_orders
         SET status = 'no_response'
         WHERE status = 'scheduled'
           AND scheduled_date < (CURDATE() - INTERVAL 1 DAY)
           AND completed_at IS NULL
           AND archived_at IS NULL"
    );
    $log("Marked {$n} work order(s) as no_response.");

    // 2) Follow-up / reminder emails (no-op unless mail is configured).
    $sent = FollowupService::run();
    $log("Follow-up service processed {$sent} item(s).");

    $log('Cron finished OK.');
    exit(0);
} catch (\Throwable $e) {
    $log('Cron ERROR: ' . $e->getMessage());
    exit(1);
}
