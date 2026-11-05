# TallyLink

Read-only desktop reporting workspace for Tally ERP and TallyPrime.

## Development

```sh
npm install
npm run dev
```

## Supabase sign-in

Use your existing Supabase project. Copy `.env.example` to `.env.local` in the project root and set the project's URL and **publishable** key:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Restart TallyLink after changing `.env.local`. The publishable key is intended for client apps; do not put a Supabase secret or service-role key in this file.

Apply [`supabase/migrations/202611050001_profiles.sql`](supabase/migrations/202611050001_profiles.sql) in the existing project's Supabase SQL Editor. It creates a `profiles` table with row-level security and copies each new signup's name, mobile number, and business name from Auth metadata. Email and password are managed by Supabase Auth. Email confirmation follows the setting in the Supabase project's Auth settings.

## GitHub Releases auto-update

Set the `build.publish` owner and repo in `package.json` before publishing. Create a GitHub personal access token with permission to create releases and set `GH_TOKEN` in the release environment, then run:

```sh
npm run release
```

The packaged app checks GitHub Releases on startup, downloads updates automatically, and installs them when the user exits. Updates only work in packaged builds. Publish signed Windows installers for customer distribution; unsigned builds may trigger Windows SmartScreen.
