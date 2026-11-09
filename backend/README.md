# Backend

NestJS REST API using the default Express platform adapter. Keep API modules and business logic here. Neo4j is accessed only from this server through the official Neo4j JavaScript driver.

Run from the repository root with `npm run dev:backend`. The API base path is `/api`.

## Public competition analytics

The `analytics` module adds public Paris 2024 Olympics data to the existing REST API and Neo4j database. It seeds `OlympicCountry`, `OlympicMedal`, and `OlympicEvent` records from `backend/data/olympics/` on the first analytics request. Unique constraints and `MERGE` make repeated imports safe. These labels are separate from UTMP users, organizations, tournaments, and sports.

- `GET /api/analytics/overview` — medal table nations, medal awards by nation and event, medal events, and sports.
- `GET /api/analytics/medals?limit=20` — medal table ordered by gold, silver, bronze, and country.
- `GET /api/analytics/sports` — medal awards, events, and nations represented by sport.

The public results explorer is available at `/analytics` and does not require an account. The bundled CSV files are the archive subset used by these endpoints; athlete rosters and schedules are not imported.

## Clerk authentication and account linking

Clerk owns sign-up, sign-in, email verification, sessions, and account profile UI. The Next.js app sends Clerk session JWTs as bearer tokens to this NestJS API; the backend verifies every protected request, fetches new Clerk user identity details, and keeps UTMP roles and organization/tournament permissions in Neo4j. No Clerk organization-role claims are trusted for UTMP business permissions.

Set `CLERK_SECRET_KEY` in the root `.env` for the NestJS API. Copy `frontend/.env.local.example` to `frontend/.env.local` and set both `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` there; Next.js reads its server environment from the frontend project directory for Clerk middleware. Keep the secret key unprefixed and private. Set `CLERK_AUTHORIZED_PARTIES` in the root `.env` to the exact frontend origins for local and deployed environments. Clerk Dashboard settings control email/password, email verification, Google, and other sign-in methods.

On the first authenticated API request, a verified primary Clerk email is linked to the existing UTMP account with the same email; the account ID, admin role, organization memberships, tournament permissions, and requests are preserved. Otherwise, a regular UTMP account is created. Existing account owners should register or sign in to Clerk with the same verified email to keep their UTMP workspace. Password hashes from the retired custom login are not used by Clerk; users who need to keep an existing account must complete Clerk sign-up with that email and set up their Clerk credentials. The old `/api/auth/signup` and `/api/auth/login` routes have been removed. Platform admin access still uses the existing server-side allowlist and invite-code check in the profile workspace.
