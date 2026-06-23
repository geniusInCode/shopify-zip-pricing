const express = require('express');
const crypto = require('crypto');
const { quote } = require('../services/pricing');
const db = require('../db');

const router = express.Router();

function verifyAppProxyHmac(req, res, next) {
  const { signature, ...rest } = req.query;
  const allowed = (process.env.ALLOWED_SHOPS || '*').split(',').map(s => s.trim());

  if (!signature) {
    // No signature: allow direct calls for testing/demo, but log a warning.
    // App Proxy calls will always have a signature, so this only affects direct API hits.
    if (process.env.REQUIRE_HMAC === 'true') {
      return res.status(401).json({ ok: false, error: 'Missing signature' });
    }
    console.warn('[price] request without signature — direct API call (not via App Proxy)');
    return next();
  }

  const shopDomain = req.query.shop || '';
  if (allowed[0] !== '*' && !allowed.includes(shopDomain)) {
    return res.status(403).json({ ok: false, error: 'Shop not allowed' });
  }

  const message = Object.keys(rest)
    .sort()
    .map(k => `${k}=${rest[k]}`)
    .join('&');

  const computed = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(message)
    .digest('hex');

  if (computed !== signature) {
    return res.status(401).json({ ok: false, error: 'Invalid signature' });
  }
  next();
}

router.get('/price', verifyAppProxyHmac, async (req, res) => {
  const { product_id, variant_id, zip, base_price_cents, shop } = req.query;

  if (!zip) {
    return res.status(400).json({
      ok: false,
      error: 'MISSING_ZIP',
      message: 'zip query parameter is required'
    });
  }

  const result = quote({
    productId: product_id || null,
    variantId: variant_id || null,
    zip: String(zip),
    basePriceCents: base_price_cents ? parseInt(base_price_cents, 10) : null
  });

  try {
    db.prepare(`
      INSERT INTO zip_lookups
        (product_id, variant_id, zip_code, price_cents, rule_id, matched, shop_domain, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      product_id || null,
      variant_id || null,
      String(zip),
      result.priceCents || 0,
      result.ruleId || null,
      result.matched ? 1 : 0,
      shop || null,
      req.headers['user-agent'] || null
    );
  } catch (e) {
    console.error('Failed to log lookup', e.message);
  }

  res.json(result);
});

module.exports = router;