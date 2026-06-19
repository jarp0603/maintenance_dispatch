<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\Auth;
use App\Middleware\Csrf;
use App\Models\AuditLog;
use App\Models\Property;
use App\Utils\Request;
use App\Utils\Response;
use App\Utils\Validator;

final class PropertyController
{
    public function index(array $params): void
    {
        Auth::requireAuth();
        Response::ok(['properties' => Property::list()]);
    }

    public function show(array $params): void
    {
        Auth::requireAuth();
        $p = Property::find((int) $params['id']);
        if (!$p) {
            Response::error('Property not found', 404);
        }
        Response::ok(['property' => $p]);
    }

    public function create(array $params): void
    {
        Auth::requireRole('administrator');
        Csrf::verify();
        $data = Request::json();
        $v = new Validator($data);
        $v->required('name')->string('name', 1, 150)
          ->required('address')->string('address', 1, 255);
        if ($v->fails()) {
            Response::error('Validation failed', 422, $v->errors());
        }
        $id = Property::create($data);
        AuditLog::record(Auth::id(), 'property.create', 'property', $id);
        Response::created(['property' => Property::find($id)]);
    }

    public function update(array $params): void
    {
        Auth::requireRole('administrator');
        Csrf::verify();
        $id = (int) $params['id'];
        if (!Property::find($id)) {
            Response::error('Property not found', 404);
        }
        Property::update($id, Request::json());
        AuditLog::record(Auth::id(), 'property.update', 'property', $id);
        Response::ok(['property' => Property::find($id)]);
    }

    /** POST /properties/{id}/units */
    public function addUnit(array $params): void
    {
        Auth::requireRole('administrator');
        Csrf::verify();
        $id = (int) $params['id'];
        if (!Property::find($id)) {
            Response::error('Property not found', 404);
        }
        $data = Request::json();
        $v = new Validator($data);
        $v->required('unit_number')->string('unit_number', 1, 50);
        if ($v->fails()) {
            Response::error('Validation failed', 422, $v->errors());
        }
        Property::addUnit($id, $data);
        AuditLog::record(Auth::id(), 'unit.create', 'property', $id);
        Response::created(['property' => Property::find($id)]);
    }
}
