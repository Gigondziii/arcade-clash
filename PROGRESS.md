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

## Current phase: games-building (solo/practice only)

**As of 2026-07-29 (session 3), this is a dedicated games-building phase.**
Goal: implement and fully test all 51 mini-games from the (external) design
doc — one at a time, or by engine cluster where it makes sense — each
running solo in practice mode through the GameModule loader. No opponent,
no real-time sync, no backend systems beyond what a single-player game
needs client-side.

**Explicitly out of scope until the user says otherwise. Do not build,
stub further, or suggest building any of these — even if a game's spec
describes multiplayer/opponent behavior, skip or no-op that part and ship
only the solo/practice version:**
- Auth & user profiles
- Matchmaking (practice/for-fun/for-stakes queue)
- Wallet / stakes / escrow system
- Leaderboards
- Real-time opponent sync (WebSocket match state, etc.)

These are deliberately deferred to a separate phase **after** all 51 games
are built and tested individually — not forgotten, not an oversight. If a
fresh agent reads this cold: do not "helpfully" start scaffolding any of
the five items above during this phase, even partially.

**Status correction (resolved in session 4):** at the start of this phase
the GameModule loader didn't exist yet, despite earlier being referred to
conversationally as "the loader we just built." It's now built — see
`packages/shared/src/gameModule.ts` (the interface) and
`packages/client/src/game-loader/` (the host that mounts a module and
shows the results screen). Games can plug in from here on.

## Games built (games-building phase progress)

| Game | Engine | Status |
|---|---|---|
| Neon Runner | runner | ✅ built + tested, practice mode only |
| Pixel Ninja Dash | reflex-timing | ✅ built + tested, practice mode only |

49 of 51 remaining. Update this table each time a game is finished.

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
│   │       ├── App.tsx        # renders HomePage
│   │       ├── lib/format.ts  # formatPlays(), engineLabel() display helpers
│   │       ├── mock/homeData.ts   # PLACEHOLDER data — see "Decisions" below
│   │       ├── components/    # Navbar, Hero, TrendingArena, GameCard, StarRating, icons
│   │       ├── game-loader/   # GameLoader.tsx (host chrome + results screen), gameFactories.ts
│   │       └── pages/HomePage.tsx
│   ├── server/                 # PLACEHOLDER — package.json + empty src/index.ts, no deps yet
│   ├── shared/                 # package.json + src/gameModule.ts (GameModule interface) + index.ts
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

## Decisions / tradeoffs (read before changing structure)

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

**Current priority (games-building phase, see above):**

1. ~~Build the GameModule loader~~ ✅ done session 4 (`packages/shared` +
   `packages/client/src/game-loader/`).
2. Build and test the remaining 50 games one at a time / by engine cluster,
   each solo/practice-only, plugging into the loader. The user feeds specs
   from an external design doc one at a time — this file won't have the
   spec content, only what's actually been built. Update the "Games built"
   table above as each one lands. For each new game: verify pure game
   logic via `npx tsx` (see the sandbox-limitation decision above), verify
   DOM/lifecycle wiring by hand in the Browser pane, add it to
   `games/registry.ts` + `games/package.json`'s exports map +
   `gameFactories.ts`, and make it clickable from somewhere on the
   homepage/trending grid so it's actually reachable for testing.
3. Homepage direction (session 2's violet/gold redesign) is still pending
   the user's explicit visual confirmation — propagating the `Navbar` +
   `.ac-card` style to other pages stays paused until then, independent of
   the games work above.

**Deferred until all 51 games are built and tested (do not start early —
see "Current phase" above for the full list and rationale):**

- Auth & profile (username, avatar, stats)
- Matchmaking queue (practice/for-fun/for-stakes + escrow data model)
- Wallet system (play-money balance, placeholder deposit/withdraw UI)
- Leaderboards (per-game + global)
- Real-time opponent sync

The homepage's "LIVE ARENA" player count and "View Leaderboards →" link
stay mock/dead until matchmaking and leaderboards are eventually built.

## How to resume

```bash
cd C:/Users/abuse/arcadeclash
# PowerShell only, until PATH is fixed:
$env:Path = "C:\Program Files\nodejs;" + $env:Path
npm run dev -w packages/client   # http://localhost:5173
```

Check `git log --oneline` for the checkpoint history if you need more detail
than this file provides.
