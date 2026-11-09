"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type SportEvent = { event: { id: string; name: string; category: string; description?: string; status: string }; tournament: { id: string; name: string; status: string; startDate?: string }; stages: { id: string; name: string; format: string; order: number }[] };
type SportResponse = { sport: { key: string; name: string }; events: SportEvent[] };
type SportTournament = { id: string; name: string; status: string; startDate?: string; endDate?: string; description?: string; format?: string; teamCount?: number; venue?: string; category?: string; gender?: string; ageGroup?: string; organization?: { id: string; name: string } | null; eventCount: number };

const sportGuides = {
  cricket: {
    name: "Cricket", kicker: "THE GAME, IN EVERY FORMAT", subtitle: "From the first ball to the final over. Follow competitions, discover formats, and build a tournament for your community.",
    image: "/images/cricket-card.webp", mark: "C",
    facts: [{ value: "11", label: "PLAYERS PER SIDE" }, { value: "3", label: "POPULAR FORMATS" }, { value: "1", label: "TEAM. TOGETHER." }],
    formats: [{ name: "T20", time: "20 overs", copy: "Fast-paced matches built for a packed day of competition." }, { name: "ODI", time: "50 overs", copy: "A longer format where innings management and momentum matter." }, { name: "Test", time: "Up to 5 days", copy: "The traditional multi-day format, made for endurance and strategy." }],
  },
  "high-jump": {
    name: "High Jump", kicker: "PRECISION. HEIGHT. HEART.", subtitle: "Every attempt counts. Explore the stages, understand the rules, and organize an individual high jump competition.",
    image: "/images/high-jump-card.webp", mark: "H",
    facts: [{ value: "1", label: "ATHLETE PER ATTEMPT" }, { value: "3", label: "ATTEMPTS PER HEIGHT" }, { value: "1", label: "WINNING CLEARANCE" }],
    formats: [{ name: "Qualification", time: "Progression round", copy: "Athletes attempt to clear the qualification height or earn a place in the final." }, { name: "Final", time: "Medal round", copy: "Athletes compete through increasing heights; the best valid clearance leads." }, { name: "Attempt order", time: "By clearance", copy: "Athletes may pass a height, but three consecutive failures end their competition." }],
  },
} as const;

export default function SportPage() {
  const params = useParams<{ sportKey: string }>();
  const sportKey = params.sportKey;
  const guide = sportGuides[sportKey as keyof typeof sportGuides];
  const [data, setData] = useState<SportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tournaments, setTournaments] = useState<SportTournament[]>([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(true);
  const [tournamentsError, setTournamentsError] = useState("");
  const [tournamentReload, setTournamentReload] = useState(0);
  const events = useMemo(() => data?.events ?? [], [data]);

  useEffect(() => {
    if (!guide) return;
    let active = true;
    api<SportResponse>(`/sports/${sportKey}`).then((result) => { if (active) setData(result); }).catch((reason: Error) => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sportKey, guide]);

  useEffect(() => {
    if (!guide) return;
    let active = true;
    setTournamentsLoading(true);
    setTournamentsError("");
    api<SportTournament[]>(`/sports/${sportKey}/tournaments`).then((result) => { if (active) setTournaments(result); }).catch((reason: Error) => { if (active) setTournamentsError(reason.message); }).finally(() => { if (active) setTournamentsLoading(false); });
    return () => { active = false; };
  }, [sportKey, guide, tournamentReload]);

  if (!guide) return <main className="sport-page"><div className="sport-not-found"><p className="sport-eyebrow">SPORT GUIDE</p><h1>This sport is not available yet.</h1><Link className="sport-action" href="/sports">Back to sports <span>{String.fromCodePoint(8599)}</span></Link></div></main>;

  const isCricket = sportKey === "cricket";
  const competitionName = (item: SportEvent) => item.tournament.name;

  return (
    <main className={`sport-page ${isCricket ? "sport-cricket" : "sport-high-jump"}`}>
      <div className="sport-topline"><Link href="/">UTMP<span>.</span></Link><div><Link href="/sports">SPORTS</Link><span>/</span><strong>{guide.name.toUpperCase()}</strong></div><Link className="sport-top-cta" href={`/profile?createSport=${sportKey}`}>＋ Create Tournament <span>{String.fromCodePoint(8599)}</span></Link></div>
      <section className="sport-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(12,18,13,.82) 0%, rgba(12,18,13,.54) 47%, rgba(12,18,13,.12) 100%), linear-gradient(0deg, rgba(12,18,13,.42), transparent 45%), url(${guide.image})` }}>
        <div className="sport-hero-content"><div className="sport-eyebrow"><span /> UTMP SPORT GUIDE · 2026</div><p className="sport-hero-kicker">{guide.kicker}</p><h1>{guide.name}<span>.</span></h1><p className="sport-hero-intro">{guide.subtitle}</p><div className="sport-hero-actions"><a href="#competitions" className="sport-action">Explore competitions <span>{String.fromCodePoint(8599)}</span></a><a href="#formats" className="sport-text-link">Learn the formats <span>{String.fromCodePoint(8599)}</span></a></div></div>
        <div className="sport-hero-side"><span>01 / 02</span><strong>{guide.mark}</strong><small>ONE SPORT.<br />MANY STORIES.</small></div>
        <div className="sport-hero-caption"><span>UTMP FIELD NOTES</span><span>COMPETE · CONNECT · CELEBRATE</span></div>
      </section>
      <div className="sport-subnav"><div><a className="sport-subnav-active" href="#overview">Overview</a><a href="#tournaments">Tournaments <span>{tournaments.length.toString().padStart(2, "0")}</span></a><a href="#competitions">Events <span>{events.length.toString().padStart(2, "0")}</span></a><a href="#formats">Formats & rules</a></div><span>DISCOVER YOUR SPORT <b>{String.fromCodePoint(8595)}</b></span></div>
      <section className="sport-facts" id="overview">{guide.facts.map((fact) => <div key={fact.label}><strong>{fact.value}</strong><span>{fact.label}</span></div>)}<p>THE DETAILS MAKE<br />THE DIFFERENCE <i>{String.fromCodePoint(10036)}</i></p></section>
      <section className="sport-tournament-section" id="tournaments">
        <div className="sport-tournament-heading"><div><p className="sport-eyebrow">YOUR SPORT · YOUR COMPETITION</p><h2>{guide.name} {isCricket ? "Tournaments" : "Competitions"}</h2><p>Explore tournaments created for {guide.name} and start one for your organization.</p></div><Link className="sport-action" href={`/profile?createSport=${sportKey}`}>＋ Create Tournament <span>{String.fromCodePoint(8599)}</span></Link></div>
        {tournamentsLoading ? <div className="sport-tournament-state" role="status"><span className="sport-spinner" /> Loading {guide.name} tournaments…</div> : tournamentsError ? <div className="sport-tournament-state sport-tournament-error" role="alert"><strong>Could not load tournaments.</strong><span>{tournamentsError}</span><button className="sport-outline-button" onClick={() => setTournamentReload((value) => value + 1)}>Try again ↻</button></div> : tournaments.length ? <div className="sport-tournament-grid">{tournaments.map((tournament) => <article className="sport-tournament-card" key={tournament.id}><div className="sport-tournament-card-top"><span className={`sport-status-pill sport-status-${tournament.status.toLowerCase()}`}>{tournament.status}</span><span>{isCricket ? "🏏" : "↗"}</span></div><span className="sport-tournament-org">{tournament.organization?.name || "UTMP organizer"}</span><h3>{tournament.name}</h3><p>{tournament.description || `${guide.name} competition managed in UTMP.`}</p><div className="sport-tournament-meta"><span><small>DATE</small>{tournament.startDate || "To be announced"}{tournament.endDate ? ` – ${tournament.endDate}` : ""}</span><span><small>{isCricket ? "FORMAT" : "CATEGORY"}</small>{isCricket ? tournament.format || "Cricket" : [tournament.gender, tournament.ageGroup, tournament.category].filter(Boolean).join(" · ") || "Open competition"}</span><span><small>{isCricket ? "TEAMS" : "EVENTS"}</small>{isCricket ? tournament.teamCount || "TBD" : tournament.eventCount}</span></div><div className="sport-tournament-card-bottom"><span>{tournament.venue || "Venue to be announced"}</span><Link href={`/tournaments/${tournament.id}`}>View details <span>↗</span></Link></div></article>)}</div> : <div className="sport-empty sport-empty-large sport-tournament-empty"><span className="sport-empty-symbol">{guide.mark}</span><p className="sport-eyebrow">START YOUR FIRST COMPETITION</p><h3>No tournaments yet</h3><p>Create your first {guide.name} {isCricket ? "tournament" : "competition"} to get started.</p><Link className="sport-action" href={`/profile?createSport=${sportKey}`}>＋ Create Tournament <span>{String.fromCodePoint(8599)}</span></Link></div>}
      </section>
      <section className="sport-content-wrap" id="competitions">
        <div className="sport-main-column"><div className="sport-section-heading"><div><p className="sport-eyebrow">THE UTMP FIELD GUIDE</p><h2>Competition <em>centre.</em></h2><p>Events and tournaments created by the UTMP community.</p></div><span className="sport-count">{events.length.toString().padStart(2, "0")} EVENTS</span></div>
          <div className="sport-score-ribbon"><span className="sport-score-dot"/><div><strong>Live centre</strong><small>Real-time scores will appear here when live scoring is available.</small></div><span className="sport-ribbon-state">{events.some((item) => item.event.status === "LIVE") ? "LIVE" : "NO LIVE FIXTURES"}</span></div>
          {loading ? <div className="sport-empty"><span className="sport-spinner"/><p>Loading {guide.name} competitions…</p></div> : error ? <div className="sport-empty"><strong>Could not load competitions.</strong><p>{error}</p><button className="sport-outline-button" onClick={() => window.location.reload()}>Try again &#8635;</button></div> : events.length ? <div className="sport-event-list">{events.map((item, index) => <Link className="sport-event-card" href={`/tournaments/${item.tournament.id}`} key={item.event.id}><span className="sport-event-index">{String(index + 1).padStart(2, "0")}</span><span className="sport-event-mark">{isCricket ? "CR" : "HJ"}</span><span className="sport-event-info"><small>{item.event.category || guide.name.toUpperCase()} · {item.tournament.status}</small><strong>{item.event.name}</strong><span>{competitionName(item)}{item.tournament.startDate ? ` · ${item.tournament.startDate}` : ""}</span>{item.stages.length > 0 && <span className="sport-stage-tags">{item.stages.map((stage) => <i key={stage.id}>{stage.name}</i>)}</span>}</span><span className="sport-event-arrow">{String.fromCodePoint(8599)}</span></Link>)}</div> : <div className="sport-empty sport-empty-large"><span className="sport-empty-symbol">{guide.mark}</span><p className="sport-eyebrow">THE NEXT CHAPTER STARTS HERE</p><h3>No {guide.name} competitions yet.</h3><p>Create a tournament, add your first event, and bring your teams or athletes together.</p><Link className="sport-action" href="/signup">Create a tournament <span>{String.fromCodePoint(8599)}</span></Link></div>}
          <div className="sport-results" id="results"><div><p className="sport-eyebrow">RESULTS & STANDINGS</p><h3>Every result tells a story.</h3><p>Competition results and standings will be listed here as organizers add scoring.</p></div><span className="sport-results-icon">01—8</span></div>
        </div>
        <aside className="sport-side-column"><div className="sport-side-card sport-side-dark"><p className="sport-eyebrow">YOUR TURN TO PLAY</p><h3>Make the<br /><em>next fixture.</em></h3><p>Set up a tournament, choose your event format, and invite your community.</p><Link href="/signup">Start organizing <span>{String.fromCodePoint(8599)}</span></Link><div className="sport-side-watermark">{guide.mark}</div></div><div className="sport-side-card sport-side-formats" id="formats"><p className="sport-eyebrow">KNOW THE GAME</p><h3>{guide.name} formats.</h3><p>Choose a competition style that fits your event.</p>{guide.formats.map((format, index) => <div className="sport-format-row" key={format.name}><span>0{index + 1}</span><div><strong>{format.name}</strong><small>{format.time}</small><p>{format.copy}</p></div></div>)}<Link href="/signup" className="sport-side-link">Set up an event <span>{String.fromCodePoint(8599)}</span></Link></div></aside>
      </section>
      <section className="sport-bottom-banner"><span className="sport-eyebrow">EVERY COMMUNITY HAS A HOME FIELD</span><h2>Bring your people<br />to <em>the game.</em></h2><Link className="sport-action" href="/signup">Build your tournament <span>{String.fromCodePoint(8599)}</span></Link></section>
      <footer className="sport-footer"><Link href="/">UTMP<span>.</span></Link><span>BUILT FOR EVERY KIND OF COMPETITION</span><Link href="/sports">ALL SPORTS &#8599;</Link></footer>
    </main>
  );
}
