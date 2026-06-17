const express = require('express');
const { google } = require('googleapis');
const { getDb } = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { parseEmailsToWorkOrders } = require('../services/gmailParser');

const router = express.Router();

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI || 'http://localhost:3001/api/gmail/callback'
  );
}

// GET /api/gmail/auth-url  (protected)
router.get('/auth-url', requireAuth, (req, res) => {
  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    prompt: 'consent',
  });
  res.json({ url });
});

// GET /api/gmail/callback  (OAuth redirect - no auth required)
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  const appUrl = process.env.APP_URL || 'http://localhost:5173';

  if (error) {
    return res.redirect(`${appUrl}/settings?gmail_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect(`${appUrl}/settings?gmail_error=no_code`);
  }

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch the connected email address
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;

    // Store tokens
    const db = getDb();
    await db.run('DELETE FROM gmail_tokens');
    await db.run(
      'INSERT INTO gmail_tokens (access_token, refresh_token, expiry_date, email) VALUES (?, ?, ?, ?)',
      [tokens.access_token, tokens.refresh_token || null, tokens.expiry_date || null, email]
    );

    res.redirect(`${appUrl}/settings?gmail_connected=true&email=${encodeURIComponent(email)}`);
  } catch (err) {
    console.error('[Gmail OAuth]', err);
    res.redirect(`${appUrl}/settings?gmail_error=${encodeURIComponent(err.message)}`);
  }
});

// GET /api/gmail/status  (protected)
router.get('/status', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const token = await db.get('SELECT email, updated_at FROM gmail_tokens LIMIT 1');
    res.json({ connected: !!token, email: token?.email || null, lastSync: token?.updated_at || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check Gmail status' });
  }
});

// DELETE /api/gmail/disconnect  (protected)
router.delete('/disconnect', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    await db.run('DELETE FROM gmail_tokens');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect Gmail' });
  }
});

// POST /api/gmail/sync  (protected)
router.post('/sync', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const tokenRow = await db.get('SELECT * FROM gmail_tokens LIMIT 1');
    if (!tokenRow) {
      return res.status(400).json({ error: 'Gmail not connected. Please authorize first.' });
    }

    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({
      access_token: tokenRow.access_token,
      refresh_token: tokenRow.refresh_token,
      expiry_date: tokenRow.expiry_date,
    });

    // Refresh token if needed
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await db.run(
          'UPDATE gmail_tokens SET access_token = ?, expiry_date = ?, updated_at = CURRENT_TIMESTAMP',
          [tokens.access_token, tokens.expiry_date || null]
        );
      }
    });

    const result = await parseEmailsToWorkOrders(oauth2Client, db);
    res.json(result);
  } catch (err) {
    console.error('[Gmail Sync]', err);
    res.status(500).json({ error: err.message || 'Failed to sync Gmail' });
  }
});

module.exports = router;
