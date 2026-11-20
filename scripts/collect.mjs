// Daily deal hunt: searches the web for every brand on the list, plus
// discovery searches per category, then merges results into data/deals.json.
// New brands found by discovery are added to data/brands.csv as "discovered".
// Run: ANTHROPIC_API_KEY=... node scripts/collect.mjs
import fs from "node:fs";
import { findDeals, CATEGORIES } from "../lib/claude.mjs";

const DEALS = "data/deals.json";
const BRANDS = "data/brands.csv";
const BATCH = 8;          // brands per search request
const PARALLEL = 4;       // requests at once
const year = new Date().getFullYear();
const today = new Date().toISOString().slice(0, 10);

function readBrands() {
  const [header, ...lines] = fs.readFileSync(BRANDS, "utf8").trim().split(/\r?\n/);
  return lines.map((l) => {
    const cells = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"'));
    return { brand: cells[0], category: cells[1], active: cells[2], website: cells[3] || "" };
  }).filter((b) => b.brand);
}

function writeBrands(brands) {
  const q = (s) => (/[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const body = brands.map((b) => [b.brand, b.category, b.active, b.website].map((s) => q(s || "")).join(",")).join("\n");
  fs.writeFileSync(BRANDS, `brand,category,active,website\n${body}\n`);
}

async function pool(tasks, n) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < tasks.length) {
      const t = tasks[i++];
      try { out.push(...(await t())); } catch (e) { console.error("search failed:", e.message); }
    }
  }));
  return out;
}

const brands = readBrands();
const active = brands.filter((b) => b.active !== "no");
const tasks = [];
for (let i = 0; i < active.length; i += BATCH) {
  const group = active.slice(i, i + BATCH);
  const list = group.map((b) => (b.website ? `${b.brand} (${b.website})` : b.brand)).join("; ");
  tasks.push(() => findDeals(`Find each of these brands' current Black Friday ${year} sale, if announced: ${list}. One deal per brand at most, skip brands with no ${year} sale found.`));
}
for (const c of CATEGORIES) {
  tasks.push(() => findDeals(`Find the best Black Friday ${year} deals in the ${c} category from any brand or store. Up to 8 deals, biggest real savings first.`));
}

console.log(`Running ${tasks.length} searches for ${active.length} brands + ${CATEGORIES.length} categories...`);
const found = await pool(tasks, PARALLEL);

// Deals Nina has marked wrong are never re-added.
const hidden = fs.existsSync("data/hidden.json") ? JSON.parse(fs.readFileSync("data/hidden.json", "utf8")) : [];
const isHidden = (d) => hidden.some((h) => d.retailer.toLowerCase() === h.retailer.toLowerCase() && (!h.title_contains || d.title.toLowerCase().includes(h.title_contains.toLowerCase())));
for (let i = found.length - 1; i >= 0; i--) if (isHidden(found[i])) found.splice(i, 1);
const existing = JSON.parse(fs.readFileSync(DEALS, "utf8"));
const key = (d) => `${d.retailer}|${d.title}`.toLowerCase();
const byKey = new Map(existing.map((d) => [key(d), d]));
let added = 0, updated = 0;
for (const d of found) {
  const k = key(d);
  if (byKey.has(k)) { byKey.set(k, { ...byKey.get(k), ...Object.fromEntries(Object.entries(d).filter(([, v]) => v != null)) }); updated++; }
  else { byKey.set(k, d); added++; }
}
// Drop deals that ended more than 2 days ago.
const cutoff = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
const merged = [...byKey.values()].filter((d) => (!d.ends || d.ends >= cutoff) && !isHidden(d));
fs.writeFileSync(DEALS, JSON.stringify(merged, null, 2) + "\n");

const known = new Set(brands.map((b) => b.brand.toLowerCase()));
const discovered = [];
for (const d of found) {
  const name = d.retailer.replace(/\s+at\s+.*$/i, "").trim();
  if (!known.has(name.toLowerCase())) { known.add(name.toLowerCase()); discovered.push({ brand: name, category: d.category, active: "discovered", website: "" }); }
}
if (discovered.length) writeBrands([...brands, ...discovered]);

console.log(`${today}: ${found.length} deals found, ${added} new, ${updated} refreshed, ${merged.length} total. ${discovered.length} new brands discovered.`);
