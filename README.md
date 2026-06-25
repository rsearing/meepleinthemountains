# Board Games with Rob Events

Private event-management site for Board Games with Rob retreats, including Meeple in the Mountains.

## Stack
- Next.js App Router
- Supabase Auth, Postgres, Storage
- Vercel
- GitHub

## Local Setup
1. Install Node.js and npm.
2. Copy `.env.example` to `.env.local`.
3. Fill in Supabase values.
4. Run each SQL file in `supabase/migrations` in numeric order against your Supabase project.
5. Install dependencies with `npm install`.
6. Start the app with `npm run dev`.

## Required Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`

Never commit real secrets.
