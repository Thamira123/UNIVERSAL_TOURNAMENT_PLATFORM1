const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
type ClerkAuthBridge = { isLoaded: boolean; isSignedIn: boolean; getToken: () => Promise<string | null>; signOut: () => Promise<unknown> };
let clerkAuth: ClerkAuthBridge | null = null;
let sessionInvalidated = false;
let clerkIntegrationEnabled = false;

export function configureClerkIntegration(enabled: boolean) {
  clerkIntegrationEnabled = enabled;
  if (!enabled) {
    clerkAuth = null;
    sessionInvalidated = false;
  }
}

export function getAccessToken() {
  if (typeof window === "undefined" || !clerkIntegrationEnabled) return null;
  if (sessionInvalidated) return null;
  if (!clerkAuth || !clerkAuth.isLoaded) return "clerk-session-pending";
  return clerkAuth.isSignedIn ? "clerk-session" : null;
}

export function connectClerkAuth(auth: ClerkAuthBridge) {
  clerkAuth = auth;
  if (auth.isLoaded && auth.isSignedIn) sessionInvalidated = false;
}

export function clearAccessToken() {
  sessionInvalidated = true;
  void clerkAuth?.signOut();
  if (typeof window !== "undefined") window.dispatchEvent(new Event("utms:auth-change"));
}

async function getClerkSessionToken() {
  if (!clerkIntegrationEnabled) return null;
  if (clerkAuth?.isLoaded) return clerkAuth.isSignedIn ? clerkAuth.getToken() : null;
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener("utms:auth-change", checkReady);
      reject(new Error("Clerk could not initialize. Check your Clerk keys and connection."));
    }, 10000);
    const checkReady = () => {
      if (!clerkAuth?.isLoaded) return;
      window.clearTimeout(timeout);
      window.removeEventListener("utms:auth-change", checkReady);
      resolve();
    };
    window.addEventListener("utms:auth-change", checkReady);
    checkReady();
  });
  return clerkAuth?.isSignedIn ? clerkAuth.getToken() : null;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = await getClerkSessionToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}/api${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    throw new Error(`Cannot connect to the backend API at ${API_ORIGIN}. Start the backend with npm run dev:backend. If it exits at startup, start Neo4j and check the root .env connection settings.`);
  }
  const payload = await response.json().catch(() => ({})) as { message?: string | string[] };
  if (!response.ok) {
    const message = Array.isArray(payload.message) ? payload.message.join(" ") : payload.message;
    if (response.status === 401) clearAccessToken();
    throw new Error(message || `Request failed (${response.status}).`);
  }
  return payload as T;
}

export function jsonBody(value: unknown) {
  return JSON.stringify(value);
}

export async function getDashboardPath(createSport = "") {
  if (createSport === "cricket" || createSport === "high-jump") return `/profile?createSport=${createSport}`;
  try {
    const access = await api<{ user: { role?: string }; organizations: { id: string; role: string }[]; tournaments?: { id: string }[] }>("/auth/me");
    if (access.user.role === "ADMIN") return "/admin";
    const manageable = access.organizations.filter((organization) => ["OWNER", "ADMIN"].includes(organization.role.toUpperCase()));
    if (manageable.length === 1) return `/organizations/${manageable[0].id}`;
    if (manageable.length > 1) return "/profile";
    if (access.tournaments?.length === 1) return `/tournaments/${access.tournaments[0].id}`;
  } catch {
    // The profile page handles expired sessions and displays API errors.
  }
  return "/profile";
}
