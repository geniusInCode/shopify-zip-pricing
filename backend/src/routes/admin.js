const express = require('express');
const { z } = require('zod');
const db = require('../db');

const router = express.Router();

const RuleSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().nullable().optional(),
  zipPattern: z.string().min(1),
  priceCents: z.number().int().positive(),
  label: z.string().nullable().optional(),
  priority: z.number().int().default(0),
  active: z.boolean().default(true)
});

router.get('/rules', async (req, res) => {
  const { product_id } = req.query;
  const stmt = product_id
    ? db.prepare('SELECT * FROM pricing_rules WHERE product_id = ? ORDER BY priority DESC, id DESC')
    : db.prepare('SELECT * FROM pricing_rules ORDER BY priority DESC, id DESC');
  const rows = product_id ? stmt.all(product_id) : stmt.all();
  res.json({ ok: true, rules: rows });
});

router.post('/rules', async (req, res) => {
  try {
    const data = RuleSchema.parse(req.body);
    const result = db.prepare(`
      INSERT INTO pricing_rules (product_id, variant_id, zip_pattern, price_cents, label, priority, active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.productId,
      data.variantId || null,
      data.zipPattern,
      data.priceCents,
      data.label || null,
      data.priority,
      data.active ? 1 : 0
    );
    const row = db.prepare('SELECT * FROM pricing_rules WHERE id = ?').get(result.lastInsertRowid);
    res.json({ ok: true, rule: row });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

router.put('/rules/:id', async (req, res) => {
  try {
    const data = RuleSchema.partial().parse(req.body);
    const existing = db.prepare('SELECT * FROM pricing_rules WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Not found' });

    const merged = {
      product_id: data.productId ?? existing.product_id,
      variant_id: data.variantId ?? existing.variant_id,
      zip_pattern: data.zipPattern ?? existing.zip_pattern,
      price_cents: data.priceCents ?? existing.price_cents,
      label: data.label ?? existing.label,
      priority: data.priority ?? existing.priority,
      active: data.active === undefined ? existing.active : (data.active ? 1 : 0)
    };

    db.prepare(`
      UPDATE pricing_rules
      SET product_id = ?, variant_id = ?, zip_pattern = ?, price_cents = ?,
          label = ?, priority = ?, active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      merged.product_id, merged.variant_id, merged.zip_pattern,
      merged.price_cents, merged.label, merged.priority, merged.active,
      req.params.id
    );

    const row = db.prepare('SELECT * FROM pricing_rules WHERE id = ?').get(req.params.id);
    res.json({ ok: true, rule: row });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

router.delete('/rules/:id', async (req, res) => {
  const result = db.prepare('DELETE FROM pricing_rules WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true });
});

router.post('/rules/bulk', async (req, res) => {
  try {
    const { rules } = z.object({ rules: z.array(RuleSchema) }).parse(req.body);
    const insert = db.prepare(`
      INSERT INTO pricing_rules (product_id, variant_id, zip_pattern, price_cents, label, priority, active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const txn = db.transaction((items) => {
      for (const r of items) {
        insert.run(r.productId, r.variantId || null, r.zipPattern, r.priceCents, r.label || null, r.priority, r.active ? 1 : 0);
      }
    });
    txn(rules);
    res.json({ ok: true, inserted: rules.length });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

router.get('/analytics', async (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM zip_lookups').get().c;
  const matched = db.prepare('SELECT COUNT(*) as c FROM zip_lookups WHERE matched = 1').get().c;
  const topZips = db.prepare(`
    SELECT zip_code, COUNT(*) as count
    FROM zip_lookups
    GROUP BY zip_code
    ORDER BY count DESC
    LIMIT 10
  `).all();
  const topProducts = db.prepare(`
    SELECT product_id, COUNT(*) as count
    FROM zip_lookups
    WHERE product_id IS NOT NULL
    GROUP BY product_id
    ORDER BY count DESC
    LIMIT 10
  `).all();
  const recent = db.prepare(`
    SELECT * FROM zip_lookups ORDER BY created_at DESC LIMIT 50
  `).all();
  res.json({ ok: true, total, matched, matchRate: total ? matched / total : 0, topZips, topProducts, recent });
});

router.get('/products', async (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY title').all();
  res.json({ ok: true, products: rows });
});

router.post('/products', async (req, res) => {
  const { productId, shopDomain, title, basePriceCents } = req.body;
  if (!productId || !shopDomain) return res.status(400).json({ ok: false, error: 'productId and shopDomain required' });
  db.prepare(`
    INSERT INTO products (product_id, shop_domain, title, base_price_cents)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(product_id) DO UPDATE SET
      shop_domain = excluded.shop_domain,
      title = excluded.title,
      base_price_cents = excluded.base_price_cents,
      synced_at = datetime('now')
  `).run(productId, shopDomain, title || null, basePriceCents || null);
  const row = db.prepare('SELECT * FROM products WHERE product_id = ?').get(productId);
  res.json({ ok: true, product: row });
});

module.exports = router;