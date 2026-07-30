# ArcadeClash — Progress Log

Self-contained handoff doc. Read this first at the start of every session —
conversations don't carry over, and work may resume from a different tool.

## Project summary

Hub of short (60–180s) head-to-head arcade mini-games. Solo practice, or
matched play (for-fun / for-stakes with play-money escrow; real-money hooks
stubbed only, not wired up). React frontend, Node/Express + Socket.IO
backend, Postgres via Drizzle ORM.

**Visual theme (as of session 2, replaces the original neon-rainbow theme):**
cinematic dark UI — near-black bg (`#0a0a0f`), violet primary accent
(`#7c3aed`, buttons/logo/active states), gold/amber secondary accent
(`#fbbf24`, ratings + links only, never primary buttons), consistently
rounded/pill-shaped controls, restrained single-color glow instead of
multi-color neon borders. Shared by every game module via `packages/theme`.

Full 51-game design doc lives outside this repo — the user feeds one game
spec at a time, starting with one representative game per engine (Runner,
Racer, Arena Shooter, Falling-Block/Match, Physics-Table/Bounce, Turn-Based
Board, Reflex-Timing, Word/Trivia), then faster reskins for the rest.

Repo root: `C:\Users\abuse\arcadeclash`

## Current phase: shared-systems-building (session 8+)

**Superseded as of 2026-07-29 (session 8) — read this before trusting
anything below in this section that says auth/systems are "out of
scope."** The user explicitly pivoted: they're now building the shared
systems (auth, matchmaking, real-time sync, wallet) that every game will
eventually plug into, validating each against one existing game (not yet
chosen which) before assuming it generalizes to the rest. Games-building
isn't abandoned — 3/51 built, 48 remain — just paused while systems work
happens. **Auth & profile is done and verified end-to-end against a real
database as of session 8** (see the session log below — signup/login/
logout/profile all confirmed working, both at the API level and through
the actual browser UI); matchmaking, wallet, and real-time sync have NOT
been started — still genuinely future work, not a stale warning this time.

### Original games-building phase (sessions 3-7, for history)

As of session 3, this was a dedicated games-building phase. Goal:
implement and fully test all 51 mini-games from the (external) design
doc — one at a time, or by engine cluster where it makes sense — each
running solo in practice mode through the GameModule loader. No opponent,
no real-time sync, no backend systems beyond what a single-player game
needs client-side.

**Explicitly out of scope during sessions 3-7 (NO LONGER TRUE for auth as
of session 8 — see above):**
- ~~Auth & user profiles~~ **done, session 8** — see the session log below
- Matchmaking (practice/for-fun/for-stakes queue) — still not started
- Wallet / stakes / escrow system — still not started
- Leaderboards — still not started
- Real-time opponent sync (WebSocket match state, etc.) — still not started

This list described the original games-first sequencing. It no longer
reflects current priority — read "Current phase" above first.

**Status correction (resolved in session 4):** at the start of this phase
the GameModule loader didn't exist yet, despite earlier being referred to
conversationally as "the loader we just built." It's now built — see
`packages/shared/src/gameModule.ts` (the interface) and
`packages/client/src/game-loader/` (the host that mounts a module and
shows the results screen). Games can plug in from here on.

**New per-game conventions, introduced session 7 — PENDING two answers
before they're fully in effect (see below):** going forward, every game
folder should use exactly `index.ts` / `engine.ts` / `skin.ts` /
`README.md` (not `constants.ts`), and get a line in the new `GAMES.md`
manifest at the repo root. `skin.ts` holds that game's tunable
colors/sprites/difficulty numbers in one commented block; colors should
come from `packages/theme` as named tokens rather than being hardcoded in
`engine.ts`/`skin.ts`. Engine code should be reused across games in the
same engine cluster rather than duplicated — but where shared engine code
should physically live (inside the original game's folder vs. a new
shared location) needs to be asked about case-by-case, not decided
unilaterally, per explicit user instruction not to scatter/create new
shared files without flagging it first.

**Two open questions, asked in session 7, unanswered as of the last
update to this file — do not guess at these, ask again if a fresh session
needs them and they're still blank:**
1. Should Neon Runner / Pixel Ninja Dash / Sky Dodge be retrofitted to
   the conventions above (they currently use `constants.ts`, no README,
   hardcoded local palettes, variable-dt loops — none of the new
   conventions)? Or apply new conventions going forward only, or never
   retrofit them?
2. The user asked for "seeded RNG and inputLog additions" to the
   `GameModule` interface as if they already existed — they don't. Also
   asked for a fixed-timestep update loop (all 3 built games currently use
   variable `dt` per frame). Proposed shape pending confirmation: a small
   `packages/shared/src/rng.ts` (seeded PRNG), `GameOverPayload` gaining
   optional `seed`/`inputLog` fields, each engine switching to a
   fixed-timestep accumulator loop. Likely purpose: deterministic
   replay (same seed + input log ⇒ same run), useful later for anti-cheat
   or ghost-replay features — but this is inference, not confirmed.

Until both are answered: don't build a 4th game (its actual spec was also
still template placeholders as of session 7 — nothing to build yet
regardless), and don't touch `packages/shared`/`packages/theme` for this.

## Games built (games-building phase progress)

| Game | Engine | Status |
|---|---|---|
| Neon Runner | runner | ✅ built + tested, practice mode only |
| Pixel Ninja Dash | reflex-timing | ✅ built + tested, practice mode only |
| Sky Dodge | falling-block | ✅ built + tested, practice mode only |

48 of 51 remaining. Update this table each time a game is finished.

## Stack decisions (confirmed with user)

- Language: **TypeScript** everywhere (client, server, shared, theme, games)
- Frontend build: **Vite + React** (my pick, not explicitly asked — flagged
  as an assumption; easy to swap if the user objects)
- Realtime: **Socket.IO**
- DB access: **Drizzle ORM** (Postgres)
- Monorepo: **npm workspaces** (`packages/*` + `games`)

## Repo structure

```
arcadeclash/
├── PROGRESS.md
├── package.json              # workspace root (npm workspaces)
├── tsconfig.base.json        # shared compiler options
├── packages/
│   ├── client/                # Vite + React + TS app
│   │   └── src/
│   │       ├── main.tsx       # imports @arcadeclash/theme/theme.css once, globally
│   │       ├── App.tsx        # view state ('home'|'profile') + active-game overlay, wraps AuthProvider
│   │       ├── lib/{format,api}.ts   # display helpers + fetch wrapper (credentials included)
│   │       ├── auth/AuthContext.tsx  # user/loading/signUp/logIn/logOut, checks /api/auth/me on mount
│   │       ├── mock/homeData.ts   # PLACEHOLDER data — see "Decisions" below
│   │       ├── components/    # Navbar (auth-aware), Hero, TrendingArena, GameCard, Avatar, AuthModal, StarRating, icons
│   │       ├── game-loader/   # GameLoader.tsx (host chrome + results screen), gameFactories.ts
│   │       └── pages/{HomePage,ProfilePage}.tsx
│   ├── server/                 # Express 5 + Drizzle + Postgres — real as of session 8
│   │   ├── drizzle.config.ts  # drizzle-kit migration config
│   │   └── src/
│   │       ├── index.ts       # app entry: cors/cookie-parser/json, mounts authRouter, global error handler
│   │       ├── auth/          # jwt.ts, password.ts (bcryptjs), middleware.ts (attachSession/requireAuth)
│   │       ├── db/            # schema.ts (users table), client.ts (pg Pool + drizzle)
│   │       └── routes/auth.ts # signup/login/logout/me
│   ├── shared/                 # package.json + src/{gameModule,user}.ts (GameModule interface, PublicUser) + index.ts
│   └── theme/                  # design system package — see below
│       └── src/
│           ├── theme.css       # :root CSS custom properties + .ac-* base classes
│           ├── tokens.ts       # colors/categoryColors objects + getThemeColor()
│           └── index.ts
└── games/
    ├── package.json            # @arcadeclash/games workspace package, exports map per game
    ├── registry.ts              # typed GameRegistryEntry[] — see "Games built" below
    └── neon-runner/             # constants.ts, engine.ts (state/physics/draw), index.ts (module)
```

## What was built

### Session 1 (2026-07-29) — scaffold + original neon theme

1. Git initialized, repo-local identity set (`abuseridzerati@gmail.com` /
   "ArcadeClash Dev" — user didn't specify one when asked, changeable via
   `git config user.name`/`user.email`).
2. `.gitignore` + npm workspace root `package.json`.
3. Client scaffolded via `npm create vite@latest -- --template react-ts`,
   renamed to `@arcadeclash/client`, Vite boilerplate stripped out.
4. `packages/server`, `packages/shared` created as empty placeholders (still
   true as of session 2 — no auth/API/DB code yet).
5. `games/registry.ts` created with the `GameEngine` union type (the 8
   engines) and typed, empty `gameRegistry` array.
6. First pass of the design system + a `ThemePreview` page to sanity-check
   it. **Superseded in session 2** — see below. `ThemePreview.tsx` was
   deleted; if you're looking for it, it's gone on purpose.

### Session 2 (2026-07-29) — visual redesign + real homepage

User provided a reference design (a Stitch mockup called "GameVault") and
asked to replace the neon-rainbow theme with a more restrained cinematic
dark UI, then rebuild the homepage to match its layout. Scope was
explicitly **homepage only** — inner pages (game detail, matchmaking,
wallet, etc.) don't exist yet, so there was nothing to propagate to yet.

1. **`packages/theme` rewritten**: dropped the cyan/magenta/purple triple
   accent + rainbow glow system entirely (confirmed nothing else referenced
   it before deleting). New tokens: `--color-primary` (violet `#7c3aed`,
   + hover/active shades), `--color-secondary` (gold `#fbbf24`, + hover/
   active shades, used only for star ratings and secondary links per the
   user's explicit instruction), bg/surface near-black scale, radius scale
   bumped toward pill shapes (`--radius-full` for buttons/pills/search),
   and a per-engine `--category-*` color palette (one hue per of the 8
   engines, for game category tag pills — see decisions below).
   `.ac-btn` is pill-shaped by default now; `.ac-pill` (nav/filter tags),
   `.ac-tag` (category badges, parameterized by a `--tag-color` custom
   property instead of one class per category), `.ac-card` (hover-elevate
   game tiles), `.ac-search` (pill search input), and `.ac-link--secondary`
   (gold links) are new. `tokens.ts` mirrors the new hex values + exports
   `categoryColors`.
2. **New homepage built** (`packages/client/src/pages/HomePage.tsx`):
   - `Navbar` — violet wordmark, pill search input, filter pills (All +
     4 sample engine categories + a "Hot" pill defaulted active), bell icon
     + avatar placeholder circle. Filter clicks only toggle local visual
     state right now — no actual filtering logic wired up.
   - `Hero` — full-bleed rounded banner, **CSS-gradient placeholder**
     standing in for real per-game key art (none exists yet), dark overlay
     gradient for legibility, a "LIVE ARENA · N players online now" badge
     top-right, category tag + "FEATURED GAME OF THE WEEK" + title +
     description + solid violet "PLAY NOW" pill bottom-left.
   - `TrendingArena` — trending icon + heading, gold "View Leaderboards →"
     link (currently a dead `href="#"`, no leaderboard page exists yet),
     responsive grid of `GameCard`s.
   - `GameCard` — gradient thumbnail placeholder tinted by category color,
     category tag pill overlaid top-left, title, star rating (gold filled
     stars via `StarRating`), formatted play count.
3. Verified in-browser: `npm install` linked the new `@arcadeclash/games`
   dependency in `packages/client` (needed for the `GameEngine` type), Vite
   served every new module with 200/304s and zero console errors, and
   computed styles confirmed the design tokens applied exactly as specified
   (`body` background `rgb(10,10,15)` = `#0a0a0f`; primary button background
   `rgb(124,58,237)` = `#7c3aed`; button border-radius `9999px`; star fill
   counts matched each mock rating's rounded value; `.ac-tag` background
   resolved through `color-mix()` to the right translucent category tint).
   As in session 1, the screenshot tool couldn't render in this sandbox —
   verification was computed-style/DOM inspection + network log, not an
   actual visual screenshot. **User should check `http://localhost:5173`
   themselves before this direction is treated as confirmed.**
4. Two commits: theme rewrite, then homepage build (on top of session 1's
   four checkpoint commits — six total, see `git log --oneline`).

### Session 3 (2026-07-29) — phase change, no code yet

User gave a status-check request (answered by reading this file + verifying
the actual repo contents on disk — confirmed accurate at the time), then
declared a shift into a dedicated games-building phase: build and test all
51 games solo/practice-only before touching auth, matchmaking, wallet, or
leaderboards. See "Current phase" above for the full scope statement. No
code changed this session — just this file, committed as its own
checkpoint, before starting on the GameModule loader + game 1.

### Session 4 (2026-07-29) — GameModule loader + Neon Runner (game 1 of 51)

First real build of the games phase. Built, in order:

1. **`GameModule` interface** (`packages/shared/src/gameModule.ts`):
   `init(container, mode, opponentSocket)` / `start()` / `pause()` /
   `destroy()`, extends `EventTarget` and dispatches a `"gameOver"`
   `CustomEvent<GameOverPayload>` (`{ score, reason, durationMs }`, `reason`
   is a plain `string` so each game can define its own codes rather than
   being forced into runner-specific ones like `"collision"`). `GameMode` is
   `"practice" | "match"` for interface stability, but only `"practice"` is
   implemented right now.
2. **Neon Runner** (`games/neon-runner/`) — the user's actual spec: endless
   side-scrolling runner, jump (variable height via hold/cut) and slide
   (timed) to avoid two obstacle types (ground hurdle, overhead beam),
   distance-based score, ramping speed + spawn-rate difficulty, countdown,
   live HUD, pause overlay (Resume/Quit), particle trail on actions. Plain
   DOM + Canvas 2D, no framework/engine dependency, own neon palette (see
   decisions below).
3. **`GameLoader`** (`packages/client/src/game-loader/GameLoader.tsx`) +
   **`gameFactories`** map — the host chrome: mounts a module via its
   factory in practice mode, listens for `gameOver`, renders the results
   screen. Wired into the homepage: the mock "Sky Runner" trending-game
   entry was replaced with the real Neon Runner (now clickable — the only
   card that is, since it's the only real game).
4. **Verification, two-pronged** (see decisions below for why): the
   `RunnerEngine`'s pure update/collision logic was verified with a
   standalone script run via `npx tsx` (jump-clears-hurdle,
   slide-clears-overhang, standing-under-either-collides, variable jump
   height, difficulty ramp — all pass, independent of any browser). Then
   the full in-browser flow (card click → dynamic import → mount →
   countdown → pause/resume → quit → `gameOver` → results screen → Play
   Again remounts cleanly → Back to Home returns to the homepage cleanly)
   was verified by hand in the Browser-pane tool. No console errors at any
   point.
5. Three commits: `GameModule` interface, Neon Runner, GameLoader +
   homepage wiring.

### Session 5 (2026-07-29) — Pixel Ninja Dash (game 2 of 51)

Second game, `reflex-timing` engine cluster (as opposed to Neon Runner's
`runner`). Same architecture as game 1 (vanilla DOM+Canvas module, own
constants/engine/index.ts files, tsx-verified engine logic, then
hand-verified DOM/lifecycle in the Browser pane) but a meaningfully
different mechanic, confirming the GameModule/GameLoader plumbing
generalizes rather than being accidentally Neon-Runner-shaped:

- Fixed forward pace (no difficulty ramp, per this game's spec) instead of
  Neon Runner's speed-ramping.
- A single input (Space/tap = dash) instead of two (jump + slide).
- Failure **doesn't end the run** — missing an obstacle triggers a timed
  stumble (temporary slowdown) rather than instant collision-death. This
  is a real mechanical difference the spec called for ("mistimed inputs
  cause a stumble that costs time"), not a copy-paste of Neon Runner.
- Fixed-length course with two end conditions (reach the finish line, or
  60s timer expires) instead of Neon Runner's endless-until-collision.
  Obstacles are pre-generated once in `reset()` for the whole course
  (simpler and correct, unlike a streaming spawn-lookahead scheme, which
  isn't needed when the track has a known end).
- Score rewards progress + clean-hit style bonus (perfect > good) +
  a finish-time bonus if the track is completed with time to spare.

Verified the same two ways as game 1: `npx tsx` against the standalone
`DashEngine` (13 checks — auto-progress, miss-triggers-stumble, perfect
clear, good clear, early-press-is-a-no-op, finishes before 60s, times out
if never dashing — all pass) and by-hand in-browser lifecycle check
(mount → pause → quit → `gameOver` → results screen → Play Again →
input dispatch → Exit), zero console errors. Same rAF/compositing sandbox
limitation as before — live animation not visually confirmed here.

Added to `trendingGames` as a new card (no existing mock placeholder was
`reflex-timing`, so this was an addition, not a swap like Neon Runner's).

### Session 6 (2026-07-29) — Sky Dodge (game 3 of 51)

Third game, classified as the `falling-block` engine's representative
(see decisions below for why — it's a judgment call, not stated by the
user). Vertical dodger: hazards rain down at increasing fall speed, ship
moves continuously left/right (held arrow keys, or drag-to-follow via
pointer) to avoid them, any hit without an active shield ends the run.
Score is simply whole survival seconds. Adds a Spacebar shield ability
(brief invulnerability, cooldown-gated) — the first ability/cooldown
mechanic across the three games so far, and the first game needing
continuous held-key input (`moveLeft`/`moveRight` as persistent state)
rather than the previous two games' edge-triggered single actions.

Verified the same two-pronged way as games 1–2: a standalone `npx tsx`
script against `DodgeEngine` (11 checks) caught a real bug — `elapsed`
accumulated from repeated `+= 1/60` landed at `2.999999999996` instead of
`3.0` due to float rounding, making `Math.floor(elapsed)` under-report the
score by 1 right at second boundaries. Fixed with a small epsilon before
flooring (`Math.floor(elapsed + 1e-6)`). Caught before it ever reached the
browser — this is exactly why the tsx-verification step earns its keep.
Full in-browser lifecycle (mount, pause, quit, gameOver, replay, exit)
verified by hand afterward, zero console errors. Swapped the mock "Block
Cascade" placeholder for the real Sky Dodge card (same pattern as Neon
Runner replacing "Sky Runner" — matching engine, so a swap rather than an
addition this time).

### Session 7 (2026-07-29) — new conventions proposed, no game built

User sent a template for how they want all future games built: a fixed
per-game file layout (`index.ts`/`engine.ts`/`skin.ts`/`README.md`,
replacing the `constants.ts` naming used so far), a root `GAMES.md`
manifest, colors/spacing sourced from `packages/theme` as named tokens
instead of hardcoded per-game, explicit engine reuse across games in the
same cluster, and "seeded RNG and inputLog additions" to the GameModule
interface plus a fixed-timestep update loop. The GAME SPEC section of the
message was left as unfilled template placeholders (`[GAME NAME]`,
`[game-slug]`, etc.) — there was no actual game to build this session.

Created `GAMES.md` at the repo root (documents the 3 existing games,
notes their file layout doesn't match the new convention yet). Did not
build any game code, touch `packages/shared`, or touch `packages/theme` —
asked two clarifying questions first (see "Current phase" above for full
detail): whether to retrofit the 3 existing games to the new conventions,
and whether the proposed RNG/inputLog/fixed-timestep design (new
`packages/shared/src/rng.ts`, `GameOverPayload` gaining `seed`/`inputLog`,
fixed-timestep accumulator loops) matches what the user actually wants.
Both unanswered as of this entry — resolve before building game 4.

### Session 8 (2026-07-30) — Auth & profile (first shared system)

Status check confirmed (read this file + `GAMES.md`, verified against
disk — accurate). Then the phase pivot described above: build the shared
systems, starting with auth & profile only this session, stopping before
matchmaking/wallet/real-time sync. Scope: user model, signup/login/logout/
session persistence, profile page, navbar wiring, Postgres schema.

**Checked the machine first: no Docker, no local Postgres.** Asked the
user how to provision one — they chose a free cloud Postgres (Supabase)
and to paste the connection string directly in chat.

**DB setup took several rounds, all resolved — auth is now fully verified
against a real database:**
- Supabase's direct-connection hostname (`db.<ref>.supabase.co`) didn't
  resolve (`ENOTFOUND`) — a known Supabase IPv6-only issue the user had
  already anticipated. Switched to the session-pooler hostname/port
  instead, which resolves fine.
- The user didn't want to paste the password itself into chat for the
  pooler string, so I wrote a small PowerShell script (run by the user,
  never by me) that prompts for password/hostname/port with hidden input,
  percent-encodes the password, and rewrites only the `DATABASE_URL` line
  in `packages/server/.env` in place — never printing the value. First
  version failed to parse on Windows PowerShell 5.1 because it contained
  em-dashes and the file had no UTF-8 BOM (PS 5.1 falls back to the
  system ANSI codepage without one, corrupting multi-byte characters
  mid-file). Rewrote it ASCII-only and saved via `Set-Content -Encoding
  UTF8`, which does add a BOM under Windows PowerShell 5.1 (unlike
  PS 7+, where UTF8 is BOM-less by default) — confirmed via a byte-level
  check before telling the user it was fixed.
- Verified connectivity with a throwaway script reporting only
  success/failure and the hostname, never the credential, per the user's
  explicit ask.
- Ran `drizzle-kit generate` (produced `drizzle/0000_early_marrow.sql`,
  matching the schema exactly) then `drizzle-kit migrate` — applied
  cleanly to the real database.
- **Found a real environment gotcha while verifying:** a schema check
  right after migrating hit "password authentication failed," which
  turned out to be a stale, months-old-in-session-time server process
  still squatting on port 4000 with an old `DATABASE_URL` loaded in
  memory — from an earlier restart this session that git-bash's
  `pkill -f "tsx watch"` silently failed to actually kill (it doesn't
  reliably match Windows-native node process command lines). Found and
  force-killed every lingering node process via PowerShell's
  `Get-CimInstance Win32_Process` + `Stop-Process`, confirmed via
  `netstat` that the freshly-started process actually held the port
  this time. **Lesson: on this machine, restart the server via
  PowerShell process inspection, not `pkill`, if there's ever any doubt
  whether the old process actually died.**
- Full flow verified twice: once at the API level directly (signup 201,
  `/me` 200 with session / 401 without, logout 204, login 200 with
  correct password / 401 with wrong password) against a real inserted
  row, and again end-to-end through the actual browser UI (signup modal
  → navbar avatar updates → Profile page shows real username/join-date/
  stats → Log out → navbar reverts → Profile page's logged-out fallback
  correctly triggers). Zero console errors throughout. Two test accounts
  now exist in the real database (`testplayer1`, `browsertest`) — left in
  place, not cleaned up; harmless, but say the word if you want them gone.

**Built:**
1. `packages/server`, real for the first time (was an empty placeholder):
   Express 5, `users` table via Drizzle ORM + `pg` (node-postgres driver),
   `drizzle-kit` for migrations. Auth routes: `POST /api/auth/signup`,
   `/login`, `/logout`, `GET /api/auth/me`. JWT in an httpOnly cookie
   (`ac_session`, 7-day expiry) — see decisions below for why over a
   session store. Passwords hashed with `bcryptjs`.
2. `packages/shared/src/user.ts` — `PublicUser` type (never includes
   `passwordHash`), the client/server-shared response shape.
3. Client: `AuthContext` (checks `/api/auth/me` on mount, exposes
   `signUp`/`logIn`/`logOut`), `AuthModal` (signup/login toggle form),
   `Avatar` (generated initial + color hashed from username, reusing the
   theme's existing `categoryColors` rather than inventing new tokens),
   `ProfilePage` (username, avatar, games-played/win-rate — real fields
   from the DB, just zero/`—` for a brand-new user, not fabricated mock
   numbers). `Navbar` now shows the avatar + a Profile/Log out dropdown
   when logged in, Log in/Sign up pills when not. `App.tsx` gained a
   `view: 'home' | 'profile'` state to reach the profile page — no router
   added yet (see decisions).
4. **Found and fixed a real bug unrelated to auth**: `tsc -b`/`tsc --noEmit`
   had apparently never been run against this codebase before (Vite/esbuild
   and `tsx` only transform, they don't type-check) — running it surfaced
   a genuine latent bug in all 3 built games (a field initialized from an
   `as const` constant infers that constant's literal type, breaking a
   later computed reassignment) plus several issues in the new server code
   (see decisions). All fixed; `tsc -b` (client) and `tsc --noEmit`
   (server) are both clean now. **This codebase had never been fully
   type-checked before this session — worth doing periodically going
   forward, not just relying on Vite/tsx running without errors.**
5. **Found and fixed a real production-impact bug**: under Express 4, an
   unhandled async rejection (simulated by the still-placeholder DB URL
   failing to connect) crashed the entire server process — any transient
   DB hiccup would have taken down the whole server for every user, not
   just failed one request. Upgraded to Express 5 (forwards async handler
   rejections to error middleware natively) plus added a global error
   handler as a last-resort safety net. Verified: the same failure now
   returns a clean 500 and the server keeps running.
6. Verified everything reachable without a live DB first: server boots
   and `/api/health` responds; `/api/auth/me` correctly 401s with no
   cookie; CORS + credentialed cross-origin cookies work between `:5173`
   and `:4000`; the signup form submits, hits the real endpoint, and
   surfaces a clean 500 without crashing anything. Then, once the real
   `DATABASE_URL` arrived (see below), verified the actual thing: a real
   signup/login/profile-view/logout round-trip against the live Supabase
   database, both via direct API calls and through the browser UI. Auth
   is genuinely done, not just wired.
7. Four commits: games type-fix, shared `PublicUser` type, server auth
   build, client auth build.

## Decisions / tradeoffs (read before changing structure)

- **On this machine, `pkill -f "tsx watch"` (from the Bash tool/git-bash)
  does not reliably kill the server's node process.** Discovered when a
  stale process from an earlier restart silently kept holding port 4000
  with an old `DATABASE_URL` loaded in memory, while a "successfully
  restarted" new process never actually got the port. Git-bash's process
  matching doesn't reliably see Windows-native node.exe command lines.
  **Going forward: to restart the server, use PowerShell —
  `Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"` filtered to
  ones whose `CommandLine` mentions `packages/server` or `tsx`, pipe to
  `Stop-Process -Force`, THEN start the new one, and confirm via
  `netstat -ano | findstr :4000` that the new PID actually holds the
  port** before trusting that a restart took effect. This cost real time
  to diagnose once already — don't reach for `pkill` for this again.
- **Auth uses a JWT in an httpOnly cookie, not a server-side session
  store.** Reasoning: no sessions table/Redis needed at this scale, and it
  plays cleanly with Socket.IO later — the same JWT can authenticate a
  WebSocket handshake without a DB round-trip. Tradeoff accepted:
  server-side "log out everywhere"/immediate revocation isn't possible
  without extra work (a token blocklist or moving to sessions). Revisit
  once the wallet/stakes phase raises the security stakes on accounts.
  7-day expiry, no refresh-token rotation yet — also a revisit-later item.
- **Password hashing: `bcryptjs`, not native `bcrypt`.** Avoids needing
  native compilation (node-gyp/Visual Studio Build Tools) on this Windows
  machine, which we don't know is set up, given the PATH friction already
  hit earlier in this project.
- **Avatars are generated client-side** (colored circle + first initial,
  color hashed from username, reusing the theme's existing
  `categoryColors` rather than adding new tokens) — no image storage or
  external avatar service. `avatarUrl` exists as a nullable DB column for
  real uploads later; unused for now.
- **`gamesPlayed`/`gamesWon` are real DB columns (default 0), not
  hardcoded mock numbers in the UI.** A brand-new user's profile honestly
  shows 0 games / `—` win rate rather than fabricated stats — the columns
  are there now so wiring in real match results later is just an UPDATE,
  not a schema migration.
- **No client-side router yet.** `App.tsx` uses a simple `view` state
  (`'home' | 'profile'`) to reach the profile page, same pattern as the
  existing game-session overlay. A real router (`react-router-dom`) is a
  near-term need once matchmaking/wallet/leaderboard pages exist too —
  don't be surprised if that's the very next infra addition.
- **This was the first time `tsc -b`/`tsc --noEmit` had been run against
  this codebase for real type-checking.** Vite (esbuild) and `tsx` only
  transform TypeScript — they strip types and run, they don't check them.
  Running a real compile surfaced genuine pre-existing bugs: a literal-
  type inference issue in all 3 games (fixed, see the games type-fix
  commit) and several server-specific issues on the way (see below).
  **Lesson for future sessions: periodically run a real type-check across
  the whole repo, not just Vite/tsx running without visible errors** —
  the latter only proves the code parses and executes the paths actually
  exercised, not that it type-checks.
- **`packages/server`'s `tsconfig.json` used to override to `NodeNext`
  module resolution**, which requires explicit `.js` extensions on every
  relative import (a well-known TS+ESM quirk) — but the package is
  actually run via `tsx`, which resolves more like a bundler and doesn't
  care about extensions, so this override didn't match the real dev
  workflow and just added friction. Removed the override; server now
  inherits `Bundler` resolution from `tsconfig.base.json` like every other
  package in the monorepo. If a real compiled build (`tsc` → `node
  dist/`) is ever wanted instead of running via `tsx` in production too,
  this decision should be revisited.
- **Upgraded `express` 4→5.** An unhandled async rejection in a route
  handler crashes the whole Node process under Express 4 (it doesn't
  forward rejected promises to error-handling middleware); Express 5 does
  this natively. Discovered via a real DB-connection failure during
  testing — this wasn't a hypothetical, it reproduced immediately. Kept a
  global `app.use(errorHandler)` too as a last-resort safety net.
- **Engine classification (`GameEngine` value in `games/registry.ts`) is
  my judgment call per game, not something the user's specs state
  explicitly.** Each spec has a "Genre" field ("Runner / Reflex" for all
  three games so far) which is marketing flavor text, NOT the same as the
  8-engine technical classification from the original brief. I classify by
  actual shared-code pattern: Neon Runner → `runner` (forward-scrolling,
  jump/slide physics), Pixel Ninja Dash → `reflex-timing` (discrete
  timing-window input against a shrinking ring), Sky Dodge → `falling-block`
  (spawner + falling objects + playfield collision, even though it's a
  dodge/survival game rather than a match-3 puzzle — the technical pattern
  of "things fall from the top of a vertical playfield" is what the engine
  category is about, not the win condition). If the user's actual external
  design doc classifies these differently, defer to that and relabel.
- **Theme is its own package (`packages/theme`), not `packages/client/src/theme`.**
  Reason: game modules under `/games/<name>/` need the theme too, and they
  must not depend on `packages/client` (client's future game-loader will
  depend on `games/registry.ts`, so the reverse dependency would be
  circular). CSS custom properties cascade from `:root`, so a game mounted
  inside the client's DOM tree gets the theme for free without importing
  anything; `@arcadeclash/theme`'s plain-TS `colors`/`categoryColors`/
  `getThemeColor()` exports cover the canvas/WebGL case where a game needs
  an actual color value instead of a `var(--x)` string.
- **Category color palette duplicated in `packages/theme/src/tokens.ts`
  (`categoryColors`) rather than importing `GameEngine` from
  `@arcadeclash/games`.** Keeps `theme` dependency-free of `games` (theme
  should be usable by anything, games included). The string keys must stay
  in sync with the `GameEngine` union in `games/registry.ts` by hand — a
  short comment in `tokens.ts` flags this. `packages/client` *does* now
  depend on `@arcadeclash/games` directly (for the `GameEngine` type used
  in mock data/components) — that's fine, not circular, since `games`
  doesn't depend on `client`.
- **Homepage content is entirely mock/placeholder data**
  (`packages/client/src/mock/homeData.ts`): six invented trending games,
  one invented featured game, a static `liveArenaCount = 128`. None of
  auth, the game registry, matchmaking, or leaderboards exist yet to source
  real data from — this was a visual/layout pass against the reference
  design, not a functional integration. Replace this file's contents with
  real API/websocket data once those systems exist; the component props
  (`GameCard`, `Hero`, etc.) are already shaped generically enough to accept
  real data without changing their internals.
- **Hero background is a CSS gradient, not an image.** No per-game key art
  exists yet and pulling a stock/placeholder photo felt riskier (licensing,
  external dependency) than a gradient that already fits the "cinematic
  dark" brief. Swap in real artwork per game once it exists.
- **Nav filter pills and "View Leaderboards" link are presentational only**
  — no client-side routing, no real filtering, no leaderboard page to link
  to yet. Don't mistake the "Hot" pill's default-active styling for real
  state; it's just a visual demo of the active-pill treatment.
- **No light theme / theme toggle.** Still one fixed dark aesthetic.
- **No custom display font.** Still using the system font stack; open
  follow-up if the user wants something more distinctive later.
- **`packages/server` and `packages/shared` are still empty placeholders**
  — no Express/Socket.IO/Drizzle/pg dependencies added yet, deferred until
  server work actually starts.
- **Environment quirk (this machine only):** Node.js is installed at
  `C:\Program Files\nodejs` (v24.18.0) but is **not on the system PATH**.
  Plain `node`/`npm` fail in a fresh shell until PATH is fixed. Worked
  around this every session by prefixing PATH inline. The user should add
  `C:\Program Files\nodejs` to their PATH permanently (Windows Settings →
  Environment Variables) since modifying system PATH isn't something done
  unprompted. Until then, prefix commands with:
  `$env:Path = "C:\Program Files\nodejs;" + $env:Path` (PowerShell).
- `C:\Users\abuse\.claude\launch.json` and `run-client.bat` exist **outside
  the repo** (machine-local) so the Browser-pane preview tool can launch the
  Vite dev server despite the PATH issue above. Not part of the project.
- **A GameModule owns its own in-run UI (countdown, live HUD, pause
  overlay); the host (`GameLoader`) owns the post-run results screen.**
  "Back to Lobby"/navigation is fundamentally a host concern the module has
  no way to perform through its fixed `init/start/pause/destroy` interface,
  so results-screen actions (Play Again, Back to Home) live in `GameLoader`
  once, reusable across all 51 games, instead of every game reimplementing
  navigation buttons it can't actually act on. A module just needs to fire
  `gameOver` reliably when a run ends (collision, quit, whatever) — nothing
  else. Renamed the spec's "Rematch"/"Back to Lobby" to "Play Again"/"Back
  to Home" since there's no opponent or lobby concept yet.
- **Each game module can have its own visual palette, distinct from the
  app-shell theme.** Neon Runner's cyan/magenta/purple/lime in-canvas
  palette (`games/neon-runner/constants.ts`) is deliberately NOT the same
  as `@arcadeclash/theme`'s violet/gold — the shared theme governs app
  chrome (nav, homepage, the results screen), while a game's own in-canvas
  look is that game's call per its spec. Don't "fix" a future game's palette
  to match the app theme unless its spec asks for that.
- **`gameFactories.ts` is a manual, explicit map** (game id → dynamic
  `import()`), not auto-derived from `games/registry.ts`. One line per game;
  revisit only if 51 manual lines actually becomes tedious in practice.
  Similarly, `games/package.json`'s `"exports"` map needs one new entry per
  game (mirrors how `@arcadeclash/theme` exports `./theme.css`).
- **Touch input is intentionally simpler than keyboard for Neon Runner:**
  a tap always yields a short controlled jump; there's no touch-hold for a
  higher jump (only keyboard hold does that), because disambiguating
  "hold to jump higher" vs "swipe down to slide" from a single touch
  gesture reliably would need real gesture-intent detection. Keyboard fully
  implements the spec's variable jump height; touch is a disclosed
  simplification. Revisit if the user wants full parity.
- **Sandbox limitation, relevant to every future game:**
  `requestAnimationFrame` never fires in this Browser-pane tool because the
  page never actually composites here (confirmed with a raw rAF counter
  probe that stayed at 0 after 8+ real seconds; `setTimeout` fires
  normally, so it's specifically rAF/compositing that's suspended, not all
  JS). Practical fallout: you cannot observe a canvas game's live
  animation, score-over-time, or rAF-driven collisions directly in this
  tool. Coordinate-based clicks (the `computer` tool) are also unreliable
  here for the same reason (no composited frame to hit-test against) —
  use `javascript_tool` to query elements and call `.click()` on them
  directly instead. To verify a game's actual logic, extract the
  non-DOM-dependent state/update code into something importable
  standalone (as `RunnerEngine` already is) and exercise it with
  `npx tsx some-test-script.ts` — real Node, no browser, no rAF dependency,
  fast and deterministic. Keep doing this for each new game: verify pure
  logic via tsx, verify DOM/lifecycle wiring (mount, pause, gameOver,
  cleanup) by hand in the Browser pane, and note in this file that live
  rendering/animation itself couldn't be visually confirmed here — the
  user should eyeball actual gameplay themselves at `localhost:5173`.

## What's next

**Current priority — shared systems (see "Current phase" above):**

1. ~~Auth & profile~~ ✅ built AND verified end-to-end against the real
   Supabase database session 8 — signup/login/logout/profile all
   confirmed working via direct API calls and through the actual browser
   UI. Two test accounts (`testplayer1`, `browsertest`) exist in the real
   DB from verification; left in place, harmless.
2. Matchmaking, real-time sync, and wallet — not started. Build order
   within these wasn't specified yet; ask before assuming.
3. Once built, validate the systems against **one existing game** (not
   yet chosen which — Neon Runner is the simplest candidate) before
   assuming the approach generalizes to the other 48 unbuilt + 3 built
   games, per the user's explicit instruction.
4. Games-building resumes after systems work (or interleaved — confirm
   with the user rather than assuming which). 3/51 done, 48 remain, 2
   open questions from session 7 (retrofit scope, seeded-RNG/inputLog
   design) still unanswered — don't guess at them.
5. Homepage direction (session 2's violet/gold redesign) is still pending
   the user's explicit visual confirmation — propagating the `Navbar` +
   `.ac-card` style to other pages stays paused until then.

The homepage's "LIVE ARENA" player count and "View Leaderboards →" link
stay mock/dead until matchmaking and leaderboards are eventually built.

## How to resume

```bash
cd C:/Users/abuse/arcadeclash
# PowerShell only, until PATH is fixed:
$env:Path = "C:\Program Files\nodejs;" + $env:Path
npm run dev -w packages/client   # http://localhost:5173 (frontend)
npm run dev -w packages/server   # http://localhost:4000 (backend API)
```

Server needs `packages/server/.env` (copy from `.env.example`) with a real
`DATABASE_URL` — see "Immediate" above if it's still a placeholder.

Check `git log --oneline` for the checkpoint history if you need more detail
than this file provides.
