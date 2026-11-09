import Link from "next/link";

export function ClerkSetupNotice() {
  return <div className="clerk-setup-notice"><strong>Connect your Clerk application</strong><p>In Clerk, open <b>Configure → API keys</b> and copy both Development keys. Add the publishable key and secret key to <code>frontend/.env.local</code>. Also add the secret key to the project-root <code>.env</code> for the NestJS API. Remove any leading <code>#</code> from these entries, then restart both UTMP servers.</p><Link href="https://dashboard.clerk.com/" target="_blank" rel="noreferrer">Open Clerk Dashboard ↗</Link></div>;
}
