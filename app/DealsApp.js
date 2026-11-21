"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CATEGORIES, PRICE_RANGES, PILLS, FASHION_FIRST, dealScore } from "@/lib/deals";

const EMPTY = { q: "", category: null, minPct: 0, price: null, maxPrice: null, endsToday: false, endsOn: null, hasCode: false, sort: "featured" };

const localDay = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
const parseDay = (s) => new Date(`${s}T23:59:59`);
const fmtDay = (s) => new Date(`${s}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

function timeLeft(ends, now) {
  if (!ends) return "End date not announced";
  const ms = parseDay(ends) - now;
  if (ms <= 0) return "Ended";
  const h = Math.floor(ms / 3.6e6);
  const d = Math.floor(h / 24);
  if (d >= 1) return `Ends in ${d}d ${h % 24}h`;
  return h >= 1 ? `Ends tonight · ${h}h left` : `Ends tonight · ${Math.max(1, Math.floor(ms / 6e4))}m left`;
}

// Puts the discount front and center in the title, e.g. "Up to **60% off** sitewide".
// Each category gets a small line icon in its own muted color.
const CAT_STYLE = {
  "Fashion": { tint: "#a8768f", icon: "M9 3l3 2 3-2 5 3-2 4-2-1v11H8V9L6 10 4 6z" },
  "Athleisure": { tint: "#4b5a78", icon: "M4 15c3 0 4-2 6-2s3 2 6 2h4v3H4zM10 13l2-6 4 2" },
  "Shoes & Accessories": { tint: "#6e5f5c", icon: "M3 16V11l4 1 3-3 3 4c2 1 5 1 8 2v3z" },
  "Beauty": { tint: "#a079b0", icon: "M10 3h4v6h-4zM8 9h8v12H8z" },
  "Tech": { tint: "#5b5e66", icon: "M4 5h16v11H4zM2 19h20" },
  "Home & Kitchen": { tint: "#8f8792", icon: "M4 11l8-7 8 7v9H4zM10 20v-5h4v5" },
  "Baking & Food": { tint: "#8c4a6e", icon: "M5 14a7 4 0 0014 0zM5 14V11h14v3M9 8c0-2 2-2 2-4M13 8c0-2 2-2 2-4" },
  "Toys & Kids": { tint: "#6f8c79", icon: "M7 4h10v6H7zM5 10h14v10H5zM9 14h6" },
  "Outdoor": { tint: "#4f6250", icon: "M3 20l7-12 4 6 2-3 5 9z" },
  "Horror & Pop Culture": { tint: "#3e2540", icon: "M12 3a7 7 0 00-7 7v11l2-2 2 2 3-2 3 2 2-2 2 2V10a7 7 0 00-7-7zM9 10h.01M15 10h.01" },
};
function CatIcon({ cat }) {
  const c = CAT_STYLE[cat];
  if (!c) return null;
  return (<svg className="caticon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style={{ color: c.tint }}><path d={c.icon} /></svg>);
}

function DealTitle({ d }) {
  const m = d.title.match(/(up to\s+)?\d+\s*%(\s*off)?/i);
  if (m) {
    const i = m.index;
    return (<>{d.title.slice(0, i)}<span className="pct">{m[0]}</span>{d.title.slice(i + m[0].length)}</>);
  }
  return d.title; // the % is already shown above the title
}

function priceOf(d) {
  return d.sale_price ?? null;
}

function icsFor(d) {
  const day = d.ends.replaceAll("-", "");
  const next = new Date(`${d.ends}T12:00:00`);
  next.setDate(next.getDate() + 1);
  const end = localDay(next).replaceAll("-", "");
  const esc = (s) => String(s).replace(/[,;\\]/g, (m) => "\\" + m);
  const body = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Black Friday Hunter//EN", "BEGIN:VEVENT",
    `UID:${d.id.replace(/\W/g, "")}-${day}@blackfridayhunter`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${esc(`Last day: ${d.retailer} ${d.discount_pct ? d.discount_pct + "% off" : "sale"}`)}`,
    `DESCRIPTION:${esc(`${d.title}${d.code ? " · code " + d.code : ""} · ${d.link}`)}`,
    "BEGIN:VALARM", "TRIGGER:-PT12H", "ACTION:DISPLAY", "DESCRIPTION:Sale ends soon", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `${d.retailer}-sale.ics` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Search matching: ignore filler words, accept plurals and common synonyms,
// so "espresso maker" finds "espresso machine".
const STOP = new Set(["the", "a", "an", "and", "or", "for", "of", "on", "in", "at", "to", "with", "best", "deal", "deals", "sale", "sales", "black", "friday", "cyber", "monday", "cheap", "cheapest", "good", "top", "buy", "find", "me", "show", "off"]);
const SYN = [
  ["maker", "machine", "brewer"], ["tee", "t-shirt", "tshirt", "top"], ["sneaker", "shoe", "trainer", "runner"],
  ["legging", "tight"], ["tv", "television"], ["headphone", "earbud", "airpod"], ["laptop", "notebook", "macbook"],
  ["sweatshirt", "hoodie", "crewneck"], ["jean", "denim"], ["bag", "tote", "purse", "handbag"], ["coat", "jacket", "puffer", "outerwear"],
  ["perfume", "fragrance", "cologne", "scent"], ["skincare", "serum", "moisturizer", "cream"], ["makeup", "foundation", "concealer", "mascara", "lipstick"],
];
const stem = (w) => w.replace(/[^a-z0-9%.-]/g, "").replace(/(ies)$/, "y").replace(/(es|s)$/, "");
function terms(q) {
  return q.toLowerCase().split(/\s+/).map(stem).filter((w) => w && !STOP.has(w));
}
function matches(hay, w) {
  const alts = SYN.find((g) => g.includes(w)) || [w];
  return alts.some((a) => hay.includes(a.replace(/%$/, "")));
}
const norm = (q) => q.trim().toLowerCase();

export default function DealsApp({ initialDeals }) {
  const [f, setF] = useState(EMPTY);
  const [now, setNow] = useState(() => new Date());
  const [live, setLive] = useState({ status: "idle", deals: [], msg: "" });
  const [reported, setReported] = useState([]);
  const hunted = useRef(new Set());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    try { setReported(JSON.parse(localStorage.getItem("bfh-reported") || "[]")); } catch {}
    return () => clearInterval(t);
  }, []);

  const today = localDay(now);
  const set = (patch) => setF((p) => ({ ...p, ...patch }));

  const all = useMemo(() => {
    const seen = new Set();
    return [...initialDeals, ...live.deals]
      .filter((d) => !(d.ends && d.ends < today))
      .filter((d) => !reported.includes(d.id))
      .filter((d) => {
        const k = `${d.retailer}|${d.title}`.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((d) => {
        const pct = d.discount_pct ?? (d.original_price > d.sale_price && d.sale_price != null ? Math.round(((d.original_price - d.sale_price) / d.original_price) * 100) : null);
        const x = { ...d, discount_pct: pct };
        return { ...x, score: dealScore(x) };
      });
  }, [initialDeals, live.deals, today, reported]);

  const results = useMemo(() => {
    const words = terms(f.q);
    const range = PRICE_RANGES.find((r) => r.id === f.price);
    let list = all.filter((d) => {
      const hay = `${d.retailer} ${d.via ?? ""} ${d.title} ${d.category} ${d.notes ?? ""} ${d.discount_pct ?? ""}% ${d.code ?? ""}`.toLowerCase();
      // Web results were already found for this exact search, so they always show.
      const fromThisSearch = d.forQ && d.forQ === norm(f.q);
      if (words.length && !fromThisSearch && !words.every((w) => matches(hay, w))) return false;
      if (f.category && d.category !== f.category) return false;
      if (f.minPct && (d.discount_pct ?? 0) < f.minPct) return false;
      if (f.hasCode && !d.code) return false;
      if (f.endsToday && d.ends !== today) return false;
      if (f.endsOn && d.ends !== f.endsOn) return false;
      const p = priceOf(d);
      if (range && (p == null || p < range.min || p >= range.max)) return false;
      if (f.maxPrice && (p == null || p > f.maxPrice)) return false;
      return true;
    });
    const by = {
      featured: (a, b) => (FASHION_FIRST.includes(b.category) - FASHION_FIRST.includes(a.category)) || b.score - a.score,
      score: (a, b) => b.score - a.score,
      pct: (a, b) => (b.discount_pct ?? 0) - (a.discount_pct ?? 0),
      price: (a, b) => (priceOf(a) ?? 1e9) - (priceOf(b) ?? 1e9),
      ending: (a, b) => (a.ends ?? "9999") .localeCompare(b.ends ?? "9999"),
    }[f.sort];
    return [...list].sort(by);
  }, [all, f, today]);

  // When a search turns up fewer than 3 saved deals, search the web on its own
  // once typing pauses, so nobody has to press a button.
  useEffect(() => {
    const q = f.q.trim();
    if (q.length < 3 || results.length >= 3 || hunted.current.has(norm(q))) return;
    const t = setTimeout(() => huntWeb(q), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.q, results.length]);

  // Ending calendar: today through Dec 2.
  const days = useMemo(() => {
    const out = [];
    const start = new Date(`${today}T12:00:00`);
    const last = new Date(`${now.getFullYear()}-12-02T12:00:00`);
    // Black Friday = day after the 4th Thursday of November; Cyber Monday = 3 days later.
    const nov1 = new Date(now.getFullYear(), 10, 1, 12);
    const thanksgiving = 1 + ((4 - nov1.getDay() + 7) % 7) + 21;
    const bfDate = new Date(now.getFullYear(), 10, thanksgiving + 1, 12);
    const cmDate = new Date(now.getFullYear(), 10, thanksgiving + 4, 12);
    const bf = localDay(bfDate), cm = localDay(cmDate);
    for (let d = new Date(start); d <= last && out.length < 14; d.setDate(d.getDate() + 1)) {
      const key = localDay(d);
      out.push({ key, count: all.filter((x) => x.ends === key).length, event: key === bf ? "Black Friday" : key === cm ? "Cyber Monday" : null });
    }
    return out;
  }, [all, today, now]);

  async function huntWeb(q = f.q, scroll = false) {
    if (!q.trim() || hunted.current.has(norm(q))) return;
    hunted.current.add(norm(q));
    setLive((l) => ({ ...l, status: "loading", msg: "" }));
    try {
      const r = await fetch("/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q }) });
      const j = await r.json();
      const fresh = (j.deals || []).map((d, i) => ({ ...d, id: `live-${Date.now()}-${i}`, fresh: true, forQ: norm(q) }));
      if (fresh.length && scroll) setTimeout(() => document.getElementById("deals")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      const priced = fresh.filter((d) => d.sale_price != null).length;
      // Product searches come back with prices: show the cheapest first.
      if (fresh.length && priced >= fresh.length / 2) set({ sort: "price" });
      setLive((l) => ({ status: "done", deals: [...l.deals, ...fresh], msg: j.error || (fresh.length ? (priced >= fresh.length / 2 ? `Found ${fresh.length} prices on the web, cheapest first.` : `Found ${fresh.length} more on the web.`) : "Nothing new turned up on the web.") }));
    } catch {
      hunted.current.delete(norm(q));
      setLive((l) => ({ ...l, status: "done", msg: "The hunt hit a snag. Try again in a minute." }));
    }
  }

  function report(d) {
    const next = [...reported, d.id];
    setReported(next);
    try { localStorage.setItem("bfh-reported", JSON.stringify(next)); } catch {}
  }

  const active = JSON.stringify({ ...f, q: "", sort: "featured" }) !== JSON.stringify({ ...EMPTY });

  return (
    <>
    <nav className="topbar">
      <div className="tb-left">
        <a href="#deals">Deals</a>
        <a href="#calendar">Calendar</a>
      </div>
      <Link href="/" className="wordmark" aria-label="Black Friday Hunter home">BLACKFRIDAY<span>hunter</span></Link>
      <div className="tb-right">
        <button type="button" onClick={() => document.getElementById("q")?.focus()}>Search</button>
        <Link href="/about">About</Link>
      </div>
    </nav>
    <main className="wrap">
      <header className="hero">
        <p className="eyebrow">Black Friday & Cyber Monday {now.getFullYear()} · Updated twice daily</p>
        <form className="search" onSubmit={(e) => { e.preventDefault(); hunted.current.delete(norm(f.q)); huntWeb(f.q, true); }}>
          <input
            id="q"
            value={f.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Search brands, products or 50%"
            aria-label="Search deals"
          />
          {f.q && <button type="button" className="clear" onClick={() => set({ q: "" })} aria-label="Clear search">×</button>}
        </form>
        <div className="pills" role="list">
          {PILLS.map((p) => (
            <button key={p.label} className={`pill ${p.q ? "pill-search" : ""}`} onClick={() => {
              if (p.q) { setF({ ...EMPTY, q: p.q }); hunted.current.delete(norm(p.q)); huntWeb(p.q, true); }
              else setF({ ...EMPTY, q: f.q, ...p.f });
            }}>{p.q && <svg className="caticon" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M10.5 17a6.5 6.5 0 110-13 6.5 6.5 0 010 13zM15.5 15.5L20 20" /></svg>}{p.label}</button>
          ))}
        </div>
        {f.q.trim() && (results.length < 3 || live.status === "loading") && (
          <div className="inline-hunt" aria-live="polite">
            {live.status === "loading" ? (
              <p>Hunting the web for “{f.q.trim()}”<span className="dots" /></p>
            ) : hunted.current.has(norm(f.q)) ? (
              <p>{results.length ? <a href="#deals">{results.length} deal{results.length === 1 ? "" : "s"} for “{f.q.trim()}” below ↓</a> : `Nothing turned up for “${f.q.trim()}” yet. Try a brand or a simpler word.`}</p>
            ) : (
              <>
                <p>{results.length ? `Only ${results.length} saved deal${results.length === 1 ? "" : "s"} for “${f.q.trim()}”.` : `No saved deals for “${f.q.trim()}” yet.`}</p>
                <button onClick={() => { hunted.current.delete(norm(f.q)); huntWeb(f.q, true); }}>Search the web</button>
              </>
            )}
          </div>
        )}
      </header>

      <section className="calendar" id="calendar" aria-label="When deals end">
        <h2>When deals end</h2>
        <div className="strip">
          {days.map((d) => (
            <button
              key={d.key}
              className={`day ${f.endsOn === d.key ? "on" : ""} ${d.count ? "" : "quiet"} ${d.event ? "event" : ""}`}
              onClick={() => set({ endsOn: f.endsOn === d.key ? null : d.key, endsToday: false })}
            >
              {d.event && <span className="devent">{d.event}</span>}
              <span className="dname">{d.key === today ? "Today" : fmtDay(d.key).split(",")[0]}</span>
              <span className="ddate">{fmtDay(d.key).split(", ")[1]}</span>
              <span className="dcount">{d.count ? `${d.count} end${d.count === 1 ? "s" : ""}` : "–"}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="filters" aria-label="Filters">
        <div className="chips">
          <button className={`chip ${!f.category ? "on" : ""}`} onClick={() => set({ category: null })}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c} className={`chip ${f.category === c ? "on" : ""}`} onClick={() => set({ category: f.category === c ? null : c })}><CatIcon cat={c} />{c}</button>
          ))}
        </div>
        <div className="row">
          <label>Discount
            <select value={f.minPct} onChange={(e) => set({ minPct: +e.target.value })}>
              <option value={0}>Any</option><option value={30}>30%+</option><option value={50}>50%+</option><option value={70}>70%+</option>
            </select>
          </label>
          <label>Price
            <select value={f.price ?? ""} onChange={(e) => set({ price: e.target.value || null, maxPrice: null })}>
              <option value="">Any</option>
              {PRICE_RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
          <label>Sort
            <select value={f.sort} onChange={(e) => set({ sort: e.target.value })}>
              <option value="featured">Featured</option><option value="score">Best deal</option><option value="pct">Biggest discount</option>
              <option value="price">Lowest price</option><option value="ending">Ending soonest</option>
            </select>
          </label>
          {active && <button className="reset" onClick={() => setF({ ...EMPTY, q: f.q })}>Clear filters</button>}
        </div>
      </section>

      <p className="count">{results.length} deal{results.length === 1 ? "" : "s"}{f.category ? ` in ${f.category}` : ""}{f.endsOn ? ` ending ${fmtDay(f.endsOn)}` : ""}</p>

      <section className="grid" id="deals">
        {results.map((d) => (
          <article key={d.id} className={`card ${d.ends === today ? "urgent" : ""}`}>
            <div className="card-hero">
              <div className="hero-top">
                <span className="cat"><CatIcon cat={d.category} />{d.category}</span>
                {d.ends === today ? <span className="flag">Ends tonight</span> : d.fresh ? <em className="new">New</em> : null}
              </div>
              <p className="brand">{d.retailer}</p>
              {d.via && <p className="via">at {d.via}</p>}
              <p className="offer">{d.discount_pct ? <>{/up to/i.test(d.title) && "Up to "}{d.discount_pct}% off</> : "On sale"}</p>
            </div>
            <h3><a className="stretch" href={d.link} target="_blank" rel="noopener noreferrer sponsored"><DealTitle d={d} /></a></h3>
            {(d.sale_price || d.original_price) && (
              <p className="price">{d.sale_price && <b>${d.sale_price}</b>} {d.original_price && <s>${d.original_price}</s>}</p>
            )}
            {d.code && <p className="code">Code <button onClick={() => navigator.clipboard?.writeText(d.code)} title="Copy code">{d.code}</button></p>}
            {d.notes && <p className="note">{d.notes}</p>}
            <p className={`ends ${d.ends ? "" : "unknown"}`}>{timeLeft(d.ends, now)}{d.ends && <span> · {fmtDay(d.ends)}</span>}</p>
            <div className="actions">
              <a className="go" href={d.link} target="_blank" rel="noopener noreferrer sponsored">Shop <span aria-hidden="true">→</span></a>
              {d.ends && <button className="cal" onClick={() => icsFor(d)}>Add to calendar</button>}
            </div>
            <p className="meta">
              Found by AI, confirm at the retailer · <span style={{ whiteSpace: "nowrap" }}>checked {d.last_checked}</span> · <a href={d.source} target="_blank" rel="noopener noreferrer">source</a> ·{" "}
              <button className="link" onClick={() => report(d)}>Report wrong deal</button>
            </p>
          </article>
        ))}
      </section>

      {results.length >= 3 && f.q.trim() && live.status !== "loading" ? (
        <section className="hunt">
          <p>{results.length ? "Want more?" : "No saved deals match that yet."}</p>
          <button onClick={() => { hunted.current.delete(norm(f.q)); huntWeb(f.q, true); }} disabled={live.status === "loading" || !f.q.trim()}>
            {live.status === "loading" ? "Hunting the web…" : `Hunt the web for “${f.q.trim() || "…"}”`}
          </button>
          {live.msg && <p className="msg">{live.msg}</p>}
        </section>
      ) : null}

      <footer className="foot">
        <p>Deals are found by AI from public pages and may change. Always check the retailer’s site. Some links may be affiliate links.</p>
        <Link href="/about">About Black Friday Hunter</Link>
      </footer>
    </main>
    </>
  );
}
