// Finds Black Friday deals with Claude + web search. Used by the live search
// API route and by the daily collector script.
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-haiku-5-5";
export const CATEGORIES = [
  "Athleisure", "Fashion", "Shoes & Accessories", "Beauty", "Tech",
  "Home & Kitchen", "Baking & Food", "Toys & Kids", "Outdoor", "Horror & Pop Culture",
];

const SYSTEM = `You find current Black Friday / Cyber Monday ${new Date().getFullYear()} sales using web search.
Rules:
- Only report deals you found in a search result for THIS year's sale. Never guess or reuse past years.
- Every deal must include the exact source URL where you found it.
- Leave a field null if the source doesn't say it. Do not invent end dates, prices or codes.
- Dates are YYYY-MM-DD. discount_pct is the headline "up to" percent as a number.
- category must be one of: ${CATEGORIES.join(", ")}.
- title is one short line in your own words.
When done, reply with ONLY a JSON array (no prose, no code fences) of objects with keys:
retailer, category, title, discount_pct, original_price, sale_price, code, starts, ends, link, source.
If nothing is found, reply [].`;

function extractJsonArray(text) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const isUrl = (s) => typeof s === "string" && /^https?:\/\//.test(s);
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const num = (v) => (typeof v === "number" && isFinite(v) ? v : v != null && !isNaN(+v) ? +v : null);

// Safety checks that replace manual review.
export function cleanDeal(d, today = new Date().toISOString().slice(0, 10)) {
  if (!d || typeof d !== "object") return null;
  if (!d.retailer || !d.title || !isUrl(d.source)) return null; // source link required
  const sale = num(d.sale_price), orig = num(d.original_price);
  let pct = num(d.discount_pct);
  // Work out the percent from the prices when the source only lists prices.
  if (pct == null && sale != null && orig > sale) pct = Math.round(((orig - sale) / orig) * 100);
  if (pct != null && (pct <= 0 || pct > 90)) return null; // >90% held back as suspicious
  return {
    retailer: String(d.retailer).slice(0, 60),
    category: CATEGORIES.includes(d.category) ? d.category : "Fashion",
    title: String(d.title).slice(0, 140),
    discount_pct: pct,
    original_price: orig,
    sale_price: sale,
    code: d.code ? String(d.code).slice(0, 40) : null,
    starts: isDate(d.starts) ? d.starts : null,
    ends: isDate(d.ends) ? d.ends : null,
    link: isUrl(d.link) ? d.link : d.source,
    source: d.source,
    last_checked: today,
    notes: d.notes ? String(d.notes).slice(0, 140) : null,
    found_by: "ai",
  };
}

export async function findDeals(query, { maxSearches = 4 } = {}) {
  const client = new Anthropic();
  const messages = [{ role: "user", content: query }];
  let response;
  // Loop only to resume a server-side search turn that paused.
  for (let i = 0; i < 4; i++) {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: maxSearches, user_location: { type: "approximate", country: "US" } }],
      messages,
    });
    if (response.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: response.content });
  }
  if (response.stop_reason === "refusal") return [];
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  return extractJsonArray(text).map((d) => cleanDeal(d)).filter(Boolean);
}
