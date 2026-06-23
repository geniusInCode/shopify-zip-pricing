# Demo recording script

Goal: a 3–4 minute screen recording showing the full system working end-to-end. Designed for **Loom** or **OBS**.

## Setup before recording

- Open these tabs in advance:
  1. Shopify dev store product page
  2. Shopify admin → Apps → ZIP Pricing (the embedded dashboard)
  3. Terminal with the backend running locally (or Render dashboard showing requests)
- Hide notifications, close unrelated tabs.
- Set browser zoom to 100%.
- Have a glass of water.

## Recording flow

### 0:00 – 0:20 — Intro
Show your face or just the screen. One line:
> "This is the ZIP-based pricing app I built for Shopify. It lets customers see location-specific pricing by entering their ZIP code."

### 0:20 – 1:00 — Show the product page
Navigate to a product on the storefront. Scroll to the new ZIP Pricing block.
> "On the product page, the customer sees a ZIP code input next to the price. They enter their ZIP, click Check Price, and we return the price for that location."

Enter `75028`, click **Check Price**.
> "Texas ZIP 75028 returns $1,499."

### 1:00 – 2:00 — Show three different ZIPs
Clear and enter `10001` → click Check Price → `$1,699` (Northeast metro).
Clear and enter `90210` → click Check Price → `$1,799` (West Coast premium).
Clear and enter `98101` → click Check Price → `$1,599` (Seattle).

> "Three different regions, three different prices. The matching is happening server-side through a Shopify App Proxy."

### 2:00 – 2:40 — Show the admin dashboard
Switch to the Shopify admin tab. Show the embedded app.
> "Pricing rules are managed from inside Shopify itself, not hardcoded anywhere. The merchant can add a new rule, set priority, and label, and the storefront sees the change immediately."

Click **Add rule** tab. Show the form. Click **Analytics** tab. Show total lookups, matched rules, match rate, top ZIPs.

### 2:40 – 3:10 — Show the architecture
Open the GitHub repo in another tab. Walk through:
- `extensions/zip-pricing-block/` — the theme block
- `backend/src/services/pricing.js` — the matching engine
- `app/shopify.app.toml` — the App Proxy config

> "Backend is a standalone Node.js service with SQLite. Pricing rules can be exact, wildcard, or range. Every lookup is logged for analytics."

### 3:10 – 3:30 — Closing
Back to the product page. Try one more ZIP.
> "That's the full assignment: Shopify app, theme extension, backend pricing engine, three test ZIPs, working demo. Happy to walk through any part of it."

## Tips

- **Don't pause to think out loud** — narrate as you click.
- **Show the network tab briefly** for one request to demonstrate the App Proxy call. Right-click → Inspect → Network → filter "Fetch/XHR" → click Check Price → click the request → show the URL is `/apps/zip-pricing?zip=...` (the App Proxy path).
- **Avoid filler words** ("uh", "so", "like"). Pause silently instead.
- **If something breaks on screen**, restart the recording — don't try to recover.
- **Export at 1080p** if possible.

## What to upload

Send two things:
1. **Video** — Loom link, or upload to Drive/Dropbox.
2. **GitHub repo link** — public repo with this codebase.

## Time spent (be honest in your reply)

Suggested line to include in your email reply:

> "Built with AI assistance in ~45 minutes for the initial codebase; ~2 hours total including deploy, install, theme wiring, and demo recording."

Adjust to match your actual time. If you did it faster, say so — that demonstrates the "AI as force multiplier" point the assignment is testing.