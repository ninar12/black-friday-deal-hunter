// Cleans up AI-collected deals so brand names and categories stay consistent.
// Used by scripts/collect.mjs on every run (old and new deals alike).

// Big stores that sell other brands. When a deal is "Brand at Store", the
// brand becomes the retailer and the store goes in `via`.
export const STORES = [
  "Amazon", "Walmart", "Target", "Best Buy", "Nordstrom Rack", "Nordstrom", "Sephora",
  "Ulta Beauty", "Ulta", "iHerb", "Yahoo Shopping", "Macy's", "Sur La Table", "Roku",
  "Costco", "Kohl's", "Saks Off 5th", "Bloomingdale's", "Revolve", "Zappos", "Dick's Sporting Goods",
];

// Fixed category per brand, where the AI keeps guessing wrong.
const CATEGORY_BY_BRAND = {
  nike: "Athleisure", adidas: "Athleisure", puma: "Athleisure", "under armour": "Athleisure",
  pandora: "Shoes & Accessories", "ray-ban": "Shoes & Accessories", fossil: "Shoes & Accessories", away: "Shoes & Accessories",
  "epic games store": "Tech", fanatical: "Tech", "sony playstation store": "Tech", steam: "Tech",
  funko: "Horror & Pop Culture", loungefly: "Horror & Pop Culture", "hot topic": "Horror & Pop Culture", shudder: "Horror & Pop Culture",
};

const HORROR = /horror|resident evil|silent hill|dying light|mortal kombat|dead by daylight|alan wake|evil dead|stranger things|friday the 13th|halloween|scream|funko|shudder|zombie|until dawn|outlast|phasmophobia|the last of us/i;
const BAKING = /bak|flour|sugar|chocolate|cocoa|vanilla|sprinkle|cookie|cake|pastry|mixer|whisk|rolling pin|sheet pan|muffin|bread|baking|kitchenaid|gift box|gift basket|candy|cheesecake|bundt/i;
const GAME = /\b(pc|ps5|ps4|xbox|switch|steam|edition|game)\b/i;

const GAME_STORES = new Set(["epic games store", "fanatical", "sony playstation store", "steam", "gamestop", "nintendo"]);
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

export function makeNormalizer(brands) {
  const canon = new Map(brands.map((b) => [b.brand.toLowerCase(), b]));
  const storeCanon = new Map(STORES.map((s) => [s.toLowerCase(), canon.get(s.toLowerCase())?.brand || s]));
  storeCanon.set("ulta", canon.get("ulta beauty")?.brand || "Ulta Beauty");
  const name = (s) => canon.get(clean(s).toLowerCase())?.brand || storeCanon.get(clean(s).toLowerCase()) || clean(s);
  const isStore = (s) => storeCanon.has(clean(s).toLowerCase());
  // Known brands sorted longest first, for spotting a brand inside a store deal's title.
  const brandNames = brands.map((b) => b.brand).filter((b) => b.length > 2 && !isStore(b)).sort((a, b) => b.length - a.length);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mentions = (b, text) => new RegExp(`(^|[^A-Za-z])${esc(b)}([^A-Za-z]|$)`).test(text);

  return function normalize(d0) {
    const d = fixPrices({ ...d0 });
    let retailer = clean(d.retailer);
    let via = d.via ? clean(d.via) : null;

    // "Brand at Store" / "Brand via Store"
    let m = retailer.match(/^(.+?)\s+(?:at|via|on|from)\s+(.+)$/i);
    if (m && isStore(m[2])) { retailer = m[1]; via = m[2]; }
    // "Store (Brand listing)" / "Store (Brand subscription)" / "Store (Brand)"
    m = retailer.match(/^(.+?)\s*\((.+?)(?:\s+(?:listing|subscription|brand|deal))?\)$/i);
    if (m) {
      if (isStore(m[1])) { via = m[1]; retailer = m[2]; }
      else retailer = m[1]; // "Aritzia (Tna)" -> Aritzia
    }
    // A store row that is really one brand's deal: "Nordstrom Rack" + "Birkenstock styles".
    if (isStore(retailer) && !via) {
      const found = brandNames.filter((b) => mentions(b, d.title || ""));
      if (found.length === 1) { via = retailer; retailer = found[0]; }
    }
    d.retailer = name(retailer);
    d.via = via ? name(via) : null;
    if (d.via && d.via.toLowerCase() === d.retailer.toLowerCase()) d.via = null;

    // Category fixes
    const forced = CATEGORY_BY_BRAND[d.retailer.toLowerCase()];
    if (forced) d.category = forced;
    const text = `${d.title} ${d.notes || ""}`;
    const game = GAME_STORES.has(d.retailer.toLowerCase()) || GAME.test(text);
    if (d.category === "Tech" && HORROR.test(text) && game) d.category = "Horror & Pop Culture";
    if (d.category === "Horror & Pop Culture" && game && !HORROR.test(text)) d.category = "Tech";
    return d;
  };
}

// Deals we drop outright: non-US prices, and single grocery items posing as baking deals.
export function isJunk(d) {
  const text = `${d.title} ${d.notes || ""} ${d.code || ""}`;
  if (/[£€]|\bGBP\b|\bEUR\b|\bAUD\b|\bCAD\b/.test(text)) return true;
  if (d.category === "Baking & Food" && !BAKING.test(text)) return true;
  if (/sold[ -]?out|out of stock|no longer available|waitlist/i.test(text)) return true;
  return false;
}

// Same brand, same headline offer: keep the one with the most detail (then the newest).
const SITEWIDE = /site-?wide|store-?wide|everything|entire site|all orders/i;
const filled = (d) => Object.values(d).filter((v) => v != null && v !== "").length;
export function dedupe(deals) {
  const out = [];
  for (const d of deals) {
    const i = out.findIndex((o) => o.retailer.toLowerCase() === d.retailer.toLowerCase() && (o.via || "") === (d.via || "") && (
      (o.discount_pct != null && o.discount_pct === d.discount_pct && !o.sale_price && !d.sale_price) ||
      (SITEWIDE.test(o.title) && SITEWIDE.test(d.title))
    ));
    if (i === -1) { out.push(d); continue; }
    const o = out[i];
    const better = (d.last_checked || "") > (o.last_checked || "") || ((d.last_checked || "") === (o.last_checked || "") && filled(d) > filled(o));
    out[i] = better ? { ...o, ...strip(d) } : { ...d, ...strip(o) };
  }
  return out;
}
// One brand-wide sale card per brand (per selling store): keep the best one.
// Big stores (Amazon, Target...) keep several, since they run separate category sales.
// Deals with a specific sale price are single products and are kept.
const BIG = new Set(STORES.map((x) => x.toLowerCase()));
const rank = (d) => [(d.discount_pct ?? 0), d.ends ? 1 : 0, d.code ? 1 : 0, d.last_checked || ""];
const better = (a, b) => { const x = rank(a), y = rank(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
export function onePerBrand(deals) {
  const best = new Map();
  for (const d of deals) {
    if (d.sale_price != null || BIG.has(String(d.retailer).toLowerCase())) continue;
    const k = `${d.retailer}|${d.via || ""}`.toLowerCase();
    if (!best.has(k) || better(d, best.get(k))) best.set(k, d);
  }
  return deals.filter((d) => d.sale_price != null || BIG.has(String(d.retailer).toLowerCase()) || best.get(`${d.retailer}|${d.via || ""}`.toLowerCase()) === d);
}
const strip = (d) => Object.fromEntries(Object.entries(d).filter(([, v]) => v != null && v !== ""));

// Price sanity checks, used on every deal (hunt and live search):
// - a "sale" price that isn't below the original drops the original
// - a store-wide "up to X% off" with one example price isn't a single item: drop the prices
// - when both prices exist, the percent is worked out from them
export function fixPrices(d) {
  let sale = d.sale_price ?? null, orig = d.original_price ?? null, pct = d.discount_pct ?? null;
  if (sale != null && orig != null && sale >= orig) orig = null;
  if (sale != null && /\bup to\b|sitewide|site-wide|storewide|select styles|hundreds|including|e\.g\.|deals on|and more|\bitems\b|\bstyles\b|marked down|\b\w+s and \w+s\b/i.test(`${d.title} ${d.notes || ""}`)) { sale = null; orig = null; }
  if (sale != null && orig != null) {
    const real = Math.round(((orig - sale) / orig) * 100);
    if (pct == null || Math.abs(real - pct) > 3) pct = real;
  }
  // The headline number must be one the title actually says ("Extra 20% off" means 20, not 76).
  if (sale == null) {
    const extra = String(d.title).match(/extra\s+(\d{1,2})\s*%/i);
    const all = [...String(d.title).matchAll(/(\d{1,2})\s*%/g)].map((m) => +m[1]);
    const base = [...String(d.title).matchAll(/(?<!extra\s+)(?<!\d)(\d{1,2})\s*%/gi)].map((m) => +m[1]);
    if (all.length && !all.includes(pct)) pct = base.length ? Math.max(...base) : +extra[1];
  }
  return { ...d, sale_price: sale, original_price: orig, discount_pct: pct };
}
