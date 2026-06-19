<?php
declare(strict_types=1);

/**
 * Route table. $router is provided by index.php.
 *
 * Auth and CSRF are enforced inside each controller action (so the rules live
 * next to the logic and technicians can be scoped to their own work orders).
 *
 * @var \App\Utils\Router $router
 */

use App\Controllers\AnalyticsController;
use App\Controllers\AppointmentController;
use App\Controllers\AttachmentController;
use App\Controllers\AuthController;
use App\Controllers\PropertyController;
use App\Controllers\SchedulingController;
use App\Controllers\SettingsController;
use App\Controllers\TenantController;
use App\Controllers\WorkOrderController;

/** @var App\Utils\Router $router */

// --- Health ------------------------------------------------------------------
$router->get('/health', [\App\Controllers\HealthController::class, 'check']);

// --- Auth --------------------------------------------------------------------
$router->post('/auth/login',  [AuthController::class, 'login']);
$router->post('/auth/logout', [AuthController::class, 'logout']);
$router->get('/auth/me',      [AuthController::class, 'me']);
$router->get('/auth/csrf',    [AuthController::class, 'csrf']);
$router->post('/auth/forgot', [AuthController::class, 'forgot']);
$router->post('/auth/reset',  [AuthController::class, 'reset']);

// --- Work orders -------------------------------------------------------------
$router->get('/work-orders',                [WorkOrderController::class, 'index']);
$router->get('/work-orders/stats',          [WorkOrderController::class, 'stats']);
$router->get('/work-orders/board',          [WorkOrderController::class, 'board']);
$router->post('/work-orders',               [WorkOrderController::class, 'create']);
$router->get('/work-orders/{id}',           [WorkOrderController::class, 'show']);
$router->put('/work-orders/{id}',           [WorkOrderController::class, 'update']);
$router->post('/work-orders/{id}/complete', [WorkOrderController::class, 'complete']);
$router->post('/work-orders/{id}/notes',    [WorkOrderController::class, 'addNote']);
$router->delete('/work-orders/{id}',        [WorkOrderController::class, 'archive']);
$router->post('/work-orders/{id}/attachments', [AttachmentController::class, 'upload']);

// --- Tenants -----------------------------------------------------------------
$router->get('/tenants',        [TenantController::class, 'index']);
$router->post('/tenants',       [TenantController::class, 'create']);
$router->get('/tenants/{id}',   [TenantController::class, 'show']);
$router->put('/tenants/{id}',   [TenantController::class, 'update']);

// --- Properties & units ------------------------------------------------------
$router->get('/properties',            [PropertyController::class, 'index']);
$router->post('/properties',           [PropertyController::class, 'create']);
$router->get('/properties/{id}',       [PropertyController::class, 'show']);
$router->put('/properties/{id}',       [PropertyController::class, 'update']);
$router->post('/properties/{id}/units',[PropertyController::class, 'addUnit']);

// --- Scheduling links (staff) + public tenant flow ---------------------------
$router->post('/scheduling-links',          [SchedulingController::class, 'create']);
$router->delete('/scheduling-links/{id}',   [SchedulingController::class, 'revoke']);
$router->get('/schedule/{token}',           [SchedulingController::class, 'publicView']);
$router->post('/schedule/{token}/book',     [SchedulingController::class, 'publicBook']);

// --- Appointments & availability ---------------------------------------------
$router->get('/appointments',   [AppointmentController::class, 'index']);
$router->get('/availability',   [AppointmentController::class, 'availability']);
$router->post('/availability',  [AppointmentController::class, 'createSlot']);

// --- Attachments -------------------------------------------------------------
$router->get('/attachments/{id}', [AttachmentController::class, 'download']);

// --- Analytics (admin) -------------------------------------------------------
$router->get('/analytics/overview',        [AnalyticsController::class, 'overview']);
$router->get('/analytics/by-type',         [AnalyticsController::class, 'byType']);
$router->get('/analytics/by-day',          [AnalyticsController::class, 'byDay']);
$router->get('/analytics/resolution-time', [AnalyticsController::class, 'resolutionTime']);

// --- Settings & users --------------------------------------------------------
$router->get('/settings',         [SettingsController::class, 'get']);
$router->put('/settings',         [SettingsController::class, 'update']);
$router->get('/users/assignable', [SettingsController::class, 'assignableUsers']);
