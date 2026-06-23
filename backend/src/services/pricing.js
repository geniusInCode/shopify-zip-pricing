const db = require('../db');

// ZIP pattern matching supports:
// - exact 5-digit: "10001"
// - prefix wildcard: "100*"  matches 10000-10099
// - range: "10000-10099"
// - 3-digit prefix: "100"  matches any ZIP starting with 100
function matchesPattern(zip, pattern) {
  if (!zip || !pattern) return false;
  zip = zip.trim();
  pattern = pattern.trim();

  if (pattern.includes('-')) {
    const [start, end] = pattern.split('-').map(s => s.trim());
    if (!/^\d{5}$/.test(start) || !/^\d{5}$/.test(end)) return false;
    return zip >= start && zip <= end;
  }

  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return zip.startsWith(prefix);
  }

  if (pattern.length === 5 && /^\d{5}$/.test(pattern)) {
    return zip === pattern;
  }

  if (pattern.length === 3 && /^\d{3}$/.test(pattern)) {
    return zip.startsWith(pattern);
  }

  return false;
}

function quote({ productId, variantId, zip, basePriceCents }) {
  if (!zip || !/^\d{5}$/.test(zip)) {
    return {
      ok: false,
      error: 'INVALID_ZIP',
      message: 'ZIP code must be 5 digits'
    };
  }

  const rules = db.prepare(`
    SELECT * FROM pricing_rules
    WHERE active = 1
      AND (product_id = ? OR product_id = '*')
      AND (variant_id IS NULL OR variant_id = ? OR variant_id = '*')
    ORDER BY
      CASE WHEN product_id = ? THEN 0 ELSE 1 END,
      CASE WHEN variant_id = ? THEN 0 ELSE 1 END,
      priority DESC,
      id DESC
  `).all(productId || '*', variantId || '*', productId || '*', variantId || '*');

  for (const rule of rules) {
    if (matchesPattern(zip, rule.zip_pattern)) {
      return {
        ok: true,
        priceCents: rule.price_cents,
        priceFormatted: formatCents(rule.price_cents),
        matched: true,
        ruleId: rule.id,
        label: rule.label || null,
        zip
      };
    }
  }

  const fallback = basePriceCents ?? parseInt(process.env.DEFAULT_PRICE_CENTS || '149900', 10);
  return {
    ok: true,
    priceCents: fallback,
    priceFormatted: formatCents(fallback),
    matched: false,
    label: 'Standard pricing',
    zip
  };
}

function formatCents(cents) {
  return '$' + (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

module.exports = { quote, matchesPattern, formatCents };