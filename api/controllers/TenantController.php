<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\Auth;
use App\Middleware\Csrf;
use App\Models\AuditLog;
use App\Models\Tenant;
use App\Utils\Request;
use App\Utils\Response;
use App\Utils\Validator;

final class TenantController
{
    public function index(array $params): void
    {
        Auth::requireAuth();
        Response::ok(['tenants' => Tenant::list(Request::query('search'))]);
    }

    public function show(array $params): void
    {
        Auth::requireAuth();
        $t = Tenant::find((int) $params['id']);
        if (!$t) {
            Response::error('Tenant not found', 404);
        }
        Response::ok(['tenant' => $t]);
    }

    public function create(array $params): void
    {
        Auth::requireRole('administrator');
        Csrf::verify();
        $data = Request::json();
        $v = new Validator($data);
        $v->required('full_name')->string('full_name', 1, 150)
          ->email('email')->integer('unit_id');
        if ($v->fails()) {
            Response::error('Validation failed', 422, $v->errors());
        }
        $id = Tenant::create($data);
        AuditLog::record(Auth::id(), 'tenant.create', 'tenant', $id);
        Response::created(['tenant' => Tenant::find($id)]);
    }

    public function update(array $params): void
    {
        Auth::requireRole('administrator');
        Csrf::verify();
        $id = (int) $params['id'];
        if (!Tenant::find($id)) {
            Response::error('Tenant not found', 404);
        }
        $data = Request::json();
        $v = new Validator($data);
        $v->email('email')->integer('unit_id')->string('full_name', 1, 150);
        if ($v->fails()) {
            Response::error('Validation failed', 422, $v->errors());
        }
        Tenant::update($id, $data);
        AuditLog::record(Auth::id(), 'tenant.update', 'tenant', $id);
        Response::ok(['tenant' => Tenant::find($id)]);
    }
}
