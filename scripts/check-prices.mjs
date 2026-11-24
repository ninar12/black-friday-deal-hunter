// Re-checks every saved single-item price against its source page (no AI, free).
// DRY_RUN=1 only prints what would change.
import fs from "node:fs";
import { verifyDeals, verifyStats } from "../lib/verify.mjs";

const DEALS = "data/deals.json";
const deals = JSON.parse(fs.readFileSync(DEALS, "utf8"));
const out = await verifyDeals(deals);
const byTitle = new Map(out.map((d) => [`${d.retailer}|${d.title}`, d]));
for (const d of deals) {
  if (d.sale_price == null) continue;
  const o = byTitle.get(`${d.retailer}|${d.title}`);
  const tag = !o ? "DROPPED (price not on page)" : o.sale_price == null ? "price hidden (page wouldn't open)" : "ok";
  console.log(`${tag}: ${d.retailer}${d.via ? " at " + d.via : ""}, $${d.sale_price}, ${d.source}`);
}
console.log(`Price check: ${verifyStats.ok} confirmed, ${verifyStats.made_up} made up (dropped), ${verifyStats.unopened} pages wouldn't open (price hidden).`);
if (!process.env.DRY_RUN) fs.writeFileSync(DEALS, JSON.stringify(out, null, 2) + "\n");
