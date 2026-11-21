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
// Popular Black Friday searches. The site shows a random handful each visit,
// and clicking one runs a live web search for it.
export const POPULAR = [
  "AirPods Pro", "Dyson Airwrap", "Ugg Tasman", "Lululemon Align", "Skims", "Cashmere cardigan",
  "Alt girl fashion deals", "Stanley cup", "Owala bottle", "Apple Watch", "iPad", "Nintendo Switch 2",
  "PS5", "Kindle", "Le Creuset Dutch oven", "Ninja Creami", "KitchenAid stand mixer", "Sol de Janeiro",
  "Rare Beauty blush", "Laneige lip mask", "Charlotte Tilbury", "Aritzia Super Puff", "Alo Yoga",
  "Barefoot Dreams blanket", "Theragun", "Oura Ring", "Bose headphones", "Hoka", "New Balance 530",
  "Coach bag", "Free People", "Revolve", "Dyson vacuum", "Meta Quest 3", "Lego sets", "Glossier",
  "Sephora sale", "Ulta sale", "Puffer jacket", "Cowboy boots", "Gold jewelry", "Perfume gift sets",
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
