// Single items only: finds a product photo (d.image) and checks the price (d.price_ok).
// - free: the product page's own preview image, and whether the sale price appears on it
// - optional: Google Shopping photos via Serper.dev when SERPER_API_KEY is set (~$0.001 each)
// Runs in GitHub Actions, where the network is open.
import fs from "fs";

const DEALS = "data/deals.json", SITES = "data/sites.json";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const deals = JSON.parse(fs.readFileSync(DEALS, "utf8"));

// Brand websites: sites.json, then the CSVs (hand-entered wins).
const sites = fs.existsSync(SITES) ? JSON.parse(fs.readFileSync(SITES, "utf8")) : {};
for (const f of ["data/brands.csv", "data/discovered.csv"]) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, "utf8").trim().split(/\r?\n/).slice(1)) {
    const c = l.split(",");
    const w = (c[3] || "").trim();
    if (c[0] && /^(https?:\/\/)?[\w-]+(\.[\w-]+)+/.test(w)) sites[c[0].toLowerCase()] = /^https?:/.test(w) ? w : "https://" + w;
  }
}

function pick(html, base) {
  const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]*>/i);
  const content = m && (m[0].match(/content=["']([^"']+)["']/i) || [])[1];
  if (!content) return null;
  try {
    const u = new URL(content.replace(/&amp;/g, "&"), base);
    if (!/^https:/.test(u.href)) return null;
    // Skip logos and tiny placeholder images.
    if (/logo|favicon|placeholder|default[-_]?share|sprite/i.test(u.pathname)) return null;
    return u.href;
  } catch { return null; }
}
async function getPage(url) {
  try {
    const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(12000), headers: { "user-agent": UA, accept: "text/html" } });
    if (!r.ok) return null;
    return { html: (await r.text()).slice(0, 600000), url: r.url };
  } catch { return null; }
}
// Does the product page show this sale price anywhere? ("$59", "59.00", "59,00" in JSON...)
function showsPrice(html, price) {
  const n = Number(price);
  const forms = [n.toFixed(2), Number.isInteger(n) ? String(n) : null].filter(Boolean);
  return forms.some((f) => new RegExp(`(\\$\\s?|"price"\\s*:\\s*"?|amount"?\\s*:\\s*"?)${f.replace(".", "\\.")}(?!\\d)`).test(html));
}
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

// Pictures are only shown on single items (deals with a sale price).
const { shopUrl } = await import("../lib/shop.js");
const items = deals.filter((d) => d.sale_price != null);

// 1. Free: when Shop goes to the product's own page, read that page once for
//    its preview picture and to check the sale price is really on it.
//    (Other pages, like news articles, are never used for pictures.)
const own = items.filter((d) => d.link && shopUrl(d, sites) === d.link && (d.image === undefined || d.price_ok === undefined));
await pool(own, 16, async (d) => {
  const p = await getPage(d.link);
  if (!p) { if (d.image === undefined) d.image = null; return; } // blocked: can't tell either way
  if (d.image === undefined) d.image = pick(p.html, p.url);
  d.price_ok = showsPrice(p.html, d.sale_price);
});
for (const d of items) if (d.image === undefined) d.image = null;
console.log(`product pages: ${own.filter((d) => d.image).length} of ${own.length} had a picture; ${own.filter((d) => d.price_ok === false).length} prices not found on the page`);

// 2. Optional, about $0.001 each: Google Shopping via Serper.dev, if SERPER_API_KEY is set.
if (process.env.SERPER_API_KEY) {
  const need = items.filter((d) => !d.image && !d.image_tried);
  await pool(need, 8, async (d) => {
    d.image_tried = true;
    const q = `${d.retailer} ${String(d.title).replace(/\$[\d,.]+|\d+%|black friday|cyber monday|deal|sale|off/gi, " ")}`.replace(/\s+/g, " ").trim().slice(0, 100);
    try {
      const r = await fetch("https://google.serper.dev/shopping", {
        method: "POST", signal: AbortSignal.timeout(15000),
        headers: { "X-API-KEY": process.env.SERPER_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({ q, gl: "us", num: 5 }),
      });
      const j = await r.json();
      const hit = (j.shopping || []).find((s) => /^https:/.test(s.imageUrl || ""));
      if (hit) d.image = hit.imageUrl;
    } catch (e) { console.log("serper failed", d.retailer, e.message); }
  });
  console.log(`Google Shopping: ${need.filter((d) => d.image).length} of ${need.length} found a picture`);
}
// Sale cards don't show pictures any more.
for (const d of deals) if (d.sale_price == null) delete d.image;

fs.writeFileSync(DEALS, JSON.stringify(deals, null, 2) + "\n");
