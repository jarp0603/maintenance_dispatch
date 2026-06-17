require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { initDb } = require('./db/db');
const { startCronJobs } = require('./services/followupCron');

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:5173',
  credentials: true,
}));

// Raw body for Calendly webhook signature verification
app.use('/api/calendly/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/workorders', require('./routes/workorders'));
app.use('/api/gmail', require('./routes/gmail'));
app.use('/api/calendly', require('./routes/calendly'));
app.use('/api/routes', require('./routes/routes'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/ai', require('./routes/ai'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV }));

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, req, res, _next) => {
  console.error('[Error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
    console.log(`[Server] DB type: ${process.env.DB_TYPE || 'sqlite'}`);
  });
  if (process.env.NODE_ENV !== 'test') {
    startCronJobs();
  }
}

start().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});

module.exports = app;
