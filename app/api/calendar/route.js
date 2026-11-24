// Calendar feed for followed brands: /api/calendar?brands=skims,alo
// Calendar apps re-fetch it on their own, so new sales show up without email.
import deals from "@/data/deals.json";
import hidden from "@/data/hidden.json";
import { makeIsHidden } from "@/lib/hidden.mjs";

export const dynamic = "force-dynamic";

const esc = (s) => String(s ?? "").replace(/[,;\\]/g, (m) => "\\" + m).replace(/\r?\n/g, " ");
const ymd = (s) => s.replaceAll("-", "");
const nextDay = (s) => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
// Lines over 75 octets must be folded per RFC 5545.
const fold = (l) => l.length <= 74 ? l : l.match(/.{1,73}/g).join("\r\n ");

export function GET(req) {
  const brands = new URL(req.url).searchParams.get("brands") || "";
  const want = new Set(brands.toLowerCase().split(",").map((b) => b.trim()).filter(Boolean).slice(0, 100));
  const isHidden = makeIsHidden(hidden);
  const mine = deals.filter((d) => want.has(String(d.retailer).toLowerCase()) && !isHidden(d));
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Black Friday Hunter//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:My brands on sale", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H"];
  const event = (uid, day, summary, desc, alarm) => {
    lines.push("BEGIN:VEVENT", `UID:${uid}@blackfridayhunter`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(day)}`, `DTEND;VALUE=DATE:${ymd(nextDay(day))}`,
      `SUMMARY:${esc(summary)}`, `DESCRIPTION:${esc(desc)}`);
    if (alarm) lines.push("BEGIN:VALARM", `TRIGGER:${alarm}`, "ACTION:DISPLAY", `DESCRIPTION:${esc(summary)}`, "END:VALARM");
    lines.push("END:VEVENT");
  };
  for (const d of mine) {
    const id = `${d.retailer}-${d.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
    const off = d.discount_pct ? `${d.discount_pct}% off` : "sale";
    const desc = `${d.title}${d.code ? ` · code ${d.code}` : ""}${d.link ? ` · ${d.link}` : ""}`;
    if (d.ends) event(`end-${id}`, d.ends, `Last day: ${d.retailer} ${off}`, desc, "-PT12H");
    const seen = d.first_seen || d.last_checked;
    if (seen) event(`new-${id}`, seen, `${d.retailer} sale is on: ${off}`, desc, "PT9H");
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "public, max-age=1800" },
  });
}
