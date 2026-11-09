"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ErrorMessage, LoadingPanel } from "@/components/app-shell";
import { api, clearAccessToken, getAccessToken } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

type UserRecord = { id: string; name: string; email: string; role: string; createdAt?: unknown; organizationCount: number; requestCount: number };
type RequestRecord = { id: string; name: string; sportKey: string; organizationName: string; description: string; startDate: string; venue: string; status: string; adminNote?: string; createdAt?: unknown; user: { id: string; name: string; email: string }; tournament?: { id: string; name: string } | null };
type OrganizationRecord = { id: string; name: string; slug: string; tournamentCount: number };
type TournamentRecord = { id: string; name: string; sportKey?: string; status: string; startDate: string; venue?: string; organization?: { id: string; name: string } | null; eventCount: number };
type EditTarget = { kind: "organization" | "tournament"; id: string; label: string };

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [tournaments, setTournaments] = useState<TournamentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("UPCOMING");
  const [editStartDate, setEditStartDate] = useState("");
  const [editVenue, setEditVenue] = useState("");

  async function load() {
    setError("");
    try {
      const [allUsers, allRequests, allOrganizations, allTournaments] = await Promise.all([
        api<UserRecord[]>("/admin/users"),
        api<RequestRecord[]>("/admin/tournament-requests"),
        api<OrganizationRecord[]>("/admin/organizations"),
        api<TournamentRecord[]>("/admin/tournaments"),
      ]);
      setUsers(allUsers);
      setRequests(allRequests);
      setOrganizations(allOrganizations);
      setTournaments(allTournaments);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not load the admin workspace.";
      setError(message);
      if (!getAccessToken()) router.replace("/login");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (!getAccessToken()) router.replace("/login"); else void load(); }, [router]);

  async function reviewRequest(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      const result = await api<RequestRecord>(`/admin/tournament-requests/${id}/${action}`, {
        method: "PATCH",
        body: JSON.stringify(action === "reject" ? { adminNote: "This request was not approved. Please contact UTMP if you need more information." } : {}),
      });
      setRequests((current) => current.map((request) => request.id === id ? { ...request, ...result } : request));
      if (action === "approve") await load();
      setNotice(action === "approve" ? "Request approved and tournament workspace created." : "Request declined.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not review this request.");
    } finally {
      setBusyId("");
    }
  }

  function editOrganization(organization: OrganizationRecord) {
    setEditTarget({ kind: "organization", id: organization.id, label: organization.name });
    setEditName(organization.name);
  }

  function editTournament(tournament: TournamentRecord) {
    setEditTarget({ kind: "tournament", id: tournament.id, label: tournament.name });
    setEditName(tournament.name);
    setEditStatus(tournament.status.toUpperCase());
    setEditStartDate(tournament.startDate?.slice(0, 10) ?? "");
    setEditVenue(tournament.venue ?? "");
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTarget) return;
    setBusyId(`edit-${editTarget.id}`);
    setError("");
    setNotice("");
    try {
      if (editTarget.kind === "organization") {
        const updated = await api<OrganizationRecord>(`/admin/organizations/${editTarget.id}`, { method: "PATCH", body: JSON.stringify({ name: editName }) });
        setOrganizations((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
        setNotice("Organization updated.");
      } else {
        const updated = await api<Pick<TournamentRecord, "id" | "name" | "status" | "startDate" | "venue">>(`/admin/tournaments/${editTarget.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: editName, status: editStatus, startDate: editStartDate, venue: editVenue }),
        });
        setTournaments((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
        setNotice("Tournament updated.");
      }
      setEditTarget(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save changes.");
    } finally {
      setBusyId("");
    }
  }

  async function deleteOrganization(organization: OrganizationRecord) {
    if (organization.tournamentCount > 0) return;
    if (!window.confirm(`Delete organization “${organization.name}”? This cannot be undone.`)) return;
    setBusyId(`organization-${organization.id}`);
    setError("");
    setNotice("");
    try {
      await api(`/admin/organizations/${organization.id}`, { method: "DELETE" });
      setOrganizations((current) => current.filter((item) => item.id !== organization.id));
      setNotice("Organization deleted.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this organization.");
    } finally {
      setBusyId("");
    }
  }

  async function deleteTournament(tournament: TournamentRecord) {
    if (!window.confirm(`Permanently delete “${tournament.name}”, its events and stages? Linked requests will be marked cancelled.`)) return;
    setBusyId(`tournament-${tournament.id}`);
    setError("");
    setNotice("");
    try {
      await api(`/admin/tournaments/${tournament.id}`, { method: "DELETE" });
      setTournaments((current) => current.filter((item) => item.id !== tournament.id));
      setNotice("Tournament and its event structure deleted.");
      void load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this tournament.");
    } finally {
      setBusyId("");
    }
  }

  const pendingCount = requests.filter((request) => request.status === "PENDING").length;
  const adminCount = users.filter((user) => user.role === "ADMIN").length;

  function signOut() { clearAccessToken(); router.push("/login"); }

  return <main className="profile-dashboard platform-admin-dashboard">
    <aside className="dashboard-sidebar">
      <Link className="dashboard-brand" href="/" aria-label="UTMP home"><span className="dashboard-brand-mark">U</span><span>UTMP<small>PLATFORM ADMIN</small></span></Link>
      <div className="dashboard-user"><span className="dashboard-avatar">A</span><div><small>ADMIN WORKSPACE</small><strong>Platform administrator</strong><span>Full platform access</span></div></div>
      <nav className="dashboard-nav" aria-label="Admin navigation">
        <span className="dashboard-nav-label">PLATFORM</span>
        <a className="dashboard-nav-active" href="#overview"><span aria-hidden="true">O</span> Overview</a>
        <a href="#requests"><span aria-hidden="true">R</span> Requests <b>{pendingCount}</b></a>
        <a href="#organizations"><span aria-hidden="true">G</span> Organizations <b>{organizations.length}</b></a>
        <a href="#tournaments"><span aria-hidden="true">T</span> Tournaments <b>{tournaments.length}</b></a>
        <a href="#users"><span aria-hidden="true">U</span> Users <b>{users.length}</b></a>
        <Link href="/account"><span aria-hidden="true">A</span> Account settings</Link>
      </nav>
      <div className="dashboard-sidebar-bottom"><div className="dashboard-sidebar-note"><span>UTMP / ADMIN</span><p>Manage requests and competition workspaces.</p></div><button type="button" onClick={signOut}><span aria-hidden="true">&gt;</span> Sign out</button></div>
    </aside>

    <section className="dashboard-main">
      <header className="dashboard-topbar"><div><span>UTMP</span><b>/</b><strong>Platform administration</strong></div><a className="dashboard-top-action" href="#requests"><span aria-hidden="true">&#8595;</span> Review requests <b>{pendingCount}</b></a></header>
      <div className="dashboard-content" id="overview">
        <div className="dashboard-welcome"><div><p className="eyebrow">PLATFORM CONTROL CENTER</p><h1>Admin <em>overview.</em></h1><p>Review submissions, oversee workspaces, and manage UTMP accounts.</p></div><span className="dashboard-date">UTMP <i /> ADMIN</span></div>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        {notice && <p className="dashboard-request-notice" role="status">{notice}</p>}
        {loading ? <div className="dashboard-loading"><LoadingPanel /></div> : <div className="platform-admin">
          <section className="platform-admin-stats dashboard-metrics" aria-label="Platform summary">
            <article className="dashboard-metric dashboard-metric-primary"><small>REGISTERED USERS</small><strong>{users.length.toString().padStart(2, "0")}</strong><p>All UTMP accounts</p></article>
            <article className="dashboard-metric"><small>TOURNAMENT REQUESTS</small><strong>{requests.length.toString().padStart(2, "0")}</strong><p>{pendingCount} awaiting review</p></article>
            <article className="dashboard-metric"><small>PLATFORM ADMINS</small><strong>{adminCount.toString().padStart(2, "0")}</strong><p>Full platform access</p></article>
            <article className="dashboard-metric"><small>ORGANIZATIONS</small><strong>{organizations.length.toString().padStart(2, "0")}</strong><p>All workspaces</p></article>
            <article className="dashboard-metric"><small>TOURNAMENTS</small><strong>{tournaments.length.toString().padStart(2, "0")}</strong><p>All competitions</p></article>
          </section>

          <section className="platform-admin-section" id="requests">
            <div className="platform-admin-heading dashboard-section-heading"><div><p className="eyebrow">REVIEW QUEUE</p><h2>Tournament requests</h2><p>Approve a request to create its organization and tournament workspace.</p></div><span>{pendingCount} PENDING</span></div>
            {requests.length ? <div className="platform-request-list">{requests.map((request) => <article className="platform-request-card" key={request.id}>
              <div className="platform-request-main"><div className="platform-request-title"><span className="platform-request-sport">{request.sportKey === "cricket" ? "CR" : "HJ"}</span><div><small>{request.organizationName} / {request.sportKey === "cricket" ? "CRICKET" : "HIGH JUMP"}</small><h3>{request.name}</h3></div><span className={`dashboard-request-status dashboard-request-status-${request.status.toLowerCase()}`}>{request.status.toLowerCase()}</span></div>
                <div className="platform-request-details"><span>Requested by <strong>{request.user.name}</strong> <small>{request.user.email}</small></span><span>Start date <strong>{request.startDate}</strong></span>{request.venue && <span>Venue <strong>{request.venue}</strong></span>}</div>
                {request.description && <p className="platform-request-description">{request.description}</p>}
                {request.adminNote && <p className="platform-request-note">Admin note: {request.adminNote}</p>}
                {request.tournament && <p className="platform-request-created">Created tournament: {request.tournament.name}</p>}
              </div>
              {request.status === "PENDING" && <div className="platform-request-actions"><button type="button" disabled={Boolean(busyId)} onClick={() => void reviewRequest(request.id, "approve")}>{busyId === request.id ? "Working..." : "Approve and create"}</button><button type="button" className="platform-reject-button" disabled={Boolean(busyId)} onClick={() => void reviewRequest(request.id, "reject")}>Decline</button></div>}
            </article>)}</div> : <div className="dashboard-empty"><span>R</span><div><h3>No tournament requests yet</h3><p>New user submissions will appear here for review.</p></div></div>}
          </section>

          <section className="platform-admin-section" id="organizations">
            <div className="platform-admin-heading dashboard-section-heading"><div><p className="eyebrow">PLATFORM DIRECTORY</p><h2>Organizations</h2><p>Open any workspace to review its tournament setup.</p></div></div>
            <div className="platform-user-table-wrap"><table className="platform-user-table"><thead><tr><th>ORGANIZATION</th><th>TOURNAMENTS</th><th>OPEN</th><th>ADMIN ACTIONS</th></tr></thead><tbody>{organizations.map((organization) => <tr key={organization.id}><td><strong>{organization.name}</strong></td><td>{organization.tournamentCount}</td><td><a href={`/organizations/${organization.id}`}>Open workspace <span aria-hidden="true">&#8594;</span></a></td><td><div className="admin-directory-actions"><button type="button" className="admin-row-button" onClick={() => editOrganization(organization)}>Edit</button><button type="button" className="admin-row-button admin-row-danger" disabled={Boolean(busyId) || organization.tournamentCount > 0} title={organization.tournamentCount > 0 ? "Delete this organization's tournaments first." : "Delete organization"} onClick={() => void deleteOrganization(organization)}>{busyId === `organization-${organization.id}` ? "Deleting…" : "Delete"}</button></div></td></tr>)}</tbody></table></div>
          </section>

          <section className="platform-admin-section" id="tournaments">
            <div className="platform-admin-heading dashboard-section-heading"><div><p className="eyebrow">COMPETITION DIRECTORY</p><h2>Tournaments</h2><p>Review all competitions and open their management pages.</p></div></div>
            <div className="platform-user-table-wrap"><table className="platform-user-table"><thead><tr><th>TOURNAMENT</th><th>STATUS</th><th>EVENTS</th><th>OPEN</th><th>ADMIN ACTIONS</th></tr></thead><tbody>{tournaments.map((tournament) => <tr key={tournament.id}><td><strong>{tournament.name}</strong><small className="platform-directory-subline">{tournament.organization?.name || "No organization"}</small></td><td>{tournament.status.toLowerCase()}</td><td>{tournament.eventCount}</td><td><a href={`/tournaments/${tournament.id}`}>Open tournament <span aria-hidden="true">&#8594;</span></a></td><td><div className="admin-directory-actions"><button type="button" className="admin-row-button" onClick={() => editTournament(tournament)}>Edit</button><button type="button" className="admin-row-button admin-row-danger" disabled={Boolean(busyId)} onClick={() => void deleteTournament(tournament)}>{busyId === `tournament-${tournament.id}` ? "Deleting…" : "Delete"}</button></div></td></tr>)}</tbody></table></div>
          </section>

          <section className="platform-admin-section" id="users">
            <div className="platform-admin-heading dashboard-section-heading"><div><p className="eyebrow">ACCOUNT DIRECTORY</p><h2>Users</h2><p>Private account details visible to platform administrators.</p></div></div>
            <div className="platform-user-table-wrap"><table className="platform-user-table"><thead><tr><th>USER</th><th>EMAIL</th><th>ROLE</th><th>ORGANIZATIONS</th><th>REQUESTS</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.name}</strong></td><td>{user.email}</td><td><span className={`dashboard-role dashboard-role-${user.role.toLowerCase()}`}>{user.role.toLowerCase()}</span></td><td>{user.organizationCount}</td><td>{user.requestCount}</td></tr>)}</tbody></table></div>
          </section>
        </div>}
        {editTarget && <div className="admin-edit-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busyId) setEditTarget(null); }}><section className="admin-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-edit-title"><p className="eyebrow">PLATFORM ADMIN</p><h2 id="admin-edit-title">Edit {editTarget.kind}</h2><p>Update “{editTarget.label}”.</p><form className="admin-edit-form" onSubmit={saveEdit}><label>{editTarget.kind === "organization" ? "Organization name" : "Tournament name"}<input value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={editTarget.kind === "organization" ? 100 : 120} required /></label>{editTarget.kind === "tournament" && <><label>Status<select value={editStatus} onChange={(event) => setEditStatus(event.target.value)}><option value="UPCOMING">Upcoming</option><option value="ONGOING">Ongoing</option><option value="LIVE">Live</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></select></label><label>Start date<input type="date" value={editStartDate} onChange={(event) => setEditStartDate(event.target.value)} required /></label><label>Venue<input value={editVenue} onChange={(event) => setEditVenue(event.target.value)} maxLength={160} /></label></>}<div className="admin-edit-actions"><button type="button" className="admin-row-button" disabled={Boolean(busyId)} onClick={() => setEditTarget(null)}>Cancel</button><button type="submit" className="workspace-primary" disabled={Boolean(busyId)}>{busyId === `edit-${editTarget.id}` ? "Saving…" : "Save changes"}</button></div></form></section></div>}
        <footer className="dashboard-footer"><span>UTMP / PLATFORM ADMINISTRATION</span><span>REVIEW / ORGANIZE / MANAGE</span><Link href="/">Visit UTMP home <span aria-hidden="true">&#8594;</span></Link></footer>
      </div>
    </section>
  </main>;
}
