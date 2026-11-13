# Deploying rabrate

One app, Next.js. Supabase provides auth, the database and image storage.

## 1. Environment variables

Set these on the host — **Production, Preview and Development**:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase → Project Settings → API |
| `NEXT_PUBLIC_SITE_URL` | optional, your canonical URL for Open Graph |

Next inlines `NEXT_PUBLIC_*` at build time, so they must exist before the build.
Without them the site shows the "Connect Supabase" setup screen — not a crash,
but not the app either. This is the most likely thing to get wrong.

## 2. Supabase auth URLs

Authentication → URL Configuration:

- **Site URL** — your production URL
- **Redirect URLs** — `https://your-site/**` and `https://*-<team>.vercel.app/**`
  (or the Netlify equivalent) so preview deployments work too

Skip this and signup confirmation links point at the wrong domain.

## 3. Deploy

**Vercel** — import the repo. Framework is pinned in `vercel.json`.

**Netlify** — `netlify.toml` uses `@netlify/plugin-nextjs`; without that plugin
only the static pages would work. Note that new Netlify projects are private by
default: Project configuration → General → Visitor access → Project visibility →
Public.

## 4. Check it worked

1. The feed loads real posts (not the setup screen).
2. Sign in — the account menu appears top right.
3. Rate a post +10 and watch the average change.
4. Create a post with a photo (camera and file both).
5. Comment on it, then edit and delete it.
6. Open `/u/<username>` in a fresh tab — deep links must work.
7. Sign up a new account and click the emailed link.
