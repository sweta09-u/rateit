# Rate It — Redesign Plan (Phase 1)

Written after inspecting the existing project. Nothing here is implemented yet.

---

## 1. What the project actually is

| | |
| --- | --- |
| Framework | **Vite 5 + React 18** (not Next.js) |
| Routing | react-router-dom v6 — 13 routes |
| Styling | **Hand-written CSS**, 2,556 lines, 101 custom properties in `src/index.css` |
| Icons | Custom `Icons.tsx`, 30 icons (no Lucide) |
| Animation | CSS transitions only (no Framer Motion) |
| Backend | Supabase — Auth, PostgREST, Storage |
| Database | 7 tables: `profiles`, `posts`, `ratings`, `comments`, `blocks`, `reports`, `moderation_actions` |

**Routes that already exist:** `/`, `/trending`, `/explore`, `/search`, `/new`,
`/post/:id`, `/u/:username`, `/settings`, `/moderation`, `/rules`, `/login`,
`/signup`, `*`

**Pages (11):** Feed, PostDetail, Profile, EditProfile, CreatePost, Moderation,
Login, Signup, Rules, Setup, NotFound

**Components (22):** Layout, TopNav, Sidebar, BottomNav, PostCard, RatingShortcut,
RatingBreakdown, Comments, ImagePicker, CameraCapture, PostMenu, EditPostDialog,
ReportDialog, ConfirmDialog, Modal, Avatar, Badges, EmptyState, Skeleton,
Spinner, ProtectedRoute, Icons, Logo

**Already working, and not visible in the brief:** the feed has four modes
(`home`, `trending`, `explore`, `search`), five sort modes (`latest`, `trending`,
`highest`, `lowest`, `controversial`), category filtering, search, rating
distribution, comments, moderation with reports and bans, image upload by camera
or file, sharing, and a light/dark/system theme switch.

---

## 2. Mapping the requested screens onto what exists

| Requested | Status | Notes |
| --- | --- | --- |
| Home feed with sections | **Partly buildable** | One feed endpoint; sections = several sorted queries. Real data only. |
| Explore + categories | **Buildable** | `/explore` already does this |
| Search + filters | **Buildable** | `/search` already does this |
| Trending | **Buildable** | `/trending` exists, `trending` sort exists |
| Rating detail page | **Buildable** | `/post/:id` has cover, description, average, count, distribution, comments |
| Rating distribution | **Buildable** | `RatingBreakdown` already renders it |
| Profile + rating history | **Buildable** | `/u/:username` has stats and posts |
| Leaderboard | **Buildable from real data** | Just a `highest` / most-rated query — no new table needed |
| Category chips, sidebar, bottom nav | **Buildable** | Sidebar and BottomNav exist |
| 1–5 star ratings | **Conflicts** | See decision A |
| Written reviews (distinct from comments) | **Needs backend** | Comments exist; a separate review model does not |
| Followers / following | **Needs backend** | No table, no columns |
| Subscriptions | **Needs backend** | Depends on follows + channels |
| History / Watch Later / Liked | **Needs backend** | No tables |
| Shorts (vertical video) | **Needs backend** | Posts have an optional image, no video, no duration |
| Notifications | **Needs backend** | No table |
| Content duration | **Needs backend** | No column |
| Next.js / Tailwind / Lucide / Framer Motion | **Conflicts** | See decision B |

---

## 3. Decisions I need before writing code

### A. The rating scale — the biggest one

The database enforces `check (score between -5 and 10)`. A sixteen-point scale,
with a prominent **+10** quick-rating button, is the core of the current product
and is covered by 63 SQL assertions and 30 browser checks.

The brief asks for **1–5 stars**. Switching is not a styling change: it touches
18 files (both rating components, the API, types, validation, four pages), needs
a migration, and rewrites the tests. It also removes the +10 button you
previously asked to keep.

### B. The stack

The brief specifies Next.js + Tailwind + Lucide + Framer Motion. The project is
Vite + plain CSS + custom icons. Migrating would mean rebuilding routing, auth
guards, and every component — and would contradict "use the existing
architecture", "do not break existing routes", and "avoid unnecessary
dependencies" in the same brief.

### C. The theme

The brief specifies a dark-only interface on `#0F0F0F` with orange, and drops
purple entirely. The app currently has a light/dark/system switch on a
white/blue/purple palette — which you specified in detail earlier and which the
logo is built on. Going orange also means re-cutting the brand assets (they are
generated from code, so this is quick).

### D. Features with no data behind them

Shorts, subscriptions, watch later, history, liked items and followers all need
new tables. "Preserve the existing database schema" and "do not create fake
production data" are both in the brief, so I will not invent them silently.

---

## 4. Proposed sequence (once the decisions are made)

1. **Theme layer** — new palette as CSS custom properties alongside the existing
   ones, so every component restyles without being rewritten.
2. **Navigation** — collapsible sidebar, top bar with centred search, category
   chips, mobile bottom nav.
3. **Home** — sectioned feed (trending / recommended / popular / recent / top
   rated) from real queries, with card redesign.
4. **Detail page** — hero cover, rating control, distribution, reviews.
5. **Explore / search / leaderboard** — reuse the existing feed modes.
6. **Profile** — restyle stats and history.
7. **Responsive + accessibility pass** — 1440 / 834 / 390, focus states, contrast.
8. **Verify** — `npm run build`, then the existing browser harness (30 checks)
   and SQL suite (63 assertions) must still pass before delivery.

Every phase is verified in a real browser against a real Postgres, as before.

---

## Status

Ported and verified against a real PostgreSQL + PostgREST (28 browser checks):

- Auth — sign in, sign up, email confirmation, session, account menu
- Rating engine — −5…+10, quick buttons, slider, update, remove
- Create post — title, body, category, link, camera/file image upload
- Comments — post and delete your own
- Profile, Settings (profile + avatar + theme + delete account), Moderation,
  Rules
- Home, Explore, Trending, Leaderboard, Post detail

Still to port before the old app can be retired:

- Edit and delete your own post
- Report a post / comment / user
- Block and unblock a user
- The "connect Supabase" setup screen when env vars are missing
