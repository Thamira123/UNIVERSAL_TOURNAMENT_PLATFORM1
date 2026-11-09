"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell, ErrorMessage, LoadingPanel } from "@/components/app-shell";
import { api, getAccessToken } from "@/lib/api";
import { readTournamentTeams, writeTournamentTeams, type TournamentTeam } from "@/lib/tournament-local";

export default function TournamentTeamsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tournamentName, setTournamentName] = useState("");
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
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
    }).catch((cause: Error) => {
      if (!active) return;
      setError(cause.message);
      if (!getAccessToken()) router.replace("/login");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [id, router]);

  function addTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const form = event.currentTarget;
    const values = new FormData(form);
    const name = String(values.get("name") ?? "").trim();
    const shortCode = String(values.get("shortCode") ?? "").trim().toUpperCase();
    const manager = String(values.get("manager") ?? "").trim();
    if (!name) {
      setError("Enter a team name.");
      return;
    }
    const team: TournamentTeam = {
      id: crypto.randomUUID(),
      name,
      shortCode: shortCode || name.slice(0, 3).toUpperCase(),
      manager,
      createdAt: new Date().toISOString(),
    };
    const next = [team, ...teams];
    try {
      writeTournamentTeams(id, next);
      setTeams(next);
      form.reset();
      setNotice(`${name} added to this browser's tournament list.`);
    } catch {
      setError("This browser could not save the team.");
    }
  }

  function removeTeam(teamId: string) {
    const next = teams.filter((team) => team.id !== teamId);
    try {
      writeTournamentTeams(id, next);
      setTeams(next);
      setNotice("Team removed from this browser's tournament list.");
      setError("");
    } catch {
      setError("This browser could not update the team list.");
    }
  }

  return <AppShell title={tournamentName ? `${tournamentName} teams` : "Tournament teams"} subtitle="Build the team list for this tournament.">
    {loading ? <LoadingPanel message="Loading tournament teams..." /> : <>
      <div className="workspace-callout local-data-note"><strong>LOCAL PREVIEW</strong><span>Teams are saved in this browser only and are not sent to the tournament server.</span></div>
      {notice && <p className="create-success" role="status">{notice}</p>}
      <ErrorMessage>{error}</ErrorMessage>
      <form className="workspace-form team-form" onSubmit={addTeam}>
        <p className="eyebrow">NEW TEAM</p>
        <label>Team name<input name="name" required maxLength={70} placeholder="e.g. Riverside XI" /></label>
        <div className="team-form-row">
          <label>Short code<input name="shortCode" maxLength={5} placeholder="RSX" /></label>
          <label>Coach or contact<input name="manager" maxLength={80} placeholder="Optional" /></label>
        </div>
        <button className="workspace-primary" type="submit">Add team <span aria-hidden="true">＋</span></button>
      </form>
      <div className="workspace-section-title">
        <div><p className="eyebrow">ROSTER</p><h2>Teams</h2></div>
        <span className="profile-badge">{teams.length} TEAMS</span>
      </div>
      {teams.length ? <div className="team-list">
        {teams.map((team) => <article className="team-row" key={team.id}>
          <span className="team-mark" aria-hidden="true">{team.shortCode.slice(0, 3)}</span>
          <div className="team-details"><strong>{team.name}</strong><span>{team.manager || "No contact added"}</span></div>
          <time dateTime={team.createdAt}>{new Date(team.createdAt).toLocaleDateString()}</time>
          <button className="local-row-action" type="button" onClick={() => removeTeam(team.id)} aria-label={`Remove ${team.name}`}>Remove</button>
        </article>)}
      </div> : <div className="workspace-panel empty-organizations"><span className="empty-symbol" aria-hidden="true">T</span><h3>No teams added</h3><p>Create the first team to start building fixtures for this tournament.</p><Link className="quiet-link" href={`/tournaments/${id}/matches`}>Go to matches <span aria-hidden="true">→</span></Link></div>}
    </>}
  </AppShell>;
}