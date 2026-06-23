// Quick smoke test against a running server
// Run: BASE=http://localhost:3000 npm test
const base = process.env.BASE || 'http://localhost:3000';

const cases = [
  { zip: '75028', expected: 149900, label: 'Texas baseline' },
  { zip: '10001', expected: 169900, label: 'Northeast metro' },
  { zip: '90210', expected: 179900, label: 'West Coast premium' },
  { zip: '98101', expected: 159900, label: 'Seattle metro' },
  { zip: '33101', expected: 159900, label: 'South Florida' },
  { zip: '80202', expected: 154900, label: 'Denver metro' },
  { zip: '00501', expected: 149900, label: 'Fallback (no rule)' },
];

(async () => {
  let passed = 0;
  let failed = 0;

  for (const c of cases) {
    const url = `${base}/api/price?zip=${c.zip}&product_id=gid://shopify/Product/DEMO-1001`;
    try {
      const r = await fetch(url);
      const j = await r.json();
      const ok = j.priceCents === c.expected;
      if (ok) {
        passed++;
        console.log(`  PASS  ${c.zip} (${c.label}) -> $${(j.priceCents/100).toFixed(2)} [${j.label || ''}]`);
      } else {
        failed++;
        console.log(`  FAIL  ${c.zip} expected ${c.expected} got ${j.priceCents} - ${JSON.stringify(j)}`);
      }
    } catch (e) {
      failed++;
      console.log(`  ERROR ${c.zip} - ${e.message}`);
    }
  }

  console.log(`\n${passed}/${cases.length} passed`);
  process.exit(failed ? 1 : 0);
})();