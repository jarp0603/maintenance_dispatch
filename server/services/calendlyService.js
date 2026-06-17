const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const { getDb } = require('../db/db');

const ISSUE_TYPE_LABELS = {
  electrical: 'Electrical / Lighting',
  smoke_alarm: 'Smoke Alarm',
  plumbing: 'Plumbing / ABS',
  welding: 'Welding',
  painting: 'Painting',
  door_repair: 'Door Repair',
  hvac: 'HVAC',
  appliances: 'Appliance Repair',
  general: 'General Maintenance',
};

async function getGmailTransporter() {
  const db = getDb();
  const tokenRow = await db.get('SELECT * FROM gmail_tokens LIMIT 1');
  if (!tokenRow || !tokenRow.refresh_token) return null;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
  oauth2Client.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
    expiry_date: tokenRow.expiry_date,
  });

  const { token } = await oauth2Client.getAccessToken();

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.GMAIL_USER_EMAIL || 'juan20643@gmail.com',
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: tokenRow.refresh_token,
      accessToken: token,
    },
  });
}

async function getSettings() {
  const db = getDb();
  const rows = await db.all('SELECT key, value FROM settings');
  return Object.fromEntries((rows || []).map((r) => [r.key, r.value]));
}

async function logEmail(workOrderId, type, recipient, subject, status = 'sent', errorMessage = null) {
  const db = getDb();
  await db.run(
    'INSERT INTO email_logs (work_order_id, email_type, recipient, subject, status, error_message) VALUES (?, ?, ?, ?, ?, ?)',
    [workOrderId, type, recipient, subject, status, errorMessage]
  );
}

async function sendEmail(to, subject, html, workOrderId, emailType) {
  try {
    const transporter = await getGmailTransporter();
    if (!transporter) {
      throw new Error('Gmail not configured. Please connect Gmail in Settings.');
    }

    await transporter.sendMail({
      from: process.env.GMAIL_USER_EMAIL || 'juan20643@gmail.com',
      to,
      subject,
      html,
    });

    await logEmail(workOrderId, emailType, to, subject, 'sent');
  } catch (err) {
    await logEmail(workOrderId, emailType, to, subject, 'failed', err.message);
    throw err;
  }
}

async function sendSchedulingLink(workOrder) {
  const settings = await getSettings();
  const calendlyUrl = settings.calendly_event_url || process.env.CALENDLY_EVENT_URL;
  if (!calendlyUrl) throw new Error('Calendly event URL not configured in settings');

  const issueLabel = ISSUE_TYPE_LABELS[workOrder.issue_type] || 'Maintenance';
  const bizName = settings.business_name || 'Maintenance Dispatch';
  const techName = settings.technician_name || 'Your Technician';

  const subject = `Schedule Your ${issueLabel} Repair – Unit ${workOrder.unit_number}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1e40af">Maintenance Appointment Scheduling</h2>
      <p>Hello ${workOrder.tenant_name},</p>
      <p>We've received your maintenance request for <strong>${issueLabel}</strong> at unit <strong>${workOrder.unit_number}</strong>.</p>
      <p>Please use the link below to schedule a convenient time for your repair:</p>
      <div style="text-align:center;margin:30px 0">
        <a href="${calendlyUrl}" style="background:#1e40af;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;font-size:16px">
          Schedule My Appointment
        </a>
      </div>
      <p><strong>Work Order Details:</strong></p>
      <ul>
        <li>Issue Type: ${issueLabel}</li>
        <li>Priority: ${workOrder.priority}</li>
        <li>Address: ${workOrder.address}</li>
      </ul>
      <p>If you have any questions, please reply to this email.</p>
      <p>Thank you,<br>${techName}<br>${bizName}</p>
    </div>
  `;

  await sendEmail(workOrder.tenant_email, subject, html, workOrder.id, 'initial');

  const db = getDb();
  await db.run('UPDATE work_orders SET updated_at=CURRENT_TIMESTAMP WHERE id=?', [workOrder.id]);
}

async function sendFollowup(workOrder, followupNumber) {
  const settings = await getSettings();
  const calendlyUrl = settings.calendly_event_url || process.env.CALENDLY_EVENT_URL;
  const issueLabel = ISSUE_TYPE_LABELS[workOrder.issue_type] || 'Maintenance';
  const bizName = settings.business_name || 'Maintenance Dispatch';
  const techName = settings.technician_name || 'Your Technician';

  const subject = `Reminder: Schedule Your ${issueLabel} Repair – Unit ${workOrder.unit_number}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1e40af">Friendly Reminder</h2>
      <p>Hello ${workOrder.tenant_name},</p>
      <p>This is a friendly reminder that your <strong>${issueLabel}</strong> repair request for unit <strong>${workOrder.unit_number}</strong> has not yet been scheduled.</p>
      <p>Please schedule a convenient time at your earliest convenience:</p>
      <div style="text-align:center;margin:30px 0">
        <a href="${calendlyUrl}" style="background:#1e40af;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;font-size:16px">
          Schedule Now
        </a>
      </div>
      <p>If you have any questions or concerns, please don't hesitate to reach out.</p>
      <p>Thank you,<br>${techName}<br>${bizName}</p>
    </div>
  `;

  const emailType = followupNumber === 1 ? 'followup1' : 'followup2';
  await sendEmail(workOrder.tenant_email, subject, html, workOrder.id, emailType);

  const db = getDb();
  const field = followupNumber === 1 ? 'followup_1_sent' : 'followup_2_sent';
  await db.run(`UPDATE work_orders SET ${field}=1, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [workOrder.id]);
}

async function sendReminder(workOrder) {
  const settings = await getSettings();
  const issueLabel = ISSUE_TYPE_LABELS[workOrder.issue_type] || 'Maintenance';
  const bizName = settings.business_name || 'Maintenance Dispatch';
  const techName = settings.technician_name || 'Your Technician';
  const date = workOrder.scheduled_date;
  const time = workOrder.scheduled_time;

  const subject = `Appointment Reminder: ${issueLabel} Tomorrow – Unit ${workOrder.unit_number}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1e40af">Appointment Reminder</h2>
      <p>Hello ${workOrder.tenant_name},</p>
      <p>This is a reminder that your <strong>${issueLabel}</strong> repair is scheduled for tomorrow.</p>
      <p><strong>Date:</strong> ${date}</p>
      ${time ? `<p><strong>Time:</strong> ${time}</p>` : ''}
      <p><strong>Address:</strong> ${workOrder.address}, Unit ${workOrder.unit_number}</p>
      <p>Please ensure someone is available to provide access. If you need to reschedule, please contact us as soon as possible.</p>
      <p>Thank you,<br>${techName}<br>${bizName}</p>
    </div>
  `;

  await sendEmail(workOrder.tenant_email, subject, html, workOrder.id, 'reminder');

  const db = getDb();
  await db.run('UPDATE work_orders SET reminder_sent=1, updated_at=CURRENT_TIMESTAMP WHERE id=?', [workOrder.id]);
}

async function sendCompletion(workOrder) {
  const settings = await getSettings();
  const issueLabel = ISSUE_TYPE_LABELS[workOrder.issue_type] || 'Maintenance';
  const bizName = settings.business_name || 'Maintenance Dispatch';
  const techName = settings.technician_name || 'Your Technician';

  const subject = `Repair Completed: ${issueLabel} – Unit ${workOrder.unit_number}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#16a34a">Repair Completed</h2>
      <p>Hello ${workOrder.tenant_name},</p>
      <p>We're happy to let you know that your <strong>${issueLabel}</strong> repair at unit <strong>${workOrder.unit_number}</strong> has been completed.</p>
      ${workOrder.notes ? `<p><strong>Notes:</strong> ${workOrder.notes}</p>` : ''}
      <p>If you notice any issues or have concerns about the work performed, please don't hesitate to contact us.</p>
      <p>Thank you for your patience!</p>
      <p>Best regards,<br>${techName}<br>${bizName}</p>
    </div>
  `;

  await sendEmail(workOrder.tenant_email, subject, html, workOrder.id, 'completion');

  const db = getDb();
  await db.run('UPDATE work_orders SET completion_sent=1, updated_at=CURRENT_TIMESTAMP WHERE id=?', [workOrder.id]);
}

module.exports = { sendSchedulingLink, sendFollowup, sendReminder, sendCompletion };
