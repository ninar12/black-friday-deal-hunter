import { NextResponse } from "next/server";
import { findDeals } from "@/lib/claude.mjs";

// Live web search for things the saved deals don't cover.
// Results are cached for a few hours so repeat searches cost nothing.
const cache = new Map();
const TTL = 3 * 60 * 60 * 1000;

export const maxDuration = 60;

export async function POST(req) {
  let q = "";
  try {
    ({ q } = await req.json());
  } catch {}
  q = String(q || "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ deals: [] });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ deals: [], error: "Live search isn't switched on yet." }, { status: 503 });
  }
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json({ deals: hit.deals, cached: true });
  try {
    const deals = await findDeals(
      `Find current Black Friday ${new Date().getFullYear()} deals for: "${q}".
If this is a specific product (like "AirPods Pro 2" or "Dyson Airwrap"), compare its current sale price at major retailers (Amazon, Best Buy, Target, Walmart, the brand's own store, Costco and others you find), one deal per retailer, with sale_price and original_price in USD, cheapest first.
Otherwise, list the best deals for it, biggest real savings first. Up to 8 deals.`,
      { maxSearches: 5 }
    );
    cache.set(key, { at: Date.now(), deals });
    return NextResponse.json({ deals });
  } catch (e) {
    console.error("live search failed", e);
    return NextResponse.json({ deals: [], error: "The hunt hit a snag. Try again in a minute." }, { status: 502 });
  }
}
