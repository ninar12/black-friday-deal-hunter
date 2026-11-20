import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { findDeals } from "@/lib/claude.mjs";

// Live web search for things the saved deals don't cover.
// Results are cached for 3 hours, shared across all visitors, so a repeat
// search comes back instantly and costs nothing.
const runSearch = (q) => findDeals(
    `Find current Black Friday ${new Date().getFullYear()} deals for: "${q}".
If this is a specific product (like "AirPods Pro 2" or "Dyson Airwrap"), compare its current sale price at major retailers (Amazon, Best Buy, Target, Walmart, the brand's own store and others you find), one deal per retailer, with sale_price and original_price in USD, cheapest first.
Otherwise, list the best deals for it, biggest real savings first. Up to 6 deals. Be quick: use at most 2 searches and keep titles short.`,
    { maxSearches: 2, maxTokens: 4000, strict: false, fast: true }
);
const search = unstable_cache(
  async (q) => {
    const deals = await runSearch(q);
    if (!deals.length) throw new Error("EMPTY"); // don't cache an empty answer
    return deals;
  },
  ["live-search-v4"],
  { revalidate: 3 * 60 * 60 }
);

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
  try {
    let deals = await search(q.toLowerCase());
    if (!deals?.length) deals = await runSearch(q); // never serve a stored empty answer
    return NextResponse.json({ deals });
  } catch (e) {
    if (e.message === "EMPTY") return NextResponse.json({ deals: [] });
    console.error("live search failed", e);
    return NextResponse.json({ deals: [], error: "The hunt hit a snag. Try again in a minute." }, { status: 502 });
  }
}
