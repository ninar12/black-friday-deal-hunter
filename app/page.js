import fs from "node:fs";
import path from "node:path";
import deals from "@/data/deals.json";
import DealsApp from "./DealsApp";

// Built once per deploy (every hunt pushes and redeploys). The data files are read
// at build time, where they exist; a serverless re-render could not see them.
export const dynamic = "force-static";

const file = (f) => path.join(process.cwd(), f);

// Brand websites from the brand lists, so "Shop" can go straight to the brand.
function brandSites() {
  // Found by scripts/sites.mjs; hand-entered websites in the CSVs win.
  const out = fs.existsSync(file("data/sites.json")) ? JSON.parse(fs.readFileSync(file("data/sites.json"), "utf8")) : {};
  for (const f of ["data/brands.csv", "data/discovered.csv"]) {
    if (!fs.existsSync(file(f))) continue;
    for (const line of fs.readFileSync(file(f), "utf8").trim().split(/\r?\n/).slice(1)) {
      const c = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((x) => x.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"'));
      const w = (c[3] || "").trim();
      if (c[0] && /^(https?:\/\/)?[\w-]+(\.[\w-]+)+/.test(w)) out[c[0].toLowerCase()] = /^https?:/.test(w) ? w : `https://${w}`;
    }
  }
  return out;
}

function picks() {
  if (!fs.existsSync(file("data/picks.txt"))) return [];
  return fs.readFileSync(file("data/picks.txt"), "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => l.toLowerCase());
}

export default function Home() {
  const withIds = deals.map((d, i) => ({ ...d, id: `${d.retailer}-${i}` }));
  return <DealsApp initialDeals={withIds} sites={brandSites()} picks={picks()} />;
}
