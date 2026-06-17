const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/calendly/status  (protected)
router.get('/status', requireAuth, async (req, res) => {
  const db = getDb();
  const setting = await db.get("SELECT value FROM settings WHERE key='calendly_event_url'");
  const hasKey = !!process.env.CALENDLY_API_KEY;
  const hasUrl = !!(setting?.value);
  res.json({ connected: hasKey && hasUrl, hasApiKey: hasKey, hasEventUrl: hasUrl });
});

// POST /api/calendly/webhook  (no auth - Calendly calls this)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const webhookSecret = process.env.CALENDLY_WEBHOOK_SECRET;

  if (webhookSecret) {
    const signature = req.headers['calendly-webhook-signature'];
    if (!signature) {
      return res.status(401).json({ error: 'Missing webhook signature' });
    }

    const [t, v1] = signature.split(',').map((part) => part.split('=')[1]);
    const body = req.body instanceof Buffer ? req.body.toString() : JSON.stringify(req.body);
    const hmac = crypto.createHmac('sha256', webhookSecret).update(`${t}.${body}`).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(v1 || ''))) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  }

  try {
    const payload = req.body instanceof Buffer ? JSON.parse(req.body.toString()) : req.body;
    const event = payload.event;
    const invitee = payload.payload?.invitee;
    const scheduledEvent = payload.payload?.scheduled_event;

    if (event === 'invitee.created' && invitee && scheduledEvent) {
      const db = getDb();
      const inviteeUri = invitee.uri;
      const eventUri = scheduledEvent.uri;

      // Find work order by matching invitee URI or tenant email
      const email = invitee.email;
      let wo = await db.get('SELECT * FROM work_orders WHERE calendly_invitee_uri = ?', [inviteeUri]);
      if (!wo) {
        wo = await db.get(
          `SELECT * FROM work_orders WHERE tenant_email = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
          [email]
        );
      }

      if (wo) {
        const startTime = scheduledEvent.start_time;
        const dt = new Date(startTime);
        const scheduledDate = dt.toISOString().split('T')[0];
        const scheduledTime = dt.toTimeString().slice(0, 5);

        await db.run(
          `UPDATE work_orders SET status='scheduled', scheduled_date=?, scheduled_time=?,
           calendly_event_uri=?, calendly_invitee_uri=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
          [scheduledDate, scheduledTime, eventUri, inviteeUri, wo.id]
        );
      }
    }

    if (event === 'invitee.canceled') {
      const db = getDb();
      const inviteeUri = payload.payload?.invitee?.uri;
      if (inviteeUri) {
        await db.run(
          `UPDATE work_orders SET status='pending', scheduled_date=NULL, scheduled_time=NULL,
           calendly_event_uri=NULL, updated_at=CURRENT_TIMESTAMP WHERE calendly_invitee_uri=?`,
          [inviteeUri]
        );
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[Calendly Webhook]', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
