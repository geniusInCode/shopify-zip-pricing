// Seeds the database with realistic demo rules.
const db = require('../src/db');

async function main() {
  await db.init();
  console.log('Seeding demo pricing rules...');

  db.exec('DELETE FROM pricing_rules');
  db.exec('DELETE FROM products');

  const rules = [
    { productId: '*', zipPattern: '902', priceCents: 179900, label: 'West Coast premium', priority: 10 },
    { productId: '*', zipPattern: '100', priceCents: 169900, label: 'Northeast metro', priority: 10 },
    { productId: '*', zipPattern: '75028', priceCents: 149900, label: 'Texas baseline', priority: 20 },
    { productId: '*', zipPattern: '750', priceCents: 154900, label: 'DFW area', priority: 5 },
    { productId: '*', zipPattern: '331', priceCents: 159900, label: 'South Florida', priority: 10 },
    { productId: '*', zipPattern: '981', priceCents: 159900, label: 'Seattle metro', priority: 10 },
    { productId: '*', zipPattern: '802', priceCents: 154900, label: 'Denver metro', priority: 10 },
    // Note: the broad '0*-1*' pattern was removed since it's literally a dash.
    // Fallback pricing applies for ZIPs without specific rules.
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

  console.log(`Seeded ${rules.length} pricing rules`);
  console.log(`Seeded ${products.length} demo products`);
  console.log('\nSample queries:');
  console.log('  curl "http://localhost:3000/api/price?zip=75028&product_id=gid://shopify/Product/DEMO-1001"');
  console.log('  curl "http://localhost:3000/api/price?zip=10001&product_id=gid://shopify/Product/DEMO-1001"');
  console.log('  curl "http://localhost:3000/api/price?zip=90210&product_id=gid://shopify/Product/DEMO-1001"');
}

main().catch(e => { console.error(e); process.exit(1); });