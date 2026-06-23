const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const db = require('./db');
const priceRouter = require('./routes/price');
const adminRouter = require('./routes/admin');

const app = express();

// Security & utility middleware
app.use(helmet({
  contentSecurityPolicy: false, // Theme app extension loads inline
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN === '*' ? true : (process.env.CORS_ORIGIN || '*'),
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '100kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiting on price endpoint (protect against abuse from store)
const priceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests, please try again shortly.' }
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'shopify-zip-pricing', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api', priceLimiter, priceRouter);
app.use('/admin', adminLimiter, adminRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not found', path: req.path });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    ok: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

async function start() {
  await db.init();

  // Auto-seed on first boot if the rules table is empty.
  const count = db.prepare('SELECT COUNT(*) as c FROM pricing_rules').get().c;
  if (count === 0) {
    console.log('[boot] pricing_rules is empty — running seed');
    const seed = require('../scripts/seed-inline');
    await seed();
  }

  // Render assigns a dynamic port via PORT env var. Only fall back to 3000 for local dev.
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const HOST = process.env.HOST || '0.0.0.0';
  app.listen(PORT, HOST, () => {
    console.log(`ZIP Pricing API listening on ${HOST}:${PORT}`);
    console.log(`  Health:    http://localhost:${PORT}/health`);
    console.log(`  Price API: http://localhost:${PORT}/api/price?zip=10001&product_id=gid://shopify/Product/123`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});

module.exports = app;