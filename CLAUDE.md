# Fugluck — standing rules

Read `PROGRESS.md` first (self-contained handoff doc, updated every
session) and `GAMES.md` (per-game manifest) before doing anything else.
This file holds durable process rules, not project status — status lives
in `PROGRESS.md`.

## Documentation rules (added 2026-07-30, after an audit found docs claiming features as "established" that didn't exist in code)

1. **Code is the source of truth.** If a doc (`PROGRESS.md`, `GAMES.md`,
   a game's own files, anything) and the actual code disagree, the code
   wins. Correct the doc — don't treat the doc as authoritative just
   because it's more detailed or was written more recently than the code
   changed.

2. **Never assume an architectural feature exists because a doc
   describes it.** Grep or read the actual source first. A doc saying
   "seeded RNG is in place" or "engines are shared across games" is a
   claim, not evidence — verify it before building on top of it,
   especially before a new system (matchmaking, wallet, etc.) is about to
   depend on the claim being true.

3. **Every claim in `PROGRESS.md` must state how it was verified**: ran a
   test / read the code / user confirmed in their own browser / assumed.
   "Assumed" is a legitimate answer — write it down as assumed rather
   than omitting the verification method or implying a stronger check
   happened.

4. **Mark every architectural claim BUILT or PLANNED.** New claims
   default to PLANNED until someone actually verifies them in code (by
   reading it, grepping it, or running it) — don't write something as
   built based on it having been discussed, proposed, or intended.

5. **Before reporting a session complete, run every test script in
   `scripts/`, not just the ones touched by that session's work, and
   report each script's pass count explicitly.** "Tests pass" without a
   count is not verification. Added 2026-07-31 after
   `scripts/matchmaking-check.ts` silently failed 6 assertions for two
   sessions — a payload-shape change in one session's work (score
   validation requiring `inputLog`/`viewport` on every submission) broke
   a different, unrelated script that nobody re-ran to check.

## Environment gotchas (this machine specifically — see PROGRESS.md "Decisions" for full detail on each)

- Node.js is not on the system PATH — prefix PowerShell commands with
  `$env:Path = "C:\Program Files\nodejs;" + $env:Path`.
- Restart the server via PowerShell (`Get-CimInstance Win32_Process` +
  `Stop-Process`), not git-bash's `pkill` — it silently fails to kill
  Windows-native node processes, leaving stale servers with stale env
  vars. Confirm via `netstat` that the new process actually holds the
  port.
- Vite needs `server: { host: true }` in `vite.config.ts` for the dev
  server to be reachable via IPv4 on this machine (already set).
- Before reporting any UI element or feature as missing/broken, run
  netstat and confirm BOTH the client (5173) AND the Express server
  are LISTENING. A dead backend presents as silently missing features
  (no Find Opponent, cannot log in), not as an error message.
  Third occurrence of an environment-state false alarm — see sessions
  9, 12, and 20.

## Architecture Invariant: Fixed Virtual Resolution (added 2026-08-10)

- **Canonical Virtual Viewport**: All game engines (`RunnerEngine`, `DashEngine`) and replay adapters MUST run strictly against `VIRTUAL_VIEWPORT = { width: 1280, height: 720 }` (`@fugluck/shared`).
- **Letterboxed Client Rendering**: Physical canvas elements MUST letterbox (`object-fit: contain`, 16:9 aspect ratio) inside host containers.
- **Equal Stakes Integrity**: `engine.resize()` MUST always receive `1280x720` to guarantee identical physics, obstacle travel distance, and scoring regardless of client monitor resolution or display width.

## Architecture Invariant: Freeze-Frame Auto-Forfeit Validation (added 2026-08-10)

- **Server-Side Pacing Enforcement**: `validateScore()` rejects submissions with `verdict: "invalid"` and `reason: "freeze_frame_detected"` whenever real-world duration (`durationMs` or intra-log `wallMs` gaps) exceeds simulated tick progress by more than `FREEZE_FRAME_THRESHOLD_SEC = 3.0` seconds.
- **Reconnection Window Independence**: Legitimate socket disconnects re-authenticating within the 10-second grace window (`RECONNECT_GRACE_MS = 10_000`) resume match synchronization cleanly without triggering freeze-frame auto-forfeit.

## Architecture Invariant: 4-Tier Platform Match Modes (added 2026-08-10)

- **Solo Practice Mode**: Offline local canvas play without server queueing or ledger transaction.
- **COINS Mode (In-Game Fun)**: 0% Platform Rake (`COINS_RAKE_PERCENT = 0`). Winner receives 100% of pot (`stake * 2`). No fee entry created.
- **DIAMONDS Mode (Competitive Staking)**: 5% Platform Rake (`DIAMONDS_RAKE_PERCENT = 5`). Winner receives 95% of pot (`stake * 2 * 0.95`). 5% is credited to `platform_rake_account`.
- **Zero-Registration Guest Instant Play**: Unauthenticated guests (`guest_<id>`) can create or join instant matches via `/play/invite/:code`. All guest matches strictly enforce `stake = 0` (Free Play). Sockets flagged with `isGuest = true` attempting to join wagering matches are rejected with `reason: "guests_cannot_wager"`.

## Architecture Invariant: Starting Grant & Monthly 1,000 COIN Allowance Refill Engine (added 2026-08-10)

- **Starting Grant**: New user registration issues 1,000 COINS (`SIGNUP_COIN_GRANT = 1000`).
- **Monthly Refill Engine**: Executed on login/me (`checkAndApplyMonthlyAllowance(userId)`). Uses month key `monthly_allowance_refill:YYYY-MM`. If COINS balance < 1,000, grants `1000 - balance` to top off balance to 1,000 COINS. If COINS balance ≥ 1,000, grants 0 COINS to leave balance untouched.

## Architecture Invariant: Navigation Layout & Profile Social Access (added 2026-08-10)

- **Clean Top Header Navigation**: Primary navbar (`Navbar.tsx`) is kept clean and un-cluttered without standalone "Friends" or "Invites" header buttons.
- **Profile-Embedded Social Management**: Full friends management (friend requests, friend list, inviting friends to matches) remains accessible via the User Profile view (`ProfilePage.tsx`) when clicking an avatar or profile.
- **Backend Schema Preservation**: The `friendships` database schema, backend API routes (`/api/friends`), and Socket.IO friend invite handlers remain 100% intact.

## Architecture Invariant: Match Recording & Server-Side Anti-Cheat Simulation (updated 2026-08-18)

- **Database Match Persistence**: Upon match completion in `emitResolved()`, match metadata (`id`, `gameId`, `player1Id`, `player2Id`, `winnerId`, `currency`, `stake`, `seed`, `inputLogP1`, `inputLogP2`, `scoreP1`, `scoreP2`) is asynchronously persisted to the `matches_history` PostgreSQL table.
- **REST Match History Endpoint**: `GET /api/matches/history` returns the authenticated user's past 20 matches enriched with opponent usernames and outcome flags (`win`, `loss`, `draw`).
- **Deterministic Server-Side Anti-Cheat Validation**: Server feeds match `seed` and player `inputLog` into the generic `replayEngine` (`@fugluck/shared`) and game-specific `replayAdapters` (`@fugluck/games`) in `scoreValidator.ts` for authoritative headless score validation. (Client-facing `ReplayModal` removed by product decision).

## Architecture Invariant: Interactive Betting Window & Stake Selection (added 2026-08-10)

- **Stake Picker Step**: Clicking "Play with COINS" or "Play with DIAMONDS" in `LaunchModal.tsx` opens a dedicated Stake Selection Step with preset wager buttons (COINS: 25, 50, 100, 250, 500; DIAMONDS: 5, 10, 25, 50, 100) and a Custom Wager input field.
- **Balance Validation**: Real-time validation disables submission if wager exceeds available user balance.
- **Socket Queue Emission**: The chosen `stake` and `currency` are emitted cleanly in `joinQueue` (`{ gameId, currency, stake }`).

## Architecture Invariant: Strict Queue Stake Isolation & Financial Settlement (added 2026-08-10)

- **Queue Isolation**: Matchmaking queues in `queue.ts` are bucketed by composite key `${gameId}:${currency}:${stake}`. Players pair ONLY if `gameId`, `currency`, and `stake` match identically.
- **Escrow Debit**: When a match starts (`createMatch()`), `escrowStake` debits both players' ledger balances (`stake_escrow:${matchId}`).
- **Winner Payout**: Upon match resolution (`emitResolved()`), `payoutWinner` credits the winning player `stake * 2` for COINS (0% rake) or `stake * 2 * 0.95` for DIAMONDS (5% rake to platform).

## Architecture Invariant: Auth Session Persistence & Post-Match Balance Rehydration (updated 2026-08-11)

- **Supabase LocalStorage Session Rehydration**: `AuthContext.tsx` integrates Supabase client (`lib/supabase.ts`) with `auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage }` and calls `supabase.auth.getSession()` + `onAuthStateChange()`, preserving user identity on page refreshes (`F5`).
- **Socket Token Attachment**: Sockets pass session JWT tokens in `auth: { token }` upon connection (`useMatchSocket.ts`), and `socketAuthMiddleware` in `socketAuth.ts` verifies token payload to attach authenticated `userId` (preventing forced guest 0-stake matches).
- **Financial Ledger Settlement**: `escrowStake` inserts `stake_escrow:${matchId}` on match start; `payoutWinner` inserts `stake_payout:${matchId}` on match completion (`stake * 2` for COINS, 0% rake) with explicit `.returning()` row validation and real-time `balanceUpdate` socket emissions.
- **Post-Match UI Balance Refetch**: Upon receiving `matchResolved` in `MatchLoader.tsx`, `refreshUser()` is called automatically to re-fetch live derived PostgreSQL balances, updating COINS and DIAMONDS in the UI immediately without requiring a manual refresh.

## Architecture Invariant: Live Public Queue Broadcast & 1-Click Lobby Matchmaking (added 2026-08-11)

- **Real-Time Queue Broadcast**: `queue.ts` compiles sanitized public queue entries (`socketId`, `userId`, `username`, `avatarUrl`, `gameId`, `currency`, `stake`, `queuedAt`) and triggers `io.emit("queueStateUpdate", ...)` whenever players join, pair, cancel, or disconnect.
- **Client Lobby Widget (`LiveQueueList.tsx`)**: Reactive widget mounted on `HomePage.tsx` displaying live searching players, wager badges, and running `00:15` search timers.
- **1-Click Match Acceptance**: Clicking "Match" on a waiting player card checks user balances and automatically emits `joinQueue` pre-configured with matching `gameId`, `currency`, and `stake` to trigger instant pairing.

## Architecture Invariant: Headless Canvas draw() & Finite Coordinate Assertions (added 2026-08-11)

- **Headless Context Mock**: `scripts/canvas-render-check.ts` intercepts 2D canvas drawing operations (`fillRect`, `clearRect`, `drawImage`, `arc`, `lineTo`, `fillText`, `setTransform`) with strict `Number.isFinite(val)` guards to prevent `NaN`/`Infinity` visual rendering bugs.
- **Fixed Virtual Resolution Letterboxing**: Canvas scaling maintains strict 16:9 aspect ratio (`VIRTUAL_VIEWPORT = { width: 1280, height: 720 }`) across all viewport bounds.
- **Suite Command**: `npm test` runs all 6 test scripts (`wallet-friends-check`, `financial-reconnection-check`, `matchmaking-check`, `determinism-check`, `score-validation-check`, `canvas-render-check`).

## Architecture Invariant: Game Module #3 ("Space Blaster") Multi-Game Expansion (added 2026-08-11)

- **Plug-and-Play Expansion Contract**: Space Blaster (`games/space-blaster/`) implements `GameModule` interface (`init`, `start`, `pause`, `destroy`) with 60 FPS fixed-timestep physics loop and `1280x720` canonical virtual resolution. The retired `game-3` compatibility alias was permanently removed during Games build-health stabilization.
- **Headless Replay Adapter Integration**: `spaceBlasterReplayAdapter` registered in `games/replayAdapters.ts` and `games/registry.ts`, allowing server-side `validateScore()` to validate Space Blaster match replays without modifying backend validation logic.
- **Client & Matchmaking Registration**: `space-blaster` is registered in `GAME_REGISTRY` (`@fugluck/shared` and `packages/client/src/registry.ts`), `gameFactories.ts`, and `homeData.ts`, enabling instant matchmaking, launch modal binding, and profile match history replay playback.
- **Ship Visibility & Coordinate Alignment**: Player ship starts at `(640, 620)` with `60x60` bounds, clamped strictly between `30 <= x <= 1250` and `30 <= y <= 690`. Rendered via multi-layer high-contrast vector fallback renderer (`#00ffff` fuselage, `#7000ff` wings, `#e0f7fa` canopy, `#ff0055` dual thrusters).

## Architecture Invariant: Game Module #4 ("Cyber Hopper") Multi-Game Expansion (added 2026-08-11)

- **Plug-and-Play Expansion Contract**: Cyber Hopper (`games/cyber-hopper/`) implements `GameModule` interface (`init`, `start`, `pause`, `destroy`) with 60 FPS fixed-timestep physics loop and `1280x720` canonical virtual resolution (20x11 grid). The retired `game-4` compatibility alias was permanently removed during Games build-health stabilization.
- **Headless Replay Adapter Integration**: `cyberHopperReplayAdapter` registered in `games/replayAdapters.ts` and `games/registry.ts`, allowing server-side `validateScore()` to validate Cyber Hopper match replays without modifying backend validation logic.
- **Client & Matchmaking Registration**: `cyber-hopper` is registered in `GAME_REGISTRY` (`@fugluck/shared` and `packages/client/src/registry.ts`), `gameFactories.ts`, and `homeData.ts`, enabling instant matchmaking, launch modal binding, and profile match history replay playback.
- **Active Playable Games Only & Clean Registry**: `GAME_REGISTRY` and dashboard game cards render strictly 4 unique, active playable games: `Neon Runner`, `Pixel Ninja Dash`, `Space Blaster`, and `Cyber Hopper`. Duplicate `(Game #3)` / `(Game #4)` labels and deprecated `Sky Dodge` are purged from active registries.
- **Game Card CTA Button Height**: Game card buttons in `GameCard.tsx` use fixed string `▶ Play` with locked 40px height (`h-10`) and `whiteSpace: nowrap` to ensure 100% uniform button height across all cards without vertical swelling.
- **Dashboard Category Filtering**: Nav pill filters (`All`, `Runner`, `Reflex Timing`, `Arena Shooter`) filter `trendingGames` dynamically by `game.engine`. Active category pill is styled with `.ac-pill--active` accent background. Selecting `All` restores full 4-game display.
- **Hero Spotlight Removal**: Featured "Game of the Week" hero banner section is removed from `HomePage.tsx`, focusing the top layout directly on category filtering, live matchmaking lobby, and active game grid.
- **Universal Deterministic Dynamic Difficulty Scaling**: All 4 active games (`Neon Runner`, `Pixel Ninja Dash`, `Space Blaster`, `Cyber Hopper`) calculate difficulty scale strictly from tick count: `const difficultyScale = 1.0 + Math.pow(tickCount / 5400, 1.4) * 1.5`. At 90s (5,400 ticks), velocity and spawn rates reach 2.5x speed while preserving 100% deterministic score validation and replay playback.
- **Leaderboards Link Removal**: Non-functional "View Leaderboards" link is removed from `TrendingArena.tsx` header for a clean, non-cluttered header layout.
- **Quiz Category Expansion**: `GameCategory` type union in `@fugluck/shared/src/gameModule.ts` and `GameEngine` in `games/registry.ts` include `"quiz"`. Nav category pills in `homeData.ts` render `'Quiz'`, allowing real-time category filtering.
- **Speed Trivia Clash (Quiz Mini-Game #1)**: `games/speed-trivia/` implements `GameModule` interface with 60 FPS tick loop, 10 questions per match, tick-based speed scoring `Points = Math.round(1000 * (ticksRemaining / 600))`, and `speedTriviaReplayAdapter` registered in `replayAdapters.ts` for headless score validation. Seeding maps `match.seed` to question selection and 4-option shuffling deterministically.
- **Speed Trivia Package Exports**: `"./speed-trivia": "./speed-trivia/index.ts"` in `games/package.json` exports map resolvable by `@fugluck/client` with Vite dev server restarted to clear resolution cache.


