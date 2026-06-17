const { google } = require('googleapis');

const ISSUE_KEYWORDS = {
  electrical: ['light', 'lights', 'electrical', 'outlet', 'switch', 'breaker', 'circuit', 'power', 'wiring', 'socket'],
  smoke_alarm: ['smoke', 'alarm', 'detector', 'carbon monoxide', 'co detector', 'fire alarm', 'beeping'],
  plumbing: ['leak', 'pipe', 'water', 'drain', 'toilet', 'sink', 'faucet', 'shower', 'abs', 'clog', 'flood', 'flooding'],
  welding: ['weld', 'welding', 'metal', 'steel', 'iron', 'gate', 'fence', 'railing'],
  painting: ['paint', 'painting', 'wall', 'ceiling', 'stain', 'peel', 'patch', 'drywall'],
  door_repair: ['door', 'lock', 'key', 'hinge', 'knob', 'handle', 'deadbolt', 'entry'],
  hvac: ['heat', 'heating', 'cooling', 'ac', 'a/c', 'air conditioning', 'hvac', 'furnace', 'thermostat', 'vent'],
  appliances: ['refrigerator', 'fridge', 'stove', 'oven', 'dishwasher', 'washer', 'dryer', 'microwave', 'appliance'],
};

const URGENCY_KEYWORDS = ['emergency', 'urgent', 'asap', 'immediately', 'flooding', 'fire', 'danger', 'dangerous', 'severe'];

const UNIT_PATTERNS = [
  /\bunit\s*#?\s*([A-Za-z0-9-]+)/i,
  /\bapt\.?\s*#?\s*([A-Za-z0-9-]+)/i,
  /\bapartment\s*#?\s*([A-Za-z0-9-]+)/i,
  /\b#\s*([A-Za-z0-9-]+)\b/i,
  /\bsuite\s*#?\s*([A-Za-z0-9-]+)/i,
  /\broom\s*#?\s*([A-Za-z0-9-]+)/i,
];

function detectIssueType(text) {
  const lower = text.toLowerCase();
  for (const [type, keywords] of Object.entries(ISSUE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return type;
  }
  return 'general';
}

function detectPriority(text) {
  const lower = text.toLowerCase();
  if (URGENCY_KEYWORDS.some((kw) => lower.includes(kw))) return 'emergency';
  return 'medium';
}

function extractUnit(text) {
  for (const pattern of UNIT_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function extractAddress(text) {
  // Simple heuristic: find lines with street number patterns
  const lines = text.split('\n');
  for (const line of lines) {
    if (/\d{1,5}\s+[A-Za-z]+\s+(St|Ave|Blvd|Dr|Rd|Ln|Way|Ct|Pl|Terr|Circle|Cir)/i.test(line)) {
      return line.trim().slice(0, 200);
    }
  }
  return '';
}

function extractTenantName(from, body) {
  // Try to get name from From header: "Name <email>"
  const fromMatch = from.match(/^"?([^"<]+)"?\s*</);
  if (fromMatch) return fromMatch[1].trim();

  // Look for "I am" / "My name is" in body
  const nameMatch = body.match(/(?:my name is|i am|this is)\s+([A-Z][a-z]+ [A-Z][a-z]+)/i);
  if (nameMatch) return nameMatch[1];

  return from.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function decodeBase64(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function extractBody(payload) {
  if (payload.body?.data) return decodeBase64(payload.body.data);
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64(part.body.data);
      }
    }
    for (const part of payload.parts) {
      if (part.body?.data) return decodeBase64(part.body.data);
    }
  }
  return '';
}

async function parseEmailsToWorkOrders(oauth2Client, db) {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Get already-processed thread IDs to skip
  const existing = await db.all('SELECT email_thread_id FROM work_orders WHERE email_thread_id IS NOT NULL');
  const processedThreadIds = new Set(existing.map((r) => r.email_thread_id));

  // Search for maintenance-related emails in last 30 days
  const query = 'subject:(repair OR maintenance OR broken OR leak OR heat OR light OR door OR emergency) newer_than:30d';
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 50,
  });

  const messages = listRes.data.messages || [];
  let parsed = 0;
  let skipped = 0;

  for (const msg of messages) {
    if (processedThreadIds.has(msg.threadId)) { skipped++; continue; }

    try {
      const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
      const headers = full.data.payload.headers || [];
      const getHeader = (name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const subject = getHeader('Subject');
      const from = getHeader('From');
      const fromEmail = (from.match(/<([^>]+)>/) || [null, from])[1];
      const body = extractBody(full.data.payload);
      const fullText = `${subject}\n${body}`;

      const issueType = detectIssueType(fullText);
      const priority = detectPriority(fullText);
      const unit = extractUnit(fullText);
      const address = extractAddress(body);
      const tenantName = extractTenantName(from, body);

      await db.run(
        `INSERT INTO work_orders
          (tenant_name, unit_number, address, issue_type, priority, status, source, email_thread_id, tenant_email, notes)
         VALUES (?, ?, ?, ?, ?, 'pending', 'email', ?, ?, ?)`,
        [
          tenantName,
          unit || 'Unknown',
          address || 'Unknown - see notes',
          issueType,
          priority,
          msg.threadId,
          fromEmail,
          `Subject: ${subject}\n\n${body.slice(0, 1000)}`,
        ]
      );

      processedThreadIds.add(msg.threadId);
      parsed++;
    } catch (err) {
      console.error(`[Gmail Parser] Failed to process message ${msg.id}:`, err.message);
    }
  }

  return { parsed, skipped, total: messages.length };
}

module.exports = { parseEmailsToWorkOrders };
