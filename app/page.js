import deals from "@/data/deals.json";
import DealsApp from "./DealsApp";

export const revalidate = 3600;

export default function Home() {
  const withIds = deals.map((d, i) => ({ ...d, id: `${d.retailer}-${i}` }));
  return <DealsApp initialDeals={withIds} />;
}
