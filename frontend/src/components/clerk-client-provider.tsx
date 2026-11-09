"use client";

import { ClerkProvider, useAuth, useClerk } from "@clerk/nextjs";
import { createContext, useContext, useEffect } from "react";
import { configureClerkIntegration, connectClerkAuth } from "@/lib/api";

const ClerkConfigurationContext = createContext(false);

export function useClerkConfigured() {
  return useContext(ClerkConfigurationContext);
}

function ClerkApiBridge({ children }: Readonly<{ children: React.ReactNode }>) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();

  connectClerkAuth({ isLoaded, isSignedIn: Boolean(isSignedIn), getToken, signOut: () => signOut() });

  useEffect(() => {
    window.dispatchEvent(new Event("utms:auth-change"));
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    const signOutExpiredSession = () => { void signOut(); };
    window.addEventListener("utms:auth-expired", signOutExpiredSession);
    return () => window.removeEventListener("utms:auth-expired", signOutExpiredSession);
  }, [signOut]);

  return children;
}

export function ClerkClientProvider({ children, enabled }: Readonly<{ children: React.ReactNode; enabled: boolean }>) {
  configureClerkIntegration(enabled);
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!enabled || !publishableKey) return <ClerkConfigurationContext.Provider value={false}>{children}</ClerkConfigurationContext.Provider>;

  return <ClerkConfigurationContext.Provider value><ClerkProvider publishableKey={publishableKey} signInUrl="/login" signUpUrl="/signup">
    <ClerkApiBridge>{children}</ClerkApiBridge>
  </ClerkProvider></ClerkConfigurationContext.Provider>;
}
