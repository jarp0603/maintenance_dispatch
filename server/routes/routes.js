const express = require('express');
const { getDb } = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { optimizeRoute } = require('../services/routeOptimizer');

const router = express.Router();
router.use(requireAuth);

// GET /api/routes?date=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date query param required in YYYY-MM-DD format' });
    }

    const db = getDb();
    const workOrders = await db.all(
      `SELECT * FROM work_orders WHERE scheduled_date = ? AND status IN ('scheduled', 'in_progress')
       ORDER BY scheduled_time ASC`,
      [date]
    );

    if (workOrders.length === 0) {
      return res.json({ date, stops: [], totalMinutes: 0, mapUrl: null });
    }

    const result = await optimizeRoute(workOrders);
    res.json({ date, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to calculate route' });
  }
});

// POST /api/routes/optimize  (custom list of work order IDs)
router.post('/optimize', async (req, res) => {
  try {
    const { workOrderIds } = req.body;
    if (!Array.isArray(workOrderIds) || workOrderIds.length === 0) {
      return res.status(400).json({ error: 'workOrderIds array required' });
    }

    const db = getDb();
    const placeholders = workOrderIds.map(() => '?').join(',');
    const workOrders = await db.all(
      `SELECT * FROM work_orders WHERE id IN (${placeholders})`,
      workOrderIds
    );

    if (workOrders.length === 0) {
      return res.status(404).json({ error: 'No work orders found for given IDs' });
    }

    const result = await optimizeRoute(workOrders);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to optimize route' });
  }
});

module.exports = router;
