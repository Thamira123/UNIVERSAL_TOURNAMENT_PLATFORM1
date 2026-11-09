"use client";

import { UserProfile } from "@clerk/nextjs";
import Link from "next/link";
import { ClerkSetupNotice } from "@/components/clerk-setup-notice";
import { useClerkConfigured } from "@/components/clerk-client-provider";

export default function AccountPage() {
  const clerkConfigured = useClerkConfigured();
  return <main className="account-page"><header className="account-page-header"><Link className="brand utms-brand" href="/"><span className="brand-mark">U</span><span>UTMP<span className="brand-period">.</span></span></Link><Link href="/profile">Back to workspace <span aria-hidden="true">↗</span></Link></header><section className="account-page-content"><p className="eyebrow">SECURE ACCOUNT SETTINGS</p><h1>Manage your <em>account.</em></h1><p className="auth-intro">Update your verified email, password, sign-in methods and active sessions.</p>{clerkConfigured ? <UserProfile path="/account" routing="path" appearance={{ variables: { colorPrimary: "#315844", borderRadius: "4px" }, elements: { rootBox: "clerk-profile-frame", cardBox: "clerk-profile-card" } }} /> : <ClerkSetupNotice />}</section></main>;
}
