# ArcadeClash — Progress Log

Self-contained handoff doc. Read this first at the start of every session —
conversations don't carry over, and work may resume from a different tool.

## Project summary

Hub of short (60–180s) head-to-head arcade mini-games. Solo practice, or
matched play (for-fun / for-stakes with play-money escrow; real-money hooks
stubbed only, not wired up). React frontend, Node/Express + Socket.IO
backend, Postgres via Drizzle ORM. Dark neon design system (near-black bg,
cyan/magenta/purple glow accents) shared by every game module.

Full 51-game design doc lives outside this repo — the user feeds one game
spec at a time, starting with one representative game per engine (Runner,
Racer, Arena Shooter, Falling-Block/Match, Physics-Table/Bounce, Turn-Based
Board, Reflex-Timing, Word/Trivia), then faster reskins for the rest.

Repo root: `C:\Users\abuse\arcadeclash`

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
│   │       ├── App.tsx        # currently just renders ThemePreview
│   │       └── pages/ThemePreview.tsx
│   ├── server/                 # PLACEHOLDER — package.json + empty src/index.ts, no deps yet
│   ├── shared/                 # PLACEHOLDER — package.json + empty src/index.ts, no types yet
│   └── theme/                  # design system package — see below
│       └── src/
│           ├── theme.css       # :root CSS custom properties + .ac-* base classes
│           ├── tokens.ts       # colors object + getThemeColor() for canvas/WebGL games
│           └── index.ts
└── games/
    ├── package.json            # @arcadeclash/games workspace package
    ├── registry.ts              # typed GameRegistryEntry[] — empty, no games added yet
    └── <game-name>/             # (none yet — this is where each future game lives)
```

## What was built this session (2026-07-29, session 1)

1. Git initialized, repo-local identity set (`abuseridzerati@gmail.com` /
   "ArcadeClash Dev" — user didn't specify one when asked, changeable via
   `git config user.name`/`user.email`).
2. `.gitignore` + npm workspace root `package.json`.
3. Client scaffolded via `npm create vite@latest -- --template react-ts`,
   renamed to `@arcadeclash/client`, Vite boilerplate (demo App.tsx/CSS,
   sample assets) stripped out.
4. `packages/server`, `packages/shared` created as empty placeholders
   (package.json + stub `src/index.ts` only — no auth/API/DB code yet).
5. `games/registry.ts` created with the `GameEngine` union type (the 8
   engines) and typed, empty `gameRegistry` array.
6. **Design system built** (`packages/theme`): CSS custom properties for
   color (surfaces, cyan/magenta/purple accents, semantic success/danger/
   warning, text), typography (font stacks, size scale xs→4xl, weights,
   line-heights), spacing (4px-based scale), radius, and layered glow
   box-shadows per accent color. Plus a handful of reusable base classes
   (`.ac-panel`, `.ac-border--{cyan,magenta,purple}`, `.ac-btn` + variants)
   so components/games style via classes instead of repeating raw values.
   `tokens.ts` mirrors the hex values for canvas/WebGL-based games that
   can't use CSS vars directly, plus a `getThemeColor()` helper that reads
   the live computed value from `:root`.
7. Theme wired into the client: `main.tsx` imports `theme.css` once at the
   app root; a `ThemePreview` page renders every color swatch, the type
   scale, three glow panels (styled as Practice/For Fun/For Stakes cards),
   and the three button variants.
8. Verified working: `npm install` resolved the workspace symlink
   (`@arcadeclash/theme` hoisted to root `node_modules`), Vite dev server
   served the theme package's CSS/TS straight from source
   (`/@fs/.../packages/theme/src/theme.css` → 200), and computed styles in
   the browser confirmed the tokens actually apply (body background
   `#05060a`, cyan panel border + glow shadow matching `--glow-cyan`
   exactly). Screenshot tool couldn't render in this sandbox, so
   verification was via computed-style inspection + page text + network
   log instead of a visual screenshot — user should eyeball
   `http://localhost:5173` themselves to sanity-check the look.
9. Four commits made at logical checkpoints (see `git log`): empty scaffold
   → folder structure → theme package → theme wired into client.

## Decisions / tradeoffs (read before changing structure)

- **Theme is its own package (`packages/theme`), not `packages/client/src/theme`
  as originally sketched in the pre-scaffold proposal.** Reason: game
  modules under `/games/<name>/` need the theme too, and they must not
  depend on `packages/client` (client's game-loader will depend on
  `games/registry.ts`, so the reverse dependency would be circular).
  Because CSS custom properties cascade from `:root`, a game mounted inside
  the client's DOM tree gets the theme for free without importing anything;
  `@arcadeclash/theme`'s plain-TS `colors`/`getThemeColor()` export covers
  the canvas/WebGL case where a game needs an actual color value instead of
  a `var(--x)` string.
- **No light theme / theme toggle.** The brief describes one fixed dark
  neon aesthetic, not a user-switchable theme, so `theme.css` only defines
  one mode.
- **No custom display font yet** — using the system font stack to stay
  dependency-free. If the user wants a more distinctive arcade/pixel feel
  (e.g. a Google Font), that's an open follow-up, not yet decided.
- **`packages/server` and `packages/shared` are empty placeholders** — just
  enough for the workspace to resolve them. No Express/Socket.IO/Drizzle/pg
  dependencies added yet; deliberately deferred until server work actually
  starts (next session), to keep this session's `npm install` lean.
- **Environment quirk (this machine only):** Node.js is installed at
  `C:\Program Files\nodejs` (v24.18.0) but is **not on the system PATH**.
  Plain `node`/`npm` fail in a fresh shell until PATH is fixed. Worked
  around this session by prefixing PATH inline per command. This isn't a
  repo concern, but it'll bite again next session — the user should add
  `C:\Program Files\nodejs` to their PATH permanently (Windows Settings →
  Environment Variables) since modifying system PATH isn't something I do
  unprompted. Until then, prefix commands with:
  `$env:Path = "C:\Program Files\nodejs;" + $env:Path` (PowerShell).
- Created `C:\Users\abuse\.claude\launch.json` and `run-client.bat`
  (**outside the repo**, machine-local) so the Browser-pane preview tool
  can launch the Vite dev server despite the PATH issue above. Not part of
  the project; don't try to find these in the repo.

## What's next

Core systems, in order (per original brief):

1. ~~Project scaffold + shared design system/theme~~ ✅ done this session
2. **Auth & profile** (username, avatar, stats) — start here next session
3. Game module loader (`init/start/pause/destroy` + `gameOver` event
   interface any mini-game plugs into) — this will define the contract
   that eventually lives in `packages/shared`
4. Matchmaking queue: practice (solo) / for-fun (matched, no stakes) /
   for-stakes (matched, play-money escrow — data model + UI only, no real
   payment processing)
5. Wallet system (play-money balance, placeholder deposit/withdraw UI)
6. Leaderboards (per-game + global)

Only after all six are in place: first representative game per engine
(spec fed one at a time by the user), then reskins for the remaining 43.

## How to resume

```bash
cd C:/Users/abuse/arcadeclash
# PowerShell only, until PATH is fixed:
$env:Path = "C:\Program Files\nodejs;" + $env:Path
npm run dev -w packages/client   # http://localhost:5173
```

Check `git log --oneline` for the checkpoint history if you need more detail
than this file provides.
