// Cleans up AI-collected deals so brand names and categories stay consistent.
// Used by scripts/collect.mjs on every run (old and new deals alike).

// Big stores that sell other brands. When a deal is "Brand at Store", the
// brand becomes the retailer and the store goes in `via`.
export const STORES = [
  "Amazon", "Walmart", "Target", "Best Buy", "Nordstrom Rack", "Nordstrom", "Sephora",
  "Ulta Beauty", "Ulta", "iHerb", "Yahoo Shopping", "Macy's", "Sur La Table", "Roku",
  "Costco", "Kohl's", "Saks Off 5th", "Bloomingdale's", "Revolve", "Zappos", "Dick's Sporting Goods",
  "REI", "Backcountry", "Field & Stream", "Barnes & Noble", "Foot Locker", "Running Warehouse", "DSW", "Urban Outfitters",
];
// Product lines whose title often leaves out the brand ("Arahi 8 running shoes" is HOKA).
const MODEL_BRAND = [
  [/\b(arahi|clifton|bondi|mach \d|speedgoat|challenger|rincon|transport|skyflow|gaviota|kawana|anacapa)\b/i, "Hoka"],
  [/\b(ultraboost|samba|gazelle|adizero|campus 00s)\b/i, "Adidas"],
  [/\b(pegasus|vomero|air max|air force 1|dunk low|invincible run)\b/i, "Nike"],
  [/\b(cloudmonster|cloudsurfer|cloudnova|cloud ?5)\b/i, "On"],
  [/\b(gel-?kayano|gel-?nimbus|novablast|gel-?1130)\b/i, "ASICS"],
  [/\b(ghost \d+|glycerin)\b/i, "Brooks"],
];
// Footwear is always Shoes & Accessories, whoever makes it.
const FOOTWEAR = /\b(shoes?|sneakers?|boots?|slippers?|sandals?|clogs?|loafers?|mules?|trainers?|flats|heels)\b/i;

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
  const leadNames = brands.map((b) => b.brand).filter((b) => b && b.length >= 2 && !isStore(b)).sort((a, b) => b.length - a.length);
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
      const model = MODEL_BRAND.find(([re]) => re.test(d.title || ""));
      if (found.length === 1) { via = retailer; retailer = found[0]; }
      else if (!found.length && model && d.sale_price != null) { via = retailer; retailer = model[1]; }
    }
    if (d.sale_price != null) {
      const lead = leadNames.find((b) => new RegExp(`^${esc(b)}([^A-Za-z]|$)`, "i").test(d.title || ""));
      if (lead && lead.toLowerCase() !== retailer.toLowerCase() && (isStore(retailer) || new RegExp(`^${esc(lead)}\\s+${esc(retailer)}\\b`, "i").test(d.title || ""))) {
        if (isStore(retailer) && !via) via = retailer;
        retailer = lead;
      }
    }
    d.retailer = name(retailer);
    d.via = via ? name(via) : null;
    if (d.via && d.via.toLowerCase() === d.retailer.toLowerCase()) d.via = null;

    // Category fixes
    const forced = CATEGORY_BY_BRAND[d.retailer.toLowerCase()];
    if (forced) d.category = forced;
    if (d.sale_price != null && !/Toys|Horror|Tech|Home/.test(d.category) && FOOTWEAR.test(d.title || "") && !/\b(socks?|shoe bag|boot tray)\b/i.test(d.title || "")) d.category = "Shoes & Accessories";
    const text = `${d.title} ${d.notes || ""}`;
    const game = GAME_STORES.has(d.retailer.toLowerCase()) || GAME.test(text);
    if (d.category === "Tech" && HORROR.test(text) && game) d.category = "Horror & Pop Culture";
    if (d.category === "Horror & Pop Culture" && game && !HORROR.test(text)) d.category = "Tech";
    d.item = isSingleItem(d);
    return d;
  };
}

// One named product (a "Single item") versus a brand, store or category sale.
// A deal with a sale price is always one product. Without a price, the title
// decides: strip the deal talk, and if what's left reads like a product name
// (no sitewide/category/plural words), it's one product. The AI's own `item`
// flag counts too, unless the title clearly covers more than one thing.
const SCOPE = /\b(site-?wide|store-?wide|brand-?wide|sitewide|storewide|everything|entire|whole|almost|most|all|any|every|select(ed)?|styles?|items?|products?|pieces?|collections?|favou?rites|best-?sellers|bestselling|new arrivals|range|lines?|catalog(ue)?|categor(y|ies)|orders?|purchases?|spend|subscriptions?|memberships?|members?|vip|code|codes|promo|coupon|free|gifts? with|with purchase|cashback|rewards?|bundles|kits|sets|deals|offers|savings|markdowns|discounts|doorbusters|clearance|outlet|closeouts?|event|preview|early access|access|week|weekend|days?|today|holiday|season(al)?|year|annual|biggest|limited|online|in[- ]stores?|shipping|terms|details|pending|brands?|plus|more|and|or|&|including|e\.g|across|tiers?|tiered|qualifying|apparel|clothing|clothes|activewear|athleisure|loungewear|sleepwear|swimwear|intimates|lingerie|outerwear|footwear|shoes and|accessories|jewelry|jewellery|starting|starts|through|until|november|december|bogo|buy \d|\d+-for-\d+|devices?|led device|luggage|bags|handbags|skincare|skin care|makeup|make-up|cosmetics|haircare|hair care|body care|bodycare|fragrances?|perfumes|beauty|wellness|supplements|furniture|decor|décor|bedding|bath|lighting|cookware|bakeware|kitchenware|kitchen|drinkware|appliances|electronics|gadgets|gear|equipment|toys|games|titles|movies|devices|tech)\b/i;
// Plural nouns that still name one product ("Bondi 9 running shoes", "BDG Jacob jeans").
const PAIR = /^(shoes|sneakers|boots|jeans|leggings|pants|shorts|joggers|tights|sunglasses|glasses|earbuds|headphones|airpods|trainers|sandals|slippers|clogs|loafers|flats|mules|cargos?|overalls|pajamas|pyjamas|scissors|tongs|chopsticks|sweatpants|trousers|briefs|socks|lashes|strips|pads|patches|gummies|drops|pods|buds)$/i;
const DEAL_TALK = /\b(black friday|cyber monday|cyber week|bfcm|early|sale|on sale|deal|price|prices|pricing|product page|page|listing|lowest|record low|all-time low|discounted|discount|reduced|marked down|markdown|down|cut|half|half off|now|save|saving|off|up to|from|to|at|on|in|the|its|for|with|of|about|roughly|only|just|new|today|this|year|vs|list|was|is|price drop|dropped|hits?|gets?|a|an)\b/gi;
export function isSingleItem(d) {
  if (d.sale_price != null) return true;
  const raw = String(d.title || "");
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let t = raw;
  for (const n of [d.retailer, d.via].filter(Boolean)) t = t.replace(new RegExp(esc(String(n)), "gi"), " ");
  t = t.replace(/\b(product page|product listing|all (colou?rs|sizes|shades)|\d+-(day|piece|pc))\b/gi, " ")
    .replace(/\(.*?\)/g, (m) => (/\d+[- ]?(pack|pc|piece|ct|count|oz|ml)\b/i.test(m) ? m : " "))
    .replace(/\$[\d,.]+|\d+\s*(%|percent)|\b\d+\s*(to|-)\s*\d+\s*%?/gi, " ");
  if (SCOPE.test(t)) return false;
  const left = t.replace(DEAL_TALK, " ").replace(/[^\p{L}\p{N}'+ -]/gu, " ").split(/\s+/).filter((w) => w.length > 1 || /\d/.test(w));
  if (!left.length) return false;
  // A plural noun (other than pairs like shoes or jeans) means a group of products.
  // Capitalized words after the first are names ("When the Rain Stops"), not plurals.
  if (left.some((w, i) => (i === 0 || !/^\p{Lu}/u.test(w)) && /[a-z]{3,}s$/i.test(w) && !/(ss|us|is|'s)$/i.test(w) && !PAIR.test(w))) return false;
  if (d.item === true) return true;
  return left.length >= 2 || /\d/.test(left[0] || "");
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
      (o.discount_pct != null && o.discount_pct === d.discount_pct && !o.sale_price && !d.sale_price && !o.item && !d.item) ||
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
// "Tower28" / "Tower 28", "MERIT Beauty" / "Merit", "Melissa & Doug" / "Melissa and Doug" are one brand.
function brandKey(name) {
  return String(name || "").toLowerCase().replace(/&|\+|\band\b/g, " ")
    .replace(/\s+(beauty|cosmetics|outdoors|rocks|official|co\.?|inc\.?)$/g, "").replace(/[^a-z0-9]/g, "");
}
export function onePerBrand(deals) {
  const best = new Map();
  const keyOf = (d) => `${brandKey(d.retailer)}|${brandKey(d.via)}`;
  for (const d of deals) {
    if (d.sale_price != null || d.item || BIG.has(String(d.retailer).toLowerCase())) continue;
    const k = keyOf(d);
    if (!best.has(k) || better(d, best.get(k))) best.set(k, d);
  }
  return deals.filter((d) => d.sale_price != null || d.item || BIG.has(String(d.retailer).toLowerCase()) || best.get(keyOf(d)) === d);
}
// Single items: the same product listed twice (different articles or stores) is one card.
// A priced listing beats one with only a percent; among priced ones, the cheapest.
const VARIANT = new Set(["xl", "plus", "ultra", "mini", "max", "pro", "air", "mid", "low", "high", "gtx", "women's", "men's", "womens", "mens", "kids", "slim", "lite"]);
const FILLER = /\b(up|product|page|listing|black friday|cyber monday|early|sale|deal|deals|price|prices|pricing|lowest|discounted|discount|reduced|cut|half|now|save|off|at|on|in|the|its|for|and|with|to|about|roughly|during|exclusive|edition|set)\b/g;
function itemWords(d) {
  const t = String(d.title).toLowerCase().replace(new RegExp(String(d.retailer).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), " ")
    .replace(/\$[\d,.]+|\d+\s*%|\(|\)/g, " ").replace(FILLER, " ").replace(/\b(amazon|best buy|walmart|target|macy's|rei)\b/g, " ")
    .replace(/[^a-z0-9'+ -]/g, " ").replace(/-/g, " ");
  return new Set(t.split(/\s+/).filter((w) => w.length > 1 || /\d/.test(w)));
}
function sameItem(a, b) {
  if (String(a.retailer).toLowerCase() !== String(b.retailer).toLowerCase()) return false;
  const A = itemWords(a), B = itemWords(b);
  const nums = (S) => [...S].filter((w) => /\d/.test(w));
  const [na, nb] = [nums(A), nums(B)].sort((x, y) => x.length - y.length);
  if (!na.every((w) => nb.includes(w))) return false;
  const only = [...A].filter((w) => !B.has(w)).concat([...B].filter((w) => !A.has(w)));
  if (only.some((w) => VARIANT.has(w))) return false;
  const both = [...A].filter((w) => B.has(w)).length;
  const small = Math.min(A.size, B.size);
  return small > 0 && (both === small || both / (A.size + B.size - both) >= 0.5);
}
export function dedupeItems(deals) {
  const out = [];
  for (const d of deals) {
    const item = (x) => x.sale_price != null || x.item;
    if (!item(d)) { out.push(d); continue; }
    const i = out.findIndex((o) => item(o) && sameItem(o, d));
    if (i === -1) { out.push(d); continue; }
    const o = out[i];
    let pick;
    if ((d.sale_price != null) !== (o.sale_price != null)) pick = d.sale_price != null ? d : o;
    else if (d.sale_price != null) pick = d.sale_price < o.sale_price || (d.sale_price === o.sale_price && filled(d) > filled(o)) ? d : o;
    else pick = (d.discount_pct ?? 0) > (o.discount_pct ?? 0) || ((d.discount_pct ?? 0) === (o.discount_pct ?? 0) && filled(d) > filled(o)) ? d : o;
    out[i] = pick;
  }
  return out;
}

const strip = (d) => Object.fromEntries(Object.entries(d).filter(([, v]) => v != null && v !== ""));

// Price sanity checks, used on every deal (hunt and live search):
// - a "sale" price that isn't below the original drops the original
// - a store-wide "up to X% off" with one example price isn't a single item: drop the prices
// - when both prices exist, the percent is worked out from them
export function fixPrices(d) {
  let sale = d.sale_price ?? null, orig = d.original_price ?? null, pct = d.discount_pct ?? null;
  if (sale != null && orig != null && sale >= orig) orig = null;
  if (sale != null && /\bup to\b|sitewide|site-wide|storewide|select styles|hundreds|including|e\.g\.|deals on|and more|\bitems\b|\bstyles\b|marked down|\b\w+s and \w+s\b|\bselect\b|many at|\btitles\b|entire site/i.test(`${d.title} ${d.notes || ""}`)) { sale = null; orig = null; }
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
