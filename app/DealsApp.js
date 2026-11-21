"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { shopUrl } from "@/lib/shop";
import { CATEGORIES, PRICE_RANGES, POPULAR, FASHION_FIRST, dealScore } from "@/lib/deals";

const EMPTY = { q: "", mine: false, picks: false, kind: "", category: null, minPct: 0, price: null, maxPrice: null, endsToday: false, endsOn: null, hasCode: false, sort: "featured" };

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
  "Fashion": { tint: "#0d9488", bar: "#2dd4bf", bg: "#f0fdfa", icon: "M9 3l3 2 3-2 5 3-2 4-2-1v11H8V9L6 10 4 6z" },
  "Athleisure": { tint: "#0891b2", bar: "#22d3ee", bg: "#ecfeff", icon: "M4 15c3 0 4-2 6-2s3 2 6 2h4v3H4zM10 13l2-6 4 2" },
  "Shoes & Accessories": { tint: "#0284c7", bar: "#38bdf8", bg: "#f0f9ff", icon: "M3 16V11l4 1 3-3 3 4c2 1 5 1 8 2v3z" },
  "Beauty": { tint: "#059669", bar: "#34d399", bg: "#ecfdf5", icon: "M10 3h4v6h-4zM8 9h8v12H8z" },
  "Tech": { tint: "#2563eb", bar: "#60a5fa", bg: "#eff6ff", icon: "M4 5h16v11H4zM2 19h20" },
  "Home & Kitchen": { tint: "#16a34a", bar: "#4ade80", bg: "#f0fdf4", icon: "M4 11l8-7 8 7v9H4zM10 20v-5h4v5" },
  "Baking & Food": { tint: "#65a30d", bar: "#a3e635", bg: "#f7fee7", icon: "M5 14a7 4 0 0014 0zM5 14V11h14v3M9 8c0-2 2-2 2-4M13 8c0-2 2-2 2-4" },
  "Toys & Kids": { tint: "#4f46e5", bar: "#818cf8", bg: "#eef2ff", icon: "M7 4h10v6H7zM5 10h14v10H5zM9 14h6" },
  "Outdoor": { tint: "#047857", bar: "#059669", bg: "#ecfdf5", icon: "M3 20l7-12 4 6 2-3 5 9z" },
  "Horror & Pop Culture": { tint: "#334155", bar: "#64748b", bg: "#f1f5f9", icon: "M12 3a7 7 0 00-7 7v11l2-2 2 2 3-2 3 2 2-2 2 2V10a7 7 0 00-7-7zM9 10h.01M15 10h.01" },
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

export default function DealsApp({ initialDeals, sites = {}, picks = [], images = {} }) {
  const [f, setF] = useState(EMPTY);
  const [now, setNow] = useState(() => new Date());
  const [live, setLive] = useState({ status: "idle", deals: [], msg: "" });
  const [reported, setReported] = useState([]);
  const hunted = useRef(new Set());
  const moreRound = useRef(0);
  // A pick is the brand's own sale. Single items from that brand at Amazon/Macy's etc. aren't tagged.
  const isPick = (d) => !d.via && picks.includes(String(d.retailer).toLowerCase());
  // A single product with a price, versus a store- or brand-wide sale.
  const isItem = (d) => d.sale_price != null;
  // Product photo, on single items only (found by scripts/images.mjs).
  const photoOf = (d) => (isItem(d) && d.image) || null;
  const money = (n) => "$" + (Number.isInteger(+n) ? +n : (+n).toFixed(2));
  const pickRank = (d) => (isPick(d) ? 1 : 0); // a pick's own-site sale beats a single item at Amazon
  // Brands this visitor follows, kept in their browser (no sign-up).
  const [following, setFollowing] = useState([]);
  useEffect(() => { try { setFollowing(JSON.parse(localStorage.getItem("bfh-follow") || "[]")); } catch {} }, []);
  // Last visit: deals from followed brands first seen after it count as new for you.
  const [lastVisit, setLastVisit] = useState(null);
  useEffect(() => {
    try {
      setLastVisit(localStorage.getItem("bfh-visit") || "");
      localStorage.setItem("bfh-visit", new Date().toISOString().slice(0, 10));
    } catch {}
  }, []);
  const toggleFollow = (brand) => setFollowing((list) => {
    const k = brand.toLowerCase();
    const next = list.includes(k) ? list.filter((x) => x !== k) : [...list, k];
    try { localStorage.setItem("bfh-follow", JSON.stringify(next)); } catch {}
    return next;
  });
  // A random mix of popular searches, picked after load so every visit differs.
  const [pills, setPills] = useState(() => POPULAR.slice(0, 8));
  const shufflePills = () => setPills([...POPULAR].sort(() => Math.random() - 0.5).slice(0, 8));
  useEffect(() => { shufflePills(); }, []);
  // The "When deals end" strip starts folded away; the choice is remembered.
  const [calOpen, setCalOpen] = useState(false);
  useEffect(() => { try { setCalOpen(localStorage.getItem("bfh-cal") === "open"); } catch {} }, []);
  const toggleCal = () => setCalOpen((o) => { try { localStorage.setItem("bfh-cal", o ? "closed" : "open"); } catch {} return !o; });

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
      if (f.mine && !following.includes(d.retailer.toLowerCase())) return false;
      if (f.picks && !isPick(d)) return false;
      if (f.kind === "sale" && isItem(d)) return false;
      if (f.kind === "item" && !isItem(d)) return false;
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
      featured: (a, b) => (pickRank(b) - pickRank(a)) || (FASHION_FIRST.includes(b.category) - FASHION_FIRST.includes(a.category)) || b.score - a.score,
      score: (a, b) => b.score - a.score,
      pct: (a, b) => (b.discount_pct ?? 0) - (a.discount_pct ?? 0),
      price: (a, b) => (priceOf(a) ?? 1e9) - (priceOf(b) ?? 1e9),
      ending: (a, b) => (a.ends ?? "9999") .localeCompare(b.ends ?? "9999"),
    }[f.sort];
    return [...list].sort(by);
  }, [all, f, today, following]);

  const newForYou = lastVisit ? all.filter((d) => following.includes(String(d.retailer).toLowerCase()) && (d.first_seen || d.last_checked || "") > lastVisit) : [];
  const feedUrl = following.length ? `/api/calendar?brands=${encodeURIComponent(following.join(","))}` : "";
  const webcal = () => `webcal://${location.host}${feedUrl}`;

  // When a search turns up fewer than 3 saved deals, search the web on its own
  // once typing pauses, so nobody has to press a button.
  useEffect(() => {
    const q = f.q.trim();
    if (q.length < 3 || results.length >= 6 || hunted.current.has(norm(q))) return;
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

  async function huntWeb(q = f.q, scroll = false, opts = {}) {
    if (!q.trim() || hunted.current.has(norm(q))) return;
    hunted.current.add(norm(q));
    setLive((l) => ({ ...l, status: "loading", msg: "" }));
    try {
      const r = await fetch("/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q, exclude: opts.exclude || [] }) });
      const j = await r.json();
      const fresh = (j.deals || []).map((d, i) => ({ ...d, ...(opts.category ? { category: opts.category } : {}), id: `live-${Date.now()}-${i}`, fresh: true, forQ: opts.category ? "" : norm(q) }));
      if (fresh.length && scroll) setTimeout(() => document.getElementById("deals")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      const priced = fresh.filter((d) => d.sale_price != null).length;
      // Product searches come back with prices: show the cheapest first.
      if (fresh.length && priced >= fresh.length / 2) set({ sort: "price" });
      setLive((l) => ({ status: "done", deals: [...l.deals, ...fresh], err: j.error || "", msg: j.error || (fresh.length ? (priced >= fresh.length / 2 ? `Found ${fresh.length} prices on the web, cheapest first.` : `Found ${fresh.length} more on the web.`) : "Nothing new turned up on the web.") }));
    } catch {
      hunted.current.delete(norm(q));
      setLive((l) => ({ ...l, status: "done", err: "The hunt hit a snag. Try again in a minute.", msg: "" }));
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
        <a href="#calendar" onClick={() => { if (!calOpen) toggleCal(); }}>Calendar</a>
      </div>
      <Link href="/" className="wordmark" aria-label="Black Friday Hunter home"><svg className="logo" viewBox="0 0 32 32" aria-hidden="true"><g transform="rotate(-24 16 16)"><path d="M11 6h14.5a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H11L3.5 16z" fill="#14b8a6" stroke="#0f766e" strokeWidth="1.6" strokeLinejoin="round" /><circle cx="10" cy="16" r="1.9" fill="#fff" stroke="#0f766e" strokeWidth="1.2" /><path d="M19.5 20.2s-4.3-2.6-4.3-5.3a2.2 2.2 0 0 1 4.3-.7 2.2 2.2 0 0 1 4.3.7c0 2.7-4.3 5.3-4.3 5.3z" fill="#fff" /></g></svg><b className="wm-text">BLACKFRIDAY<span>hunter</span></b></Link>
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
          {pills.map((q) => (
            <button key={q} className="pill" onClick={() => { setF({ ...EMPTY, q }); hunted.current.delete(norm(q)); huntWeb(q, true); }}>{q}</button>
          ))}
          <button className="pill pill-shuffle" onClick={shufflePills} aria-label="Show other popular searches">↻</button>
        </div>
        {f.q.trim() && (results.length < 6 || live.status === "loading") && (
          <div className="inline-hunt" aria-live="polite">
            {live.status === "loading" ? (
              <p>Hunting the web for “{f.q.trim()}”<span className="dots" /></p>
            ) : hunted.current.has(norm(f.q)) ? (
              <>
                <p>{live.err && !results.length ? live.err : results.length ? <a href="#deals">{results.length} deal{results.length === 1 ? "" : "s"} for “{f.q.trim()}” below ↓</a> : `Nothing turned up for “${f.q.trim()}” yet. Try a brand or a simpler word.`}</p>
                {results.length > 0 && <button onClick={() => { hunted.current.delete(norm(f.q)); huntWeb(f.q, false, { exclude: [...new Set(results.map((d) => d.retailer))] }); }}>Check more stores</button>}
              </>
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
        <button type="button" className="cal-toggle" aria-expanded={calOpen} onClick={toggleCal}>
          <h2>When deals end</h2>
          {!calOpen && (
            <span className="cal-sum">
              {days.filter((d) => d.event).map((d) => `${d.event} ${fmtDay(d.key).split(", ")[1]}`).join(" · ")}
              {" · "}{days.reduce((n, d) => n + d.count, 0)} deals end in the next two weeks
              {f.endsOn && <> · showing {fmtDay(f.endsOn).split(", ")[1]}</>}
            </span>
          )}
          <span className="cal-chev" aria-hidden="true">{calOpen ? "Hide −" : "Show +"}</span>
        </button>
        {calOpen && <div className="strip">
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
        </div>}
      </section>

      <section className="filters" aria-label="Filters">
        <div className="chips">
          <button className={`chip ${!f.category && !f.mine ? "on" : ""}`} onClick={() => set({ category: null, mine: false, picks: false })}>All</button>
          {newForYou.length > 0 && !f.mine && <button className="chip chip-new" onClick={() => set({ mine: true, picks: false, category: null })}>{newForYou.length} new from your brands</button>}
          <button className={`chip chip-pick ${f.picks ? "on" : ""}`} onClick={() => set({ picks: !f.picks, mine: false, category: null })}>★ Nina’s picks</button>
          <button className={`chip chip-mine ${f.mine ? "on" : ""}`} onClick={() => set({ mine: !f.mine, picks: false, category: null })}>♥ My brands{following.length ? ` (${following.length})` : ""}</button>
          {CATEGORIES.map((c) => (
            <button key={c} style={{ "--cat": CAT_STYLE[c]?.tint }} className={`chip chip-cat ${f.category === c ? "on" : ""}`} onClick={() => set({ category: f.category === c ? null : c })}><CatIcon cat={c} />{c}</button>
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
          <label>Type
            <select value={f.kind} onChange={(e) => set({ kind: e.target.value })}>
              <option value="">Everything</option>
              <option value="sale">Sales</option>
              <option value="item">Single items</option>
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
            {photoOf(d) && (
              <div className="photo photo-item">
                <img src={photoOf(d)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.parentElement.style.display = "none"; }} />
              </div>
            )}
            <div className={`card-hero ${isItem(d) ? "is-item" : "is-sale"}`} style={{ "--cat": CAT_STYLE[d.category]?.tint || "#64748b", "--cat-bar": CAT_STYLE[d.category]?.bar || "#94a3b8", "--cat-bg": CAT_STYLE[d.category]?.bg || "#f8fafc" }}>
              <div className="hero-top">
                <span className="cat">{isPick(d) ? <><CatIcon cat={d.category} />{d.category}<span className="pick">· ★ Nina’s pick</span></> : <><CatIcon cat={d.category} />{d.category}</>}</span>
                <span className="hero-right">
                  {d.ends === today ? <span className="flag">Ends tonight</span> : d.fresh ? <em className="new">New</em> : null}
                  <button className={`heart ${following.includes(d.retailer.toLowerCase()) ? "on" : ""}`} onClick={() => toggleFollow(d.retailer)} aria-pressed={following.includes(d.retailer.toLowerCase())} title={following.includes(d.retailer.toLowerCase()) ? `Unfollow ${d.retailer}` : `Follow ${d.retailer}`}>
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" /></svg>
                  </button>
                </span>
              </div>
              <p className="kind">{isItem(d) ? "Single item" : d.via ? "Brand sale" : "Sitewide sale"}</p>
              <p className="brand">{d.retailer}</p>
              {d.via && <p className="via">at {d.via}</p>}
              {isItem(d)
                ? (d.price_ok === false
                  // The store's page doesn't show this price any more: don't print a wrong number.
                  ? <p className="offer">{d.discount_pct ? `${d.discount_pct}% off` : "On sale"}<span className="price-note">See today’s price at the store</span></p>
                  : <p className="offer">{money(d.sale_price)}{d.original_price && <s>{money(d.original_price)}</s>}{d.discount_pct ? <span className="pct">−{d.discount_pct}%</span> : null}
                      <span className="price-note">{d.price_ok ? "Price checked on the store’s page" : `Price as of ${fmtDay(d.last_checked || today)}`}</span></p>)
                : <p className="offer">{d.discount_pct ? <>{/up to/i.test(d.title) && "Up to "}{d.discount_pct}% off</> : "On sale"}</p>}
            </div>
            <h3><a className="stretch" href={shopUrl(d, sites)} target="_blank" rel="noopener noreferrer sponsored"><DealTitle d={d} /></a></h3>
            {!isItem(d) && d.original_price && (
              <p className="price">{d.sale_price && <b>${d.sale_price}</b>} {d.original_price && <s>${d.original_price}</s>}</p>
            )}
            {d.code && <p className="code">Code <button onClick={() => navigator.clipboard?.writeText(d.code)} title="Copy code">{d.code}</button></p>}
            {d.notes && <p className="note">{d.notes}</p>}
            {d.ends ? <p className="ends">{timeLeft(d.ends, now)}<span> · {fmtDay(d.ends)}</span></p> : <p className="ends unknown">End date not announced</p>}
            <div className="card-foot">
              <span className="go">Shop <span aria-hidden="true">→</span></span>
              {d.ends && <button className="mini" onClick={() => icsFor(d)} title="Add the last day to your calendar">+ Calendar</button>}
              <a className="mini" href={d.source} target="_blank" rel="noopener noreferrer" title="Where this deal was found">Source</a>
            </div>
          </article>
        ))}
      </section>

      {f.mine && following.length > 0 && (
        <section className="hunt subscribe">
          <p>Get a heads-up without email: add your brands to your calendar. It updates on its own as new sales turn up, with a reminder the day before each one ends.</p>
          <a className="btn" href={feedUrl ? webcal() : "#"} onClick={(e) => { e.currentTarget.href = webcal(); }}>Subscribe in my calendar</a>
          <a className="mini" href={feedUrl} download="my-brands.ics">or download it once</a>
        </section>
      )}

      {f.mine && !results.length && (
        <section className="hunt"><p>{following.length ? "None of your brands have a sale saved yet. We check twice a day." : "Tap the ♥ on any deal to follow that brand. Its sales will show up here."}</p></section>
      )}

      {f.category && !f.q.trim() && (
        <section className="hunt">
          <p>Want more {f.category} deals?</p>
          <button disabled={live.status === "loading"} onClick={() => {
            moreRound.current++;
            huntWeb(`best ${f.category} black friday deals`.concat(moreRound.current > 1 ? ` page ${moreRound.current}` : ""), false, { category: f.category, exclude: [...new Set(results.map((d) => d.retailer))].slice(0, 40) });
          }}>
            {live.status === "loading" ? <>Finding more<span className="dots" /></> : `Find more ${f.category} deals on the web`}
          </button>
          {live.status !== "loading" && live.msg && <p className="msg">{live.err || live.msg}</p>}
        </section>
      )}

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
