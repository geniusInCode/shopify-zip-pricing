# Deployment guide

End-to-end setup that takes ~30 minutes once your accounts are ready.

## Prerequisites

You will need accounts on:
- **Shopify Partners** — free, at https://partners.shopify.com
- **Render** (or Railway / Fly.io) — free tier, for the Node backend
- **GitHub** — for the code

Total cost: **$0**.

## 1. Get the code onto GitHub

```bash
git init
git add .
git commit -m "ZIP pricing app"
gh repo create shopify-zip-pricing --public --source=. --push
```

## 2. Deploy the backend to Render

1. Go to https://render.com → New → Web Service → connect your GitHub repo.
2. **Root directory**: `backend`
3. **Build command**: `npm install`
4. **Start command**: `npm start`
5. **Instance type**: Free
6. **Environment variables**:
   ```
   NODE_ENV=production
   PORT=3000
   SHOPIFY_API_SECRET=<generate-a-random-string-32+-chars>
   ALLOWED_SHOPS=*
   DEFAULT_PRICE_CENTS=149900
   CORS_ORIGIN=*
   ```
7. Click **Create Web Service**. After deploy, copy the URL — it'll be something like `https://zip-pricing-api.onrender.com`.
8. Verify:
   ```bash
   curl https://zip-pricing-api.onrender.com/health
   # {"ok":true,"service":"shopify-zip-pricing",...}
   ```
9. Seed the database. From your local machine, point the seed at the deployed DB. Easiest path: open a Render shell and run `npm run seed`.

## 3. Create the Shopify app

1. https://partners.shopify.com → Apps → Create app → Custom app.
2. Name: **ZIP Pricing**. App URL: `https://zip-pricing-api.onrender.com`.
3. Allowed redirection URLs:
   - `https://zip-pricing-api.onrender.com/auth/callback`
   - `https://zip-pricing-api.onrender.com/auth/shopify/callback`
4. Scopes: `read_products`, `write_products`.
5. Webhooks: skip for now.
6. **App Proxy** section:
   - Subpath: `zip-pricing`
   - Prefix: `apps`
   - URL: `https://zip-pricing-api.onrender.com/api`
7. Save and copy the **API key**, **API secret**, and the **shared secret** it generates for App Proxy.

## 4. Update `shopify.app.toml`

Edit `app/shopify.app.toml` and replace:
- `REPLACE_WITH_YOUR_SHOPIFY_APP_CLIENT_ID` with your API key
- `YOUR_BACKEND_HOST` with `zip-pricing-api.onrender.com`

Then set `SHOPIFY_API_SECRET` on Render to the same value as the App Proxy shared secret in your Shopify app config.

## 5. Install the theme extension

1. From `extensions/zip-pricing-block/`, push the extension:
   ```bash
   shopify app dev
   ```
   or upload via the Partner dashboard → App → Extensions → Upload.
2. In your dev store admin: **Online Store → Themes → Customize**.
3. Open any product template.
4. **Add block** → **ZIP Pricing Lookup**.
5. Configure the heading, button label, accent color.
6. Save.

## 6. Test

Visit the product page on the storefront. Type `75028` and click **Check Price**. You should see `$1,499`.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| 401 invalid signature | SHOPIFY_API_SECRET doesn't match App Proxy secret | Regenerate in Partners dashboard, update Render env var, restart |
| 404 on `/apps/zip-pricing` | App Proxy not configured | Re-check `shopify.app.toml` and Partners dashboard |
| Backend cold-start delay | Render free tier sleeps after inactivity | First request takes ~30s. Upgrade to $7/mo for always-on |
| Theme block doesn't render | App not installed on the store | Install the app on the dev store, then re-add the block |
| `better-sqlite3` build fails | Native compilation needed | Render's Node image has build tools; if not, add `npm install --build-from-source` to the build command |

## Cost

| Service | Tier | Cost |
|---|---|---|
| Render | Free | $0 |
| Render (always-on) | Starter | $7/mo |
| Railway | Free trial → $5/mo | $0–5 |
| Fly.io | Free tier | $0 |
| Shopify Partners | All free | $0 |
| Dev store | Free | $0 |

Demo runs end-to-end on $0/mo with the caveat of a ~30s cold start.