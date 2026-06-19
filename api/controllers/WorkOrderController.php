<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\Auth;
use App\Middleware\Csrf;
use App\Models\AuditLog;
use App\Models\WorkOrder;
use App\Utils\Request;
use App\Utils\Response;
use App\Utils\Validator;

final class WorkOrderController
{
    /** GET /work-orders */
    public function index(array $params): void
    {
        Auth::requireAuth();
        $filters = [
            'status'         => Request::query('status'),
            'priority'       => Request::query('priority'),
            'property_id'    => Request::query('property_id'),
            'unit_id'        => Request::query('unit_id'),
            'tenant_id'      => Request::query('tenant_id'),
            'assigned_to'    => Request::query('assigned_to'),
            'scheduled_date' => Request::query('scheduled_date'),
            'created_from'   => Request::query('created_from'),
            'created_to'     => Request::query('created_to'),
            'completed_from' => Request::query('completed_from'),
            'completed_to'   => Request::query('completed_to'),
            'search'         => Request::query('search'),
            'include_archived' => Request::query('include_archived'),
        ];
        // Technicians only see their own assigned work orders.
        if (Auth::role() === 'technician') {
            $filters['assigned_to'] = Auth::id();
        }
        Response::ok(['workOrders' => WorkOrder::list($filters)]);
    }

    /** GET /work-orders/stats */
    public function stats(array $params): void
    {
        Auth::requireAuth();
        Response::ok(WorkOrder::stats());
    }

    /** GET /work-orders/board */
    public function board(array $params): void
    {
        Auth::requireAuth();
        Response::ok(['board' => WorkOrder::board()]);
    }

    /** GET /work-orders/{id} */
    public function show(array $params): void
    {
        Auth::requireAuth();
        $wo = WorkOrder::find((int) $params['id']);
        if (!$wo) {
            Response::error('Work order not found', 404);
        }
        if (Auth::role() === 'technician' && (int) $wo['assigned_to'] !== Auth::id()) {
            Response::error('Forbidden', 403);
        }
        Response::ok(['workOrder' => $wo]);
    }

    /** POST /work-orders */
    public function create(array $params): void
    {
        Auth::requireAuth();
        Csrf::verify();
        $data = Request::json();

        $v = new Validator($data);
        $v->required('description')->string('description', 1, 5000)
          ->in('priority', WorkOrder::PRIORITIES)
          ->in('status', WorkOrder::STATUSES)
          ->integer('property_id')->integer('unit_id')->integer('tenant_id')
          ->integer('assigned_to')->date('scheduled_date');
        if ($v->fails()) {
            Response::error('Validation failed', 422, $v->errors());
        }

        $id = WorkOrder::create($data, (int) Auth::id());
        AuditLog::record(Auth::id(), 'work_order.create', 'work_order', $id);
        Response::created(['workOrder' => WorkOrder::find($id)]);
    }

    /** PUT /work-orders/{id} */
    public function update(array $params): void
    {
        Auth::requireAuth();
        Csrf::verify();
        $id = (int) $params['id'];
        $existing = WorkOrder::find($id);
        if (!$existing) {
            Response::error('Work order not found', 404);
        }
        if (Auth::role() === 'technician' && (int) $existing['assigned_to'] !== Auth::id()) {
            Response::error('Forbidden', 403);
        }
        $data = Request::json();
        $v = new Validator($data);
        $v->in('priority', WorkOrder::PRIORITIES)->in('status', WorkOrder::STATUSES)
          ->date('scheduled_date');
        if ($v->fails()) {
            Response::error('Validation failed', 422, $v->errors());
        }
        WorkOrder::update($id, $data, (int) Auth::id());
        AuditLog::record(Auth::id(), 'work_order.update', 'work_order', $id);
        Response::ok(['workOrder' => WorkOrder::find($id)]);
    }

    /** POST /work-orders/{id}/complete — requires completion notes. */
    public function complete(array $params): void
    {
        Auth::requireAuth();
        Csrf::verify();
        $id = (int) $params['id'];
        $existing = WorkOrder::find($id);
        if (!$existing) {
            Response::error('Work order not found', 404);
        }
        if (Auth::role() === 'technician' && (int) $existing['assigned_to'] !== Auth::id()) {
            Response::error('Forbidden', 403);
        }
        $note = trim((string) Request::input('note', ''));
        if ($note === '') {
            Response::error('Completion notes are required', 422, ['note' => 'Required.']);
        }
        WorkOrder::complete($id, $note, (int) Auth::id());
        AuditLog::record(Auth::id(), 'work_order.complete', 'work_order', $id);
        Response::ok(['workOrder' => WorkOrder::find($id)]);
    }

    /** POST /work-orders/{id}/notes */
    public function addNote(array $params): void
    {
        Auth::requireAuth();
        Csrf::verify();
        $id = (int) $params['id'];
        $note = trim((string) Request::input('note', ''));
        if ($note === '') {
            Response::error('Note text is required', 422, ['note' => 'Required.']);
        }
        WorkOrder::addNote($id, $note, (int) Auth::id());
        Response::ok(['workOrder' => WorkOrder::find($id)]);
    }

    /** DELETE /work-orders/{id} — admin-only archive (soft delete). */
    public function archive(array $params): void
    {
        Auth::requireRole('administrator');
        Csrf::verify();
        $id = (int) $params['id'];
        WorkOrder::archive($id);
        AuditLog::record(Auth::id(), 'work_order.archive', 'work_order', $id);
        Response::ok(['success' => true]);
    }
}
