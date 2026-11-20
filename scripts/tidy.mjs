// Re-runs the name/category cleanup over data/deals.json without searching.
// Run: node scripts/tidy.mjs
import fs from "node:fs";
import { makeNormalizer, isJunk, dedupe } from "../lib/normalize.mjs";

const [, ...lines] = fs.readFileSync("data/brands.csv", "utf8").trim().split(/\r?\n/);
const brands = lines.map((l) => {
  const c = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((x) => x.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"'));
  return { brand: c[0], category: c[1] };
}).filter((b) => b.brand);
const normalize = makeNormalizer(brands);
const before = JSON.parse(fs.readFileSync("data/deals.json", "utf8"));
const after = dedupe(before.map(normalize).filter((d) => !isJunk(d)));
fs.writeFileSync("data/deals.json", JSON.stringify(after, null, 2) + "\n");
console.log(`${before.length} -> ${after.length} deals`);
