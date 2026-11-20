export const CATEGORIES = [
  "Fashion", "Athleisure", "Shoes & Accessories", "Beauty", "Tech",
  "Home & Kitchen", "Baking & Food", "Toys & Kids", "Outdoor", "Horror & Pop Culture",
];

export const PRICE_RANGES = [
  { id: "u25", label: "Under $25", min: 0, max: 25 },
  { id: "25-100", label: "$25–$100", min: 25, max: 100 },
  { id: "100-500", label: "$100–$500", min: 100, max: 500 },
  { id: "500", label: "$500+", min: 500, max: Infinity },
];

// Guide pills: each is just a saved set of filters.
export const PILLS = [
  { label: "Fashion", f: { category: "Fashion" } },
  { label: "Athleisure", f: { category: "Athleisure" } },
  { label: "Shoes & bags", f: { category: "Shoes & Accessories" } },
  { label: "50%+ off", f: { minPct: 50 } },
  { label: "Ending today", f: { endsToday: true } },
  { label: "Beauty", f: { category: "Beauty" } },
  { label: "Tech under $200", f: { category: "Tech", maxPrice: 200 } },
  { label: "Has a promo code", f: { hasCode: true } },
];

// Default "Featured" order puts these categories first.
export const FASHION_FIRST = ["Fashion", "Athleisure", "Shoes & Accessories"];

export function dealScore(d) {
  const pct = d.discount_pct ?? 0;
  const saved = d.original_price && d.sale_price ? d.original_price - d.sale_price : 0;
  return Math.round(pct + Math.min(20, saved / 10));
}

export function dayKey(date) {
  return date.toISOString().slice(0, 10);
}
