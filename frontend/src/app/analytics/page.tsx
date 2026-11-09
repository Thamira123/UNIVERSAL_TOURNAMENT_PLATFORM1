"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Overview = { edition: string; source: string; countries: number; medalAwards: number; events: number; sports: number };
type Country = { rank: number; code: string; name: string; gold: number; silver: number; bronze: number; total: number };
type Sport = { sport: string; medalAwards: number; events: number; countries: number };

const numberFormat = new Intl.NumberFormat("en-US");
const flag = (code: string) => [...code.toUpperCase()].map((character) => String.fromCodePoint(character.charCodeAt(0) + 127397)).join("");

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;
    Promise.all([
      api<Overview>("/analytics/overview"),
      api<Country[]>("/analytics/medals?limit=20"),
      api<Sport[]>("/analytics/sports"),
    ]).then(([summary, table, disciplineList]) => {
      if (!current) return;
      setOverview(summary);
      setCountries(table);
      setSports(disciplineList);
    }).catch((cause: unknown) => {
      if (current) setError(cause instanceof Error ? cause.message : "Analytics data could not be loaded.");
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);

  const leadingSport = sports[0];
  const maxAwards = leadingSport?.medalAwards || 1;

  return <main className="analytics-page">
    <div className="analytics-topline"><Link href="/" className="brand utms-brand"><span className="brand-mark">U</span><span>UTMP<span className="brand-period">.</span></span></Link><nav aria-label="Main navigation"><Link href="/sports">Sports</Link><Link href="/analytics" aria-current="page">Analytics</Link><Link href="/login">Organizer sign in <span>↗</span></Link></nav></div>
    <section className="analytics-hero"><div className="analytics-hero-inner"><p className="analytics-kicker"><span /> PARIS 2024 RESULTS · DATA EXPLORER</p><h1>Every medal<br />has a <em>story.</em></h1><p>Explore the nations, sports and events that shaped the Paris 2024 Olympic Games.</p><div className="analytics-edition"><span>01</span><div><strong>PARIS 2024</strong><small>OLYMPIC SUMMER GAMES · 26 JUL — 11 AUG 2024</small></div></div></div><div className="analytics-hero-art" aria-hidden="true"><div className="analytics-rings" /><span className="analytics-art-word">PARIS<br /><i>24</i></span><small>FRANCE / 48°51′ N</small></div></section>

    <section className="analytics-content">
      <div className="analytics-section-head"><div><p className="analytics-eyebrow">THE GAMES IN NUMBERS</p><h2>A global <em>stage.</em></h2></div><span className="analytics-section-index">01 / OVERVIEW</span></div>
      {error ? <div className="analytics-error" role="alert"><strong>Analytics are temporarily unavailable.</strong><p>{error}</p><button onClick={() => window.location.reload()} type="button">Try again ↗</button></div> : <>
        <div className="analytics-stats" aria-live="polite">{[
          { label: "MEDAL TABLE NATIONS", value: overview?.countries, index: "01" },
          { label: "MEDALS AWARDED", value: overview?.medalAwards, index: "02" },
          { label: "MEDAL EVENTS", value: overview?.events, index: "03" },
          { label: "SPORTS", value: overview?.sports, index: "04" },
        ].map((stat) => <article className="analytics-stat" key={stat.index}><span>{stat.index} <i>—</i> {stat.label}</span><strong>{loading ? "—" : numberFormat.format(stat.value ?? 0)}</strong><small>PARIS 2024</small></article>)}</div>

        <section className="analytics-table-section"><div className="analytics-section-head"><div><p className="analytics-eyebrow">NATIONS · GOLD FIRST</p><h2>The medal <em>table.</em></h2></div><span className="analytics-section-index">TOP 20 / {overview?.countries ?? "—"}</span></div><div className="analytics-table-wrap"><table className="analytics-table"><thead><tr><th scope="col">RANK</th><th scope="col">NATION</th><th scope="col">GOLD</th><th scope="col">SILVER</th><th scope="col">BRONZE</th><th scope="col">TOTAL</th></tr></thead><tbody>{countries.map((country) => <tr key={country.code} className={country.rank <= 3 ? "analytics-podium-row" : ""}><td className="analytics-rank">{String(country.rank).padStart(2, "0")}</td><th scope="row"><span className="analytics-country"><span>{flag(country.code)}</span><strong>{country.name}</strong><small>{country.code}</small></span></th><td><span className="medal-count medal-gold">{country.gold}</span></td><td><span className="medal-count medal-silver">{country.silver}</span></td><td><span className="medal-count medal-bronze">{country.bronze}</span></td><td className="analytics-total">{country.total}</td></tr>)}</tbody></table>{loading && <div className="analytics-loading">Connecting to the tournament data archive…</div>}</div></section>

        <section className="analytics-sports-section"><div className="analytics-section-head"><div><p className="analytics-eyebrow">DISCIPLINE BREAKDOWN</p><h2>Made for the <em>moment.</em></h2></div><span className="analytics-section-index">{String(sports.length).padStart(2, "0")} SPORTS</span></div><div className="analytics-sport-grid">{sports.slice(0, 12).map((sport, index) => <article className="analytics-sport-card" key={sport.sport}><div className="analytics-sport-card-head"><span>{String(index + 1).padStart(2, "0")}</span><span>{numberFormat.format(sport.events)} EVENTS</span></div><h3>{sport.sport}</h3><div className="analytics-bar-track"><span style={{ width: `${Math.max(4, sport.medalAwards / maxAwards * 100)}%` }} /></div><div className="analytics-sport-meta"><strong>{numberFormat.format(sport.medalAwards)} <small>MEDAL AWARDS</small></strong><span>{sport.countries} nations</span></div></article>)}</div></section>
      </>}
    </section>
    <footer className="analytics-footer"><Link className="brand utms-brand" href="/"><span className="brand-mark">U</span><span>UTMP<span className="brand-period">.</span></span></Link><span>DATA: PARIS 2024 OLYMPIC RESULTS</span><Link href="/sports">EXPLORE UTMP SPORTS ↗</Link></footer>
  </main>;
}
