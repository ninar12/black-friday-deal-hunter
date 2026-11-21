import fs from "node:fs";
import deals from "@/data/deals.json";
import DealsApp from "./DealsApp";

export const revalidate = 3600;

// Brand websites from the brand lists, so "Shop" can go straight to the brand.
function brandSites() {
  const out = {};
  for (const file of ["data/brands.csv", "data/discovered.csv"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").trim().split(/\r?\n/).slice(1)) {
      const c = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((x) => x.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"'));
      if (c[0] && /^https?:\/\//.test(c[3] || "")) out[c[0].toLowerCase()] = c[3];
    }
  }
  return out;
}

export default function Home() {
  const withIds = deals.map((d, i) => ({ ...d, id: `${d.retailer}-${i}` }));
  return <DealsApp initialDeals={withIds} sites={brandSites()} />;
}
