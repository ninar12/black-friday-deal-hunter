// Keeps Shop links working:
// 1. Finds each brand's official US homepage (Claude, no web search), checks it loads, saves to data/sites.json.
// 2. Checks every deal link; links that are gone (404/410/no such site) are cleared so Shop falls back to the brand site.
// Runs in the hunt workflow, where the network is open.
import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { MODEL } from "../lib/claude.mjs";

const SITES = "data/sites.json", DEALS = "data/deals.json";
const letters = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const read = (f) => fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim().split("\n").slice(1).map((l) => l.split(",")) : [];
const sites = fs.existsSync(SITES) ? JSON.parse(fs.readFileSync(SITES, "utf8")) : {};
const csvSite = new Set([...read("data/brands.csv"), ...read("data/discovered.csv")].filter((r) => r[3]).map((r) => r[0].toLowerCase()));
const deals = JSON.parse(fs.readFileSync(DEALS, "utf8"));
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

async function probe(url) {
  try {
    const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000), headers: { "user-agent": UA, accept: "text/html" } });
    const html = r.ok ? (await r.text()).slice(0, 20000) : "";
    return { status: r.status, final: r.url, title: (html.match(/<title[^>]*>([^<]*)/i)?.[1] || "").trim() };
  } catch (e) { return { status: 0, err: e.cause?.code || e.name }; }
}
async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

// 1. Brand homepages
const need = [...new Set(deals.map((d) => d.retailer))].filter((b) => !csvSite.has(b.toLowerCase()) && !sites[b.toLowerCase()]);
console.log(`${need.length} brands without a website`);
const client = new Anthropic();
for (let i = 0; i < need.length; i += 60) {
  const batch = need.slice(i, i + 60);
  const res = await client.messages.create({
    model: MODEL, max_tokens: 6000, thinking: { type: "disabled" },
    messages: [{ role: "user", content: `For each brand or store below, give its official US shopping website homepage (the brand's own store, not Amazon or a retailer, not a UK/EU site). If you're not sure, use null.\nReply with only a JSON object {"Brand": "https://..."}.\n\n${batch.join("\n")}` }],
  });
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  let got = {};
  try { got = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); } catch { console.log("could not parse batch", i); }
  const checks = await pool(Object.entries(got).filter(([, u]) => typeof u === "string" && u.startsWith("http")), 12, async ([b, u]) => [b, u, await probe(u)]);
  for (const [b, u, p] of checks) {
    // Bot walls (403/429/503) still mean the site exists; only drop dead ones.
    if (p.status === 0 || p.status === 404 || p.status === 410) { console.log("dead site", b, u, p.status || p.err); continue; }
    sites[b.toLowerCase()] = u;
  }
}
fs.writeFileSync(SITES, JSON.stringify(Object.fromEntries(Object.entries(sites).sort()), null, 2) + "\n");
console.log(`${Object.keys(sites).length} brand sites saved`);

// 2. Deal links
const linked = deals.filter((d) => d.link);
const results = await pool(linked, 16, async (d) => [d, await probe(d.link)]);
let cleared = 0;
for (const [d, p] of results) {
  if (p.status === 0 || p.status === 404 || p.status === 410) { console.log("dead link", d.retailer, d.link, p.status || p.err); d.link = null; cleared++; }
}
fs.writeFileSync(DEALS, JSON.stringify(deals, null, 2) + "\n");
console.log(`checked ${linked.length} deal links, cleared ${cleared} dead ones`);
