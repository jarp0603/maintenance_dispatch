const cron = require('node-cron');
const { getDb } = require('../db/db');
const { sendFollowup, sendReminder, sendCompletion } = require('./calendlyService');

async function getHours(key, defaultVal) {
  try {
    const db = getDb();
    const row = await db.get('SELECT value FROM settings WHERE key=?', [key]);
    return parseInt(row?.value || defaultVal);
  } catch {
    return defaultVal;
  }
}

async function runFollowups() {
  const db = getDb();
  const [f1Hours, f2Hours] = await Promise.all([
    getHours('followup_1_hours', 48),
    getHours('followup_2_hours', 96),
  ]);

  const notificationsRow = await db.get("SELECT value FROM settings WHERE key='notifications_enabled'");
  if (notificationsRow?.value === 'false') return;

  // Work orders pending followup 1
  const f1Threshold = new Date(Date.now() - f1Hours * 60 * 60 * 1000).toISOString();
  const pendingF1 = await db.all(
    `SELECT * FROM work_orders
     WHERE status='pending' AND followup_1_sent=0 AND tenant_email IS NOT NULL
       AND created_at <= ? AND tenant_email != ''`,
    [f1Threshold]
  );

  for (const wo of pendingF1) {
    try {
      await sendFollowup(wo, 1);
      console.log(`[Cron] Sent followup 1 to ${wo.tenant_email} for WO #${wo.id}`);
    } catch (err) {
      console.error(`[Cron] Failed followup 1 for WO #${wo.id}:`, err.message);
    }
  }

  // Work orders pending followup 2
  const f2Threshold = new Date(Date.now() - f2Hours * 60 * 60 * 1000).toISOString();
  const pendingF2 = await db.all(
    `SELECT * FROM work_orders
     WHERE status='pending' AND followup_1_sent=1 AND followup_2_sent=0 AND tenant_email IS NOT NULL
       AND created_at <= ? AND tenant_email != ''`,
    [f2Threshold]
  );

  for (const wo of pendingF2) {
    try {
      await sendFollowup(wo, 2);
      console.log(`[Cron] Sent followup 2 to ${wo.tenant_email} for WO #${wo.id}`);
    } catch (err) {
      console.error(`[Cron] Failed followup 2 for WO #${wo.id}:`, err.message);
    }
  }
}

async function runReminders() {
  const db = getDb();
  const reminderHours = await getHours('reminder_hours', 24);

  const notificationsRow = await db.get("SELECT value FROM settings WHERE key='notifications_enabled'");
  if (notificationsRow?.value === 'false') return;

  // Upcoming scheduled work orders
  const now = new Date();
  const windowStart = new Date(now.getTime() + (reminderHours - 2) * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + (reminderHours + 2) * 60 * 60 * 1000);

  const startDate = windowStart.toISOString().split('T')[0];
  const endDate = windowEnd.toISOString().split('T')[0];

  const upcoming = await db.all(
    `SELECT * FROM work_orders
     WHERE status='scheduled' AND reminder_sent=0 AND tenant_email IS NOT NULL
       AND scheduled_date BETWEEN ? AND ? AND tenant_email != ''`,
    [startDate, endDate]
  );

  for (const wo of upcoming) {
    try {
      await sendReminder(wo);
      console.log(`[Cron] Sent reminder to ${wo.tenant_email} for WO #${wo.id}`);
    } catch (err) {
      console.error(`[Cron] Failed reminder for WO #${wo.id}:`, err.message);
    }
  }
}

async function runCompletionEmails() {
  const db = getDb();

  const notificationsRow = await db.get("SELECT value FROM settings WHERE key='notifications_enabled'");
  if (notificationsRow?.value === 'false') return;

  const recentlyCompleted = await db.all(
    `SELECT * FROM work_orders
     WHERE status='completed' AND completion_sent=0 AND tenant_email IS NOT NULL
       AND completed_at IS NOT NULL AND tenant_email != ''
       AND completed_at >= datetime('now', '-1 hour')`
  );

  for (const wo of recentlyCompleted) {
    try {
      await sendCompletion(wo);
      console.log(`[Cron] Sent completion email to ${wo.tenant_email} for WO #${wo.id}`);
    } catch (err) {
      console.error(`[Cron] Failed completion email for WO #${wo.id}:`, err.message);
    }
  }
}

function startCronJobs() {
  // Run followup checks every hour
  cron.schedule('0 * * * *', async () => {
    try { await runFollowups(); }
    catch (err) { console.error('[Cron] Followup job failed:', err); }
  });

  // Run reminder checks every 2 hours
  cron.schedule('0 */2 * * *', async () => {
    try { await runReminders(); }
    catch (err) { console.error('[Cron] Reminder job failed:', err); }
  });

  // Run completion email check every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try { await runCompletionEmails(); }
    catch (err) { console.error('[Cron] Completion email job failed:', err); }
  });

  console.log('[Cron] Jobs started: followups (hourly), reminders (2h), completions (15min)');
}

module.exports = { startCronJobs };
