"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ErrorMessage, LoadingPanel } from "@/components/app-shell";
import { api, clearAccessToken, getAccessToken, jsonBody } from "@/lib/api";

type Organization = { id: string; name: string; role: string };
type Tournament = { id: string; name: string; role: string; organization?: string };
type RequestItem = { id: string; name: string; sportKey: string; organizationName: string; description: string; startDate: string; venue: string; status: string; adminNote?: string; tournament?: { id: string; name: string } | null };
type Profile = { user: { name: string; email: string; role: string }; organizations: Organization[]; tournaments?: Tournament[] };
type OrgFilter = "All workspaces" | "Owner" | "Admin";

const filters: OrgFilter[] = ["All workspaces", "Owner", "Admin"];

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OrgFilter>("All workspaces");
  const [createSport, setCreateSport] = useState("");
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [requestError, setRequestError] = useState("");
  const [requestNotice, setRequestNotice] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [claimError, setClaimError] = useState("");
  const [claimingAdmin, setClaimingAdmin] = useState(false);

  useEffect(() => {
    const requestedSport = new URLSearchParams(window.location.search).get("createSport");
    if (requestedSport === "cricket" || requestedSport === "high-jump") setCreateSport(requestedSport);
    if (!getAccessToken()) {
      router.replace(requestedSport === "cricket" || requestedSport === "high-jump" ? `/login?createSport=${requestedSport}` : "/login");
      return;
    }
    api<Profile>("/auth/me").then((profile) => {
      setData(profile);
      if (profile.user.role === "ADMIN") router.replace("/admin");
      return api<RequestItem[]>("/tournament-requests/mine").then(setRequests);
    }).catch((cause) => {
      setError(cause.message);
      if (!getAccessToken()) router.replace("/login");
    });
  }, [router]);

  const organizations = data?.organizations ?? [];
  const tournaments = data?.tournaments ?? [];
  const owned = organizations.filter((organization) => organization.role.toLowerCase() === "owner").length;
  const administered = organizations.filter((organization) => organization.role.toLowerCase() === "admin").length;
  const visibleOrganizations = useMemo(() => organizations.filter((organization) => {
    const matchesRole = filter === "All workspaces" || organization.role.toLowerCase() === filter.toLowerCase();
    return matchesRole && organization.name.toLowerCase().includes(query.trim().toLowerCase());
  }), [organizations, filter, query]);

  function signOut() {
    clearAccessToken();
    router.push("/login");
  }

  async function submitTournamentRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError("");
    setRequestNotice("");
    setRequesting(true);
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const request = await api<RequestItem>("/tournament-requests", { method: "POST", body: jsonBody({ name: values.get("name"), sportKey: values.get("sportKey"), organizationName: values.get("organizationName"), startDate: values.get("startDate"), venue: values.get("venue"), description: values.get("description") }) });
      setRequests((current) => [request, ...current]);
      form.reset();
      setRequestNotice("Your request has been sent to the UTMP administrators for review.");
    } catch (cause) {
      setRequestError(cause instanceof Error ? cause.message : "Could not submit your request.");
    } finally {
      setRequesting(false);
    }
  }

  async function claimAdminAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClaimError("");
    setClaimingAdmin(true);
    try {
      await api("/auth/claim-admin", { method: "POST", body: jsonBody({ adminCode }) });
      router.replace("/admin");
    } catch (cause) {
      setClaimError(cause instanceof Error ? cause.message : "Could not activate administrator access.");
    } finally {
      setClaimingAdmin(false);
    }
  }

  return <main className="profile-dashboard">
    <aside className="dashboard-sidebar">
      <Link className="dashboard-brand" href="/" aria-label="UTMP home"><span className="dashboard-brand-mark">U</span><span>UTMP<small>TOURNAMENT MANAGEMENT</small></span></Link>
      <div className="dashboard-user"><span className="dashboard-avatar">{data?.user.name.slice(0, 1).toUpperCase() ?? "U"}</span><div><small>YOUR WORKSPACE</small><strong>{data?.user.name ?? "Loading profile"}</strong><span>{data?.user.email ?? ""}</span></div></div>
      <nav className="dashboard-nav" aria-label="Dashboard navigation">
        <span className="dashboard-nav-label">WORKSPACE</span>
        <a className="dashboard-nav-active" href="#overview"><span aria-hidden="true">O</span> Overview</a>
        <a href="#organizations"><span aria-hidden="true">G</span> Organizations <b>{organizations.length}</b></a>
        <a href="#tournaments"><span aria-hidden="true">T</span> Tournaments <b>{tournaments.length}</b></a>
        <Link href="/sports"><span aria-hidden="true">S</span> Sports directory</Link>
        <Link href="/account"><span aria-hidden="true">A</span> Account settings</Link>
        <span className="dashboard-nav-label dashboard-nav-label-spaced">MANAGE</span>
        <a href="#requests"><span aria-hidden="true">+</span> Request tournament</a>
      </nav>
      <div className="dashboard-sidebar-bottom"><div className="dashboard-sidebar-note"><span>UTMP / 2026</span><p>Organize every competition in one place.</p></div><button type="button" onClick={signOut}><span aria-hidden="true">&gt;</span> Sign out</button></div>
    </aside>

    <section className="dashboard-main">
      <header className="dashboard-topbar"><div><span>UTMP</span><b>/</b><strong>Overview</strong></div><a className="dashboard-top-action" href="#requests"><span aria-hidden="true">+</span> Request tournament</a></header>
      <div className="dashboard-content" id="overview">
        <div className="dashboard-welcome"><div><p className="eyebrow">YOUR TOURNAMENT DESK</p><h1>Welcome back, <em>{data?.user.name.split(" ")[0] ?? "organizer"}.</em></h1><p>Your organizations, tournaments and requests in one place.</p></div><span className="dashboard-date">UTMP <i /> WORKSPACE</span></div>
        {!data ? error ? <ErrorMessage>{error}</ErrorMessage> : <div className="dashboard-loading"><LoadingPanel /></div> : <>
          {createSport && <section className="workspace-panel sport-org-picker dashboard-sport-picker"><div><p className="eyebrow">CREATE A {createSport === "cricket" ? "CRICKET TOURNAMENT" : "HIGH JUMP COMPETITION"}</p><h2>Request a tournament</h2><p>Complete the request form below. The selected sport is already filled in.</p></div><a className="workspace-primary" href="#requests">Go to request form <span>-&gt;</span></a></section>}

          <section className="dashboard-metrics" aria-label="Workspace summary">
            <article className="dashboard-metric dashboard-metric-primary"><span className="dashboard-metric-icon" aria-hidden="true">O</span><small>ORGANIZATIONS</small><strong>{organizations.length.toString().padStart(2, "0")}</strong><p>Workspaces you can access</p></article>
            <article className="dashboard-metric"><span className="dashboard-metric-icon" aria-hidden="true">+</span><small>OWNER ACCESS</small><strong>{owned.toString().padStart(2, "0")}</strong><p>Organizations you created</p></article>
            <article className="dashboard-metric"><span className="dashboard-metric-icon" aria-hidden="true">A</span><small>ADMIN ACCESS</small><strong>{administered.toString().padStart(2, "0")}</strong><p>Organizations you help run</p></article>
            <article className="dashboard-metric"><span className="dashboard-metric-icon" aria-hidden="true">T</span><small>TOURNAMENTS</small><strong>{tournaments.length.toString().padStart(2, "0")}</strong><p>Competitions assigned to you</p></article>
          </section>

          <section className="dashboard-section" id="organizations">
            <div className="dashboard-section-heading"><div><p className="eyebrow">YOUR WORKSPACES</p><h2>Organizations</h2><p>Organizations you own or have been invited to manage.</p></div></div>
            {organizations.length > 0 && <div className="dashboard-list-tools"><label className="dashboard-search"><span aria-hidden="true">?</span><input aria-label="Search organizations" placeholder="Search organizations" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="dashboard-filters" role="group" aria-label="Filter organizations by role">{filters.map((item) => <button type="button" key={item} className={filter === item ? "is-active" : ""} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div></div>}
            {organizations.length ? visibleOrganizations.length ? <div className="dashboard-org-grid">{visibleOrganizations.map((organization) => <Link className="dashboard-org-card" href={`/organizations/${organization.id}`} key={organization.id}><div className="dashboard-card-top"><span className="dashboard-org-mark">{organization.name.slice(0, 2).toUpperCase()}</span><span className={`dashboard-role dashboard-role-${organization.role.toLowerCase()}`}>{organization.role.toLowerCase()}</span></div><small>ORGANIZATION</small><strong>{organization.name}</strong><span className="dashboard-card-link">Open workspace <b aria-hidden="true">-&gt;</b></span></Link>)}</div> : <div className="dashboard-empty-inline">No organizations match your search. <button type="button" onClick={() => { setQuery(""); setFilter("All workspaces"); }}>Clear filters</button></div> : <div className="dashboard-empty"><span aria-hidden="true">O</span><div><h3>No organization workspaces yet</h3><p>When an administrator approves your tournament request, its workspace will appear here.</p></div><a href="#requests">Request a tournament <b aria-hidden="true">-&gt;</b></a></div>}
          </section>

          <section className="dashboard-section dashboard-tournaments" id="tournaments">
            <div className="dashboard-section-heading"><div><p className="eyebrow">COMPETITION ACCESS</p><h2>Tournaments</h2><p>Tournaments where you have been given access.</p></div></div>
            {tournaments.length ? <div className="dashboard-tournament-list">{tournaments.map((tournament) => <Link className="dashboard-tournament-row" href={`/tournaments/${tournament.id}`} key={tournament.id}><span className="dashboard-tournament-mark">T</span><span className="dashboard-tournament-info"><small>{tournament.organization || "TOURNAMENT WORKSPACE"}</small><strong>{tournament.name}</strong></span><span className="dashboard-role">{tournament.role.toLowerCase()}</span><span className="dashboard-row-action">Open <b aria-hidden="true">-&gt;</b></span></Link>)}</div> : <div className="dashboard-empty dashboard-empty-tournament"><span aria-hidden="true">T</span><div><h3>No tournament access yet</h3><p>Send a tournament request below. Approved competitions will appear here.</p></div></div>}
          </section>

          <section className="dashboard-section dashboard-requests" id="requests">
            <div className="dashboard-section-heading"><div><p className="eyebrow">TOURNAMENT SUBMISSIONS</p><h2>Request a tournament</h2><p>Tell us what you want to organize. A UTMP administrator will review it.</p></div></div>
            {requestNotice && <p className="dashboard-request-notice" role="status">{requestNotice}</p>}
            {requestError && <ErrorMessage>{requestError}</ErrorMessage>}
            <form className="dashboard-request-form" onSubmit={submitTournamentRequest}>
              <label>Tournament name<input name="name" required maxLength={120} placeholder="e.g. Colombo Schools Cricket Cup" /></label>
              <label>Sport<select name="sportKey" defaultValue={createSport || "cricket"}><option value="cricket">Cricket</option><option value="high-jump">High Jump</option></select></label>
              <label>Organization or club name<input name="organizationName" required maxLength={100} placeholder="School, club or organization" /></label>
              <label>Proposed start date<input name="startDate" type="date" required /></label>
              <label className="dashboard-request-wide">Venue (optional)<input name="venue" maxLength={160} placeholder="City or venue" /></label>
              <label className="dashboard-request-wide">Details (optional)<textarea name="description" maxLength={1000} rows={3} placeholder="Share the format, age group or other details for the review." /></label>
              <div className="dashboard-request-submit"><button className="workspace-primary" type="submit" disabled={requesting}>{requesting ? "Sending request..." : "Send for review"}<span aria-hidden="true">-&gt;</span></button><small>Only you and UTMP administrators can see this request.</small></div>
            </form>
            {requests.length > 0 && <div className="dashboard-request-list"><h3>Your requests</h3>{requests.map((request) => <article className="dashboard-request-row" key={request.id}><span className="dashboard-tournament-mark">{request.sportKey === "cricket" ? "C" : "H"}</span><span className="dashboard-tournament-info"><small>{request.organizationName} / {request.sportKey === "cricket" ? "CRICKET" : "HIGH JUMP"}</small><strong>{request.name}</strong><em>{request.adminNote || (request.status === "APPROVED" ? "Approved. Your tournament workspace is ready." : "")}</em></span><span className={`dashboard-request-status dashboard-request-status-${request.status.toLowerCase()}`}>{request.status.toLowerCase()}</span>{request.tournament && <Link className="dashboard-row-action" href={`/tournaments/${request.tournament.id}`}>View <b aria-hidden="true">-&gt;</b></Link>}</article>)}</div>}
          </section>

          <details className="dashboard-admin-setup"><summary>Administrator account setup</summary><p>Only an email address configured by the UTMP operator and the matching private setup code can activate platform administrator access.</p>{claimError && <ErrorMessage>{claimError}</ErrorMessage>}<form onSubmit={claimAdminAccess}><label>Private setup code<input type="password" value={adminCode} onChange={(event) => setAdminCode(event.target.value)} required autoComplete="off" /></label><button className="workspace-primary" type="submit" disabled={claimingAdmin}>{claimingAdmin ? "Checking..." : "Activate admin access"}</button></form></details>
        </>}
        <footer className="dashboard-footer"><span>UTMP / 2026</span><span>ORGANIZE / COMPETE / GROW</span><Link href="/">Visit UTMP home -&gt;</Link></footer>
      </div>
    </section>
  </main>;
}
