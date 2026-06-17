const express = require('express');
const { getDb } = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { sendSchedulingLink } = require('../services/calendlyService');

const router = express.Router();
router.use(requireAuth);

const VALID_STATUSES = ['pending', 'scheduled', 'in_progress', 'completed', 'cancelled'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'emergency'];
const VALID_ISSUE_TYPES = [
  'electrical', 'smoke_alarm', 'plumbing', 'welding', 'painting',
  'door_repair', 'hvac', 'appliances', 'general',
];

// GET /api/workorders/stats
router.get('/stats', async (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [open, scheduledToday, completedWeek, overdue] = await Promise.all([
      db.get(`SELECT COUNT(*) as count FROM work_orders WHERE status IN ('pending','scheduled','in_progress')`),
      db.get(`SELECT COUNT(*) as count FROM work_orders WHERE status='scheduled' AND scheduled_date=?`, [today]),
      db.get(`SELECT COUNT(*) as count FROM work_orders WHERE status='completed' AND completed_at >= ?`, [weekAgo]),
      db.get(`SELECT COUNT(*) as count FROM work_orders WHERE status IN ('pending','scheduled') AND scheduled_date < ? AND scheduled_date IS NOT NULL`, [today]),
    ]);

    res.json({
      open: open?.count || 0,
      scheduledToday: scheduledToday?.count || 0,
      completedWeek: completedWeek?.count || 0,
      overdue: overdue?.count || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/workorders
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { status, priority, issue_type, search, page = 1, limit = 20, sort = 'created_at', order = 'DESC' } = req.query;

    const safeSorts = ['created_at', 'updated_at', 'scheduled_date', 'priority', 'status', 'tenant_name'];
    const sortCol = safeSorts.includes(sort) ? sort : 'created_at';
    const sortDir = order === 'ASC' ? 'ASC' : 'DESC';

    const conditions = [];
    const params = [];

    if (status) { conditions.push('status = ?'); params.push(status); }
    if (priority) { conditions.push('priority = ?'); params.push(priority); }
    if (issue_type) { conditions.push('issue_type = ?'); params.push(issue_type); }
    if (search) {
      conditions.push('(tenant_name LIKE ? OR unit_number LIKE ? OR address LIKE ? OR notes LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q, q);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows, countRow] = await Promise.all([
      db.all(`SELECT * FROM work_orders ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`, [...params, parseInt(limit), offset]),
      db.get(`SELECT COUNT(*) as total FROM work_orders ${where}`, params),
    ]);

    res.json({
      data: rows,
      total: countRow?.total || 0,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch work orders' });
  }
});

// GET /api/workorders/kanban
router.get('/kanban', async (req, res) => {
  try {
    const db = getDb();
    const rows = await db.all(
      `SELECT * FROM work_orders WHERE status != 'cancelled' ORDER BY
        CASE priority WHEN 'emergency' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        created_at DESC`
    );

    const columns = {
      pending: [],
      scheduled: [],
      in_progress: [],
      completed: [],
    };
    for (const row of rows) {
      if (columns[row.status]) columns[row.status].push(row);
    }
    res.json(columns);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch kanban data' });
  }
});

// GET /api/workorders/:id
router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const wo = await db.get('SELECT * FROM work_orders WHERE id = ?', [req.params.id]);
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    const logs = await db.all('SELECT * FROM email_logs WHERE work_order_id = ? ORDER BY sent_at DESC', [req.params.id]);
    res.json({ ...wo, email_logs: logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch work order' });
  }
});

// POST /api/workorders
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const {
      tenant_name, unit_number, address, issue_type = 'general',
      priority = 'medium', status = 'pending', scheduled_date, scheduled_time,
      notes, source = 'manual', email_thread_id, tenant_email,
    } = req.body;

    if (!tenant_name || !unit_number || !address) {
      return res.status(400).json({ error: 'tenant_name, unit_number, and address are required' });
    }

    if (!VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }
    if (!VALID_ISSUE_TYPES.includes(issue_type)) {
      return res.status(400).json({ error: `Invalid issue_type. Must be one of: ${VALID_ISSUE_TYPES.join(', ')}` });
    }

    const result = await db.run(
      `INSERT INTO work_orders (tenant_name, unit_number, address, issue_type, priority, status,
        scheduled_date, scheduled_time, notes, source, email_thread_id, tenant_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant_name, unit_number, address, issue_type, priority, status,
        scheduled_date || null, scheduled_time || null, notes || null,
        source, email_thread_id || null, tenant_email || null]
    );

    const wo = await db.get('SELECT * FROM work_orders WHERE id = ?', [result.lastID]);

    // Auto-send scheduling link if tenant email provided and Calendly configured
    if (tenant_email && process.env.CALENDLY_API_KEY && process.env.CALENDLY_EVENT_URL) {
      sendSchedulingLink(wo).catch((err) => console.error('[Calendly] Failed to send link:', err));
    }

    res.status(201).json(wo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create work order' });
  }
});

// PUT /api/workorders/:id
router.put('/:id', async (req, res) => {
  try {
    const db = getDb();
    const existing = await db.get('SELECT * FROM work_orders WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Work order not found' });

    const allowedFields = [
      'tenant_name', 'unit_number', 'address', 'issue_type', 'priority', 'status',
      'scheduled_date', 'scheduled_time', 'notes', 'tenant_email', 'calendly_event_uri',
    ];
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (field in req.body) {
        if (field === 'priority' && !VALID_PRIORITIES.includes(req.body[field])) {
          return res.status(400).json({ error: `Invalid priority` });
        }
        if (field === 'status' && !VALID_STATUSES.includes(req.body[field])) {
          return res.status(400).json({ error: `Invalid status` });
        }
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    // Auto-set completed_at when marking complete
    if (req.body.status === 'completed' && existing.status !== 'completed') {
      updates.push('completed_at = ?');
      values.push(new Date().toISOString());
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(req.params.id);

    await db.run(`UPDATE work_orders SET ${updates.join(', ')} WHERE id = ?`, values);
    const updated = await db.get('SELECT * FROM work_orders WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update work order' });
  }
});

// DELETE /api/workorders/:id
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const existing = await db.get('SELECT id FROM work_orders WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Work order not found' });
    await db.run('DELETE FROM email_logs WHERE work_order_id = ?', [req.params.id]);
    await db.run('DELETE FROM work_orders WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete work order' });
  }
});

// POST /api/workorders/:id/send-scheduling
router.post('/:id/send-scheduling', async (req, res) => {
  try {
    const db = getDb();
    const wo = await db.get('SELECT * FROM work_orders WHERE id = ?', [req.params.id]);
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    if (!wo.tenant_email) return res.status(400).json({ error: 'No tenant email on this work order' });

    await sendSchedulingLink(wo);
    res.json({ success: true, message: 'Scheduling link sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to send scheduling link' });
  }
});

module.exports = router;
