const express = require('express');
const { getDb } = require('../db/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/analytics/overview
router.get('/overview', async (req, res) => {
  try {
    const db = getDb();
    const [total, byStatus, byPriority, thisMonth] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM work_orders'),
      db.all('SELECT status, COUNT(*) as count FROM work_orders GROUP BY status'),
      db.all('SELECT priority, COUNT(*) as count FROM work_orders GROUP BY priority'),
      db.get(`SELECT COUNT(*) as count FROM work_orders WHERE created_at >= date('now','-30 days')`),
    ]);

    res.json({
      total: total?.count || 0,
      thisMonth: thisMonth?.count || 0,
      byStatus: Object.fromEntries((byStatus || []).map((r) => [r.status, r.count])),
      byPriority: Object.fromEntries((byPriority || []).map((r) => [r.priority, r.count])),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

// GET /api/analytics/trends?period=week|month&weeks=12
router.get('/trends', async (req, res) => {
  try {
    const db = getDb();
    const { period = 'week', weeks = 12 } = req.query;
    const n = Math.min(parseInt(weeks) || 12, 52);

    let rows;
    if (period === 'month') {
      rows = await db.all(
        `SELECT strftime('%Y-%m', created_at) as period, COUNT(*) as count
         FROM work_orders
         WHERE created_at >= date('now', '-${n} months')
         GROUP BY period
         ORDER BY period ASC`
      );
    } else {
      rows = await db.all(
        `SELECT strftime('%Y-W%W', created_at) as period, COUNT(*) as count
         FROM work_orders
         WHERE created_at >= date('now', '-${n * 7} days')
         GROUP BY period
         ORDER BY period ASC`
      );
    }

    res.json({ period, data: rows || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

// GET /api/analytics/by-type
router.get('/by-type', async (req, res) => {
  try {
    const db = getDb();
    const rows = await db.all(
      `SELECT issue_type, COUNT(*) as count,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed
       FROM work_orders
       GROUP BY issue_type
       ORDER BY count DESC`
    );
    res.json(rows || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch by-type data' });
  }
});

// GET /api/analytics/resolution-time
router.get('/resolution-time', async (req, res) => {
  try {
    const db = getDb();
    const rows = await db.all(
      `SELECT issue_type,
        ROUND(AVG(
          CAST((julianday(completed_at) - julianday(created_at)) * 24 AS REAL)
        ), 1) as avg_hours,
        COUNT(*) as count
       FROM work_orders
       WHERE status='completed' AND completed_at IS NOT NULL
       GROUP BY issue_type
       ORDER BY avg_hours DESC`
    );
    res.json(rows || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch resolution time data' });
  }
});

// GET /api/analytics/by-day
router.get('/by-day', async (req, res) => {
  try {
    const db = getDb();
    const rows = await db.all(
      `SELECT strftime('%w', created_at) as day_of_week, COUNT(*) as count
       FROM work_orders
       GROUP BY day_of_week
       ORDER BY day_of_week ASC`
    );
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result = days.map((name, i) => {
      const match = (rows || []).find((r) => parseInt(r.day_of_week) === i);
      return { day: name, count: match?.count || 0 };
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch by-day data' });
  }
});

// GET /api/analytics/by-unit
router.get('/by-unit', async (req, res) => {
  try {
    const db = getDb();
    const rows = await db.all(
      `SELECT unit_number, address, COUNT(*) as count,
        SUM(CASE WHEN priority IN ('high','emergency') THEN 1 ELSE 0 END) as high_priority
       FROM work_orders
       GROUP BY unit_number
       ORDER BY count DESC
       LIMIT 20`
    );
    res.json(rows || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch by-unit data' });
  }
});

module.exports = router;
