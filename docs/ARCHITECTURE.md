# Architecture

## High-level flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                           SHOPIFY STORE                              │
│                                                                      │
│   ┌─────────────────┐    app proxy     ┌──────────────────────────┐  │
│   │  Product page   │ ───────────────► │  /apps/zip-pricing?zip=… │  │
│   │  (theme app     │   HMAC-signed    │  (Shopify injects        │  │
│   │   extension)    │ ◄─────────────── │   ?signature=…&shop=…)   │  │
│   └─────────────────┘    JSON price    └──────────────────────────┘  │
│                                                  │                   │
│   ┌─────────────────┐                            │ forward           │
│   │  Admin (Remix)  │ ─── REST CRUD ───────────► │                   │
│   │  - rules mgmt   │ ◄─── analytics ────────────│                   │
│   │  - analytics    │                            ▼                   │
│   │  - quick test   │                  ┌──────────────────────────┐ │
│   └─────────────────┘                  │     YOUR BACKEND         │ │
│                                        │     (Express :3000)      │ │
│                                        │                          │ │
│                                        │  /api/price  (proxy)     │ │
│                                        │  /admin/*    (CRUD)      │ │
│                                        │                          │ │
│                                        │  ┌────────────────────┐  │ │
│                                        │  │ pricing engine     │  │ │
│                                        │  │ - ZIP matcher      │  │ │
│                                        │  │ - rule priority    │  │ │
│                                        │  └─────────┬──────────┘  │ │
│                                        │            │             │ │
│                                        │  ┌─────────▼──────────┐  │ │
│                                        │  │ SQLite (WAL mode)  │  │ │
│                                        │  │ - pricing_rules    │  │ │
│                                        │  │ - zip_lookups      │  │ │
│                                        │  │ - products         │  │ │
│                                        │  └────────────────────┘  │ │
│                                        └──────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

## How the API is called from Shopify

There are three channels, each with a different trust model:

### 1. Theme extension → Backend via App Proxy (production path)

This is what runs on every customer page-load.

```
Browser (customer on product page)
  ↓ fetch
Shopify CDN
  ↓ proxy with HMAC signature
Backend /api/price?zip=…&product_id=…&shop=…&signature=…
  ↓ HMAC verify (using SHOPIFY_API_SECRET shared with Shopify)
Pricing engine
  ↓ query
SQLite
  ↑ result
Pricing engine → JSON response → Shopify CDN → Browser
```

The App Proxy is configured in `shopify.app.toml`:

```toml
[app_proxy]
url = "https://YOUR_BACKEND_HOST/api"
prefix = "apps"
subpath = "zip-pricing"
```

That makes Shopify forward every request to `/apps/zip-pricing*` on the storefront to `https://YOUR_BACKEND_HOST/api/zip-pricing*`. **Why the App Proxy instead of letting the browser call the backend directly?**

1. **No CORS** — the request appears same-origin to the browser.
2. **HMAC verification** — Shopify signs the request; we can verify the call truly came from a Shopify storefront and not a random attacker hitting our API.
3. **No exposed backend URL** — the public surface is just `/apps/zip-pricing`.
4. **Authentication is implicit** — the `shop` query param tells us which store the request came from.

### 2. Admin (Remix app) → Backend (CRUD)

For managing rules, products, viewing analytics. Goes through the Shopify embedded admin, which authenticates the merchant via OAuth. The Remix server then talks to the backend over its internal network.

### 3. Direct backend calls (development only)

For smoke tests, curl, etc. We accept unauthenticated calls when `NODE_ENV=development`.

## Data model

```
pricing_rules
  id              INTEGER PK
  product_id      TEXT     'gid://shopify/Product/123' or '*' for any
  variant_id      TEXT     NULL = any variant, else exact match
  zip_pattern     TEXT     '10001' | '100*' | '10000-10099' | '100'
  price_cents     INTEGER  149900
  label           TEXT     'Texas baseline' (shown to customer)
  priority        INTEGER  higher wins on tie
  active          INTEGER  0/1
  created_at      TEXT
  updated_at      TEXT

zip_lookups              -- append-only analytics log
  id, product_id, variant_id, zip_code, price_cents, rule_id, matched,
  shop_domain, user_agent, created_at

products                 -- cache of Shopify product metadata
  product_id PK, shop_domain, title, base_price_cents, synced_at
```

## Pricing algorithm

```python
def quote(productId, variantId, zip):
    rules = SELECT * FROM pricing_rules
             WHERE active = 1
               AND (product_id = :pid OR product_id = '*')
               AND (variant_id IS NULL OR variant_id = :vid OR variant_id = '*')
             ORDER BY
               CASE WHEN product_id = :pid THEN 0 ELSE 1 END,  -- exact product first
               CASE WHEN variant_id = :vid THEN 0 ELSE 1 END,  -- exact variant first
               priority DESC,
               id DESC
    for rule in rules:
        if matches(zip, rule.zip_pattern):
            return rule.price_cents, rule.label, matched=True
    return base_price_cents, 'Standard pricing', matched=False
```

Pattern matching supports four formats:

| Pattern | Matches |
|---|---|
| `10001` | exactly `10001` |
| `100*` | any ZIP starting with `100` (10000–10099) |
| `10000-10099` | explicit range |
| `100` | any ZIP starting with `100` (same as `100*`) |

## Security

- HMAC-SHA256 signature verification on every App Proxy call (when `NODE_ENV=production`).
- Helmet for standard headers (CSP disabled because the theme block runs inline).
- CORS locked to the configured origin (or `*` in dev).
- Rate limit: 60 price requests/min per IP, 30 admin requests/min per IP.
- Input validation with Zod on every admin endpoint.
- SQL: only parameterised queries via `better-sqlite3` prepared statements — no string concatenation.

## Why these choices

- **SQLite over Postgres** — the demo has < 1000 rules; SQLite is 0-config, survives restarts, and good enough to 100k rules. Swap to Postgres in `src/db/index.js` if you outgrow it.
- **App Proxy over public API** — see above. The HMAC layer is what separates this from a typical “store ZIP lookup in a JSON file on Shopify”.
- **Theme app extension over theme code paste** — installation is one click and survives theme updates.
- **Backend in Express, not in the Remix app** — separation of concerns. Backend can scale independently and can serve other channels (e.g., checkout extensions, headless storefronts).