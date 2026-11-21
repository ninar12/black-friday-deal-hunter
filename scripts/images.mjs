// Finds a picture for each deal, with no AI cost:
// - a deal's own page preview image (og:image), e.g. the product photo for a single item
// - otherwise the brand's homepage preview image
// Saves deal images on the deal (d.image) and brand images in data/images.json.
// Runs in GitHub Actions, where the network is open.
import fs from "fs";

const DEALS = "data/deals.json", IMAGES = "data/images.json", SITES = "data/sites.json";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const deals = JSON.parse(fs.readFileSync(DEALS, "utf8"));
const brandImg = fs.existsSync(IMAGES) ? JSON.parse(fs.readFileSync(IMAGES, "utf8")) : {};

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
async function ogImage(url) {
  try {
    const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(12000), headers: { "user-agent": UA, accept: "text/html" } });
    if (!r.ok) return null;
    return pick((await r.text()).slice(0, 200000), r.url);
  } catch { return null; }
}
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

// 1. Deal pages (only ones we haven't tried yet).
const todo = deals.filter((d) => d.link && d.image === undefined);
await pool(todo, 16, async (d) => { d.image = (await ogImage(d.link)) || null; });
console.log(`deal pages: ${todo.filter((d) => d.image).length} of ${todo.length} had a picture`);

// 2. Brand homepages, for deals without their own picture.
const brands = [...new Set(deals.filter((d) => !d.image).map((d) => d.retailer.toLowerCase()))].filter((b) => sites[b] && brandImg[b] === undefined);
await pool(brands, 16, async (b) => { brandImg[b] = (await ogImage(sites[b])) || null; });
console.log(`brand homepages: ${brands.filter((b) => brandImg[b]).length} of ${brands.length} had a picture`);

fs.writeFileSync(DEALS, JSON.stringify(deals, null, 2) + "\n");
fs.writeFileSync(IMAGES, JSON.stringify(Object.fromEntries(Object.entries(brandImg).sort()), null, 2) + "\n");
