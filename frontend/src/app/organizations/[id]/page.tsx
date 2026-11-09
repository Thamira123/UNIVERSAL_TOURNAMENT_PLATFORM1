"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppShell, ErrorMessage, LoadingPanel } from "@/components/app-shell";
import { api, getAccessToken, jsonBody } from "@/lib/api";

type OrganizationWorkspace = { organization: { id: string; name: string; description: string }; role: string; isPlatformAdmin: boolean; admins: { id: string; name: string; email: string; role: string }[]; tournaments: { id: string; name: string; status: string; startDate: string }[] };

export default function OrganizationPage() {
  const { id } = useParams<{ id: string }>(); const router = useRouter(); const [data, setData] = useState<OrganizationWorkspace | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const load = useCallback(() => api<OrganizationWorkspace>(`/organizations/${id}`).then(setData).catch((cause) => { setError(cause.message); if (!getAccessToken()) router.replace("/login"); }), [id, router]);
  useEffect(() => { if (!getAccessToken()) router.replace("/login"); else void load(); }, [load, router]);
  async function addAdmin(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); const form = event.currentTarget; const email = String(new FormData(form).get("email")); try { await api(`/organizations/${id}/admins`, { method: "POST", body: jsonBody({ email }) }); form.reset(); setNotice(`${email} is now an organization admin.`); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add admin."); } }
  const canManage = ["OWNER", "ADMIN"].includes(data?.role ?? "");
  const canCreateTournament = data?.isPlatformAdmin ?? false;
  const activeTournaments = data?.tournaments.filter((item) => ["UPCOMING", "ONGOING", "LIVE", "ACTIVE"].includes(item.status.toUpperCase())).length ?? 0;
  return <AppShell title={data?.organization.name ?? "Organization"} subtitle={data?.organization.description || "Manage your tournaments, team and organization access."}>
    {!data ? error ? <ErrorMessage>{error}</ErrorMessage> : <LoadingPanel /> : <div className="org-dashboard">
      <div className="org-dashboard-toolbar">
        <div className="org-role-banner"><span className="org-role-icon" aria-hidden="true">{data.organization.name.slice(0, 1).toUpperCase()}</span><span><strong>{data.role.toLowerCase()} access</strong><small>You can view this organization and its tournament workspace.</small></span></div>
        <Link className="org-back-link" href="/profile">← All workspaces</Link>
      </div>

      {notice && <p className="create-success" role="status">{notice}</p>}
      <ErrorMessage>{error}</ErrorMessage>

      <section className="org-metrics" aria-label="Organization overview">
        <article><span>TOURNAMENTS</span><strong>{data.tournaments.length.toString().padStart(2, "0")}</strong><small>In this organization</small></article>
        <article><span>ACTIVE</span><strong>{activeTournaments.toString().padStart(2, "0")}</strong><small>Upcoming or in progress</small></article>
        <article><span>ADMINS</span><strong>{data.admins.length.toString().padStart(2, "0")}</strong><small>With workspace access</small></article>
      </section>

      <section className="org-section">
        <div className="org-section-heading"><div><p className="eyebrow">ORGANIZATION WORKSPACE</p><h2>Tournaments</h2><p>Every competition created for {data.organization.name}.</p></div>{canCreateTournament && <Link className="workspace-primary" href={`/organizations/${id}/tournaments/new`}>Create tournament <span aria-hidden="true">＋</span></Link>}</div>
        {data.tournaments.length ? <div className="org-tournament-grid">{data.tournaments.map((tournament) => <Link className="org-tournament-card" href={`/tournaments/${tournament.id}`} key={tournament.id}>
          <div className="org-tournament-top"><span className="org-tournament-icon" aria-hidden="true">T</span><span className={`org-status org-status-${tournament.status.toLowerCase()}`}>{tournament.status.toLowerCase()}</span></div>
          <p className="panel-kicker">TOURNAMENT</p><h3>{tournament.name}</h3>
          <p className="org-tournament-date"><span aria-hidden="true">◷</span> Starts {tournament.startDate || "Date to be confirmed"}</p>
          <span className="org-card-action">Open tournament <b aria-hidden="true">↗</b></span>
        </Link>)}</div> : <div className="org-empty-state"><span className="org-empty-icon" aria-hidden="true">＋</span><div><h3>No tournaments yet</h3><p>Users can request a tournament from their workspace. A platform administrator will review it.</p></div>{canCreateTournament && <Link className="workspace-primary" href={`/organizations/${id}/tournaments/new`}>Create tournament <span aria-hidden="true">→</span></Link>}</div>}
      </section>

      <section className="org-section org-admin-section">
        <div className="org-section-heading"><div><p className="eyebrow">PEOPLE & PERMISSIONS</p><h2>Organization admins</h2><p>People who can help manage this organization.</p></div><span className="org-admin-count">{data.admins.length} {data.admins.length === 1 ? "ADMIN" : "ADMINS"}</span></div>
        <div className="org-admin-grid">{data.admins.map((admin) => <article className="org-admin-card" key={admin.id}><span className="org-admin-avatar">{admin.name.slice(0, 1).toUpperCase()}</span><span className="org-admin-copy"><strong>{admin.name}</strong><small>{admin.email}</small></span><span className={`org-admin-role org-admin-role-${admin.role.toLowerCase()}`}>{admin.role.toLowerCase()}</span></article>)}</div>
        {canManage && <form className="org-invite-form" onSubmit={addAdmin}><div><label htmlFor="organization-admin-email">Invite an organization admin</label><p>They need an existing UTMP account. Admins can create tournaments and manage access.</p></div><div className="org-invite-controls"><input id="organization-admin-email" name="email" type="email" required placeholder="name@example.com" /><button className="workspace-primary" type="submit">Add admin <span aria-hidden="true">＋</span></button></div></form>}
      </section>
    </div>}
  </AppShell>;
}
