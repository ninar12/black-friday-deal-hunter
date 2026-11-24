// Daily deal hunt: searches the web for every brand on the list, plus
// discovery searches per category, then merges results into data/deals.json.
// New brands found by discovery are added to data/brands.csv as "discovered".
// Run: ANTHROPIC_API_KEY=... node scripts/collect.mjs
import fs from "node:fs";
import { findDeals, CATEGORIES, usage } from "../lib/claude.mjs";
import { makeNormalizer, isJunk, dedupe, dedupeItems, onePerBrand } from "../lib/normalize.mjs";
import { makeIsHidden } from "../lib/hidden.mjs";

const DEALS = "data/deals.json";
const BRANDS = "data/brands.csv";          // edited by people
const DISCOVERED = "data/discovered.csv";  // written only by the hunt, so the two never clash
const BATCH = 12;         // brands per search request
const PARALLEL = 4;       // requests at once
const year = new Date().getFullYear();
const today = new Date().toISOString().slice(0, 10);

function readBrands(file = BRANDS) {
  if (!fs.existsSync(file)) return [];
  const [header, ...lines] = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  return lines.map((l) => {
    const cells = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"'));
    return { brand: cells[0], category: cells[1], active: cells[2], website: cells[3] || "" };
  }).filter((b) => b.brand);
}

function writeBrands(brands) {
  const q = (s) => (/[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const body = brands.map((b) => [b.brand, b.category, b.active, b.website].map((s) => q(s || "")).join(",")).join("\n");
  fs.writeFileSync(DISCOVERED, `brand,category,active,website\n${body}\n`);
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

const brands = [...readBrands(), ...readBrands(DISCOVERED)];
// To keep API costs down, only brands on Nina's list get their own check, and only
// when they have no current deal saved (checked in the last 3 days and not ended).
// Discovered brands are kept fresh by the category searches.
const saved = fs.existsSync(DEALS) ? JSON.parse(fs.readFileSync(DEALS, "utf8")) : [];
const recent = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
const covered = new Set(saved.filter((d) => (d.last_checked || "") >= recent && (!d.ends || d.ends >= today)).map((d) => String(d.retailer).toLowerCase()));
// ONLY_BRANDS="A,B" runs a quick, cheap hunt for just those brands (for newly added ones).
const only = (process.env.ONLY_BRANDS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const active = readBrands().filter((b) => b.active !== "no" && (only.length ? only.includes(b.brand.toLowerCase()) : !covered.has(b.brand.toLowerCase())));
const opts = { maxSearches: 3, maxTokens: 8000, fast: true };
const tasks = [];
for (let i = 0; i < active.length; i += BATCH) {
  const group = active.slice(i, i + BATCH);
  const list = group.map((b) => (b.website ? `${b.brand} (${b.website})` : b.brand)).join("; ");
  tasks.push(() => findDeals(`Find each of these brands' current Black Friday ${year} sale, if announced: ${list}. One deal per brand at most, skip brands with no ${year} sale found.`, opts));
}
// One discovery search per category per day, rotating through three angles.
const ANGLES = [
  (c) => `Find the best Black Friday ${year} deals in the ${c} category from any brand or store. Up to 10 deals, biggest real savings first.`,
  (c) => `Find Black Friday ${year} sitewide sales from smaller, indie or trending ${c} brands (not the biggest names). Up to 10 deals.`,
  (c) => `Find specific ${c} products with big Black Friday ${year} price drops right now, with sale and original prices. Up to 10 deals.`,
];
const dayNo = Math.floor(Date.now() / 864e5);
if (!only.length) CATEGORIES.forEach((c, i) => tasks.push(() => findDeals(ANGLES[(dayNo + i) % ANGLES.length](c), opts)));

console.log(`Running ${tasks.length} searches for ${active.length} brands without a current deal + ${CATEGORIES.length} categories...`);
const found = await pool(tasks, PARALLEL);

// Deals Nina has marked wrong are never re-added.
const hidden = fs.existsSync("data/hidden.json") ? JSON.parse(fs.readFileSync("data/hidden.json", "utf8")) : [];
const isHidden = makeIsHidden(hidden);
for (let i = found.length - 1; i >= 0; i--) if (isHidden(found[i])) found.splice(i, 1);
for (const r of new Set(JSON.parse(fs.readFileSync(DEALS, "utf8")).map((d) => d.retailer))) if (!brands.some((b) => b.brand.toLowerCase() === String(r).toLowerCase())) brands.push({ brand: r });
const normalize = makeNormalizer(brands);
for (let i = 0; i < found.length; i++) found[i] = normalize(found[i]);
const existing = JSON.parse(fs.readFileSync(DEALS, "utf8")).map(normalize).map((d) => ({ ...d, first_seen: d.first_seen || d.last_checked }));
const key = (d) => `${d.retailer}|${d.title}`.toLowerCase();
const byKey = new Map(existing.map((d) => [key(d), d]));
let added = 0, updated = 0;
for (const d of found) {
  const k = key(d);
  if (byKey.has(k)) { byKey.set(k, { ...byKey.get(k), ...Object.fromEntries(Object.entries(d).filter(([, v]) => v != null)) }); updated++; }
  else { byKey.set(k, { ...d, first_seen: today }); added++; }
}
// Drop deals that ended more than 2 days ago.
const cutoff = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
const merged = dedupeItems(onePerBrand(dedupe([...byKey.values()].filter((d) => (!d.ends || d.ends >= cutoff) && !isHidden(d) && !isJunk(d)))));
fs.writeFileSync(DEALS, JSON.stringify(merged, null, 2) + "\n");

const known = new Set(brands.map((b) => b.brand.toLowerCase()));
const discovered = [];
for (const d of found.filter((d) => !isJunk(d))) {
  const name = d.retailer;
  if (!known.has(name.toLowerCase())) { known.add(name.toLowerCase()); discovered.push({ brand: name, category: d.category, active: "discovered", website: "" }); }
}
if (discovered.length) writeBrands([...readBrands(DISCOVERED), ...discovered]);

console.log(`${today}: ${found.length} deals found, ${added} new, ${updated} refreshed, ${merged.length} total. ${discovered.length} new brands discovered.`);
// Rough cost: Haiku tokens plus $10 per 1,000 web searches.
console.log(`API use: ${usage.calls} calls, ${usage.searches} web searches, ${Math.round(usage.input / 1000)}k input + ${Math.round(usage.output / 1000)}k output tokens.`);
