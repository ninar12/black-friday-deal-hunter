# Black Friday Hunter

Every Black Friday deal in one searchable place: search, guide pills, category / discount / price filters, a deal-score ranking, an "ends on" calendar strip, and add-to-calendar reminders.

## How deals get here
- `data/brands.csv` is the list of brands to hunt. Add a row to track a new brand.
- `scripts/collect.mjs` runs twice a day (GitHub Actions, `.github/workflows/collect.yml`). It asks Claude (Haiku 5.5, with web search) for each brand's current sale and does discovery searches per category, then updates `data/deals.json`. Vercel redeploys on each commit.
- Deals publish without manual review. Safety checks: a source link is required, discounts over 90% are dropped, missing end dates show as "End date not announced".
- The site's "Hunt the web" button runs a live search (`app/api/search/route.js`) when saved deals don't cover a query.

## Setup
1. `npm install` then `npm run dev`.
2. Set `ANTHROPIC_API_KEY` in Vercel (Project → Settings → Environment Variables) for live search, and as a GitHub Actions secret for the daily hunt.
