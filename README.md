# rabrate

Post anything. Rate everything. A community where every post is rated **−5 to +10**.

Next.js 16 · React 19 · Tailwind · TypeScript · Supabase

---

## Run it

```bash
npm install
cp .env.example .env.local     # then add your Supabase URL and anon key
npm run dev                    # http://localhost:3000
```

The two values live in your Supabase dashboard under **Project Settings → API**.
The anon key is safe to ship — it only grants what Row Level Security allows.
Never put the `service_role` key here.

If the variables are missing the app shows a setup screen explaining what to add,
rather than an empty feed.

| Script | Does |
| --- | --- |
| `npm run dev` | dev server on :3000 |
| `npm run build` | production build |
| `npm start` | serve the build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run brand` | regenerate the logo from code |

---

## What it does

- **Rating** — a −5 to +10 scale, not five stars. One tap on −5 / 0 / +10 saves
  immediately; the slider commits any value in between. Re-rating updates your
  single existing row. Average, count and distribution are computed in the
  database, so they agree for everyone.
- **Posts** — title, body, category, optional link and image. Images can be taken
  with the camera (native app on a phone, live preview on desktop) or uploaded
  from a file, straight to Supabase Storage.
- **Discovery** — Home with four real sections (Trending, Top rated, Recently
  added, Most debated), Explore with category and sort, Trending, Leaderboard.
- **Comments**, **profiles** with stats, **settings** (profile, avatar, theme,
  account deletion), **moderation** (report queue, suspend), **rules**.
- **Theme** — dark and light variants of the same orange system, plus "follow the
  device". Applied before first paint, so there is no flash.

Sections are named after the sort that produced them. Nothing is presented as
"recommended for you" when it is really just the newest posts.

---

## Design system

All colour lives in `src/app/globals.css` as semantic custom properties
(`--bg`, `--surface`, `--fg`, `--brand`, …) mapped into Tailwind in
`tailwind.config.ts`. Components never name a hex value, which is what lets the
same markup render in both themes.

| Token | Dark | Light |
| --- | --- | --- |
| Background | `#0F0F0F` | `#FFFFFF` |
| Surface | `#1B1B1B` | `#F6F6F7` |
| Primary | `#FF8500` | `#E87500` |
| Accent | `#FFB347` | `#FF8500` |

Primary buttons use **dark ink on orange**. White on `#FF8500` is only 2.4:1,
which fails WCAG AA; the dark ink reaches 7.7:1.

---

## The database

The schema, policies and seed data live in `supabase/` and are unchanged by the
interface rewrite — the app talks to the same `list_posts`, `rate_post`,
`remove_my_rating` and `get_user_stats` functions as before.

- `supabase/migrations/` — 8 migrations, applied in order
- `supabase/seed.sql` — demo content for **local testing only**. It refuses to
  run against a database that already has real accounts, so it cannot be used to
  re-seed production.
- `supabase/tests/` — the SQL acceptance suite and an HTTP integration suite

---

## Deploying

**Vercel** — import the repository. It detects Next.js; `vercel.json` pins the
framework. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
under Settings → Environment Variables, then redeploy.

**Netlify** — `netlify.toml` is included and uses `@netlify/plugin-nextjs`, which
is required for server rendering and routing.

Either way, add your deployed URL to Supabase → **Authentication → URL
Configuration** (Site URL and Redirect URLs), or signup confirmation emails will
point at the wrong domain.

See `DEPLOY.md` for the full checklist.

---

## Known limits

- **Rating scale** is −5…+10 by design. The interface shows it signed (`+4.6`,
  `−2.0`) rather than as stars, because it is not a five-point scale.
- **No follows, subscriptions, watch-later or history.** There are no tables
  behind them, and the app does not invent data to fill the space.
- **No video.** Posts carry an optional image, not a clip.
- **Orphaned images.** Deleting a post removes the row but leaves its image in
  the bucket.
- **Moderation covers reports, suspension and post/comment status.** There is no
  audit-log viewer yet.
