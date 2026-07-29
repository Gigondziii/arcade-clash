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

**Status correction:** the GameModule loader (`init/start/pause/destroy` +
`gameOver` event interface) does **not** exist yet as of the start of this
phase, despite being referred to conversationally as "the loader we just
built." `packages/shared/src/index.ts` is still `export {}`. Building this
loader is the first prerequisite of the games phase — every game needs it
to plug in — and is **not** one of the deferred items above; it's required
infrastructure, not a backend/multiplayer system.

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
│   │       └── pages/HomePage.tsx
│   ├── server/                 # PLACEHOLDER — package.json + empty src/index.ts, no deps yet
│   ├── shared/                 # PLACEHOLDER — package.json + empty src/index.ts, no types yet
│   └── theme/                  # design system package — see below
│       └── src/
│           ├── theme.css       # :root CSS custom properties + .ac-* base classes
│           ├── tokens.ts       # colors/categoryColors objects + getThemeColor()
│           └── index.ts
└── games/
    ├── package.json            # @arcadeclash/games workspace package
    ├── registry.ts              # typed GameRegistryEntry[] — empty, no games added yet
    └── <game-name>/             # (none yet — this is where each future game lives)
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

## What's next

**Current priority (games-building phase, see above):**

1. Build the GameModule loader — `init/start/pause/destroy` + `gameOver`
   event interface — in `packages/shared`, plus whatever minimal client-side
   mount/unmount harness (`packages/client/src/game-loader/` per the
   originally proposed structure) is needed to run one solo in the browser.
   This is the first real task of this phase.
2. Build and test the 51 games one at a time / by engine cluster, each
   solo/practice-only, plugging into the loader above. The user feeds specs
   from an external design doc one at a time — this file won't have the
   spec content, only what's actually been built.
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
