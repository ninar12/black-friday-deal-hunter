// Price check: the AI sometimes makes up prices. Before a single-item price is
// shown, we open the source page (and the shop page) and make sure the sale
// price is really printed there. Used by live search and the daily hunt.
//
//   - Price found on the page: keep it, mark price_checked with today's date.
//     The original price is kept only if it is on the page too.
//   - Page opened but the price isn't on it: the price was made up. Drop the deal.
//   - Page wouldn't open (blocked, timeout): keep the deal, but hide the prices
//     and percent, so the card says "see price at store" instead of a guess.

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const MAX_BYTES = 2_000_000;

async function readPage(url, timeoutMs) {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", "accept-language": "en-US,en;q=0.9" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    if (!/html|text|json/i.test(res.headers.get("content-type") || "text/html")) return null;
    const reader = res.body?.getReader();
    if (!reader) return null;
    let html = "", size = 0;
    const dec = new TextDecoder();
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      html += dec.decode(value, { stream: true });
    }
    try { reader.cancel(); } catch {}
    // Bot walls and captchas count as "couldn't open", not as "price missing".
    if (html.length < 2000 || /captcha|robot check|access denied|are you a human|enable javascript and cookies|px-captcha|cf-chl/i.test(html.slice(0, 20000)) && !/\$\s?\d/.test(html)) return null;
    return html;
  } catch { return null; }
}

// Page text with tags gone, plus the raw HTML (prices often sit in JSON-LD or data attributes).
function haystack(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ").replace(/&#36;|&dollar;/g, "$").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
  return { text, raw: html.replace(/&quot;/g, '"').replace(/&#36;/g, "$") };
}

// Does this page show this dollar amount?
export function pageHasPrice(page, price) {
  if (price == null || !page) return false;
  const p = Number(price);
  const whole = Math.floor(p);
  const cents = Math.round((p - whole) * 100);
  const w = whole.toLocaleString("en-US").replace(/,/g, ",?");
  const c = String(cents).padStart(2, "0");
  // "$54", "$54.00", "$ 54", "USD 54", "$1,299.99", "$54 99" (cents in a <sup>)
  const money = cents
    ? new RegExp(`(\\$|USD)\\s*${w}(\\.|\\s)${c}(?!\\d)`, "i")
    : new RegExp(`(\\$|USD)\\s*${w}(\\.00?)?(?!\\d)(?![.,]\\d)`, "i");
  if (money.test(page.text)) return true;
  // Structured data: "price": "54.00", "salePrice":54, data-price="54.00"
  const num = cents ? `${whole}\\.${c}` : `${whole}(\\.0+)?`;
  return new RegExp(`(price|amount|lowPrice|highPrice)["']?\\s*[:=]\\s*["']?\\$?${num}(?![\\d])`, "i").test(page.raw);
}

const pages = new Map(); // one fetch per URL per run
function getPage(url, timeoutMs) {
  if (!pages.has(url)) pages.set(url, readPage(url, timeoutMs).then((h) => (h ? haystack(h) : null)));
  if (pages.size > 500) pages.clear();
  return pages.get(url);
}

export const verifyStats = { checked: 0, ok: 0, made_up: 0, unopened: 0 };

// Returns the deal with checked prices, or null when the price was made up.
export async function verifyDeal(d, { timeoutMs = 6000, today = new Date().toISOString().slice(0, 10) } = {}) {
  if (d.sale_price == null) return d;
  // Already checked recently with the same price: no need to open the page again.
  if (d.price_checked && d.price_checked_price === d.sale_price) return d;
  // The picture step already found this price on the store's own product page.
  if (d.price_ok === true) return { ...d, price_checked: today, price_checked_price: d.sale_price };
  verifyStats.checked++;
  const urls = [...new Set([d.source, d.link].filter((u) => typeof u === "string" && /^https?:\/\//.test(u)))];
  const got = (await Promise.all(urls.map((u) => getPage(u, timeoutMs)))).filter(Boolean);
  if (!got.length) {
    verifyStats.unopened++;
    return { ...d, sale_price: null, original_price: null, discount_pct: null, price_checked: null, price_checked_price: undefined, price_note: "See price at store" };
  }
  const hit = got.find((p) => pageHasPrice(p, d.sale_price));
  if (!hit) { verifyStats.made_up++; return null; }
  verifyStats.ok++;
  const origOk = d.original_price != null && got.some((p) => pageHasPrice(p, d.original_price));
  const orig = origOk ? d.original_price : null;
  const pct = orig ? Math.round(((orig - d.sale_price) / orig) * 100) : null;
  return { ...d, original_price: orig, discount_pct: pct, price_checked: today, price_checked_price: d.sale_price, price_note: null };
}

export async function verifyDeals(deals, opts = {}) {
  const out = [];
  const queue = deals.map((d, i) => [d, i]);
  const results = new Array(deals.length);
  const n = opts.parallel || 12;
  await Promise.all(Array.from({ length: n }, async () => {
    while (queue.length) {
      const [d, i] = queue.shift();
      try { results[i] = await verifyDeal(d, opts); } catch { results[i] = d.sale_price == null ? d : null; }
    }
  }));
  for (const r of results) if (r) out.push(r);
  return out;
}
