<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Config\Config;
use App\Middleware\Auth;
use App\Middleware\Csrf;
use App\Models\Appointment;
use App\Models\AuditLog;
use App\Models\SchedulingLink;
use App\Models\WorkOrder;
use App\Utils\Request;
use App\Utils\Response;
use App\Utils\Validator;

final class SchedulingController
{
    /** POST /scheduling-links  (staff: create + return a shareable link) */
    public function create(array $params): void
    {
        Auth::requireAuth();
        Csrf::verify();
        $woId = (int) Request::input('work_order_id', 0);
        if ($woId <= 0 || !WorkOrder::find($woId)) {
            Response::error('Valid work_order_id is required', 422);
        }
        $ttl = (int) Request::input('ttl_hours', 72);
        [$id, $raw] = SchedulingLink::create($woId, (int) Auth::id(), $ttl > 0 ? $ttl : 72);
        AuditLog::record(Auth::id(), 'scheduling_link.create', 'work_order', $woId);

        $base = rtrim((string) Config::get('APP_URL', ''), '/');
        Response::created([
            'id'  => $id,
            'url' => $base . '/schedule/' . $raw, // tenant-facing SPA route
            'expiresInHours' => $ttl > 0 ? $ttl : 72,
        ]);
    }

    /** DELETE /scheduling-links/{id}  (staff: revoke) */
    public function revoke(array $params): void
    {
        Auth::requireAuth();
        Csrf::verify();
        SchedulingLink::revoke((int) $params['id']);
        AuditLog::record(Auth::id(), 'scheduling_link.revoke', 'scheduling_link', (int) $params['id']);
        Response::ok(['success' => true]);
    }

    /**
     * GET /schedule/{token}  (PUBLIC: tenant opens the link)
     * Returns a minimal work-order summary + open availability slots.
     * No authentication; the token IS the capability. No PII beyond what the
     * tenant already knows about their own request.
     */
    public function publicView(array $params): void
    {
        $link = SchedulingLink::resolve((string) $params['token']);
        if (!$link) {
            Response::error('This scheduling link is invalid or has expired.', 410);
        }
        $wo = WorkOrder::find((int) $link['work_order_id']);
        if (!$wo) {
            Response::error('This scheduling link is no longer valid.', 410);
        }
        Response::ok([
            'workOrder' => [
                'number'      => $wo['wo_number'],
                'issueType'   => $wo['issue_type'],
                'description' => $wo['description'],
                'property'    => $wo['property_name'],
                'unit'        => $wo['unit_number'],
            ],
            'slots' => Appointment::openSlots(),
        ]);
    }

    /**
     * POST /schedule/{token}/book  (PUBLIC: tenant picks a slot)
     * Body: { slot_id }. Prevents double-booking server-side.
     */
    public function publicBook(array $params): void
    {
        $link = SchedulingLink::resolve((string) $params['token']);
        if (!$link) {
            Response::error('This scheduling link is invalid or has expired.', 410);
        }
        $slotId = (int) Request::input('slot_id', 0);
        $v = new Validator(['slot_id' => $slotId]);
        $v->required('slot_id')->integer('slot_id');
        if ($v->fails() || $slotId <= 0) {
            Response::error('Please choose an available time slot.', 422);
        }

        try {
            $apptId = Appointment::book((int) $link['work_order_id'], $slotId);
        } catch (\RuntimeException $e) {
            if ($e->getMessage() === 'slot_unavailable') {
                Response::error('That time was just taken. Please pick another slot.', 409);
            }
            throw $e;
        }

        SchedulingLink::markUsed((int) $link['id']);
        AuditLog::record(null, 'appointment.book', 'work_order', (int) $link['work_order_id']);
        Response::created([
            'message'       => 'Your appointment is confirmed.',
            'appointmentId' => $apptId,
        ]);
    }
}
