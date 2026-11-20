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
- US deals only, prices in USD. Skip UK, EU, Canadian or Australian sales.
- retailer is the BRAND whose products are on sale, spelled the way the brand spells it (e.g. "Birkenstock", "amika", "I Am Delilah"). Never add notes in parentheses or "at Store" to it.
- via is the store selling it when that isn't the brand's own site (e.g. "Nordstrom Rack", "Sephora", "Amazon"), otherwise null. If a store sale covers many brands, retailer is the store and via is null.
- category must be exactly one of these, picked by what is on sale (not by where it is sold):
  Fashion: clothing, denim, dresses, outerwear, intimates.
  Athleisure: activewear, leggings, gym and running clothes, sportswear brands like Nike, Adidas, Lululemon.
  Shoes & Accessories: shoes, bags, luggage, jewelry, watches, sunglasses.
  Beauty: makeup, skincare, haircare, fragrance, supplements sold as beauty.
  Tech: electronics, TVs, laptops, phones, headphones, smart home, video games that aren't horror.
  Home & Kitchen: furniture, bedding, decor, cookware, small appliances.
  Baking & Food: baking tools and ingredients, bakeware, specialty food and food gifts. Not ordinary groceries.
  Toys & Kids: toys, LEGO, kids' and baby clothes and gear.
  Outdoor: camping, hiking, ski, coolers, outdoor gear.
  Horror & Pop Culture: horror films, games and streaming, collectibles like Funko and Loungefly, fandom merch.
- title is one short line in your own words.
When done, reply with ONLY a JSON array (no prose, no code fences) of objects with keys:
retailer, via, category, title, discount_pct, original_price, sale_price, code, starts, ends, link, source.
If nothing is found, reply [].`;

function extractJsonArray(text) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  // Fallback: pull out each {...} object that parses on its own.
  const out = [];
  for (const m of text.slice(start).matchAll(/\{[^{}]*\}/g)) {
    try { out.push(JSON.parse(m[0])); } catch {}
  }
  return out;
}

const isUrl = (s) => typeof s === "string" && /^https?:\/\//.test(s);
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const num = (v) => (typeof v === "number" && isFinite(v) ? v : v != null && !isNaN(+v) ? +v : null);

// Safety checks that replace manual review.
export function cleanDeal(d, today = new Date().toISOString().slice(0, 10), { strict = true } = {}) {
  if (!d || typeof d !== "object") return null;
  if (!d.retailer || !d.title || !isUrl(d.source)) return null; // source link required
  // Daily hunt: unknown category is skipped. Live search: keep it, file under Fashion.
  if (!CATEGORIES.includes(d.category)) { if (strict) return null; d = { ...d, category: "Fashion" }; }
  const sale = num(d.sale_price), orig = num(d.original_price);
  let pct = num(d.discount_pct);
  // Work out the percent from the prices when the source only lists prices.
  if (pct == null && sale != null && orig > sale) pct = Math.round(((orig - sale) / orig) * 100);
  if (pct != null && (pct <= 0 || pct > 90)) return null; // >90% held back as suspicious
  return {
    retailer: String(d.retailer).slice(0, 60),
    via: d.via ? String(d.via).slice(0, 60) : null,
    category: d.category,
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

export async function findDeals(query, { maxSearches = 4, maxTokens = 16000, strict = true, fast = false } = {}) {
  const client = new Anthropic();
  const messages = [{ role: "user", content: query }];
  let response;
  // Loop only to resume a server-side search turn that paused.
  for (let i = 0; i < 4; i++) {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      // Live search: skip the thinking step and keep effort low so answers come back sooner.
      ...(fast ? { thinking: { type: "disabled" }, output_config: { effort: "low" } } : {}),
      system: SYSTEM,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: maxSearches, user_location: { type: "approximate", country: "US" } }],
      messages,
    });
    if (response.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: response.content });
  }
  if (response.stop_reason === "refusal") return [];
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return extractJsonArray(text).map((d) => cleanDeal(d, undefined, { strict })).filter(Boolean);
}
