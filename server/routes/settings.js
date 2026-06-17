const express = require('express');
const { getDb } = require('../db/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const ALLOWED_KEYS = [
  'followup_1_hours', 'followup_2_hours', 'reminder_hours', 'min_gap_minutes',
  'calendly_event_url', 'business_name', 'technician_name', 'tech_email',
  'notifications_enabled',
];

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const rows = await db.all('SELECT key, value FROM settings');
    const settings = Object.fromEntries((rows || []).map((r) => [r.key, r.value]));
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  try {
    const db = getDb();
    const updates = req.body;

    for (const [key, value] of Object.entries(updates)) {
      if (!ALLOWED_KEYS.includes(key)) continue;
      await db.run(
        'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP',
        [key, String(value)]
      );
    }

    const rows = await db.all('SELECT key, value FROM settings');
    res.json(Object.fromEntries((rows || []).map((r) => [r.key, r.value])));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
