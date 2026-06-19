<?php
declare(strict_types=1);

namespace App\Models;

use App\Utils\Database;

final class Appointment
{
    /** Open availability slots from today onward. */
    public static function openSlots(): array
    {
        return Database::all(
            "SELECT a.id, a.user_id, a.slot_date, a.start_time, a.end_time,
                    u.full_name AS technician_name
             FROM availability_slots a
             LEFT JOIN users u ON u.id = a.user_id
             WHERE a.is_open = 1 AND a.slot_date >= CURDATE()
             ORDER BY a.slot_date, a.start_time
             LIMIT 200"
        );
    }

    public static function createSlot(array $d): int
    {
        return Database::insert(
            'INSERT INTO availability_slots (user_id, slot_date, start_time, end_time) VALUES (?,?,?,?)',
            [$d['user_id'] ?? null, $d['slot_date'], $d['start_time'], $d['end_time'] ?? null]
        );
    }

    /**
     * Book a slot for a work order, preventing double-booking.
     * Returns the new appointment id. Throws \RuntimeException on conflict.
     */
    public static function book(int $workOrderId, int $slotId): int
    {
        Database::beginTransaction();
        try {
            // Lock the slot row.
            $slot = Database::one(
                'SELECT * FROM availability_slots WHERE id = ? FOR UPDATE',
                [$slotId]
            );
            if (!$slot || (int) $slot['is_open'] !== 1) {
                throw new \RuntimeException('slot_unavailable');
            }

            // Insert the appointment. The UNIQUE(technician_id, appt_date,
            // start_time) constraint is the final guard against races.
            $apptId = Database::insert(
                'INSERT INTO appointments
                   (work_order_id, slot_id, technician_id, appt_date, start_time, end_time, status)
                 VALUES (?,?,?,?,?,?, "confirmed")',
                [$workOrderId, $slotId, $slot['user_id'], $slot['slot_date'], $slot['start_time'], $slot['end_time']]
            );

            // Close the slot and update the work order.
            Database::run('UPDATE availability_slots SET is_open = 0 WHERE id = ?', [$slotId]);
            Database::run(
                "UPDATE work_orders
                 SET status = 'scheduled', scheduled_date = ?, scheduled_time = ?,
                     assigned_to = COALESCE(assigned_to, ?)
                 WHERE id = ?",
                [$slot['slot_date'], $slot['start_time'], $slot['user_id'], $workOrderId]
            );
            Database::run(
                'INSERT INTO work_order_status_history (work_order_id, to_status, changed_by)
                 VALUES (?, "scheduled", NULL)',
                [$workOrderId]
            );

            Database::commit();
            return $apptId;
        } catch (\PDOException $e) {
            Database::rollBack();
            // Duplicate key = the slot/time was taken concurrently.
            if ($e->getCode() === '23000') {
                throw new \RuntimeException('slot_unavailable');
            }
            throw $e;
        } catch (\Throwable $e) {
            Database::rollBack();
            throw $e;
        }
    }

    public static function forDate(string $date): array
    {
        return Database::all(
            "SELECT ap.*, wo.wo_number, wo.description, p.address AS property_address,
                    un.unit_number, t.full_name AS tenant_name
             FROM appointments ap
             JOIN work_orders wo ON wo.id = ap.work_order_id
             LEFT JOIN properties p ON p.id = wo.property_id
             LEFT JOIN units un ON un.id = wo.unit_id
             LEFT JOIN tenants t ON t.id = wo.tenant_id
             WHERE ap.appt_date = ? AND ap.status = 'confirmed'
             ORDER BY ap.start_time",
            [$date]
        );
    }
}
