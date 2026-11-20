export const CATEGORIES = [
  "Athleisure", "Fashion", "Shoes & Accessories", "Beauty", "Tech",
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
  { label: "Ending today", f: { endsToday: true } },
  { label: "50%+ off", f: { minPct: 50 } },
  { label: "Tech under $200", f: { category: "Tech", maxPrice: 200 } },
  { label: "Athleisure deals", f: { category: "Athleisure" } },
  { label: "Beauty steals", f: { category: "Beauty", sort: "score" } },
  { label: "Cozy home", f: { category: "Home & Kitchen" } },
  { label: "Has a promo code", f: { hasCode: true } },
];

export function dealScore(d) {
  const pct = d.discount_pct ?? 0;
  const saved = d.original_price && d.sale_price ? d.original_price - d.sale_price : 0;
  return Math.round(pct + Math.min(20, saved / 10));
}

export function dayKey(date) {
  return date.toISOString().slice(0, 10);
}
