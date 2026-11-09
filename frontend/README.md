# Frontend

Next.js App Router application. Keep pages, layouts, reusable UI, and browser-side API clients here. Use `NEXT_PUBLIC_API_URL` for the public API origin; never put database credentials in this workspace.

Run from the repository root with `npm run dev:frontend`.

The homepage currently uses sample tournament, score, and story data in src/app/page.tsx; its sport filters, search, calendar layout toggle, mobile menu, and event detail dialog are interactive previews.

For Clerk, copy `.env.local.example` to `.env.local` in this folder and set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` to your Clerk application's publishable key. Keep `CLERK_SECRET_KEY` in the repository-root `.env` only; the backend uses it to verify sessions and read Clerk user records.
