"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell, ErrorMessage, LoadingPanel } from "@/components/app-shell";
import { api, getAccessToken } from "@/lib/api";
import {
  readTournamentMatches,
  readTournamentTeams,
  writeTournamentMatches,
  type TournamentMatch,
  type TournamentTeam,
} from "@/lib/tournament-local";

export default function TournamentMatchesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tournamentName, setTournamentName] = useState("");
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    if (!getAccessToken()) {
      router.replace("/login");
      return () => { active = false; };
    }
    api<{ tournament: { name: string } }>(`/tournaments/${id}`).then((result) => {
      if (!active) return;
      setTournamentName(result.tournament.name);
      setTeams(readTournamentTeams(id));
      setMatches(readTournamentMatches(id).sort((left, right) => left.startsAt.localeCompare(right.startsAt)));
    }).catch((cause: Error) => {
      if (!active) return;
      setError(cause.message);
      if (!getAccessToken()) router.replace("/login");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [id, router]);

  function addMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const form = event.currentTarget;
    const values = new FormData(form);
    const homeTeamId = String(values.get("homeTeamId") ?? "");
    const awayTeamId = String(values.get("awayTeamId") ?? "");
    const homeTeam = teams.find((team) => team.id === homeTeamId);
    const awayTeam = teams.find((team) => team.id === awayTeamId);
    if (!homeTeam || !awayTeam || homeTeam.id === awayTeam.id) {
      setError("Choose two different teams.");
      return;
    }
    const match: TournamentMatch = {
      id: crypto.randomUUID(),
      homeTeamId: homeTeam.id,
      homeTeamName: homeTeam.name,
      awayTeamId: awayTeam.id,
      awayTeamName: awayTeam.name,
      startsAt: String(values.get("startsAt") ?? ""),
      venue: String(values.get("venue") ?? "").trim(),
      homeScore: null,
      awayScore: null,
    };
    const next = [...matches, match].sort((left, right) => left.startsAt.localeCompare(right.startsAt));
    try {
      writeTournamentMatches(id, next);
      setMatches(next);
      form.reset();
      setNotice("Fixture saved in this browser.");
    } catch {
      setError("This browser could not save the fixture.");
    }
  }

  function saveResult(event: FormEvent<HTMLFormElement>, matchId: string) {
    event.preventDefault();
    setError("");
    const values = new FormData(event.currentTarget);
    const homeScore = Number(values.get("homeScore"));
    const awayScore = Number(values.get("awayScore"));
    if (!Number.isInteger(homeScore) || homeScore < 0 || !Number.isInteger(awayScore) || awayScore < 0) {
      setError("Enter a whole number of zero or higher for each score.");
      return;
    }
    const next = matches.map((match) => match.id === matchId ? { ...match, homeScore, awayScore } : match);
    try {
      writeTournamentMatches(id, next);
      setMatches(next);
      setNotice("Result saved in this browser.");
    } catch {
      setError("This browser could not save the result.");
    }
  }

  function removeMatch(matchId: string) {
    const next = matches.filter((match) => match.id !== matchId);
    try {
      writeTournamentMatches(id, next);
      setMatches(next);
      setNotice("Fixture removed from this browser.");
      setError("");
    } catch {
      setError("This browser could not update the fixture list.");
    }
  }

  return <AppShell title={tournamentName ? `${tournamentName} matches` : "Tournament matches"} subtitle="Schedule fixtures and record results.">
    {loading ? <LoadingPanel message="Loading tournament matches..." /> : <>
      <div className="workspace-callout local-data-note"><strong>LOCAL PREVIEW</strong><span>Fixtures and results are saved in this browser only and are not sent to the tournament server.</span></div>
      {notice && <p className="create-success" role="status">{notice}</p>}
      <ErrorMessage>{error}</ErrorMessage>
      {teams.length < 2 ? <div className="workspace-panel empty-organizations"><span className="empty-symbol" aria-hidden="true">M</span><h3>Add teams before scheduling</h3><p>A fixture needs two different teams in this tournament.</p><Link className="workspace-primary" href={`/tournaments/${id}/teams`}>Manage teams <span aria-hidden="true">→</span></Link></div> : <form className="workspace-form match-form" onSubmit={addMatch}>
        <p className="eyebrow">NEW FIXTURE</p>
        <div className="match-form-teams">
          <label>Home team<select name="homeTeamId" required defaultValue=""><option value="" disabled>Select a team</option>{teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>
          <span aria-hidden="true">VS</span>
          <label>Away team<select name="awayTeamId" required defaultValue=""><option value="" disabled>Select a team</option>{teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>
        </div>
        <div className="team-form-row">
          <label>Date and time<input name="startsAt" type="datetime-local" required /></label>
          <label>Venue<input name="venue" maxLength={100} placeholder="Optional" /></label>
        </div>
        <button className="workspace-primary" type="submit">Add fixture <span aria-hidden="true">＋</span></button>
      </form>}
      <div className="workspace-section-title">
        <div><p className="eyebrow">SCHEDULE</p><h2>Matches</h2></div>
        <span className="profile-badge">{matches.length} FIXTURES</span>
      </div>
      {matches.length ? <div className="match-list">
        {matches.map((match) => <article className="match-row" key={match.id}>
          <div className="match-row-heading">
            <div className="match-date"><span>{match.homeScore === null ? "FIXTURE" : "FINAL"}</span><time dateTime={match.startsAt}>{new Date(match.startsAt).toLocaleString()}</time></div>
            <div className="match-pair"><strong>{match.homeTeamName}</strong><span>{match.homeScore === null ? "VS" : `${match.homeScore} - ${match.awayScore}`}</span><strong>{match.awayTeamName}</strong></div>
            <button className="local-row-action" type="button" onClick={() => removeMatch(match.id)} aria-label={`Remove ${match.homeTeamName} versus ${match.awayTeamName}`}>Remove</button>
          </div>
          <div className="match-row-footer">
            <span>{match.venue || "Venue not set"}</span>
            <form className="match-result-form" onSubmit={(event) => saveResult(event, match.id)}>
              <label>{match.homeTeamName} score<input name="homeScore" type="number" min="0" max="999" required defaultValue={match.homeScore ?? ""} /></label>
              <label>{match.awayTeamName} score<input name="awayScore" type="number" min="0" max="999" required defaultValue={match.awayScore ?? ""} /></label>
              <button className="local-row-action" type="submit">Save result</button>
            </form>
          </div>
        </article>)}
      </div> : teams.length >= 2 ? <div className="workspace-panel empty-organizations"><span className="empty-symbol" aria-hidden="true">M</span><h3>No fixtures scheduled</h3><p>Choose two teams, then set the date and venue for their match.</p></div> : null}
    </>}
  </AppShell>;
}