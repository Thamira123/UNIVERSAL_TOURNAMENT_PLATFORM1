"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAccessToken } from "@/lib/api";

export function AppShell({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const tournamentId = pathname.match(/^\/tournaments\/([^/]+)/)?.[1];

  function signOut() {
    clearAccessToken();
    router.push("/login");
  }

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <Link className="brand workspace-brand" href="/" aria-label="UTMP home">
          <span className="brand-mark">U</span><span>UTMP<span className="brand-period">.</span><small>TOURNAMENT MANAGEMENT</small></span>
        </Link>
        <nav aria-label="Workspace navigation">
          <Link aria-current={pathname === "/sports" || pathname.startsWith("/sports/") ? "page" : undefined} href="/sports">Sports</Link>
          <Link aria-current={pathname === "/profile" ? "page" : undefined} href="/profile">My profile</Link>
          <Link aria-current={pathname === "/account" ? "page" : undefined} href="/account">Account settings</Link>
          <Link className="workspace-nav-secondary" aria-current={pathname === "/organizations/new" ? "page" : undefined} href="/organizations/new">New organization</Link>
          <button onClick={signOut} type="button">Sign out <span aria-hidden="true">↗</span></button>
        </nav>
      </header>
      {tournamentId && <nav className="tournament-tools-nav" aria-label="Tournament tools">
        <Link aria-current={pathname === `/tournaments/${tournamentId}` ? "page" : undefined} href={`/tournaments/${tournamentId}`}>Overview</Link>
        <Link aria-current={pathname === `/tournaments/${tournamentId}/teams` ? "page" : undefined} href={`/tournaments/${tournamentId}/teams`}>Teams</Link>
        <Link aria-current={pathname === `/tournaments/${tournamentId}/matches` ? "page" : undefined} href={`/tournaments/${tournamentId}/matches`}>Matches</Link>
      </nav>}
      <section className="workspace-content">
        <div className="workspace-heading">
          <p className="eyebrow">UTMP <span aria-hidden="true">/</span> TOURNAMENT WORKSPACE</p>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {children}
      </section>
      <footer className="workspace-footer"><span>UNIVERSAL TOURNAMENT MANAGEMENT PLATFORM · 2026</span><Link href="/">Back to UTMP home <span aria-hidden="true">↑</span></Link></footer>
    </main>
  );
}

export function LoadingPanel({ message = "Loading your workspace..." }: { message?: string }) {
  return <div className="workspace-panel loading-panel" role="status" aria-live="polite"><span className="loading-dot" />{message}</div>;
}

export function ErrorMessage({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="form-error" role="alert">{children}</p>;
}
