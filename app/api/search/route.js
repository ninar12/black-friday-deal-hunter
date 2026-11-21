import { NextResponse } from "next/server";
import { findDeals, lastRun } from "@/lib/claude.mjs";

// Live web search for things the saved deals don't cover.
// Good results are cached for 3 hours, so a repeat search is instant.
const runSearch = (q, exclude = []) => findDeals(
    `Find current Black Friday ${new Date().getFullYear()} deals for: "${q}".
If this is a specific product (like "AirPods Pro 2" or "Dyson Airwrap"), compare its current sale price at major retailers (Amazon, Best Buy, Target, Walmart, the brand's own store and others you find), up to 8 stores, one deal per store (retailer = the store name, like "Walmart", via = null), with sale_price and original_price in USD, cheapest first.
Always run a web search first, even for broad terms like "espresso maker" or "winter coats", and never answer [] without searching.
Otherwise, list the best deals for it, biggest real savings first. Up to 8 deals. Be quick: use at most 3 searches and keep titles short.${exclude.length ? `\nSkip these brands, we already have them: ${exclude.join(", ")}.` : ""}`,
    { maxSearches: 3, maxTokens: 5000, strict: false, fast: true }
);
const cache = new Map();
const TTL = 3 * 60 * 60 * 1000;
async function search(q, exclude) {
  const k = `${q}|${exclude.join(",").toLowerCase()}`;
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < TTL) return hit.deals;
  const deals = await runSearch(q, exclude);
  if (deals.length) cache.set(k, { at: Date.now(), deals }); // never keep an empty answer
  return deals;
}

export const maxDuration = 60;

// Bot protection: only our own pages may call this, each visitor gets a
// handful of web searches per 10 minutes, and there's a daily ceiling.
const PER_IP = 8, WINDOW = 10 * 60 * 1000, DAILY_CAP = 600;
const hits = new Map();
let day = "", dayCount = 0;
function allowed(req) {
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  const host = req.headers.get("host") || "";
  try { if (new URL(origin).host !== host) return "Search only works from the site itself."; } catch { return "Search only works from the site itself."; }
  if (/bot|crawl|spider|curl|wget|python|scrapy|httpclient/i.test(req.headers.get("user-agent") || "")) return "Automated requests aren't allowed.";
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW);
  if (recent.length >= PER_IP) return "You've done a lot of web searches. Try again in a few minutes.";
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) { day = today; dayCount = 0; }
  if (dayCount >= DAILY_CAP) return "Web search is resting for today. Saved deals still work.";
  recent.push(now); hits.set(ip, recent); dayCount++;
  if (hits.size > 5000) hits.clear();
  return null;
}

export async function POST(req) {
  let q = "", exclude = [];
  try {
    ({ q, exclude = [] } = await req.json());
  } catch {}
  exclude = (Array.isArray(exclude) ? exclude : []).map((x) => String(x).slice(0, 40)).slice(0, 40);
  q = String(q || "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ deals: [] });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ deals: [], error: "Live search isn't switched on yet." }, { status: 503 });
  }
  const key = q.toLowerCase();
  const hit = cache.get(`${key}|${exclude.join(",").toLowerCase()}`);
  if (!(hit && Date.now() - hit.at < TTL)) {
    const blocked = allowed(req);
    if (blocked) return NextResponse.json({ deals: [], error: blocked }, { status: 429 });
  }
  try {
    const deals = await search(key, exclude);
    return NextResponse.json(deals.length ? { deals } : { deals, why: lastRun.info });
  } catch (e) {
    console.error("live search failed", e);
    return NextResponse.json({ deals: [], error: "The hunt hit a snag. Try again in a minute." }, { status: 502 });
  }
}
