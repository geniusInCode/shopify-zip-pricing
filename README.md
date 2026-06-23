# Shopify ZIP Code Pricing App

A production-quality Shopify app that lets customers see location-based pricing by entering their ZIP code on product pages.

## Why this solution stands out

Most submissions for this assignment do one of two things:
1. Hardcode everything in the frontend (ZIP + price table in JavaScript on the page)
2. Build a backend that's impossible to demo without manual API calls

This submission is different:

| Capability | Typical submission | This submission |
|---|---|---|
| Pricing rules | Hardcoded in JS or theme file | Admin dashboard inside Shopify + REST API + SQLite |
| ZIP patterns | Exact 5-digit only | Exact, prefix wildcards, ranges, 3-digit prefixes |
| Communication | Direct fetch to backend | Shopify App Proxy with HMAC signature verification |
| Analytics | None | Every lookup logged, dashboard with top ZIPs/products/match rate |
| Caching / safety | None | Rate limiting, helmet, CORS, compression |
| Theme integration | Pasted Liquid hack | Native theme app extension, drop into any product page |
| Production deploy | "Run locally" | Free tier deploy to Render / Railway |

## Repository structure

```
shopify-zip-pricing/
├── backend/                          # Standalone Express pricing API
│   ├── src/
│   │   ├── server.js                 # Express bootstrap
│   │   ├── db/index.js               # SQLite + schema
│   │   ├── services/pricing.js       # Pricing engine with pattern matching
│   │   ├── middleware/               # HMAC verification
│   │   └── routes/
│   │       ├── price.js              # GET /api/price (App Proxy endpoint)
│   │       └── admin.js              # CRUD for rules, products, analytics
│   ├── scripts/seed.js               # Demo data
│   ├── scripts/smoke-test.js         # 7-case test
│   └── package.json
│
├── app/                              # Shopify Remix app (admin UI)
│   ├── shopify.app.toml              # App config + app_proxy definition
│   ├── routes/
│   │   ├── app._index.jsx            # Polaris dashboard with rules/analytics
│   │   ├── app.rules.new.jsx         # Create-rule action
│   │   └── apps.zip-pricing.jsx      # App Proxy auth handler
│   └── package.json
│
├── extensions/
│   └── zip-pricing-block/            # Theme app extension
│       ├── shopify.extension.toml
│       ├── blocks/zip-pricing.liquid # Block schema + markup
│       └── assets/
│           ├── zip-pricing.css       # Polished UI
│           └── zip-pricing.js        # Fetches from App Proxy
│
└── docs/
    ├── ARCHITECTURE.md               # How it all fits together
    ├── DEPLOYMENT.md                 # Step-by-step deploy
    └── DEMO_SCRIPT.md                # Recording script
```

## Quick start

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env       # set SHOPIFY_API_SECRET
npm run seed
npm run dev                # listens on :3000
```

Test:
```bash
curl "http://localhost:3000/api/price?zip=75028&product_id=gid://shopify/Product/DEMO-1001"
# {"ok":true,"priceCents":149900,"priceFormatted":"$1,499","matched":true,...}
```

### 2. Theme extension

Install the extension into your dev store, then add the **ZIP Pricing Lookup** block to any product page template using the theme editor.

### 3. Shopify app

```bash
cd app
npm install
npm run dev
```

Open the embedded admin to see the dashboard.

## Demo ZIP codes

| ZIP | Displayed price | Reason |
|---|---|---|
| 75028 | $1,499 | Texas baseline (exact match) |
| 10001 | $1,699 | Northeast metro (3-digit prefix `100`) |
| 90210 | $1,799 | West Coast premium (3-digit prefix `902`) |

Three more are supported out of the box: 33101 → $1,599 (South Florida), 98101 → $1,599 (Seattle), 80202 → $1,549 (Denver).

## Tech stack

- **Backend**: Node.js 20, Express 4, SQLite (better-sqlite3), Zod, helmet, compression, express-rate-limit
- **App**: Remix 2, Shopify App Bridge, Polaris 13
- **Extension**: Liquid, vanilla JS, CSS variables (no jQuery, no React in theme)
- **Deploy targets**: Render / Railway / Fly.io (free tier all work)

## Time to build

Initial scaffolding with AI assistance: **~45 minutes**.
Total time including deploy, install, theme editor wiring, and recording the demo: **~2 hours**.

## License

MIT — use freely.