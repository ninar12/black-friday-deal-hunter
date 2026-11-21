// Where "Shop" goes. AI-found deals often link to the news article that
// mentioned the sale; send shoppers to the store itself instead.
const SEARCH = {
  amazon: (q) => `https://www.amazon.com/s?k=${q}`,
  walmart: (q) => `https://www.walmart.com/search?q=${q}`,
  target: (q) => `https://www.target.com/s?searchTerm=${q}`,
  "best buy": (q) => `https://www.bestbuy.com/site/searchpage.jsp?st=${q}`,
  costco: (q) => `https://www.costco.com/CatalogSearch?keyword=${q}`,
  "nordstrom rack": (q) => `https://www.nordstromrack.com/sr?keyword=${q}`,
  nordstrom: (q) => `https://www.nordstrom.com/sr?keyword=${q}`,
  sephora: (q) => `https://www.sephora.com/search?keyword=${q}`,
  "ulta beauty": (q) => `https://www.ulta.com/search?search=${q}`,
  ulta: (q) => `https://www.ulta.com/search?search=${q}`,
  "macy's": (q) => `https://www.macys.com/shop/featured/${q}`,
  "kohl's": (q) => `https://www.kohls.com/search.jsp?search=${q}`,
  "sur la table": (q) => `https://www.surlatable.com/search?q=${q}`,
  wayfair: (q) => `https://www.wayfair.com/keyword.php?keyword=${q}`,
  revolve: (q) => `https://www.revolve.com/r/search.jsp?search=${q}`,
  iherb: (q) => `https://www.iherb.com/search?kw=${q}`,
  rei: (q) => `https://www.rei.com/search?q=${q}`,
  backcountry: (q) => `https://www.backcountry.com/store/search?q=${q}`,
  "hot topic": (q) => `https://www.hottopic.com/search?q=${q}`,
  gamestop: (q) => `https://www.gamestop.com/search/?q=${q}`,
  "epic games store": (q) => `https://store.epicgames.com/en-US/browse?q=${q}`,
};

const letters = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}
// Does this link already point at the brand's or store's own site?
function isOwnSite(url, names) {
  // Compare the main part of the domain only, so "brand.couponsite.com" doesn't count.
  const parts = hostOf(url).split(".");
  const h = letters(parts.length >= 2 ? parts[parts.length - 2] : "");
  return !!h && names.some((n) => { const l = letters(n); return l.length > 2 && (h.includes(l) || l.includes(h)); });
}
function productWords(d) {
  return String(d.title)
    .replace(/\bat\s+[A-Z][\w'&. ]+$/, "")
    .replace(/\$[\d,.]+|\d+\s*%|\b(up to|off|sale|deal|deals|black friday|cyber monday|early|price|lowest|discount(ed)?|cut|marked down|in half|for|from|on|with|the|its|and)\b/gi, " ")
    .replace(/[^\w'&+ -]/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 6).join(" ");
}

export function shopUrl(d, sites = {}) {
  const names = [d.retailer, d.via].filter(Boolean);
  if (isOwnSite(d.link, names)) return d.link;
  const store = [d.via, d.retailer].find((n) => n && SEARCH[n.toLowerCase()]);
  if (store) {
    const words = productWords(d);
    const brand = store === d.retailer || words.toLowerCase().includes(String(d.retailer).toLowerCase()) ? "" : d.retailer;
    const q = [...new Set(`${brand} ${words}`.trim().split(" "))].join(" ") || d.retailer;
    return SEARCH[store.toLowerCase()](encodeURIComponent(q));
  }
  const site = sites[d.retailer?.toLowerCase()];
  if (site) return site;
  return `https://duckduckgo.com/?q=${encodeURIComponent(`!ducky ${d.retailer} official site`)}`;
}
