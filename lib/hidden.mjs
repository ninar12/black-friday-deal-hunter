// Deals Nina has marked wrong (data/hidden.json). An entry matches on retailer, and
// optionally on title_contains, via (the store selling it) and sale_price.
export function makeIsHidden(hidden) {
  const low = (s) => String(s ?? "").toLowerCase();
  const list = Array.isArray(hidden) ? hidden : [];
  return (d) => list.some((h) => low(d.retailer) === low(h.retailer)
    && (!h.title_contains || low(d.title).includes(low(h.title_contains)))
    && (!h.via || low(d.via) === low(h.via))
    && (h.sale_price == null || Number(d.sale_price) === Number(h.sale_price)));
}
