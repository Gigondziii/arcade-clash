# ArcadeClash — Progress Log

Self-contained handoff doc. Read this first at the start of every session —
conversations don't carry over, and work may resume from a different tool.

## 60-second status (read only this to get oriented)

**Stack:** React/Vite client, Express 5 + Drizzle ORM + Postgres (Supabase,
cloud-hosted) server, npm workspaces monorepo (`packages/client`,
`packages/server`, `packages/shared`, `packages/theme`, `games/*`).

**BUILT (verified in code and/or browser — see "Architecture status"
further down for the full audit):** auth — signup/login/logout/session/
profile — verified via direct API calls AND full browser click-through
against the real Supabase database; 3 of 51 practice-mode mini-games
(Neon Runner, Pixel Ninja Dash, Sky Dodge), each with fully independent
engine code (zero sharing between them); the `GameModule` interface
(`init(container, mode, opponentSocket)` / `start` / `pause` / `destroy`,
`GameOverPayload = { score, reason, durationMs }` — no `seed`, no
`inputLog`); the `GameLoader` host chrome; homepage (colors/layout
verified via DOM inspection, but never visually confirmed by the user in
an actual live view — still an open seam, not a blocker).

**PLANNED (described somewhere in this file or in conversation, NOT in
code — confirmed absent by a 2026-07-30 read-only audit, grepped and
read directly):** seeded RNG, `inputLog`, a fixed-timestep update loop, a
real shared-engine abstraction (each game's `engine.ts` is fully
independent — no two games have ever shared a cluster), the 8-engine
cluster model as a tested abstraction, matchmaking, wallet, real-time
sync, leaderboards.

**EXACT NEXT STEP:** build the determinism foundation — seeded RNG,
fixed-timestep loop, `inputLog`, retrofit all 3 existing games to use all
three. Confirmed by the user, ahead of matchmaking. Full brief, with
everything that session needs and nothing it doesn't, is the very next
section below.

Everything past the next section is historical detail, decisions, and the
session-by-session log — unchanged, just relocated below the summary so
this file costs less context to read at the start of every session. Skim
it only for the "why" behind something; it's not required to get oriented.

## NEXT SESSION: DETERMINISM FOUNDATION

Everything this session needs to start cold, with zero prior context.
**Scope:** seeded RNG, fixed-timestep loop, `inputLog`, retrofit all 3
existing games (Neon Runner, Pixel Ninja Dash, Sky Dodge) to use all
three. **Matchmaking does not start this session — it comes after.**

### Decisions already made — do not re-litigate these

- **Retrofit all 3 existing games.** YES, confirmed.
- **Build seeded RNG + fixed-timestep loop + `inputLog`.** YES, confirmed.
- **Two separate RNG streams, gameplay and cosmetic, both derived from
  one seed.** YES, confirmed. (This resolves the question raised by
  session 10's audit about whether cosmetic-particle randomness needs
  seeding too — it does, but as its own stream, so cosmetic-only
  variation doesn't perturb the gameplay-affecting sequence or vice
  versa. See the full `Math.random()` site list below for which sites go
  in which stream.)
- **Matchmaking comes after this, not before.** Confirmed explicitly,
  twice now (sessions 10 and 11 — session 9 was an unrelated dev-server
  fix, not a matchmaking-sequencing decision; don't cite it as one).

### The one open question this session should answer before coding

**Should `inputLog` entries be keyed on `{ timestamp, action }` or
`{ tick, action }`?** Not yet decided — don't silently pick one without
flagging it. `timestamp` (wall-clock ms) is simpler to record but less
naturally tied to a fixed-timestep replay; `tick` (a frame-counter
integer) ties directly to the fixed-timestep loop and is likely what
actually enables exact replay, but depends on the loop existing first to
define what a "tick" is.

### Two small cleanups queued for this session (found during the doc audit, not yet done)

- `games/sky-dodge/engine.ts`: remove the dead `playerMovingLeft` /
  `playerMovingRight` fields on `DodgeEngine` — declared, never read or
  written anywhere in the class.
- `games/pixel-ninja-dash/engine.ts`: `dashFlashRemainingMs = 180` inside
  `pressDash()` is a magic number, unlike every other tunable, which
  lives in `constants.ts`'s `WORLD`/`TIMING`/`SCORE` objects. Move it
  there for consistency.

### Exact current state of the code this session will touch

**The `GameModule` interface, verbatim, `packages/shared/src/gameModule.ts`:**

```ts
export type GameMode = "practice" | "match";

export type GameOverPayload = {
  score: number;
  reason: string;
  durationMs: number;
};

export interface GameModule extends EventTarget {
  init(container: HTMLElement, mode: GameMode, opponentSocket: WebSocket | null): void;
  start(): void;
  pause(): void;
  destroy(): void;
}

export type GameModuleFactory = () => GameModule;
```

No `seed` parameter, no `inputLog`/`meta` field — this session adds them.

**The current variable-dt loop — identical shape in all 3 games'
`index.ts` (`neon-runner` shown below; `pixel-ninja-dash` and `sky-dodge`
match exactly except for which input flags get reset each frame):**

```ts
private loop = () => {
  if (this.state !== "running") return;
  const now = performance.now();
  const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
  this.lastFrameTime = now;

  const result = this.engine.update(dt, this.input);
  this.input.jumpPressed = false;
  this.input.jumpReleased = false;
  this.input.slidePressed = false;

  if (this.ctx) this.engine.draw(this.ctx);
  if (this.hud) this.hud.textContent = `SCORE ${this.engine.score}`;

  if (result === "collision") {
    this.endRun("collision");
    return;
  }

  this.rafId = requestAnimationFrame(this.loop);
};
```

Line references: `neon-runner/index.ts:233-252`;
`pixel-ninja-dash/index.ts:196-219`; `sky-dodge/index.ts:222-246` — same
`dt` calculation, same `requestAnimationFrame(this.loop)` tail, different
result-handling and input-reset lines per game.

**Every `Math.random()` call site across the 3 games, labeled
gameplay-affecting or cosmetic-only (17 total — grepped 2026-07-30):**

`games/neon-runner/engine.ts`:
- L106-108 (inside `spawnParticles()`: `vx`, `vy`, `life`) — **cosmetic-only**
- L144 (`spawnTimerMs = spawnIntervalMs + Math.random() * 300`) — **gameplay-affecting** (obstacle spawn timing)
- L145 (`type = Math.random() < 0.5 ? "hurdle" : "overhang"`) — **gameplay-affecting** (obstacle type)

`games/pixel-ninja-dash/engine.ts`:
- L95 (`d += WORLD.obstacleSpacingMin + Math.random() * (...)`) — **gameplay-affecting** (course layout, pre-generated once in `reset()`)
- L109-111 (inside particle spawn: `vx`, `vy`, `life`) — **cosmetic-only**

`games/sky-dodge/engine.ts`:
- L84-86 (inside particle spawn: `vx`, `vy`, `life`) — **cosmetic-only**
- L93 (hazard `size`) — **gameplay-affecting** (hitbox size)
- L94 (hazard `shape`: block/shard) — **gameplay-affecting** (hitbox shape)
- L95 (hazard `x` position) — **gameplay-affecting** (spawn position)
- L114 (`Math.random() < 0.5` gating a movement-trail particle spawn) — **cosmetic-only** (just thins out the visual trail)
- L136 (`spawnTimerSec = intervalSec + Math.random() * 0.15`) — **gameplay-affecting** (hazard spawn timing)

**Tally: 7 gameplay-affecting, 10 cosmetic-only.** Every one of these
needs to move to one of the two seeded RNG streams decided above.

---

# Full history and detail below (unchanged content, relocated — not required reading to get oriented; read for the "why")

## Detailed status (superseded as the entry point by the 60-second summary above; kept for full verification-method detail)

Written for someone with zero memory of anything below. Everything else in
this file is historical detail/audit trail — this section is the map.

### Done and verified (method noted — don't assume "built" means "confirmed")

- **Auth (signup/login/logout/session persistence/profile page).**
  Verification: highest confidence in the project. Checked TWO ways —
  direct API calls with real assertions (signup returns 201 with a real
  user row; `/me` returns 200 with a session cookie and 401 without;
  logout returns 204 and actually invalidates the session; login accepts
  the right password and rejects the wrong one) AND a full manual
  browser click-through (signup modal → navbar avatar updates → Profile
  page shows real username/join-date/stats → Log out → navbar and
  Profile page both revert correctly) — against the real production
  Supabase database, not a mock or local stand-in. Zero console errors.
  Two leftover test accounts (`testplayer1`, `browsertest`) were deleted
  from the real DB at the end of this session — table is empty now.
- **GameModule loader + GameLoader host** (mount/pause/quit/`gameOver`/
  results-screen/replay/exit). Verification: manual browser click-through,
  for all 3 built games, each time. Not automated — re-verify by hand if
  this plumbing changes.
- **3 games' engine logic** (Neon Runner, Pixel Ninja Dash, Sky Dodge —
  physics, collision, scoring, difficulty curves). Verification:
  standalone `npx tsx` scripts with real pass/fail assertions, run outside
  the browser entirely. This caught two real bugs before they shipped
  (see session 6, session 8 entries). Deterministic and re-runnable.
- **3 games' DOM/lifecycle wiring** (mount, pause, gameOver dispatch,
  cleanup). Verification: manual browser click-through, same as the
  loader above.
- **Type-checking passes** (`tsc -b` client, `tsc --noEmit` server).
  Verification: actually ran the compiler and read its output — not an
  assumption from Vite/tsx running without visible errors (which don't
  type-check at all, discovered this session). Both clean as of now.
- **Monorepo scaffold, workspace wiring, Express/Drizzle/Postgres setup.**
  Verification: code inspection + successful builds/installs + the auth
  verification above (which exercises the whole server stack).
- **Git history contains no committed credential.** Verification: ran
  `git log -p --all -S 'supabase.co'` and `git log --all --name-only
  --diff-filter=A | grep -i '\.env$'` at the user's explicit request and
  read the raw output — not an assumption from `.gitignore` looking
  correct now. Clean: the only history match is this file's own
  descriptive prose in a commit message; no `.env` has ever been added.

### Fixed session 9, CONFIRMED session 12 — dev server is reachable

- **Vite dev server was reachable by my own tooling but refused
  connections from the user's actual browser** (`ERR_CONNECTION_REFUSED`
  on `http://localhost:5173`). Root cause: Vite's default bound
  `[::1]:5173` (IPv6 loopback) only — confirmed via `netstat` showing no
  IPv4 entry at all. Fixed with `server: { host: true }` in
  `packages/client/vite.config.ts`; `netstat` now shows both `0.0.0.0` and
  `[::]` bound. **Verified two ways now:** (1) the fix itself — compiles,
  server starts, `netstat` shows correct dual-stack binding, my own
  Browser-pane tool loads the page with zero console errors; (2) the
  thing that actually mattered — **the user confirmed in their own
  browser, session 12, that it now loads.** Both parts of this are done;
  don't reopen unless something changes (e.g. a future Vite/dependency
  update resets `server.host`).
- **Session 12 wrinkle: the immediate cause that day wasn't a new
  IPv6 issue at all — the client dev server simply wasn't running.**
  `netstat` showed nothing on `:5173` before I started it. Checked for
  stale processes first (none found), started fresh via the Browser-pane
  tool's `preview_start`, confirmed dual-stack binding again, then the
  user confirmed it worked. The IPv6 fix from session 9 is still in
  place and still the right fix for that specific failure mode — this
  was just a reminder that "won't load" can have more than one cause,
  and checking whether the process is even running is step one.

### Half-done, with the exact seam

- **Homepage visual direction (violet/gold redesign).** Built and
  DOM/computed-style-inspected (colors, radii, etc. match spec exactly),
  but **no one has ever visually confirmed it in an actual rendered
  view** — the screenshot tool doesn't work in this sandbox (see the rAF/
  compositing decision further down), so "looks right" has never been
  checked by a human. Seam: open `http://localhost:5173` yourself and
  actually look at it. Nothing downstream has been blocked on this, but
  it's also never been signed off.
- **Games: 3 of 51 built** (Neon Runner/runner, Pixel Ninja Dash/reflex-
  timing, Sky Dodge/falling-block). Seam: 48 remain, across racer/
  arena-shooter/physics-table/turn-based-board/word-trivia (untouched)
  plus more runner/reflex-timing/falling-block reskins. Session 7's Q1
  (retrofit the 3 existing games to a new file-layout convention?) is
  still unanswered — don't guess, ask again if it matters before the next
  game gets built. Session 7's Q2 (seeded-RNG/inputLog/fixed-timestep) is
  now answered — see "NEXT SESSION: DETERMINISM FOUNDATION" at the top.
- **Backend: only auth exists.** `packages/server/src/routes/` has
  exactly one file, `auth.ts`. No matchmaking, wallet, real-time sync, or
  leaderboard routes/tables/anything. Seam: this is a from-scratch build
  for each of those, not an extension of existing code.
- **No client-side router.** `App.tsx` reaches the one extra page
  (Profile) via a hand-rolled `view` state, not `react-router-dom`. Seam:
  this will need to become a real router the moment a second real page
  (matchmaking lobby, wallet, leaderboard) shows up — it wasn't built
  now because there was only one extra page to reach.
- **`avatarUrl` and `gamesPlayed`/`gamesWon` columns exist but are
  inert.** `avatarUrl` is always null (client generates a placeholder
  avatar instead); `gamesPlayed`/`gamesWon` default to 0 and nothing
  anywhere increments them yet, because no match has ever been played.
  Seam: these become real the moment matches produce results to write.

### Noticed but deliberately not touched

- **No rate limiting on `/api/auth/login` or `/signup`.** Nothing stops
  repeated password-guessing attempts right now. Not added because it
  wasn't asked for and the right approach (in-memory vs. a shared store)
  depends on decisions not yet made — flagging so it isn't forgotten
  before this app has real users/stakes.
- **No CSRF token** — relying solely on the session cookie's `sameSite:
  lax` attribute, which helps but isn't complete CSRF protection. Same
  reasoning as above: not asked for, worth a deliberate look before money
  is involved.
- **`npm audit` reports 5 vulnerabilities (4 moderate, 1 high)**, all in
  `drizzle-kit`'s dev-only bundled `esbuild`/`esbuild-kit` dependency
  chain — not the runtime/production dependency tree. Did not run
  `npm audit fix --force` since that can introduce breaking changes and
  these don't ship to production; worth a deliberate look, not urgent.
- **JWT sessions have no revocation/blocklist and a 7-day expiry** with no
  refresh-token rotation. Deliberately simple for a practice-only phase —
  flagged repeatedly in this file as a pre-wallet-phase security revisit.
- **Supabase's dashboard pasted an "Install Agent Skills" suggestion**
  (`npx skills add supabase/agent-skills`) alongside the connection
  string the user gave — this read as generic Supabase UI copy, not a
  deliberate ask, so it was never run.

## Architecture status: BUILT vs PLANNED (2026-07-30 audit, session 10)

Standing rule going forward, also in `CLAUDE.md`: every architectural
claim in this repo's docs must be labeled BUILT or PLANNED. Anything not
verified in code right now is PLANNED — a doc saying something is
"established" or "in place" is not evidence by itself, and this project's
docs got ahead of the code once already (see below). Read this section
before trusting any older passage that describes something as already
working.

### BUILT (verified by reading the actual code, 2026-07-30)

**The `GameModule` interface, copied verbatim from
`packages/shared/src/gameModule.ts`:**

```ts
export type GameMode = "practice" | "match";

export type GameOverPayload = {
  score: number;
  reason: string;
  durationMs: number;
};

export interface GameModule extends EventTarget {
  init(container: HTMLElement, mode: GameMode, opponentSocket: WebSocket | null): void;
  start(): void;
  pause(): void;
  destroy(): void;
}

export type GameModuleFactory = () => GameModule;
```

`reason` and `durationMs` are real — every game's `GameOverPayload`
construction was grepped and matches this shape exactly. There is no
`seed` parameter in `init()` anywhere, in the interface or in any game.
There is no `inputLog` or `meta` field in `GameOverPayload` anywhere.

- Auth (signup/login/logout/session/profile) — verified via direct API
  calls + full browser click-through against the real Supabase DB.
- 3 games (Neon Runner, Pixel Ninja Dash, Sky Dodge), each independently
  implementing the interface above — engine logic verified via standalone
  `tsx` scripts, DOM/lifecycle verified by hand in-browser.
- `GameModule` loader + `GameLoader` host chrome.
- `games/registry.ts`'s `engine` field values (`runner`, `reflex-timing`,
  `falling-block`) — real, distinct values in real code. (Whether this
  represents a *validated* shared-engine model is a separate question —
  see PLANNED below. The field existing and being distinct is BUILT; the
  abstraction it implies is not.)
- Monorepo scaffold, theme/design system, Express/Drizzle/Postgres server.

### PLANNED (verified absent — grepped/read the whole repo, none of this exists)

- **Seeded RNG.** No `createSeededRandom`/seeded-PRNG utility exists
  anywhere in the repo. All 3 games use raw `Math.random()` for
  gameplay-affecting randomness (obstacle spawns, timing, positions), not
  just cosmetic particles. (Full call-site list now in "NEXT SESSION:
  DETERMINISM FOUNDATION" at the top of this file.)
- **`inputLog`.** Does not exist anywhere. No game records
  `{ timestamp, action }` or anything resembling it.
- **Fixed-timestep update loop.** All 3 games use a variable-timestep
  loop (`dt = Math.min(0.05, (now - lastFrameTime) / 1000)`), not a
  fixed-timestep accumulator.
- **`seed` parameter in `GameModule.init()`.** Not in the interface, not
  in any game. Real signature: `init(container, mode, opponentSocket)`.
- **`seed`/`inputLog` fields in `GameOverPayload`.** Not present. Real
  shape: `{ score, reason, durationMs }`.
- **Shared engine abstraction.** Each of the 3 games has a fully
  independent `engine.ts`; zero code is shared between them — every
  import in every game's `engine.ts`/`index.ts` resolves to that game's
  own local files or `@arcadeclash/shared`, never another game. What
  looks shared is structural convention (similar class shapes, method
  names) applied by hand each time, not an actual abstraction.
- **The 8-engine cluster model, as a validated abstraction.** 3 of 8
  engine labels are used, each by exactly one game. **No two built games
  have ever shared an engine cluster — the "one representative game per
  engine, then reskins" plan has never been tested.** There's no evidence
  yet that a second `runner` game could reuse Neon Runner's engine rather
  than needing its own from scratch, like all 3 games so far did
  independently.
- **Per-game file-layout convention** (`index.ts`/`engine.ts`/`skin.ts`/
  `README.md`, theme-sourced colors) — proposed session 7, never adopted
  by any of the 3 built games, never confirmed by the user.
- Matchmaking, wallet, real-time sync, leaderboards — not started.

**Status as of session 11 (this doc-restructure session): seeded RNG,
fixed-timestep, and `inputLog` are still PLANNED, not built — this
session was documentation-only (see session 11 log below and the
"NEXT SESSION" brief at the top). Building them is explicitly the next
session's job.**

## Known gaps (blockers for public deployment, NOT for localhost dev)

None of these block continued local development. All of them should
block shipping this publicly or handling real money:

- **No rate limiting on `/api/auth/login` or `/api/auth/signup`.**
  Nothing stops repeated password-guessing attempts.
- **No CSRF token** — relying solely on the session cookie's
  `sameSite: lax` attribute, which helps but isn't complete protection.
- **JWT sessions have a flat 7-day expiry, no revocation/blocklist
  mechanism, and no refresh-token rotation.** A leaked token stays valid
  for up to 7 days with no way to force a logout.

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
As of session 10, the determinism foundation (seeded RNG/fixed-timestep/
inputLog) is now confirmed to come BEFORE matchmaking — see "NEXT SESSION"
at the top of this file.

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

**New per-game conventions, introduced session 7 — PLANNED, not adopted
by any built game (confirmed by the 2026-07-30 audit, "Architecture
status" above). Do not read the rest of this paragraph as describing
current reality:** going forward, every game
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

**Two open questions, asked in session 7 — Q2 is now resolved, Q1 is
still open (do not guess at Q1, ask again if a fresh session needs it and
it's still blank):**
1. **STILL OPEN.** Should Neon Runner / Pixel Ninja Dash / Sky Dodge be
   retrofitted to the file-layout conventions above (they currently use
   `constants.ts`, no README, hardcoded local palettes — none of the new
   file-layout conventions)? Or apply new conventions going forward only,
   or never retrofit them? **Note: this is distinct from the determinism
   retrofit below, which session 10 DID resolve — don't conflate the
   two.**
2. **RESOLVED session 10.** The user asked for "seeded RNG and inputLog
   additions" to the `GameModule` interface as if they already existed —
   they don't, confirmed by the session 10 audit. Also asked for a
   fixed-timestep update loop (all 3 built games currently use variable
   `dt` per frame). Session 10's follow-up confirmed: yes, build seeded
   RNG + fixed-timestep + `inputLog`, retrofit all 3 games, two RNG
   streams (gameplay/cosmetic) from one seed. Full brief in "NEXT
   SESSION: DETERMINISM FOUNDATION" at the top of this file. The exact
   `inputLog` key shape (`{ timestamp, action }` vs. `{ tick, action }`)
   is the one remaining open detail — see that section.

Until Q1 is answered: don't rename any of the 3 games' files or add
per-game READMEs without asking first. The determinism work (Q2) is
separately greenlit and does not require Q1 to be answered first.

## Games built (games-building phase progress)

| Game | Engine | Status |
|---|---|---|
| Neon Runner | runner | ✅ built + tested, practice mode only |
| Pixel Ninja Dash | reflex-timing | ✅ built + tested, practice mode only |
| Sky Dodge | falling-block | ✅ built + tested, practice mode only |

48 of 51 remaining. Update this table each time a game is finished.

**Engine column note:** these are real, distinct field values in
`games/registry.ts` (confirmed by the 2026-07-30 audit), but no two of
these three games share actual engine code — see "Architecture status"
above. Don't read this table as evidence the 8-engine shared-code model
works; it hasn't been tested yet.

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
│   │                            # NOTE: no rng.ts yet — PLANNED, next session builds it
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
8. **Session close-out:** deleted the `testplayer1`/`browsertest` test
   accounts from the real database (table confirmed empty after). Ran a
   git-history audit at the user's request — `git log -p --all -S
   'supabase.co'` and `git log --all --name-only --diff-filter=A | grep
   -i '\.env$'` — to check whether any credential had ever been committed,
   not just whether `.gitignore` covers it now. Result: clean. The only
   history match for "supabase.co" is descriptive prose in this file's own
   commit message; no `.env` file has ever been added in this repo's
   history. Rewrote this file's opening into the "Status summary" section
   above per the user's explicit ask for a from-scratch-reader-friendly
   status doc, separate from the session-by-session log below it.

### Session 9 (2026-07-30) — dev server unreachable, fixed, confirmed session 12

User reported `http://localhost:5173` gave `ERR_CONNECTION_REFUSED` in
their actual browser, despite the server running and reachable through my
own tooling. Diagnosed via `netstat`: Vite's default had bound only
`[::1]:5173` (IPv6 loopback), no IPv4 entry at all — the user's browser
likely tried `127.0.0.1` first and found nothing listening. Fixed with
`server: { host: true }` in `packages/client/vite.config.ts`, restarted
properly (PowerShell process kill, not `pkill` — see that decision
below), confirmed via `netstat` that both `0.0.0.0` and `[::]` are now
bound, and confirmed the page still loads with zero console errors
through my own tooling. One commit.

**Update, session 12: the user confirmed their own browser can now reach
it — see the session 12 entry below.** This sat as fixed-but-unconfirmed
for two sessions; it's fully resolved now, not just fixed-by-tooling.

### Session 10 (2026-07-30) — read-only audit, then doc cleanup

User asked for a read-only code audit (no files touched) of several
assumptions matchmaking would depend on: how many distinct engines the 3
built games actually use, whether the engine abstraction is real code-
sharing or copy-paste, whether the `GameModule` interface matches a
`seed`/`inputLog`/`meta` spec, whether seeded RNG/fixed-timestep/
`inputLog` actually exist, and a verbatim quote of session 7's two open
questions. Answered each by reading the actual files and grepping —
findings: registry labels are 3 distinct values as claimed, but the
"engine" abstraction is not real (zero shared code between the 3 games'
`engine.ts` files, confirmed via import analysis); the `GameModule`
interface has no `seed` param and `GameOverPayload` has no `inputLog`/
`meta`, only `{ score, reason, durationMs }`; seeded RNG/`inputLog`/
fixed-timestep don't exist anywhere (grepped, zero matches) — all 3 games
use raw `Math.random()` and a variable-`dt` loop.

Then, this session: documentation-only cleanup (no code touched) in
response to that audit. Listed every file in the repo making
architectural claims (`PROGRESS.md`, `GAMES.md`; confirmed no `CLAUDE.md`
and no game `README.md`s exist; noted the 51-game design doc lives
outside the repo and `packages/client/README.md` is untouched generic
Vite scaffold with no ArcadeClash-specific claims). Added the
"Architecture status: BUILT vs PLANNED" and "Known gaps" sections above,
corrected the engine-classification and session-7-conventions passages to
explicitly say PLANNED/RESOLVED rather than reading as established,
updated "Exact next step" and "What's next" to make the determinism
foundation the actual next step ahead of matchmaking, updated `GAMES.md`
similarly, and created `CLAUDE.md` at the repo root with the four
standing rules the user specified (code is the source of truth over
docs; grep before assuming a feature exists; every `PROGRESS.md` claim
states its verification method; new claims default to PLANNED). Did not
delete any historical narrative — corrections were added inline as
`RESOLVED`/superseded markers, per explicit instruction to preserve
original intent.

### Session 11 (2026-07-30) — session close, doc restructure, handoff

Documentation and summary only, no code changes — explicit scope.
Restructured this file: pushed the large "Status summary" (now
"Detailed status") and everything after it down, and replaced the top of
the file with a genuinely-60-seconds-readable status summary plus a new
"NEXT SESSION: DETERMINISM FOUNDATION" section containing everything that
session needs cold — the `GameModule` interface verbatim, the current
variable-dt loop as written (with exact file:line references in all 3
games), every `Math.random()` call site across the 3 games labeled
gameplay-affecting or cosmetic-only (17 sites, 7/10 split), the decisions
already made (retrofit all 3 games yes; build seeded RNG + fixed
timestep + inputLog yes; two RNG streams — gameplay and cosmetic — from
one seed, yes; matchmaking after determinism, not before), the two small
code cleanups queued (dead fields in `sky-dodge/engine.ts`, a magic
number in `pixel-ninja-dash/engine.ts`), and the one real open question
(`inputLog` keyed on `{ timestamp, action }` or `{ tick, action }`).

Re-read `GAMES.md`, `PROGRESS.md` (post-restructure), and `CLAUDE.md`
fresh, as instructed, checking specifically: (1) anything that would make
a new session believe seeded RNG/inputLog/fixed-timestep/shared-engines
already exist, (2) any claim missing a stated verification method, (3)
any internal contradiction. `GAMES.md` and `CLAUDE.md` were already clean
from session 10's pass — no changes needed. In `PROGRESS.md`, found and
fixed: the "Architecture status" PLANNED list didn't explicitly restate
that session 11 itself was documentation-only and didn't build any of the
PLANNED items (a reader could otherwise wonder whether "session 11"
quietly built something) — added an explicit line confirming they're
still PLANNED after this session too. No contradictions found between
the new top summary and the detailed sections below. See the top of this
file for the full "what was fixed" list if this section is trimmed later.

### Session 12 (2026-07-30) — dev-server unreachable again, different cause, now confirmed working

User asked for a link to `PROGRESS.md`, then reported `localhost` still
didn't work in their browser. Checked `netstat` first: the client dev
server wasn't running at all (`:5173` had no listener) — the API server
on `:4000` was still up. This is a different immediate cause than session
9's IPv6-binding issue (which is still fixed and still in place, confirmed
via the dual-stack binding once the server restarted). Checked for stale
`node`/`vite` processes via PowerShell first (none found — clean), started
the client dev server via the Browser-pane tool's `preview_start`,
confirmed `netstat` showed both `0.0.0.0:5173` and `[::]:5173` bound, and
confirmed zero console errors on load. **The user then confirmed in their
own browser that it works now.** This is the first time this specific
item — "does the user's own browser reach the app" — has an actual
user-confirmed yes behind it, not just tooling-side verification. Updated
the session 9 entry and the "Detailed status" section above to reflect
this; removed the now-resolved "also unconfirmed" line from the 60-second
summary at the top (a resolved item doesn't need to occupy space in a
section meant to be a minimal, current-state snapshot — the resolution is
recorded here and in the amended session 9 entry instead). No code
changes this session, one commit for the doc update.

## Decisions / tradeoffs (read before changing structure)

- **On this machine, Vite's default (no `server.host` set) resolved
  "localhost" to IPv6-only (`::1`)** — `netstat` showed only a
  `[::1]:5173` entry, no IPv4 one. The user's real browser tried the
  IPv4 loopback first and got `ERR_CONNECTION_REFUSED`, even though the
  dev server was genuinely running and I could reach it fine through the
  Browser-pane tool (which apparently resolves/connects differently).
  Fixed with `server: { host: true }` in `vite.config.ts`, which binds
  both `0.0.0.0` and `[::]` — confirmed via `netstat` afterward. If a
  fresh agent hits "server is running but the user says the page won't
  load," check this first before assuming the server crashed.
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
  category is about, not the win condition).
  **RESOLVED 2026-07-30: the user confirmed the registry is correct — the
  three games are genuinely mechanically different, not reskins of one
  engine.** Separately from the labels being correct, though: no two of
  the 3 built games have ever shared an engine cluster (see "Architecture
  status" above), so the underlying shared-engine/reskin model itself is
  still completely untested — that's a different question from whether
  the labels are right, and the labels being right doesn't answer it.
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

**Current priority — see "NEXT SESSION: DETERMINISM FOUNDATION" at the
top of this file for the full, self-contained brief. Summary below, kept
for history rather than renumbered/deleted:**

0. **(Added session 10, actually first) Build the determinism
   foundation** — seeded RNG, fixed-timestep loop, `inputLog`, retrofit
   all 3 existing games to use all three. Confirmed by the user as the
   real next step, ahead of matchmaking. See the top of this file for the
   full detail on scope, decisions already made, and the one open
   question.
1. ~~Auth & profile~~ ✅ built AND verified end-to-end against the real
   Supabase database session 8 — signup/login/logout/profile all
   confirmed working via direct API calls and through the actual browser
   UI. Two test accounts (`testplayer1`, `browsertest`) existed in the
   real DB from verification; deleted in session 8's close-out — table
   confirmed empty.
2. Matchmaking, real-time sync, and wallet — not started, and now
   explicitly AFTER item 0 above, not next. Build order among these three
   wasn't specified; ask before assuming.
3. Once matchmaking/etc. are built, validate against **one existing
   game** (not yet chosen which — Neon Runner is the simplest candidate)
   before assuming the approach generalizes to the other 48 unbuilt + 3
   built games, per the user's explicit instruction.
4. Games-building (48/51 remaining) resumes after systems work (or
   interleaved — confirm with the user rather than assuming which).
   Session 7's Q1 (file-layout convention retrofit — `skin.ts`/
   `README.md`) is still genuinely unanswered, distinct from item 0's
   determinism retrofit above — don't conflate them, don't guess at Q1.
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

Server needs `packages/server/.env` with a real `DATABASE_URL` — this is
already set up and working as of session 8 (a real Supabase database),
should not need touching again unless the credential changes.
**If you restart the server, don't use `pkill` (see the decision above on
why) — use PowerShell's `Get-CimInstance`/`Stop-Process`, and confirm via
`netstat` that the new process actually holds port 4000.**

Check `git log --oneline` for the checkpoint history if you need more detail
than this file provides.
