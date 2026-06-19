<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\Auth;
use App\Middleware\Csrf;
use App\Models\Appointment;
use App\Models\AuditLog;
use App\Utils\Request;
use App\Utils\Response;
use App\Utils\Validator;

final class AppointmentController
{
    /** GET /appointments?date=YYYY-MM-DD */
    public function index(array $params): void
    {
        Auth::requireAuth();
        $date = (string) Request::query('date', date('Y-m-d'));
        Response::ok(['appointments' => Appointment::forDate($date)]);
    }

    /** GET /availability — open slots */
    public function availability(array $params): void
    {
        Auth::requireAuth();
        Response::ok(['slots' => Appointment::openSlots()]);
    }

    /** POST /availability — staff add an availability slot */
    public function createSlot(array $params): void
    {
        Auth::requireAuth();
        Csrf::verify();
        $data = Request::json();
        $v = new Validator($data);
        $v->required('slot_date')->date('slot_date')->required('start_time');
        if ($v->fails()) {
            Response::error('Validation failed', 422, $v->errors());
        }
        $id = Appointment::createSlot($data);
        AuditLog::record(Auth::id(), 'availability.create', 'availability', $id);
        Response::created(['id' => $id]);
    }
}
