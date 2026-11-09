"use client";

import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ClerkSetupNotice } from "@/components/clerk-setup-notice";
import { useClerkConfigured } from "@/components/clerk-client-provider";

function SignUpCard() {
  const clerkConfigured = useClerkConfigured();
  const query = useSearchParams().get("createSport");
  const sport = query === "cricket" || query === "high-jump" ? query : "";
  const destination = `/auth/callback${sport ? `?createSport=${sport}` : ""}`;

  if (!clerkConfigured) return <ClerkSetupNotice />;

  return <SignUp
    path="/signup"
    routing="path"
    signInUrl={sport ? `/login?createSport=${sport}` : "/login"}
    fallbackRedirectUrl={destination}
    signInFallbackRedirectUrl={destination}
    appearance={{ variables: { colorPrimary: "#315844", borderRadius: "4px" }, elements: { card: "clerk-auth-card", headerTitle: "clerk-auth-title" } }}
  />;
}

export default function SignupPage() {
  return <main className="auth-page"><section className="auth-story"><Link className="brand" href="/"><span className="brand-mark">U</span><span>UTMP<span className="brand-period">.</span></span></Link><div><p className="eyebrow">YOUR GAME STARTS HERE</p><h1>Find your<br /><em>place in sport.</em></h1><p>Create your profile, request a tournament and follow its review from your personal dashboard.</p></div><span className="auth-story-foot">COMPETE · CONNECT · CELEBRATE</span></section><section className="auth-form-side"><div className="auth-form clerk-auth-frame"><p className="eyebrow">CREATE YOUR PROFILE</p><h2>Join UTMP.</h2><p className="auth-intro">Secure account setup, email verification and profile management are provided by Clerk.</p><Suspense fallback={<div className="clerk-auth-loading">Loading secure registration…</div>}><SignUpCard /></Suspense></div></section></main>;
}
