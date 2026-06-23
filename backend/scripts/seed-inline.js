// Inline seed used by server.js on first boot if the DB is empty.
// Kept separate from scripts/seed.js (CLI version) so it can be require()d.
const db = require('../src/db');

async function run() {
  const rules = [
    { productId: '*', zipPattern: '902', priceCents: 179900, label: 'West Coast premium', priority: 10 },
    { productId: '*', zipPattern: '100', priceCents: 169900, label: 'Northeast metro', priority: 10 },
    { productId: '*', zipPattern: '75028', priceCents: 149900, label: 'Texas baseline', priority: 20 },
    { productId: '*', zipPattern: '750', priceCents: 154900, label: 'DFW area', priority: 5 },
    { productId: '*', zipPattern: '331', priceCents: 159900, label: 'South Florida', priority: 10 },
    { productId: '*', zipPattern: '981', priceCents: 159900, label: 'Seattle metro', priority: 10 },
    { productId: '*', zipPattern: '802', priceCents: 154900, label: 'Denver metro', priority: 10 },
  ];

  const insert = db.prepare(`
    INSERT INTO pricing_rules (product_id, variant_id, zip_pattern, price_cents, label, priority, active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);

  for (const r of rules) {
    insert.run('*', null, r.zipPattern, r.priceCents, r.label, r.priority);
  }

  const products = [
    { productId: 'gid://shopify/Product/DEMO-1001', shopDomain: 'demo.myshopify.com', title: 'Aurora Wireless Headphones', basePriceCents: 149900 },
    { productId: 'gid://shopify/Product/DEMO-1002', shopDomain: 'demo.myshopify.com', title: 'Nimbus Smart Speaker', basePriceCents: 199900 },
  ];

  const insertProduct = db.prepare(`
    INSERT INTO products (product_id, shop_domain, title, base_price_cents)
    VALUES (?, ?, ?, ?)
  `);
  for (const p of products) insertProduct.run(p.productId, p.shopDomain, p.title, p.basePriceCents);

  console.log(`[auto-seed] Inserted ${rules.length} rules and ${products.length} products`);
}

module.exports = run;