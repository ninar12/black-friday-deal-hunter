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

// Pages on the brand's site that aren't for shopping: send people to the homepage instead.
const NOT_SHOP = /\/(blog|blogs|article|articles|news|press|support|help|faq|terms|legal|policies|promo-terms|stories|journal)\b|^(support|help|blog|corporate|investors?|press|news|about)\./i;
// UK/EU/AU/CA versions of a brand's site.
const NON_US = /^(uk|eu|au|ca|de|fr|gb|ie)\.|\/(uk|en-gb|gb|eu|au|en-au|ca|en-ca)(\/|$)/i;
function homepage(url) {
  const parts = hostOf(url).split(".");
  return `https://www.${parts.slice(-2).join(".")}`;
}

export function shopUrl(d, sites = {}) {
  const names = [d.retailer, d.via].filter(Boolean);
  if (isOwnSite(d.link, names)) {
    let u; try { u = new URL(d.link); } catch {}
    const where = u ? u.hostname + u.pathname : "";
    if (u && !NOT_SHOP.test(where) && !NON_US.test(where)) return d.link;
    return sites[d.retailer?.toLowerCase()] || homepage(d.link);
  }
  const store = [d.via, d.retailer].find((n) => n && SEARCH[n.toLowerCase()]);
  if (store) {
    // Brand sold at a store: search the store for the brand plus product words.
    // The store's own general sale: go to the store's homepage when there's no real product named.
    const words = productWords(d).replace(new RegExp(store.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ").replace(/\b(select|selected|styles?|items?|top|free|shipping|during|bfcm|devices|toys|everything|sitewide|store|online|plus|extra|new|more|all)\b/gi, " ").replace(/\s+/g, " ").trim().replace(/\s+(at|in|on|for|from|with|by)$/i, "");
    if (store === d.retailer && words.split(" ").filter((w) => w.length > 2).length < 2) return sites[store.toLowerCase()] || SEARCH[store.toLowerCase()]("black friday");
    const brand = store === d.retailer || words.toLowerCase().includes(String(d.retailer).toLowerCase()) ? "" : d.retailer;
    const q = [...new Set(`${brand} ${words}`.trim().split(" "))].join(" ") || d.retailer;
    return SEARCH[store.toLowerCase()](encodeURIComponent(q));
  }
  const site = sites[d.retailer?.toLowerCase()];
  if (site) return site;
  return `https://duckduckgo.com/?q=${encodeURIComponent(`!ducky ${d.retailer} official site`)}`;
}
