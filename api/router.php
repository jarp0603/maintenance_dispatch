<?php
/**
 * Router shim for PHP's built-in server (local dev only).
 *
 *   php -S localhost:8000 router.php
 *
 * Emulates the Apache .htaccess behavior: serve real files if they exist,
 * otherwise hand the request to index.php (the front controller). On Bluehost,
 * Apache + .htaccess does this — router.php is NOT used in production.
 */

declare(strict_types=1);

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';

// Serve existing static files directly (but never the protected uploads dir).
$full = __DIR__ . $uri;
if ($uri !== '/' && is_file($full) && strpos($uri, '/uploads/') !== 0) {
    return false;
}

require __DIR__ . '/index.php';
