<?php
/**
 * Maintenance Dispatch API — front controller.
 *
 * All /api/* requests are routed here by .htaccess. This file boots the
 * environment, registers an autoloader, applies global middleware, and
 * dispatches to a controller via the route table in routes/routes.php.
 */

declare(strict_types=1);

// --- Error handling: never leak details to clients --------------------------
error_reporting(E_ALL);
ini_set('display_errors', '0'); // never display to output; log instead

define('API_ROOT', __DIR__);

// --- PSR-4-ish autoloader ----------------------------------------------------
// Maps App\Utils\Response -> utils/Response.php, App\Controllers\X -> controllers/X.php
spl_autoload_register(function (string $class): void {
    $prefix = 'App\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $parts = explode('\\', $relative);
    $className = array_pop($parts);
    $dir = strtolower(implode('/', $parts)); // namespace dirs are lowercase folders
    $path = API_ROOT . '/' . ($dir !== '' ? $dir . '/' : '') . $className . '.php';
    if (is_file($path)) {
        require $path;
    }
});

use App\Config\Config;
use App\Utils\Request;
use App\Utils\Response;
use App\Utils\Router;

// --- Load configuration (.env) ----------------------------------------------
Config::load(API_ROOT . '/.env');

// --- Fatal/exception safety net ---------------------------------------------
set_exception_handler(function (\Throwable $e): void {
    error_log('[API] Uncaught: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    Response::error('Internal server error', 500);
});

// --- CORS (strict: single configured origin) --------------------------------
$allowedOrigin = Config::get('APP_URL', 'http://localhost:5173');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && $origin === $allowedOrigin) {
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
}

// Preflight
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- Dispatch ----------------------------------------------------------------
$router = new Router();
require API_ROOT . '/routes/routes.php'; // registers routes on $router

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = Request::path(); // normalized path after /api

$router->dispatch($method, $path);
