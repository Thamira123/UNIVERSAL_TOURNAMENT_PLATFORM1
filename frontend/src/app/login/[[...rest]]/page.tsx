"use client";

import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ClerkSetupNotice } from "@/components/clerk-setup-notice";
import { useClerkConfigured } from "@/components/clerk-client-provider";

function SignInCard() {
  const clerkConfigured = useClerkConfigured();
  const query = useSearchParams().get("createSport");
  const sport = query === "cricket" || query === "high-jump" ? query : "";
  const destination = `/auth/callback${sport ? `?createSport=${sport}` : ""}`;

  if (!clerkConfigured) return <ClerkSetupNotice />;

  return <SignIn
    path="/login"
    routing="path"
    signUpUrl={sport ? `/signup?createSport=${sport}` : "/signup"}
    fallbackRedirectUrl={destination}
    signUpFallbackRedirectUrl={destination}
    appearance={{ variables: { colorPrimary: "#315844", borderRadius: "4px" }, elements: { card: "clerk-auth-card", headerTitle: "clerk-auth-title" } }}
  />;
}

export default function LoginPage() {
  return <main className="auth-page"><section className="auth-story"><Link className="brand" href="/"><span className="brand-mark">U</span><span>UTMP<span className="brand-period">.</span></span></Link><div><p className="eyebrow">WELCOME BACK</p><h1>The game<br /><em>goes on.</em></h1><p>Your organizations and tournaments are waiting in your workspace.</p></div><span className="auth-story-foot">COMPETE · CONNECT · CELEBRATE</span></section><section className="auth-form-side"><div className="auth-form clerk-auth-frame"><p className="eyebrow">SECURE SIGN IN</p><h2>Good to see you.</h2><p className="auth-intro">Continue securely with your UTMP account.</p><Suspense fallback={<div className="clerk-auth-loading">Loading secure sign-in…</div>}><SignInCard /></Suspense></div></section></main>;
}
