# ArcadeClash — Progress Log

Self-contained handoff doc. Read this first at the start of every session —
conversations don't carry over, and work may resume from a different tool.

## NEXT SESSION: WALLET PART 1 — the ledger, points only, no stakes

This section is written for zero prior context — read it alone and you have
enough to start. The rest of this file is full project history/detail for
"why"; skim it only if you need that. (Remove this section once this
session actually starts, same convention as every prior "NEXT SESSION"
brief — see session 13's and session 16's log entries for precedent.)

**What this session builds:** an append-only points ledger and a way to
derive a balance from it. That's the whole scope. Read the exclusions below
before writing any code — it's easy to over-build this.

**Explicitly OUT of scope this session:**
- **Stakes or escrow** (locking points against a match, settling a pot on a
  result) — that's wallet part 2, a separate future session, not started.
- **Match settlement.** Matchmaking's server-side score validation and
  winner determination (`packages/server/src/validation/{scoreValidator,
  matchOutcome}.ts`, sessions 15-17) already produce an authoritative
  `outcome` (`"win" | "loss" | "draw" | "void"`) per match — but nothing
  persists it anywhere or acts on it. Nothing in this session should change
  that. No match currently affects, or should affect, a balance.
- **Real money.** Per "Product direction" further down this file: no
  real-money code this year, a hard constraint on scope, not a soft
  preference. Points only.
- Also not blocked on, but don't confuse with this session: two STAKES
  BLOCKER entries exist in Known Gaps (viewport-coupled gameplay simulation;
  no reconnection window on disconnect) — both block wallet part 2 (stakes),
  neither blocks this session (the ledger itself has no gameplay dependency).

**Money-representation rules — MUST hold from this session's first commit,
not retrofit later.** Copied here verbatim from "Product direction" further
down this file so this brief is self-contained; that section has the full
business context if you want it:
- All balances stored as INTEGERS in minor units, never floats.
- Every ledger row carries a `currency` field, set to `POINTS` for now —
  adding a real currency (e.g. GEL) later is a new value in that column,
  not a schema migration.
- Balances are DERIVED from an append-only ledger, never stored as an
  independently-mutable field. If a cached/denormalized balance exists for
  read performance, a reconciliation job must recompute it from the ledger
  and alert on mismatch — the cache is never the source of truth.
- The rake (a house cut, once stakes exist) is a ledger entry to a house
  account, not money disappearing from the system — not needed this
  session (no stakes yet), but the schema should be able to represent it
  later without a migration.
- System invariant: **the sum of all balances is constant except at an
  explicit grant/deposit event.** Any code path that can change that sum
  without one is a bug. This is the invariant to design the schema/API
  around from the start, and the one worth writing a test against.
- Points reset at real-money launch, and this must be stated in the UI
  before anyone accumulates a points balance — no user should be surprised
  later that their points didn't carry over. Keep the schema/design
  compatible with a future reset operation; don't bake in an assumption
  that a balance is permanent.

**Current auth/user schema** (`packages/server/src/db/schema.ts` — read the
actual file before assuming its shape, don't trust this copy if it's drifted):
```ts
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: varchar("username", { length: 32 }).notNull().unique(),
  email: varchar("email", { length: 255 }).unique(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  gamesPlayed: integer("games_played").notNull().default(0),
  gamesWon: integer("games_won").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```
`users.id` (`text`, a UUID string — see `routes/auth.ts` for how it's
generated at signup) is the foreign key a ledger table would reference.
`gamesPlayed`/`gamesWon` are pre-existing, still-inert stat columns —
unrelated to points/wallet, nothing currently increments them, don't
conflate them with this session's work.

**DB migrations — Drizzle ORM/Kit.** Schema source: `packages/server/src/
db/schema.ts` (the only schema file so far — add the ledger table here).
Config: `packages/server/drizzle.config.ts` (points `schema` at that file,
`out` at `packages/server/drizzle/`). Generated SQL migrations live in
`packages/server/drizzle/` (currently just `0000_early_marrow.sql`, the
original users-table migration, plus a `meta/` snapshot/journal Drizzle Kit
manages itself — don't hand-edit those). Workflow: edit `schema.ts` → `npm
run db:generate -w packages/server` (writes a new numbered migration file)
→ `npm run db:migrate -w packages/server` (applies it to the real,
cloud-hosted Supabase Postgres via `DATABASE_URL` in `packages/server/
.env` — there is no local/throwaway DB, this applies to the real database).
DB client: `packages/server/src/db/client.ts` exports `db` (the Drizzle
instance, already wired to the schema) and `pool` (the raw `pg` Pool).

**Auth context for a wallet route.** `packages/server/src/auth/
middleware.ts`'s `requireAuth` (already used by the existing `/api/auth`
routes) rejects unauthenticated requests and attaches `req.userId` from a
verified session cookie — the pattern a wallet/balance route should follow,
not a new auth mechanism.

**Verified via grep before writing this brief:** no `wallet`/`ledger`/
`balance`/`stake`/`escrow` code exists anywhere in `packages/` today — the
only hits are two comments (a Known Gaps cross-reference in `matches.ts`,
and this file's own prose) — confirming the PLANNED label below is
accurate, not stale.

**Before coding: give a plan** (files, in order — including the exact
ledger table schema you're proposing, and how a balance gets read: a live
`SUM()` query vs. a maintained-and-reconciled cache, per the invariant
above) and wait for go-ahead, matching how every other session in this
file's log has worked.

## 60-second status (read only this to get oriented)

**Stack:** React/Vite client, Express 5 + Drizzle ORM + Postgres (Supabase,
cloud-hosted) server, npm workspaces monorepo (`packages/client`,
`packages/server`, `packages/shared`, `packages/theme`, `games/*`).

**BUILT AND VERIFIED (method noted for each — see "Architecture status"
further down for the full audit):**
- Auth (signup/login/logout/session/profile) — verified via direct API
  calls with real assertions AND a full manual browser click-through,
  both against the real Supabase database.
- 3 practice-mode mini-games (Neon Runner, Pixel Ninja Dash, Sky
  Dodge) — engine logic verified via standalone `npx tsx` scripts;
  DOM/lifecycle (mount/pause/resume/quit/`gameOver`/results/Play Again)
  verified by hand in-browser, zero console errors. (The "51 games"
  target this used to be measured against is no longer current — see
  "Product direction" further down: revised session 15 to roughly 3
  games per major category, breadth-first, not a 51-game backlog.)
- The determinism foundation — seeded RNG (`packages/shared/src/rng.ts`),
  a fixed-timestep loop (`packages/shared/src/fixedTimestepLoop.ts`,
  genuinely shared by and imported from all 3 games — the first real
  cross-game shared code in this repo), and `inputLog` recording
  (`{ tick, action, wallMs? }`) — verified by `scripts/
  determinism-check.ts`, 17 automated assertions, all passing: same seed
  + same inputLog replayed twice ⇒ identical final state for all 3 games;
  the shared loop driven through a fake clock with jittery vs. smooth
  timing (incl. a simulated 400ms stall) also reaches identical final
  state; replay is unaffected by stripping or randomizing every `wallMs`
  value. Also verified by a manual negative test (one gameplay call
  temporarily de-seeded, confirmed the script fails, reverted) and a
  browser click-through of all 3 games' full lifecycle, zero console
  errors.
- `GameModule` interface + `GameLoader` host chrome — verified by the
  same browser click-through as above, all 3 games.
- **Matchmaking (for-fun only), the protocol specifically: queue join,
  pairing, self-match rejection, server-issued seed generation, `matched`
  delivery with server-derived (not client-supplied) opponent username,
  `submitScore` → `matchResolved` with correct per-side score breakdown**
  (session 15). This is the part with the strongest verification in the
  whole matchmaking feature: a live smoke test drove two REAL
  `socket.io-client` sockets, authenticated with REAL session cookies
  from two REAL throwaway accounts signed up via the real signup API,
  against the ACTUAL running server and ACTUAL Supabase DB (not mocked,
  not fake sockets) — asserted both sides received the identical
  `matchId`/seed, each side's `opponentUsername` matched the OTHER
  account's real signed-up username, and both sides' `matchResolved`
  correctly attributed each score to the right player. Throwaway
  accounts deleted afterward. Additionally covered by 21 fake-socket unit
  assertions in `scripts/matchmaking-check.ts` for edge cases the live
  test didn't exercise (self-match rejection, duplicate-submission
  idempotency). **What this does NOT cover, stated plainly rather than
  implied as "verified end-to-end":**
  - **No heartbeat/liveness-check mechanism exists.** Grepped
    `packages/server/src/matchmaking/` and `packages/client/src/
    matchmaking/` for "heartbeat"/"ping"/"interval" — zero matches. The
    forfeit-timeout (below) is a single one-shot `setTimeout`, not a
    recurring check. Detecting a connection that dies WITHOUT a clean
    close (network drop, crashed tab, sleeping laptop) relies entirely on
    Socket.IO's own default transport ping/pong (unconfigured this
    session — library defaults are roughly a 45-second combined
    interval+timeout, unverified for this app specifically). Every test
    this session that touched "disconnect" used either a real, explicit
    `socket.disconnect()` call (an intentional clean close, not a dead
    connection) or a fake socket with `handleDisconnect()` called
    directly (skips Socket.IO's real event delivery entirely). **A
    genuinely silent connection death has never been tested.**
  - **No tick-based win condition existed as of session 15 — RESOLVED
    session 16.** This bullet described the state going into session
    16: no server-side "winner" field, a plain client-side
    DISPLAY-ONLY ternary (`you.score > opponent.score`) in
    `MatchLoader.tsx`'s `ResolvedPanel`. See the new "Server-side score
    validation + winner determination" BUILT entry below for what
    replaced it. Left here as the historical record of the gap, not
    current status.
  - **The forfeit-timeout mechanism (`FORFEIT_GRACE_MS` = 120,000ms,
    `packages/server/src/matchmaking/matches.ts`) was verified with the
    delay artificially stubbed down to ~10ms** (a temporary
    `global.setTimeout` override in the test, restored immediately after)
    **— the real 120-second duration has never actually elapsed in any
    test.** The logic that fires is real and exercised; the actual wait
    time is not.
  - **Disconnect-mid-match and disconnect-mid-queue's SERVER-SIDE
    effects were verified only against fake sockets** (`scripts/
    matchmaking-check.ts`, direct `handleDisconnect()` calls simulating
    that a disconnect event already fired) — not against a real Socket.IO
    disconnect event of any kind, clean or otherwise. The one REAL
    disconnect this session (clicking Cancel in the browser) confirmed
    correct CLIENT behavior (clean return to home, zero console errors)
    but nobody checked server-side that the queue entry was actually
    cleared as a result of that specific click — that link is inferred
    from the unit test plus Socket.IO's well-established reliability for
    explicit `.disconnect()` calls, not independently confirmed live.
  - **The socket auth middleware's REJECTION path has never been
    tested.** The live smoke test only exercised the acceptance path
    (valid cookie → connection allowed). Nobody has connected a socket
    with a missing or invalid cookie to confirm it actually gets refused.
  - **Every UI phase beyond 'queued' has never been rendered or observed
    by anyone, in any browser** — 'countdown', the actual `GameModule`
    mount in match mode, 'awaiting-opponent', 'resolved' (including the
    win/lose/tie text and score display), 'ended', and 'connection-error'
    exist only as source code that compiles and type-checks. This
    sandbox's single shared cookie jar meant only one real account could
    be logged in in-browser at a time, so no match was ever actually
    reached in a real DOM — only the pre-match 'queued' screen and
    Cancel button were. The live smoke test that DID verify the
    underlying data (correct scores, correct usernames) used a raw
    `socket.io-client` connection with no React and no browser at all, so
    it confirms the WIRE DATA was correct, not that `ResolvedPanel` (or
    any of the other five phases) renders that data correctly.
  - The full lifecycle was never observed as one continuous playthrough
    by a human — only in disconnected pieces (protocol via the live
    socket test, pre-game UI via the browser).
- **Server-side score validation + winner determination (session 16).**
  Closes both gaps flagged as the exact next step at the end of session
  15. A submitted `(gameId, seed, inputLog, claimedScore)` is replayed
  server-side against the real engine, game-agnostically: `games/<id>/
  replay.ts` adapters (one per game, each wrapping that game's own
  engine) plus a generic driver (`packages/shared/src/replay.ts`,
  `replayEngine()`) that contains zero game-specific logic — adding a
  4th game needs its own adapter and one line in `games/
  replayAdapters.ts`, not a validator change. `scripts/
  determinism-check.ts` was refactored to call the same adapters +
  driver rather than its own hand-rolled per-game logic, so the
  determinism suite and the real validator are provably the same code
  path now. Three verdicts: VALID (exact score match — no tolerance),
  INVALID (mismatch, over the tick/log-size cap, malformed/unsorted log,
  or an unrecognized action — all treated as cheating), UNVERIFIABLE
  (kept in the `ScoreVerdict` type for a future non-tick game; no
  current adapter can produce it — see the Sky Dodge Known Gaps entry
  below for why). Winner determination (`packages/server/src/
  validation/matchOutcome.ts`): higher validated score wins, equal
  scores draw, an INVALID score never wins regardless of what it's
  compared against (including a forfeiting opponent — void, not a win),
  both INVALID → void. Runs inline in the `submitScore` socket handler,
  not queued — justified by measuring (not estimating) real per-tick
  replay cost across all 3 engines (0.0002-0.00063ms/tick), which keeps
  even the 21,600-tick cap's worst case under ~14ms.
  **Verification: two standalone `tsx` scripts** (same convention as
  `determinism-check.ts`) — `scripts/score-validation-check.ts` (22
  assertions: honest runs validate for all 3 games, a tampered score is
  rejected, a tampered inputLog is rejected — with an explicit
  precondition check after an initial sparse tamper attempt turned out
  not to be load-bearing for 2 of 3 games, see that file's comments —
  an over-cap submission is rejected fast enough to prove replay never
  ran, and 6 winner-determination policy cases including forfeit/void
  edge cases) and the refactored `scripts/determinism-check.ts` (still
  all 17 original assertions passing unchanged). Also: `tsc -b`
  (client)/`tsc --noEmit` (shared, games, server) all clean, `oxlint`
  clean across every changed directory (same one pre-existing unrelated
  warning as session 15), and the running dev server auto-reloaded
  through every edit this session via `tsx watch` without crashing,
  confirmed via a health-check request after the last change. **Not
  verified: an actual live two-socket match through the full
  matchmaking flow with real validation** (session 15's live-socket
  smoke test was NOT re-run this session) — the two `tsx` scripts test
  the validator/outcome logic directly against the real functions, not
  through a real Socket.IO round-trip. Also not verified: the new
  client-side UI (server-provided `outcome` text in `ResolvedPanel`,
  the pause button's absence in match mode, drag's absence in match
  mode) — all DOM/lifecycle changes, and this sandbox still can't drive
  real gameplay/rAF (documented since session 4) to click through them.
  Two related, deliberate scope decisions made mid-session (approved by
  the user before implementation, not unilateral): rejected an
  originally-proposed `usedUnverifiableInput` client-supplied flag
  (would have been a client-controlled off switch for the whole
  validator) in favor of disabling Sky Dodge's drag input in match mode
  entirely; and disabled the pause button (and the `visibilitychange`-
  triggered auto-pause) in match mode after confirming by reading the
  code that both were live and unconditional — see Known Gaps below for
  both.
- **Two regressions from session 16's pause removal, fixed session 17:
  an honest concede path, and disconnect-resolves-not-voids.** Removing
  pause silently removed the only route to `endRun("quit")` in match
  mode (it lived inside the pause overlay) — a losing player's only
  remaining exit was a raw disconnect that voided the match with no
  recorded result, reopening the exact "deny the result" exploit the
  forfeit timer already closed for non-submission, through a different
  door. Both fixed:
  - **A Forfeit control** (all 3 `games/*/index.ts`, same screen
    position pause used to occupy): click-twice confirm (first click
    arms a 3-second "Confirm?" state, second click within that window
    fires `endRun("quit")` — identical reason string to practice's Quit
    Run, so it's the same real-score/real-inputLog/real-validation path
    downstream, no special-casing needed in `MatchLoader.tsx`'s existing
    `gameOver` handler).
  - **Mid-match disconnect now resolves the match as a loss for the
    disconnecting player instead of voiding it** (`packages/server/src/
    matchmaking/matches.ts`'s `handleDisconnect`, `packages/server/src/
    validation/matchOutcome.ts`'s new `determineDisconnectOutcome`).
    Three distinct sub-cases, not one rule: (1) disconnecting player
    had already submitted — a no-op, they finished honestly and left,
    the match resolves normally off whatever the still-connected side
    does; (2) disconnecting player never submitted, opponent already
    had — resolves immediately (doesn't wait for the 120s forfeit
    timer), opponent wins with their real validated score; (3) neither
    side had submitted (opponent still mid-run) — opponent still wins
    outright, not a void, since disconnecting is strictly worse than
    still legitimately playing. `endMatch()`'s existing single cleanup
    path (already unconditionally cancels any pending forfeit timer)
    means this and the timer can't double-fire — reused, not new
    machinery.
  - **`PlayerResult` extended with a proper `status` field**
    (`"completed" | "forfeited" | "opponent_disconnected"`,
    `packages/shared/src/matchmaking.ts`), not a `forfeited: boolean` +
    a sentinel `score: 0`/`reason: "opponent_disconnected"` (the first
    draft, rejected before implementation) — this type is what escrow
    will eventually settle payouts on, so "never played because the
    opponent left" has to be a real, distinct state from "scored zero,"
    not encoded into a free-form string. `ScoreColumn`/`ResolvedPanel`
    in `MatchLoader.tsx` updated accordingly.
  - **Auto-forfeit on backgrounding, no grace period.** Going hidden in
    match mode now calls `endRun("backgrounded")` immediately (all 3
    games) instead of silently resuming with zero trace, which is what
    session 16's pause-disable alone left in place (removing the pause
    *button* didn't stop a backgrounded tab from stalling the sim just
    as effectively via rAF throttling — see the freeze-frame Known Gaps
    entry). No grace period, deliberately — see that Known Gaps entry
    for the reasoning (any nonzero window is repeatable with no
    proposed cooldown, and these games' own timing precision is
    tens-to-low-hundreds of ms, so even a "short" grace period stays
    meaningfully exploitable).
  - **`visibilityHidden` evidence event** — the client reports every
    hidden transition to the server for the whole `MatchLoader`
    lifetime (queued through resolved), not just during active play;
    the server just logs it (`packages/server/src/matchmaking/
    index.ts`), no state, no verdict impact.
  - **`matchEnded`/the `'ended'` client phase removed**, not just
    stopped-being-emitted — after the disconnect fix, nothing
    server-side ever produces it anymore (every disconnect that used to
    void now resolves via `matchResolved` instead), and unreachable code
    describing behavior the system no longer has misleads whoever reads
    it next more than deleting it does.
  **Verification:** `scripts/matchmaking-check.ts` rewritten (its
  `submitScore` calls predated this session's `inputLog`/`viewport`
  requirement and had been silently failing for two sessions — see
  CLAUDE.md's new standing rule and this session's log entry) — all 27
  assertions pass, including 3 new disconnect sub-case tests. 3 new unit
  assertions for `determineDisconnectOutcome` added to `scripts/
  score-validation-check.ts` (25/25 passing). `scripts/
  determinism-check.ts` re-run per the same new rule: 17/17 unchanged.
  `tsc -b`(client)/`tsc --noEmit`(shared, games, server) all clean,
  `oxlint` clean (same one pre-existing unrelated warning). **Not
  verified by the assistant in an actual browser, and not something the
  assistant is able to verify that way** — the Forfeit button's
  two-click confirm, the disconnect-resolution UI, the visibility-hidden
  reporting, and the new `ResolvedPanel`/`ScoreColumn` copy have never
  been rendered or clicked in a real DOM. See the "STILL UNVERIFIED"
  bullet above for the full breakdown — real interactive/gameplay
  confirmation of this app has always required the user's own browser
  (documented since session 4), not the assistant's Browser-pane tool.
- Homepage — colors/layout verified via DOM/computed-style inspection
  only, see "still unverified" below.

**STILL UNVERIFIED (built, but confirmation is incomplete — don't assume
these work just because the code looks right):**
- **Live rAF-driven gameplay (actual real-time score progression,
  animation, collisions) has never been observed working** — this
  Browser-pane tool's tab reports `document.hidden = true` (confirmed via
  a raw rAF-counter probe that never fired), so `requestAnimationFrame`
  never runs here at all. This is a pre-existing sandbox limitation
  (documented since session 4), not new to the determinism work, but it
  means the fixed-timestep loop's real in-browser behavior has only ever
  been exercised by the injectable-clock automated test, never by an
  actual human playing. **The user should confirm real gameplay feel
  themselves at `localhost:5173` before trusting this further.** Match
  mode (session 15) mounts this exact same rendering path, so it
  inherits this limitation too — see the matchmaking bullet above for
  the full, specific breakdown of what was and wasn't observed.
- **Genuinely silent (non-graceful) socket disconnection has never been
  tested** (session 15) — every disconnect-related test used either a
  real, explicit `socket.disconnect()` call or a fake socket with the
  server's disconnect handler invoked directly. What actually happens on
  a dead network/crashed tab (detection relies on Socket.IO's
  unconfigured default ping/pong, ~45s combined default) is unverified.
- **The socket auth middleware's rejection path has never been tested**
  (session 15) — only the acceptance path (valid cookie) was exercised.
- **Every matchmaking UI phase beyond 'queued' has never been rendered
  in any browser** (session 15) — see the matchmaking bullet above.
- **`wallMs` has only been confirmed to (a) populate and (b) not affect
  replay** — both via automated test / trivial instant-click browser
  interaction. It has never captured a *meaningful* real-world gap
  (an actual multi-second pause-and-think), because no real gameplay
  session has run long enough to produce one in this sandbox. The field
  works structurally; whether it captures the sizes/patterns useful for
  a future exploit-detector is unverified.
- **RNG re-derivation-on-`reset()` idempotency (session 13's fix for the
  "reset() might fire twice" structural gap) has been verified by reading
  the code, not by a test that actually calls `reset()` twice on one
  engine instance and checks the second call restarts the same sequence.**
  Every current caller (the acceptance test, `GameModule.start()`) only
  ever calls `reset()` once per instance in practice, so the idempotency
  claim is logically sound (unconditional re-derivation, verified by
  reading `reset()`'s implementation in all 3 engines) but has zero direct
  test coverage of the actual "call it twice" case.
- **`sky-dodge`'s pointer-drag movement path was not re-exercised in
  browser this session** (session 13's click-through tested ArrowLeft/
  Space only) — the drag code itself wasn't touched, only logging was
  added around it, so risk is low, but it hasn't been re-confirmed
  working since the loop refactor.
- Homepage visual direction — still never visually confirmed by the user
  in an actual rendered view (long-standing, unrelated to this work).
- **Sessions 16-17's match-mode UI has never been rendered or clicked in
  any browser — this is a Claude Code sandbox limitation, not something
  the assistant can perform, and any real confirmation of it is the
  user's own action, not the assistant's.** Specifically: the Forfeit
  control's click-twice confirm, the disconnect-resolution UI (all 3
  sub-cases — already-submitted no-op, opponent-already-won,
  opponent-still-playing-wins), auto-forfeit firing on a real
  backgrounded tab, the `visibilityHidden` event actually round-tripping
  through a real socket connection, and the new `PlayerResult`
  `status`-union display branches (`ScoreColumn`'s "opponent
  disconnected" caption, `ResolvedPanel`'s corresponding message). All
  of this is covered by fake-socket/headless `tsx` script assertions
  (`scripts/matchmaking-check.ts`, 27/27 as of session 17) exercising
  the real `matches.ts`/`matchOutcome.ts` logic directly — that's real
  server-logic coverage, but it is not the same claim as "observed
  working in a browser," and session 15's live two-real-socket smoke
  test (the strongest verification this project has produced) was not
  re-run against the disconnect fix specifically.

**NOTICED BUT DELIBERATELY NOT TOUCHED:** see "Known gaps" further down —
the drag/anti-cheat gap (now narrowed to practice mode only, session 16)
and the freeze-frame/time-dilation exploit (mitigated but not closed,
sessions 16-17 — see that Known Gaps entry for exactly what changed and
what didn't) are both real, flagged gaps. The stale `console.warn` on
`mode === "match"` this section used to flag here was actually removed
in session 16 (a direct side effect of adding the `mode` field to all 3
games, not a separate cleanup pass) — correcting this bullet now since
it was never updated when that happened. New this session: the
disconnected side of a mid-match-disconnect resolution still shows
"forfeited — no result submitted in time" (`MatchLoader.tsx`'s
`ResolvedPanel`, reusing the existing forfeit-by-timeout copy) — accurate
in substance (they didn't submit) but the wording implies a timeout
specifically, when the real cause was an active disconnect; noticed,
not fixed, since distinguishing the two precisely would mean either a
new `PlayerResult` status or new copy-selection logic for a cosmetic
difference only the disconnected player's opponent sees. Still standing
from earlier sessions: no rate limiting on auth endpoints, no CSRF
token, JWT has no revocation/refresh-rotation, session 7's
file-layout-convention question (Q1) is still unanswered.

**ROADMAP (decided outside a coding session — see "Product direction"
below for the full business/product context this comes from):**
1. ~~Server-side score validation~~ ✅ **done, session 16** — see the
   "Server-side score validation + winner determination" BUILT entry
   above. One real gap this surfaced that's now a hard prerequisite for
   item 3 (stakes) below, not yet scheduled: viewport-coupled gameplay
   simulation is a STAKES BLOCKER, see Known Gaps.
2. **Wallet part 1: the ledger, points only — NEXT SESSION.**
3. Wallet part 2: stakes and escrow. Do not build this before the
   viewport/simulation-determinism Known Gaps entry is resolved —
   confirmed live session 18 (a real match, zero deliberate action by
   either player, produced a 41% score gap from ordinary window-size
   difference alone; see Known Gaps for the measured ~0.1 pts/px slope
   and the open letterbox-vs-stretch question that needs answering
   before that work starts). No longer theoretical.
4. Invites + per-game live player counts.

This replaces the "candidate next steps, none picked" framing that used
to be here — the order above is now decided, not a menu.

Everything past the next section is historical detail, decisions, and the
session-by-session log — unchanged, just relocated below the summary so
this file costs less context to read at the start of every session. Skim
it only for the "why" behind something; it's not required to get oriented.

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
- **Determinism foundation (seeded RNG, fixed-timestep loop, `inputLog`
  incl. `wallMs`), sessions 13-14.** Verification: `scripts/
  determinism-check.ts`, 17 automated pass/fail assertions covering (a)
  same seed + same inputLog replayed twice ⇒ identical state, all 3
  games, (b) the real `createFixedTimestepLoop` driven through smooth vs.
  jittery (incl. a 400ms stall) fake clocks ⇒ identical state, (c)
  replay is unaffected by stripping/randomizing every `wallMs` value.
  Also a manual negative test (temporarily de-seeded one gameplay call,
  confirmed the script correctly fails, reverted) proving the test can
  actually catch a regression, not just always pass. `tsc -b`/
  `tsc --noEmit` clean, `oxlint` clean. Browser click-through of all 3
  games' full lifecycle (mount/countdown/pause/resume/quit/`gameOver`/
  results/Play Again), zero console errors — **live rAF-driven score
  progression itself was NOT observable** (this Browser-pane tab reports
  `document.hidden = true`, confirmed via a raw rAF probe, so
  `requestAnimationFrame` never fires here — pre-existing sandbox
  limitation, not new). See session 13/14 log entries for full detail,
  every design decision and why, and the exact list of what's still
  unverified (60-second summary above).

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
- **Games: 3 built** (Neon Runner/runner, Pixel Ninja Dash/reflex-timing,
  Sky Dodge/falling-block). Seam: racer/arena-shooter/physics-table/
  turn-based-board/word-trivia are all still untouched — no game exists
  in any of them yet. (This used to say "3 of 51" against a 51-game
  backlog target — that target was revised session 15 to roughly 3 games
  per major category, breadth-first; see "Product direction." "48
  remain" is no longer the right way to describe what's left.) Session
  7's Q1 (retrofit the 3 existing games to a new file-layout convention?)
  is still unanswered — don't guess, ask again if it matters before the
  next game gets built. Session 7's Q2 (seeded-RNG/inputLog/
  fixed-timestep) is now answered — see the determinism foundation entry
  above.
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

### BUILT (verified by reading the actual code; last confirmed 2026-07-30, session 13)

**The `GameModule` interface, copied verbatim from
`packages/shared/src/gameModule.ts`:**

```ts
export type GameMode = "practice" | "match";

export type InputLogEntry = {
  tick: number;
  action: string;
  wallMs?: number; // evidence only, session 14 — never read by replay
};

export type GameOverPayload = {
  score: number;
  reason: string;
  durationMs: number;
  seed: number;
  inputLog: InputLogEntry[];
};

export interface GameModule extends EventTarget {
  init(container: HTMLElement, mode: GameMode, opponentSocket: WebSocket | null, seed: number): void;
  start(): void;
  pause(): void;
  destroy(): void;
}

export type GameModuleFactory = () => GameModule;
```

`reason` and `durationMs` are still real and unchanged from before;
`seed`/`inputLog` are new as of session 13, both grepped and confirmed
present in all 3 games' `GameOverPayload` construction and `init()`
signature.

- Auth (signup/login/logout/session/profile) — verified via direct API
  calls + full browser click-through against the real Supabase DB.
- 3 games (Neon Runner, Pixel Ninja Dash, Sky Dodge), each independently
  implementing the interface above — engine logic verified via standalone
  `tsx` scripts, DOM/lifecycle verified by hand in-browser.
- `GameModule` loader + `GameLoader` host chrome.
- **Seeded RNG** (`packages/shared/src/rng.ts`): `mulberry32`,
  `createSeededRandom(seed).stream(label)` deriving independent
  gameplay/cosmetic streams from one root seed. Every one of the 17
  `Math.random()` call sites tallied in session 12's audit is now routed
  through `this.gameplayRng()` or `this.cosmeticRng()`, grepped
  afterward to confirm zero `Math.random()` remains anywhere in `games/`.
  Verified by `scripts/determinism-check.ts` (same seed replayed twice
  ⇒ identical state) and by a manual negative test (temporarily reverted
  one call to `Math.random()`, confirmed the script fails, reverted back).
- **Fixed-timestep loop** (`packages/shared/src/fixedTimestepLoop.ts`,
  `createFixedTimestepLoop`): a real accumulator loop imported by and
  shared across all 3 games — the first genuine cross-game shared code in
  this repo (previously every game's logic, simulation AND scheduling,
  was fully independent; now the scheduling/tick layer is shared, the
  simulation layer — each game's own `engine.ts` state/physics/scoring —
  is still fully independent, see PLANNED below). Verified by
  `scripts/determinism-check.ts`'s loop-jitter test: the same engine
  driven through the real loop under a smooth 16.67ms clock vs. a jittery
  clock (including a simulated 400ms stall) reaches bit-identical final
  state. Stall-clamp policy: a single frame clamps to at most 5 catch-up
  ticks, excess real time is dropped rather than queued for later frames
  — verified this doesn't cause a freeze (single 5-second stall test) and
  is safe for replay determinism specifically because replay steps ticks
  from the recorded log, never re-runs this accumulator against real
  time (see session 13 log for the full reasoning).
- **`inputLog`** (`{ tick, action, wallMs? }`, keyed on simulation tick,
  not wall-clock time — see session 13 log for why tick is correct).
  Recorded as edge transitions (press/release, or held-key down/up) in
  all 3 games' `index.ts`, tagged with the fixed-timestep loop's current
  tick at the moment of the real DOM event. `wallMs` (session 14, real
  elapsed ms since run start) rides alongside as evidence only — `tick`
  remains the sole authoritative replay key, and `scripts/
  determinism-check.ts`'s Test 3 asserts replay is bit-for-bit unaffected
  by stripping or randomizing every `wallMs` value, not just that the
  replay code happens not to reference it today. Nothing yet validates
  `wallMs` against expected pacing — see "Known gaps" (time-dilation/
  freeze-frame exploit). `sky-dodge`'s pointer-drag movement
  (`dragTargetX`) is deliberately excluded from `inputLog` entirely — see
  "Known gaps" (drag/anti-cheat gap) below.
- `games/registry.ts`'s `engine` field values (`runner`, `reflex-timing`,
  `falling-block`) — real, distinct values in real code. (Whether this
  represents a *validated* shared-engine *simulation* model is a separate
  question — see PLANNED below. The field existing and being distinct is
  BUILT; that abstraction is not.)
- Monorepo scaffold, theme/design system, Express/Drizzle/Postgres server.
- **Matchmaking (for-fun only): queue, pairing, server-issued seeds,
  match lifecycle, forfeit-on-timeout, disconnect handling** (session
  15) — `packages/shared/src/matchmaking.ts` (wire protocol types),
  `packages/server/src/matchmaking/{socketAuth,queue,matches,index}.ts`
  (first real Socket.IO server in this repo — `socket.io` was a stack
  decision since session 4 but genuinely unused until now, confirmed by
  grepping `package-lock.json`/`node_modules` before this session added
  it), `packages/client/src/matchmaking/useMatchSocket.ts`,
  `packages/client/src/game-loader/MatchLoader.tsx`. Seed generation
  moved fully server-side for match mode (`crypto.randomInt`, not
  `Math.random()`) — practice mode's client-side seed in
  `GameLoader.tsx` is untouched and correctly so (solo, nothing to cheat
  against). `tsc -b`/`tsc --noEmit` clean, `oxlint` clean. **Verification
  confidence is NOT uniform across this feature** — the queue/pairing/
  seed/username/score-resolution protocol is solidly verified (live
  two-socket test against the real running server and real Supabase DB,
  plus 21 fake-socket unit assertions); disconnect handling, the forfeit
  timer's actual duration, the auth rejection path, and every UI screen
  past 'queued' are NOT solidly verified — see the "BUILT AND VERIFIED"
  matchmaking bullet at the top of this file for the itemized breakdown,
  don't rely on this shorter entry alone.

### PLANNED (verified absent — grepped/read the whole repo, none of this exists)

- **Shared engine *simulation* abstraction.** Each of the 3 games'
  `engine.ts` still has fully independent state/physics/scoring logic;
  zero simulation code is shared between them (`RunnerEngine`,
  `DashEngine`, `DodgeEngine` remain 3 separate classes). This is
  distinct from the RNG/fixed-timestep-loop *infrastructure* sharing
  that session 13 added (see BUILT above) — infrastructure sharing is
  real now; simulation-logic sharing across an engine cluster is not.
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
- Wallet, stakes/escrow, leaderboards, DB-persisted match history — not
  started. (Matchmaking itself moved to BUILT this session, see above.)
- **A live-synchronized match model** (as opposed to the async model
  matchmaking uses) — not started, not needed until a game that requires
  it (e.g. a future Arena Shooter cluster) actually exists. The queue/
  pairing/auth layer built this session is agnostic to what happens
  after a match is created, so a live model would reuse it unchanged and
  layer a new in-match protocol on top — not a rebuild.
- **Server-side score verification and tick-based win condition — BUILT
  session 16.** Both used to be listed here as not started; see the
  "Server-side score validation + winner determination" entry under
  BUILT above and the session 16 log entry for the full build. Left
  this line here (rather than deleting it) as the historical record of
  what the gap looked like before session 16 closed it.
- **A heartbeat/liveness-check mechanism for matchmaking — does not
  exist.** Stated explicitly because it would be easy to assume the
  forfeit-timeout mechanism IS one; it isn't. `FORFEIT_GRACE_MS` is a
  single one-shot `setTimeout`, not a recurring check — grepped
  `packages/server/src/matchmaking/` and `packages/client/src/
  matchmaking/` for "heartbeat"/"ping"/"interval" before writing this
  line, zero matches. Detecting a connection that dies without a clean
  close relies entirely on Socket.IO's own unconfigured default
  transport ping/pong. Still true as of session 16 — untouched.

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
- **`sky-dodge` match mode is keyboard-only as of session 16 — pointer-
  drag movement is disabled client-side in match mode specifically
  because the server can't replay-verify it.** `dragTargetX` is
  continuous analog input (pointer position), excluded from
  `inputLog`/replay since session 13's determinism build because the log
  format only records discrete `{ tick, action }` transitions — that
  part is unchanged. What changed session 16: rather than exempting
  drag-produced runs from validation (considered and explicitly
  rejected — see the score-validation BUILT entry above for why a
  client-supplied "trust me, this one's unverifiable" flag would have
  been a client-controlled off switch for the whole validator), Sky
  Dodge's `handlePointerDown`/`handlePointerMove` now no-op in match
  mode (`games/sky-dodge/index.ts`), so a real match run is always fully
  keyboard-driven and always fully replayable. **Practical fallout:
  touch/mobile players cannot play Sky Dodge competitively (in a real
  match) today — only via keyboard.** Practice mode is untouched, drag
  still works there, same as always. Resolve by adding analog-input
  support to the log format (recording `dragTargetX` samples, not just
  discrete actions) before re-enabling drag in match mode — not started,
  no smaller than a proper design pass on the log format itself.
- **Time-dilation / freeze-frame exploit: stalling the sim grants
  unlimited planning time per decision; undetectable by tick-keyed replay
  alone.** These are reflex games — the win condition is reacting under
  real time pressure. A player who can stall the loop at will (e.g. a
  deliberately backgrounded tab, throttled via devtools, or some other
  means of pausing frame delivery) freezes the screen on a rendered frame
  and gets arbitrarily long real-world time to study it and plan the next
  input, with zero trace in the replay: no extra ticks are granted (the
  stall clamp drops time, never banks it — see session 13), no obstacles
  are skipped (everything gameplay-relevant is keyed to tick count, not
  wall-clock time), so a `(seed, inputLog)` replay of a four-hour
  freeze-and-plan run and an honest reflex run produce byte-identical
  logs and the same score. This converts a reaction test into a planning
  test, undetectably, for any match where that distinction matters (i.e.
  most of these games' whole premise).
  **Sessions 16-17 raised the bar substantially. They did not close the
  gap — read the rest of this bullet before assuming otherwise.**
  Session 16: the pause button (and the `visibilitychange`-triggered
  auto-pause on tab-backgrounding) was disabled in match mode
  (`pause()` in all 3 `games/*/index.ts` no-ops when `mode === "match"`
  — confirmed live before the fix by reading `init()`, it was
  unconditional). Session 17: found and fixed two regressions that
  disabling pause caused (see that session's log entry) — a real
  Forfeit control (click-twice confirm, calls `endRun("quit")`, the
  exact same real-score/real-inputLog/real-validation path practice's
  Quit Run uses) restores an honest concede path; going hidden in match
  mode now auto-submits via `endRun("backgrounded")` immediately (no
  grace period — see that session's reasoning) instead of silently
  resuming with zero trace; and a `visibilityHidden` event reports every
  hidden transition to the server for the whole match session, logged
  as evidence.
  **Every one of those mitigations is enforced client-side, in
  JavaScript the client chooses to run. State this plainly so nobody
  later reads this bullet as solved:** a modified client — someone
  running their own script against the real Socket.IO protocol instead
  of this app's real `games/*/index.ts`, the same category of tool this
  project's own live smoke tests already use (raw `socket.io-client`,
  no browser) — can simply never call `endRun("backgrounded")`, never
  emit `visibilityHidden`, and there is nothing server-side stopping
  it. The pause button's removal, the auto-forfeit, and the visibility
  reporting are all real improvements for the stock client, and they do
  meaningfully raise the effort/sophistication bar for the casual
  case — but none of them are a defense against a deliberately modified
  client, only against using the provided UI dishonestly.
  **The only server-side signal that exists at all is the wallMs
  plausibility check** (`packages/server/src/validation/
  scoreValidator.ts`'s `warnIfImplausiblePacing`, session 16): compares
  each pair of consecutive `inputLog` entries' `wallMs` gap against
  their `tick` gap, and the whole run's `durationMs` against
  `finalTick / 60`, logging a `console.warn` on a large mismatch.
  **Detection only, no enforcement — never affects the verdict, and a
  modified client can fabricate plausible-looking `wallMs` values just
  as easily as it can skip emitting `visibilityHidden`.** It also
  cannot distinguish a real exploit from ordinary legitimate pausing —
  `durationMs` and every `wallMs` value are
  `performance.now() - runStartTime`, which keeps running during any
  stall regardless of cause, so a real freeze and a real "I glanced at
  a notification" produce the identical signature. Treat the warning
  log as "worth a human look," not a cheat signal on its own — this
  caveat is also in the code comment directly above
  `warnIfImplausiblePacing`. Building real server-side enforcement
  against a modified client is a fundamentally different, harder
  problem than anything shipped across sessions 16-17 (client-side UI
  changes can't solve it by construction) and remains not started.
- **No reconnection window — STAKES BLOCKER, session 17. Second
  priority of the two STAKES BLOCKER entries in this section** — see
  the viewport entry below, confirmed live with real numbers session
  18, fix that one first. As of session
  17's disconnect-resolution fix (see the BUILT entry above and that
  session's log), a mid-match socket disconnect resolves the match
  immediately as a loss for the disconnecting player, with no grace
  period at all. Correct for closing the "close the tab to avoid a
  recorded loss" exploit — that was the whole point — but it means a
  momentary network blip (wifi hiccup, a phone briefly losing signal,
  a laptop waking from sleep) costs the match outright too, with zero
  distinction from a deliberate abandonment. For a for-fun match this is
  an acceptable, honestly-labeled tradeoff. **Once real money is
  involved, this becomes disputes and chargebacks** — a player who
  legitimately lost a match to a dropped connection, not a loss, will
  reasonably contest the outcome, and there's currently no record
  distinguishing "gave up" from "wifi died" beyond how quickly the
  disconnect happened relative to the match's progress (not currently
  captured either). The eventual fix: a short reconnection window
  (server pauses that player's own effective clock — not the shared
  match state, these are async-independent rounds, see below) rather
  than resolving instantly on disconnect. Sizing/design not done this
  session — flagging the requirement, not proposing an implementation.
- **Matchmaking's round-sync model is now decided: async-independent
  rounds** (session 15, was previously an open question here). Each
  player plays their own instance off a server-issued seed, submits
  `(score, reason, durationMs)`, scores are compared once both are in.
  Chosen specifically because these games have no fixed round length
  (they end on collision/game-over, not a clock) — a live model's shared
  wall-clock cutoff would risk unfairly cutting off a legitimately long,
  skilled run, where async only starts any timer once a player has
  already finished (see the forfeit-timeout gap below). **Does not
  foreclose a future live-synchronized model** for e.g. an Arena Shooter
  cluster — the queue/pairing/auth layer built this session doesn't care
  what happens after `matched`; a live mode would reuse it unchanged and
  add a new in-match protocol on top.
- **If neither matched player ever submits a score (both idle/abandoned
  without disconnecting), the match has no timeout and sits in server
  memory until the process restarts or a socket disconnects for
  unrelated reasons** (session 15). The forfeit-timeout mechanism
  (`FORFEIT_GRACE_MS`, `packages/server/src/matchmaking/matches.ts`)
  only starts once ONE player has submitted, deliberately — that's the
  only case where someone is actually stuck waiting on a broken UI; a
  fully-idle-both-sides match strands nobody, it just costs a small
  amount of server memory until something else cleans it up. Not fixed
  this session; revisit if match volume ever makes this matter.
- **Match state (queue + in-progress matches) is in-memory only, not
  persisted to Postgres** (session 15) — a server restart drops every
  queued/in-progress match instantly; both clients see "connection lost"
  and have to start over, no resume. Acceptable for for-fun/no-stakes;
  revisit before a match result needs to survive a restart or count
  toward `gamesPlayed`/`gamesWon` (still inert — no match writes
  anywhere in the DB yet, this session included).
- **Client-reported scores are trusted outright — RESOLVED session 16,
  see the "Server-side score validation + winner determination" BUILT
  entry above.** Left here as the historical record of the session-15
  acceptance this closed. What's still true from the original bullet: a
  determined loser can still avoid a recorded loss by simply not
  submitting at all before the forfeit timeout fires and their opponent
  wins by forfeit instead — session 16 didn't change forfeit behavior,
  only what happens once a score IS submitted.
- **Viewport size feeds gameplay simulation directly, in 2 of 3 games —
  now CONFIRMED LIVE, session 18, and promoted to the highest-priority
  STAKES BLOCKER (ahead of the no-reconnection-window entry above).**
  Fix this one first. Discovered while building session 16's score
  validator, reading `RunnerEngine`/`DodgeEngine` (not just the
  interface): both use
  `this.width` in code that determines WHEN a collision happens —
  `RunnerEngine`'s obstacle spawn x (`this.width + 40`) and `playerX`
  (`this.width * xFraction`) together set how long an obstacle takes to
  reach the player; `DodgeEngine`'s hazard spawn x
  (`gameplayRng() * (this.width - size)`) and the player's clamped
  bounds both scale with width. (`DashEngine` is NOT affected — its
  scoring/collision math is purely distance/time-based, confirmed by
  reading `pressDash()`/`update()`, width is only ever used in `draw()`
  there.) **Concretely: two players on different screen sizes running
  the identical seed are not playing the identical course, and the
  difference is exploitable — resizing your window to the most
  favorable dimensions before a wagered match is an undetectable edge.**
  This breaks the zero-luck skill-wagering premise the whole product is
  built on (see "Product direction" below), which is why it's a hard
  blocker for stakes specifically, not just a nice-to-fix.
  **Session 16 shipped the minimum fix needed for THIS session's
  deliverable to work at all** (an honest run has to validate, which
  requires the server to know what width the client played at): the
  container size in effect when a run starts is now captured
  (`lastResizeWidth`/`lastResizeHeight` in each `games/*/index.ts`,
  set from the same `handleResize()` that already called
  `engine.resize()`) and transmitted (`GameOverPayload.viewport`,
  `SubmitScorePayload.viewport`); the server calls `engine.resize()`
  with that same value before replaying. This makes replay exact for a
  run whose container size never changes — it does NOT decouple
  gameplay from viewport, it just makes the server aware of whatever
  viewport the client used.
  **Residual gap even with this fix: a real window resize DURING a
  match isn't captured at all** — only the size at run start is sent:
  `handleResize()` can fire again mid-run (a real `ResizeObserver`
  callback, e.g. the player drags their browser window wider mid-match),
  which changes live gameplay but leaves no record for replay to
  reproduce, so that specific run would (correctly, but for a
  reason that looks confusing without this note) fail as INVALID even
  though the player didn't cheat. Not fixed this session — resizing
  mid-run is a narrow edge case relative to the exploit above, and
  fixing it properly means logging resize events the same way `inputLog`
  logs actions, which is really the same underlying problem as the
  paragraph below.
  **Session 18: this stopped being theoretical.** A real two-client
  match with zero input from both sides produced scores of 221 and 157
  in Neon Runner — reported by the user, diagnosed by the assistant.
  Measured (not estimated) by replaying `RunnerEngine` headless, same
  seed, empty inputLog, across a swept range of widths: **score is
  approximately linear in canvas width, ~0.1 points per pixel.** A
  player on a 1920px-wide screen scores roughly **33% higher** than one
  on 1280px with *identical play* — confirmed both by the width sweep
  (score 261 at 1920px vs. 195 at 1280px) and by working the reported
  221/157 backward through that same ~0.1 pts/px slope, which lands on
  ~1560px and ~920px — a maximized browser window vs. a default,
  never-resized incognito window. **Neither client did anything
  unusual or deliberately exploitative — this was two people just
  using their browsers normally, and it produced a 41% score
  difference from window state alone.** That's what makes this the
  higher-priority blocker of the two STAKES BLOCKER entries in this
  section: the reconnection-window gap above requires an actual
  disconnect to matter; this one is live on every single match, right
  now, with zero effort from anyone — for a wagered skill product, an
  ordinary difference in browser window habits deciding a match is
  disqualifying on its own. Confirmed the seed genuinely was identical
  for both clients (not a second bug wearing this one's clothes) two
  ways: by code — `packages/server/src/matchmaking/index.ts`'s single
  `generateSeed()` call feeds both `matched` emits from the same
  variable, no path exists for divergence — and by a temporary
  diagnostic log added to `createMatch` and `submitScore`
  (`packages/server/src/matchmaking/matches.ts`, marked `TEMPORARY
  DIAGNOSTIC`, remove once this is resolved) that now prints both
  sides' seed and viewport on both the server console and each client's
  own browser console, so the next reproduction settles it directly
  from logs rather than by inference. **One caveat on the diagnosis
  itself, worth stating plainly: a zero-input run is seed-independent**
  (every seed tested produced the identical score at a given width,
  since a standing, never-jumping, never-sliding player collides with
  the first obstacle regardless of its type or spawn jitter) — so the
  zero-input test that surfaced this bug could not, by itself, have
  told the difference between "same seed, different width" and "
  different seed" if that had been the actual cause. The code-level
  proof plus the new logging is what actually settles seed identity;
  the score-gap match against the measured width-vs-score slope is
  what settles cause.
  **The real fix, not done this session (asked for a sizing estimate,
  not the work): decouple gameplay simulation from the real viewport
  entirely — a fixed virtual resolution for all simulation math,
  scaled only at render time.** Roughly sized per game, based on the
  exact call sites read this session:
  - **Pixel Ninja Dash: smallest job.** Simulation already doesn't use
    width/height at all (confirmed above) — this is purely a `draw()`
    change (wrap existing draw calls in a scale transform from a fixed
    virtual resolution to the real canvas size). Low risk.
  - **Neon Runner: moderate.** A handful of call sites — the `playerX`
    getter, obstacle spawn x, `groundY` (from height) — swap `this.width`/
    `this.height` for fixed constants inside simulation code, keep the
    real size for `draw()`'s scale transform only.
  - **Sky Dodge: moderate, slightly more surface than Neon Runner.**
    Same idea, but width is read in more places — `resize()`'s clamp,
    `reset()`'s initial `playerX`, `spawnHazard()`, and `update()`'s
    clamp — meaning the "simulation width" vs. "render width" split has
    to be threaded through 4 call sites instead of 2-3.
  - **Cross-cutting, small:** a shared virtual-resolution constant +
    scale-transform helper (`packages/shared` is the natural home,
    alongside `fixedTimestepLoop.ts`/`rng.ts`); once done, the
    `viewport` plumbing this session added (adapters' `resize()` step,
    `GameOverPayload.viewport`) becomes vestigial for replay-correctness
    purposes — simulation would no longer need to know the real size at
    all — though it might be worth keeping for telemetry.
  **OPEN QUESTION — answer before that session starts, not during it:
  letterbox or stretch, when a fixed virtual resolution meets an
  arbitrary real device aspect ratio (a phone in portrait vs. an
  ultrawide monitor)?**
  - **Option A — letterbox.** Uniform scale (`scaleX === scaleY`) fit
    to the smaller axis, centered, bars (in the app's own background
    color, not literal black) fill the rest.
    - *For:* the only option that fully closes THIS gap with a clean,
      one-line correctness argument — a uniform scale factor preserves
      every proportion and hit-target size exactly, on every device, no
      exceptions to reason about. Matches how most competitive/esports
      games handle arbitrary aspect ratios, so it won't read as
      unfamiliar.
    - *Against:* wastes screen space — how much depends on how far a
      real device's aspect ratio sits from the chosen virtual
      resolution's. A narrow phone in portrait against a
      landscape-oriented virtual resolution could end up with a small
      played area and large bars, which may read as unpolished or
      un-immersive specifically on the device class most likely to be
      touch/mobile players (the same population already narrowed to
      keyboard-only in Sky Dodge's match mode this session — worth
      weighing together, not independently).
  - **Option B — non-uniform stretch.** Fill the whole container,
    `scaleX` and `scaleY` allowed to differ.
    - *For:* always fills the screen, no wasted space, feels more
      full-bleed on any device.
    - *Against:* distorts shapes and, more importantly, **only
      partially closes the gap this fix exists to close.** Two players
      on different aspect ratios still see different effective
      hit-target proportions under stretch — smaller in magnitude than
      today's raw-pixel-count problem, but the same *kind* of problem,
      now expressed as shape distortion instead of a score gap. Harder
      to make a clean "this is fair now" argument for the same reason
      letterboxing's argument is easy: there's no single scale factor
      to point at.
  - **Recommendation, not a decision:** Option A. It's the only one of
    the two that actually satisfies "monitor size doesn't decide
    matches" without a residual asterisk. But this has a real product
    cost (wasted space, especially on mobile) that's legitimately a
    call about how the app should feel, not a pure correctness
    question — flagging the recommendation, not assuming it answers
    the question.
  - **One coupled sub-decision, smaller, worth one line here rather
    than its own question:** which virtual resolution to standardize
    on. This session's own replay-adapter tests already used 1280x720
    as a stand-in canonical size — reasonable as a starting default,
    not yet confirmed as the actual answer.
  **Overall scope: a well-contained, roughly half-a-session job now
  that the exact call sites are known (listed above) — most of it
  mechanical — gated on the open question above being answered first,
  not during the session.**

## Project summary

Hub of short (60–180s) head-to-head arcade mini-games. Solo practice, or
matched play (for-fun / for-stakes with play-money escrow; real-money hooks
stubbed only, not wired up). React frontend, Node/Express + Socket.IO
backend, Postgres via Drizzle ORM.

## Product direction

Decisions made outside any coding session (2026-07-31), recorded here so
they aren't lost — this repo is the only durable record of them. Nothing
below is implemented unless a line says BUILT; everything else is
PLANNED, some of it years off. See "ROADMAP" at the top of this file for
what's actually next.

**Business model — PLANNED.** Player-vs-player skill wagering: no house
odds, no luck-based stakes. The platform takes a percentage rake from
each pot — a ledger entry to a house account when built (see "Money
representation" below), not a fee that just vanishes. Real money is the
eventual goal, but everything is built and tested with points first.
Licensing and jurisdiction are unresolved and under separate legal
review — **no real-money code this year**, a hard constraint on scope,
not a soft preference.

**Scale — PLANNED.** Friend-group scale first (~20 users), public scale
later. Both random matchmaking AND direct invite-based challenges are
needed, not just one — invites matter more at small scale specifically,
since two friends who both want to play each other shouldn't have to be
queued at the same moment to get matched (random pairing, as built
session 15, doesn't cover this — it only pairs whoever happens to be
queued for the same game at the same time). Invites are PLANNED, not
built — see ROADMAP item 4.

**Game plan — PLANNED, revises the earlier "51 games" target described
elsewhere in this file** (see e.g. "Games: 3 built" in Architecture
status, and the sessions 3-7 history further down — both describe the
plan as it stood before this revision, not the current one). NOT 51
games. Target is roughly 3 games per major category (engine cluster).
Build the FIRST game in each cluster before a second game in ANY
cluster — prioritize breadth of skill types (reflex, knowledge, aim,
spatial, turn-based) over depth in one cluster, so different players end
up with different strengths rather than the app rewarding one skill
repeatedly. Some games will be culturally rooted, starting with Georgian
ones. (Practical note for whoever picks the next game to build: this
means the next game after Neon Runner/Pixel Ninja Dash/Sky Dodge should
probably be in an untouched cluster — racer, arena-shooter,
physics-table, turn-based-board, or word-trivia — not a second `runner`
reskin, even though session 13-14's notes flagged a second `runner` game
as the natural test of the shared-engine-cluster model. Ask before
assuming which takes priority if this ever matters.)

**Money representation (the "BUILT-BY" rule) — PLANNED, applies once the
wallet is built; nothing below exists in code yet.** These are
invariants the wallet implementation MUST satisfy from its first
commit, not retrofit later:
- All balances stored as INTEGERS in minor units, never floats.
- Every ledger row carries a `currency` field, set to `POINTS` for now —
  adding a real currency (e.g. GEL) later is a new value in that column,
  not a schema migration.
- Balances are DERIVED from an append-only ledger, never stored as an
  independently-mutable field. If a cached/denormalized balance exists
  for read performance, a reconciliation job must recompute it from the
  ledger and alert on mismatch — the cache is never the source of truth.
- The rake is a ledger entry to a house account, not money disappearing
  from the system.
- System invariant: the sum of all balances is constant except at an
  explicit grant/deposit event. Any code path that can change that sum
  without one is a bug.
- **Points reset at real-money launch, and this must be stated in the UI
  before anyone accumulates a points balance** — no user should be
  surprised later that their points didn't carry over.

**Visual theme (as of session 2, replaces the original neon-rainbow theme):**
cinematic dark UI — near-black bg (`#0a0a0f`), violet primary accent
(`#7c3aed`, buttons/logo/active states), gold/amber secondary accent
(`#fbbf24`, ratings + links only, never primary buttons), consistently
rounded/pill-shaped controls, restrained single-color glow instead of
multi-color neon borders. Shared by every game module via `packages/theme`.

A 51-game design doc lived outside this repo as of sessions 1-14 — one
representative game per engine (Runner, Racer, Arena Shooter,
Falling-Block/Match, Physics-Table/Bounce, Turn-Based Board,
Reflex-Timing, Word/Trivia), then faster reskins for the rest, fed to
Claude one game spec at a time. **This target was revised session 15 —
see "Product direction" above** — to roughly 3 games per major category,
breadth-first (first game in every cluster before a second game in any
cluster), not a 51-game backlog. Whether the external design doc itself
was updated to match is unknown — ask before assuming it reflects the
current target.

Repo root: `C:\Users\abuse\arcadeclash`

## Current phase: shared-systems-building (session 8+)

**This heading is itself stale — frozen at session 8's understanding,
never updated since, doubly superseded now by session 15's matchmaking
build and the "Product direction"/"ROADMAP" sections above. Read this
whole section as history, not current status** — same caveat the
section already carried for its own "out of scope" framing, extended
here to the "48 remain" figure below (superseded session 15, see
"Product direction" — no longer 51 total). The user pivoted, as of
session 8, to building the shared systems (auth, matchmaking, real-time
sync, wallet) that every game will eventually plug into, validating each
against one existing game (not yet chosen which at the time) before
assuming it generalizes to the rest. Games-building wasn't abandoned —
3/51 built, 48 remain, by the count that stood at the time — just paused
while systems work happens. **Auth & profile is done and verified
end-to-end against a real database as of session 8** (see the session
log below — signup/login/logout/profile all confirmed working, both at
the API level and through the actual browser UI); as of session 15,
matchmaking is also done (see "Architecture status" above for what that
actually means and doesn't) — wallet and real-time sync are still
genuinely future work, see "ROADMAP" at the top of this file.

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

**Stale duplicate — `GAMES.md` is the current, maintained source for
this table** (it exists as a real file in this repo now; it didn't when
this section was first written). "Practice mode only" and "48 of 51
remaining" below are both superseded by session 15 — see `GAMES.md` and
"Product direction" above. Left as-is rather than kept in sync from now
on, to avoid two places drifting independently.

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

### Session 13 (2026-07-30) — Determinism foundation: seeded RNG, fixed-timestep loop, inputLog

Built the brief from "NEXT SESSION: DETERMINISM FOUNDATION" (now
collapsed into a short pointer at the top of this file — see "DETERMINISM
FOUNDATION — DONE" there). Started by reading `CLAUDE.md`/`PROGRESS.md`/
`packages/shared/` cold and re-verifying every claim by reading the actual
code (per the documentation rules from session 10) — confirmed accurate:
no `rng.ts`, no `inputLog`, all 3 games' loops identical variable-dt
shape, `GameOverPayload` exactly `{score, reason, durationMs}`, all 17
`Math.random()` sites matching the prior session's list and
classification exactly.

**The one open question, answered before coding: `inputLog` keys on
`tick`, not `timestamp`.** A fixed-timestep sim is fully determined by
(seed, sequence of discrete ticks, which inputs were live on each tick) —
wall-clock time isn't part of that model. Replaying a `timestamp`-keyed
log would require converting back to a tick index at replay time
(`floor(timestamp / stepMs)`), a lossy derivation of the one thing that's
actually invariant. `tick` records that invariant directly.

**Built, in order:**

1. `packages/shared/src/rng.ts` — `mulberry32` (32-bit PRNG) and
   `createSeededRandom(seed)`, which returns `{ stream(label) }` —
   `.stream("gameplay")` and `.stream("cosmetic")` derive two
   independent mulberry32 generators from one root seed via an internal
   xmur3-style hash of `(seed, label)`, so advancing one stream can never
   perturb the other (they're backed by separate generator state, not two
   slices of one shared stream).
2. `packages/shared/src/fixedTimestepLoop.ts` — `createFixedTimestepLoop`,
   an accumulator loop with `FIXED_TIMESTEP_SEC = 1/60`. Genuinely
   imported by and shared across all 3 games — the session's brief
   explicitly asked to stop and report if the games turned out unable to
   share it; they didn't need to, no forking required. `now`/`raf`/`caf`
   are injectable, which is what makes it testable without a browser (see
   the acceptance test below) and is also what let the user's requested
   loop-jitter test happen at all.
   - **Stall-clamp policy: clamp the frame delta to `maxStepsPerFrame *
     stepSec` (5 steps ≈ 83ms) before it reaches the accumulator, then
     drop the excess — don't carry it forward to catch up over several
     frames.** This is the standard "Fix Your Timestep" spiral-of-death
     guard. Verified safe specifically for this system's replay model:
     replay steps ticks from the recorded `inputLog`, it never re-runs
     this accumulator against real time, so whatever a stall's clamp
     drops during a live session only affects that session's real-time
     pacing (a brief hitch), never the reproducibility of the log it
     produces.
3. `packages/shared/src/gameModule.ts` — added `InputLogEntry = { tick,
   action }`; `init()` gained a `seed: number` 4th parameter;
   `GameOverPayload` gained `seed` and `inputLog`, kept `reason`/
   `durationMs` (both real and useful, per the brief).
4. All 3 games' `engine.ts` (`RunnerEngine`, `DashEngine`, `DodgeEngine`):
   constructor now takes `seed: number`. **RNG streams are re-derived
   inside `reset()`, not the constructor, and re-derived on every call to
   `reset()`** — this was flagged mid-session as a structural-invariant
   question (the user pointed out that "reset() only ever fires once in
   practice, because `GameLoader` always destroys/recreates the module
   for Play Again" is an unenforced assumption about caller discipline,
   not something the engine itself guarantees). Chose re-derivation over
   throwing on a second `reset()` call: it makes `reset()` fully
   idempotent — any number of calls always restarts this seed's exact
   sequence — rather than just converting a silent bug into a loud one
   while still forbidding a legitimate future use case (restarting a run
   without a full module teardown/recreation).
5. All 3 games' `index.ts`: engine construction moved from a field
   initializer into `init()` (needs the seed); the old
   `requestAnimationFrame`-based variable-dt loop replaced with
   `createFixedTimestepLoop`; `pause()`/`resume()` now map directly to
   `loop.stop()`/`loop.start()`. `inputLog` recorded as edge transitions
   (press/release, or held-key down/up for `sky-dodge`'s continuous
   `moveLeft`/`moveRight`), tagged with `this.fixedLoop.tick` at the
   moment of the real DOM event, only once the run has actually started.
   `sky-dodge` previously had no key-repeat debounce guard on
   `moveLeft`/`moveRight` (unlike `jumpKeyDown` in `neon-runner`) — added
   one, needed for clean single-transition log entries rather than one
   entry per OS key-repeat (~every 30-60ms while held). This also meant
   removing `pause()`'s old defensive `input.moveLeft/moveRight = false`
   reset: with the debounce guard in place, forcing those false on pause
   would block a still-held key from re-arming on resume until released
   and re-pressed (the guard would see `moveLeftKeyDown` still `true` and
   skip re-setting `moveLeft`). Confirmed safe to just remove: the loop
   is fully stopped while paused, so `engine.update` never reads the
   input flags during that window regardless of their value — the only
   moment they matter is the first tick after resume, and leaving them
   untouched during pause makes a still-held key keep working immediately
   on resume, which is the more correct behavior anyway.
   `dragTargetX` (pointer-drag movement in `sky-dodge`) deliberately
   excluded from `inputLog` — continuous analog input, out of scope for
   this session's tick/action log format. Logged as a known anti-cheat
   gap, not just a missing feature — see "Known gaps" above.
6. `packages/client/src/game-loader/GameLoader.tsx`: generates a fresh
   seed per mount (`Math.random()`-based — this is the host picking an
   arbitrary starting point for one run, not gameplay-affecting
   randomness, so it deliberately doesn't go through the seeded streams)
   and passes it into `mod.init(...)`.
7. Two queued cleanups, done in the same files while already in them:
   removed the dead `playerMovingLeft`/`playerMovingRight` fields from
   `sky-dodge/engine.ts` (declared, never read/written anywhere — confirmed
   by reading the whole class before deleting); moved
   `pixel-ninja-dash`'s `dashFlashRemainingMs = 180` magic number into
   `constants.ts`'s `WORLD.dashFlashDurationMs`, alongside its other
   tunables.

**Cross-engine float determinism, checked per explicit ask:** grepped all
of `games/` for `Math.sin/cos/tan/atan2/pow/exp/log` (not
implementation-exact across JS engines) — zero matches anywhere in
gameplay code. Only `Math.min/max/floor/ceil/round/abs` (IEEE-exact) and
one `Math.PI` constant used inside `draw()` (rendering only, not
simulation state) appear anywhere. Nothing to fix; not a live risk in
this codebase.

**Acceptance test: `scripts/determinism-check.ts`** (same standalone
`npx tsx` convention as the engine-verification scripts from sessions
4-6 — no DOM/rAF needed for the engine-replay test; the loop-jitter test
uses the loop's injectable `now`/`raf`/`caf` instead of a real browser).
Two tests, not one, per explicit instruction that engine-only testing
never exercises the loop itself:

1. **Engine replay** — all 3 games, same seed + same synthetic tick-tagged
   `inputLog`, run twice, assert identical final score AND full
   `JSON.stringify(engine)` state. All 6 assertions (3 games × score/state)
   pass.
2. **Loop jitter** — `RunnerEngine` driven through the real
   `createFixedTimestepLoop` under two fake clocks (smooth ~16.67ms vs.
   jittery `[16, 50, 8, 400, 16, 16, 33, 9, 41, 300, 16, 12, 60]`ms,
   cycling — includes a simulated 400ms stall), same seed, same
   `inputLog`. Stopping is done from *inside* `update()` at an exact tick
   (mirroring how the real games stop on collision), not by checking
   `loop.tick` from outside between frames — the first version of this
   test did the latter and the jittery run overshot the target by 2 ticks
   (a single burst catch-up frame can process up to 5 ticks at once,
   crossing an externally-checked threshold mid-frame); the bug was in
   the test's driving logic, not the loop, and is fixed now. All 5
   assertions (tick-sequence shape × 2, score match, full state match,
   stall-clamp bound) pass. Confirmed the scenario isn't accidentally
   vacuous: the run does collide partway through (tick 93 of 300), but
   several 400ms/300ms jitter stalls land before that point in real time,
   so the comparison still meaningfully exercises live gameplay under
   burst catch-up, not just a frozen post-collision tail.

**Negative test, per explicit ask** ("if it can't fail, it isn't testing
anything"): temporarily reverted `neon-runner/engine.ts`'s obstacle-type
call from `this.gameplayRng()` back to `Math.random()`, reran — the
"full state matches" assertion correctly failed (score still coincidentally
matched; full state didn't). Reverted immediately, reran, back to all
passing.

**Type-checked** (`tsc -b` client, which covers `games`/`shared` via
project references; `tsc --noEmit` server) — both clean. One real fix
needed along the way: this TS version (6.x) has `erasableSyntaxOnly`
enabled, which rejects constructor parameter-property shorthand
(`constructor(private readonly seed: number) {}`) — rewrote as an
explicit field + plain constructor body in all 3 engines. `oxlint` across
`games`/`packages/shared/src`/`scripts` also clean.

**Browser-verified** (all 3 games): mount → countdown → pause → resume →
pause → quit → `gameOver` → results screen → Play Again remount, zero
console errors throughout; `sky-dodge`'s new key-repeat debounce path
exercised via ArrowLeft/Space key presses, no errors. **Could not verify
live rAF-driven score progression** — confirmed via a raw rAF-counter
probe that `document.hidden === true` in this Browser-pane tab, so
`requestAnimationFrame` never fires here at all (a pre-existing,
already-documented sandbox limitation from earlier sessions, re-confirmed
rather than newly discovered). This is exactly why the loop-jitter
acceptance test above uses an injectable fake clock instead of relying on
real rAF — the same limitation that blocks browser verification is also
why the automated test needed to be clock-injectable in the first place.
The user should confirm live gameplay feel themselves at
`localhost:5173`.

No commits made this session — ask before committing, per standing
instruction.

### Session 14 (2026-07-30) — wallMs evidence field, stall-clamp follow-up analysis

Follow-up to session 13, same day. User asked two analysis-only questions
about the stall-clamp policy's implications for a future live two-player
match (round length in ticks vs. wall-clock; whether score comparison
needs equal tick counts) — answered without changing code (round length
is tick-native in all 3 games today, confirmed by reading how `elapsed`
accumulates; async score comparison doesn't need equal ticks, a future
live-synchronized model would).

**The user then identified a real gap the prior analysis missed: a
freeze-frame/time-dilation exploit, not a lag-switch/skip-content
exploit.** These are reflex games — stalling the sim doesn't grant extra
ticks or skip obstacles (confirmed correct in the prior analysis), but it
does freeze the rendered frame and hand the player unlimited real-world
time to study it and plan, undetectably: the tick-keyed `inputLog` can't
see the real-time gap, so a replay of a four-hour freeze-and-plan run and
an honest one are byte-identical. This converts a reaction test into a
planning test with zero trace in the log.

**Built:** `InputLogEntry` gained an optional `wallMs?: number` field
(`packages/shared/src/gameModule.ts`) — real elapsed ms since run start
(`performance.now() - runStartTime`, same basis as the already-existing
`durationMs`), captured in `logInput()` in all 3 games' `index.ts`
alongside the existing `tick`/`action`. Confirmed before adding anything
that `durationMs` was already true wall-clock run duration (computed via
direct `performance.now()` calls at run start/end, independent of tick
count) — no change needed there, the user's "if that isn't already real
elapsed time" condition was already false.

**Enforced, not just intended, that `wallMs` can't affect determinism:**
added Test 3 to `scripts/determinism-check.ts` — replays each of the 3
games' baseline `inputLog` with every `wallMs` value either randomized or
stripped entirely, asserts the resulting state is bit-for-bit identical
to the original run. All 6 new assertions pass, alongside the 11 from
session 13 (17 total, all pass). This is deliberately a stronger claim
than "the replay code doesn't currently read the field" — it's an
enforced invariant that will catch a future regression if anyone
mistakenly wires `wallMs` into replay logic later.

Type-checked (`tsc -b` client, `tsc --noEmit` server) and linted
(`oxlint`) clean. Browser-verified on Neon Runner only (key press →
`logInput` → `wallMs` capture → pause → quit → `gameOver` dispatch with
the new field in `inputLog`), zero console errors — didn't re-verify all
3 games' full lifecycle again since this change is structurally identical
and low-risk across them, and session 13 already covered the full
lifecycle for all 3 immediately prior.

Added two entries to "Known gaps" per the user's explicit request: the
time-dilation/freeze-frame exploit itself (wallMs is captured as evidence
but nothing validates it yet — building that validator is separate,
future work), and the async-vs-live-synchronized matchmaking model choice
(with a note that a future Arena Shooter cluster likely needs the live
model, so whichever gets built first may not generalize to all 8
engines).

No commits made this session — ask before committing, per standing
instruction.

### Session 15 (2026-07-31) — Matchmaking (for-fun): queue, server-issued seeds, forfeit timeout

Built the matchmaking session flagged as "exact next step" since session
14. Scope confirmed up front: for-fun only, no wallet/stakes/escrow, no
real-time in-game state sync (each player plays their own instance off a
shared seed, scores compared only), no leaderboards, no new games.

**Pre-coding questions answered, then approved with two changes (see
below):**
1. **Async-independent rounds, not live-wall-clock-synchronized** —
   these games have no fixed round length (end on collision, not a
   clock), so a flat timer from match start would risk cutting off a
   legitimately long, skilled run. Async fits what's built with zero
   engine changes. Doesn't foreclose a live model later for e.g. Arena
   Shooter — the queue/pairing/auth layer is agnostic to what happens
   after `matched`.
2. **Match state: in-memory only, not Postgres.** No stakes, nothing
   worth persisting yet. A restart drops every queued/in-progress match;
   both clients see "connection lost."
3. **Client-reported score is trusted outright — stated explicitly as a
   for-fun-only acceptance, not an oversight.** What must change before
   stakes: the 3 engines are already DOM-free (proven by
   `determinism-check.ts` running them headless), so a future verifier
   could replay `(seed, inputLog)` server-side and reject a mismatch —
   not built this session.
4. **Local two-player testing needs two distinct accounts** (same-browser
   tabs share the session cookie) — confirmed as the actual method used
   for this session's live verification below.

**User additions to the plan before coding:**
- **ADD: a server-side forfeit timeout.** The original plan handled
  disconnection but not a player who stays connected and never submits
  (paused, tabbed away, idle at the match-found countdown) — their
  opponent would sit on "awaiting opponent" forever, and never
  submitting is a losing player's dominant strategy once stakes exist
  (avoids a recorded loss). Decision: the grace timer starts at the
  FIRST score submission (not match start, for the round-length reason
  above), runs `FORFEIT_GRACE_MS` = 120s (generous relative to this
  project's own 60–180s round-length target), and on expiry **the
  submitted score wins outright — the match is NOT voided.** Voiding
  would let the exploit succeed anyway (a void still avoids a recorded
  loss); forfeit means submit-and-maybe-win-or-tie vs.
  don't-submit-and-definitely-lose. Both clients get told: the submitter
  sees "You win — opponent didn't finish in time," the non-submitter
  (wherever they are — countdown, mid-run, anywhere) has their module
  torn down immediately and sees "You forfeited." Residual gap,
  deliberately not covered: if *neither* player ever submits, no timer
  runs for that match at all (see Known Gaps) — this doesn't strand
  anyone, it's a memory-cleanliness gap, not a fairness one.
- **VETO: client-supplied display username.** The original plan had the
  client send its own username alongside `joinQueue`, trusting it as a
  cosmetic-only display value. Correctly rejected: the display name is
  what the OTHER player sees, so a client could claim any name and
  impersonate someone. Fixed by moving the username lookup server-side —
  `socketAuthMiddleware` (`packages/server/src/matchmaking/
  socketAuth.ts`) does a `db.query.users.findFirst` on the same verified
  `userId` the JWT already established, exactly where the trust boundary
  already exists (mirrors `/api/auth/me`'s pattern). `JoinQueuePayload`
  no longer carries a username field at all — verified by the live smoke
  test asserting each side's `opponentUsername` matches the OTHER
  account's REAL signed-up username, not anything either client
  transmitted.

**Built** (see "Architecture status" above for the file list and full
verification detail — not repeated here): shared wire-protocol types
(`packages/shared/src/matchmaking.ts`); server matchmaking module
(`socketAuth.ts`, `queue.ts`, `matches.ts`, `index.ts`) attached to a
`node:http` server wrapping the existing Express app (`app.listen` →
`httpServer.listen`, first structural change to `index.ts`'s bootstrapping
since it was written); client `useMatchSocket` hook + a new `MatchLoader`
host component (deliberately separate from `GameLoader`, not a mode
branch inside it — practice mode's `mount()` is completely untouched,
its client-side random seed is still correct there since solo has
nothing to cheat against); a "Find Opponent" button on `GameCard`
(gated on being logged in, both client-side via `useAuth()` and
server-side via the socket auth middleware — defense in depth, not
redundant).

**Interface check, as explicitly asked for:** `GameModule`/
`GameOverPayload` needed zero changes. `matchId` correlation lives at the
host layer (`MatchLoader`), not inside `GameOverPayload` — that payload
stays purely about one game run, game-agnostic, same as before. All 3
games' `index.ts` files are untouched.

**Verification, in order of confidence:** (1) 21 automated assertions in
`scripts/matchmaking-check.ts` against the real `queue.ts`/`matches.ts`
logic using fake sockets cast to the real `MatchmakingSocket` type —
pairing, self-match rejection (proven via the enqueue-dedup invariant,
not a separate runtime check), queue cancel/removal, match creation,
normal both-submitted resolution, duplicate-submission idempotency,
forfeit-by-timeout (using a temporary `global.setTimeout` stub to avoid
a real 120s wait — same goal as `determinism-check.ts`'s injectable fake
clock, applied via a stub since `matches.ts` wasn't built with an
injectable timer), and disconnect-mid-match (confirms the pending
forfeit timer is actually cancelled, not just that the immediate
`matchEnded` fires). (2) A live two-socket smoke test against the REAL
running dev server and REAL Supabase DB (not mocked): signed up two real
throwaway accounts via the real signup API, connected two real
`socket.io-client` sockets using their real session cookies via
`extraHeaders`, drove them through `joinQueue` → `matched` →
`submitScore` → `matchResolved`, asserted matching `matchId`/seed on
both sides and each side's `opponentUsername` against the OTHER
account's real signed-up username — then deleted both throwaway
accounts afterward. (3) A real browser click-through: signed up an
account, clicked Find Opponent, confirmed the queued screen text and a
working Cancel button returning cleanly to home, zero console errors
both times. **Not verified: an actual two-player match played end to
end** — this Browser-pane sandbox can't drive real `requestAnimationFrame`
(same `document.hidden`-true limitation documented since session 4), so
"matched → countdown → play → both scores shown" was pieced together from
the live-socket protocol test and the pre-game UI test rather than
observed as one continuous human playthrough. Regression-checked:
`scripts/determinism-check.ts` still passes all 17 assertions unchanged.
`tsc -b` (client)/`tsc --noEmit` (server) both clean, `oxlint` clean (one
pre-existing warning in an untouched file, `AuthContext.tsx`).

Also added, per explicit request: this session's `NEXT SESSION:
MATCHMAKING` brief (which had lived at the top of this file since session
14) is now removed — it was a forward-looking brief for exactly this
session, now historical. Added a note to "NOTICED BUT DELIBERATELY NOT
TOUCHED" that all 3 games' `console.warn` on `mode === "match"` is now a
stale message (real matches exist) but wasn't fixed since it required
touching `games/*/index.ts`, out of this session's stated scope.

**Same-day follow-up, documentation-only pass (no code changed):** asked
to state plainly whether a heartbeat and a tick-based win condition were
actually built, rather than let them read as "planned work underway."
Grepped `packages/server/src/matchmaking/`, `packages/client/src/
matchmaking/`, and `MatchLoader.tsx` for "heartbeat"/"ping"/"interval"/
"tick" before answering — **neither exists.** No heartbeat: disconnect
detection for anything other than an explicit `.disconnect()` call
relies entirely on Socket.IO's own unconfigured default ping/pong; the
forfeit timer is a one-shot `setTimeout`, not a recurring check, and
that distinction hadn't been stated clearly enough in the original
write-up above. No tick-based win condition: the only "who won" logic
anywhere is a plain client-side score comparison for display, unrelated
to each game's tick-native round length. Reviewing the earlier
verification claims in this same entry against that standard surfaced
several more that were true but understated their own limits — corrected
in the "BUILT AND VERIFIED" and "Architecture status" sections above,
not rewritten here: the forfeit timer's real 120s duration was never
actually waited out (tested with a stubbed near-instant delay), the auth
middleware's rejection path was never tested (only acceptance), every
disconnect test used either an explicit clean `.disconnect()` call or a
fake socket with the handler invoked directly — never a genuinely silent
connection death — and every UI phase past 'queued' was never rendered
in any browser, only type-checked. None of this reverses anything
reported as verified above; it makes explicit what was and wasn't, since
the original phrasing left room to assume more than was actually shown.

**Also recorded this pass: product-direction decisions made outside any
coding session** — business model (skill-based PvP wagering, rake, no
real money this year pending legal review), target scale (~20 friends
first, both random matchmaking and invites), a revised game plan (not
51 games — roughly 3 per category, breadth-first, some culturally
rooted), and money-representation invariants for the eventual wallet
(integer minor units, currency field, ledger-derived balances, rake as
a ledger entry, points reset at real-money launch). All PLANNED, none
built — see "Product direction" above. Corrected every place in this
file that described the old 51-game target as current status (the
60-second summary, Architecture status, and the project-summary design-
doc line); left session 3-7's historical log entries themselves
unrewritten, since they're an accurate record of the plan as it stood
at the time. Replaced the "candidate next steps, none picked" framing
in "EXACT NEXT STEP" with the actual decided order: server-side score
validation next, then wallet ledger, then stakes/escrow, then invites +
live player counts.

No commits made this session — ask before committing, per standing
instruction.

### Session 16 (2026-07-31) — Server-side score validation + winner determination

Built the item flagged "NEXT SESSION" at the end of session 15: replay a
submitted `(seed, inputLog)` server-side before trusting a reported score,
and have the server (not the client) decide and record a match's winner.
Scope confirmed up front: validation + winner determination only — no
wallet, no stakes, no invites, no heartbeat, no new games.

**Pre-coding questions answered (measured, not estimated, per explicit
instruction), then a plan approved with three changes:**
1. **Inline in the `submitScore` handler, not queued.** Measured (not
   estimated) real per-tick cost of all 3 engines via a throwaway `tsx`
   probe (200,000 "live" ticks each, resetting on collision so every
   tick pays full cost): 0.00020ms (neon-runner), 0.00026ms
   (pixel-ninja-dash), 0.00063ms (sky-dodge, slowest). Even at the
   21,600-tick cap, worst case is ~13.6ms — safe on the event loop.
2. **Game-agnostic via a registry-driven adapter map, not a switch.**
   Found the current structure didn't support this for free: the
   action->input mapping was hand-duplicated between each game's
   `index.ts` (live play) and `determinism-check.ts` (test-only), and
   the registry had zero connection to either. Built `games/<id>/
   replay.ts` adapters (one per game) conforming to a shared
   `ReplayAdapter` interface (`packages/shared/src/replay.ts`), a
   generic `replayEngine()` driver with zero game-specific logic, and a
   static `games/replayAdapters.ts` map (asserted complete against
   `games/registry.ts` at module load). `determinism-check.ts` refactored
   to call the same adapters + driver — this session's answer to "share
   the harness, don't duplicate it."
3. **One side INVALID -> the other wins; both INVALID -> void.** Mirrors
   the existing forfeit-timeout precedent (`matches.ts`'s
   `FORFEIT_GRACE_MS` comment): voiding on a failed validation would let
   "submit a tampered score, force a void" replace "don't submit" as a
   losing player's escape hatch — forfeit precedent already rejected
   that shape of exploit once, so INVALID gets the same treatment.
   Extended (my own call, not separately asked for, flagged as such in
   the plan) to a forfeit-vs-INVALID edge case: a forfeit doesn't hand
   the opponent a win if that opponent's own submission is invalid —
   void instead, since an invalid score shouldn't win just because the
   other side also failed to produce a trustworthy result.

**Two blockers found while reading the actual engine code (not assumed
from the interface), both flagged before writing code:**
- **Viewport size feeds simulation directly in 2 of 3 games** (Neon
  Runner, Sky Dodge — Pixel Ninja Dash unaffected), discovered by
  reading `engine.ts` collision math, not the `GameModule` interface.
  Without transmitting it, an honest run on a real (non-zero) screen
  size would very plausibly fail to replay-validate — not from cheating,
  from the server guessing width=0. See the Known Gaps STAKES BLOCKER
  entry for the full detail and the fix's implications.
- **UNVERIFIABLE needed a signal the server didn't have** (whether Sky
  Dodge's drag input was used in a given run) to correctly distinguish
  "can't replay because of the known drag gap" from "can't replay
  because of real tampering." Originally proposed as a client-supplied
  `usedUnverifiableInput` boolean on `GameOverPayload` — **rejected by
  the user**: a boolean the client controls, that skips replay when
  true, is a client-controlled off switch for the entire validator (set
  it on every submission, never get checked). Replaced with disabling
  drag input in match mode entirely (`games/sky-dodge/index.ts`'s
  `handlePointerDown`/`handlePointerMove` no-op when `mode === "match"`)
  — every match run is now fully keyboard-driven and fully replayable,
  so there's nothing left to exempt. `ScoreVerdict` keeps
  `"unverifiable"` in the type for a future non-tick game; no current
  adapter can produce it — an unreplayable match run is INVALID, per
  explicit instruction.
- **Checked whether pause is live in match mode, as asked, before
  assuming either way:** grepped `mode` usage in all 3 `games/*/
  index.ts` — it was captured as an `init()` parameter but only ever
  used for a `console.warn`, never to gate anything. The pause button
  was created unconditionally and wired straight to `pause()`; the
  `visibilitychange` listener (backgrounded tab) was also unconditional
  and also calls `pause()`. **Confirmed: yes, live in match mode.**
  Fixed by guarding `pause()` itself (not just the button) on
  `this.mode === "match"` — one guard point covers both the button and
  the tab-backgrounding path, in all 3 games. Practice mode unaffected.

**Built:** `packages/shared/src/replay.ts` (adapter type, `replayEngine()`
driver, `checkReplayRequestShape()`, tick/log-size caps);
`games/{neon-runner,pixel-ninja-dash,sky-dodge}/replay.ts` (per-game
adapters); `games/replayAdapters.ts` (static map + startup assertion);
`packages/server/src/validation/{scoreValidator,matchOutcome}.ts`
(replay-based verdict + the plausibility warning; winner-determination
policy); `GameOverPayload`/`SubmitScorePayload` extended with `viewport`;
`SubmitScorePayload` extended with `inputLog`; `PlayerResult` extended
with `verdict`; `MatchResolvedPayload` extended with `outcome`;
`matches.ts` wired to call the validator and compute `outcome` before
`emitResolved`; `MatchLoader.tsx` forwards `inputLog`/`viewport` and
displays the server's `outcome` instead of comparing scores itself (kept
to the file's existing `ac-panel`/`ac-text-muted` classes and theme
vars — no new hardcoded styling). All 3 games' `index.ts`: viewport
capture, `mode` field, pause gated off in match mode; Sky Dodge also
gates drag off in match mode. The now-inaccurate `console.warn` about
match mode not being implemented (flagged as stale in session 15's
"noticed but not touched," out of scope then) was removed from all 3
games as a direct, minimal side effect of touching that exact `init()`
line for the `mode` field — not a separate cleanup pass.

**Tick/log-size caps: `MAX_REPLAY_TICKS = 21,600` (360s, 2x this
project's own stated 60-180s round-length target — Pixel Ninja Dash
self-terminates at its own hard 60s regardless; Neon Runner/Sky Dodge
have no in-engine limit, so this cap is the only thing bounding them),
`MAX_INPUT_LOG_ENTRIES = 10,000`** (a generous physical input-rate
ceiling — ~10 presses + 10 releases/sec sustained, already far beyond
realistic mashing — times 360s, rounded up). Both checked before any
engine is constructed. Product/gameplay judgment calls, not purely
technical — flagged as adjustable when proposed.

**Verification:** two standalone `tsx` scripts, same convention as every
engine-logic test in this project — `scripts/score-validation-check.ts`
(new, 22 assertions) and `scripts/determinism-check.ts` (refactored to
route through the shared adapters/driver; all 17 original assertions
still pass, unchanged). Worth recording because it wasn't a straight
line: the first version of the "tampered inputLog" test used sparse,
early hand-picked actions (copied from `determinism-check.ts`'s own
sample logs) and its own precondition check caught that dropping them
didn't actually change 2 of 3 games' replayed score — the obstacles in
those sample runs don't arrive until well after those actions' ticks, so
they were never load-bearing. Switched to a denser, spread-out periodic
action pattern (and, for the "tampered" case itself, an empty log) that
empirically does change the outcome, confirmed by the precondition
check now passing. `tsc -b` (client) / `tsc --noEmit` (shared, games,
server) all clean — one real bug caught this way:
`UnrecognizedActionError`'s constructor used TS parameter-property
shorthand, which the client build's `erasableSyntaxOnly` setting
rejects (`TS1294`); fixed by declaring the fields explicitly. `oxlint`
clean across every changed directory, same one pre-existing warning as
session 15 in an untouched file. The dev server (`tsx watch`) auto-
reloaded through every edit this session without crashing — confirmed
via a health-check request after the last change (PID changed between
checks, confirming an actual restart happened, not just a stale healthy
process). **Not done this session, stated plainly rather than implied:**
session 15's live two-real-socket smoke test was not re-run, so there is
no live-Socket.IO-round-trip confirmation that a real match submission
reaches the validator and back correctly — the two `tsx` scripts call
the real validator/outcome functions directly, not through the wire
protocol. The new client-side UI (server `outcome` text, pause button's
absence, drag's absence in match mode) has not been rendered in any
browser — same `document.hidden`-true sandbox limitation as every
session since 4.

Two Known Gaps entries added or substantially rewritten this session —
see "Known gaps" above for the full text, not repeated here: Sky Dodge
match mode is keyboard-only until analog input is properly logged
(touch/mobile players can't compete there yet); viewport-coupled
simulation is a STAKES BLOCKER (with a rough per-game sizing estimate
for the fixed-virtual-resolution decoupling job, explicitly not done
this session, and the mid-run-resize residual gap even with this
session's transmit-and-replay fix). The freeze-frame entry was updated,
not superseded — pause is now disabled in match mode and a plausibility
warning exists, but the underlying backgrounded-tab/throttled-tab stall
vector is untouched, and the warning is explicitly noted (in both this
file and the code comment above it) to be unable to distinguish a real
exploit from ordinary legitimate pausing.

No commits made this session — ask before committing, per standing
instruction.

### Session 17 (2026-07-31) — Two regressions from disabling pause: honest concede path, disconnect-resolves-not-voids

Same-day follow-up to session 16. Asked two direct questions about the
pause removal before any code changed: what happens when a match player
backgrounds their tab (answered: resumes exactly where they left off,
zero penalty — confirmed by reading `pause()`'s new match-mode guard and
`handleVisibilityChange`, not assumed), and whether there's still a way
to quit mid-match (answered: yes, but it changed from "concede with a
real score" to "raw disconnect that voids the match," since the only
`endRun("quit")` trigger lived inside the now-unreachable pause overlay
— confirmed by grepping all 3 games for `endRun(` and finding exactly
one call site each, always the pause overlay's Quit Run button). Both
answers surfaced real regressions; user asked for both fixed this
session, plus a third fix for the backgrounding case itself, plus a
Known Gaps correction, plus two process additions.

**Built** — see the new BUILT entry above for the full breakdown, not
repeated here: a Forfeit control (click-twice confirm) in all 3 games;
`handleDisconnect` rewritten to resolve mid-match disconnects as a loss
for the disconnector across 3 distinct sub-cases instead of voiding
unconditionally; `PlayerResult` extended with a proper `status` union
(session decision: rejected the first-draft sentinel-value approach —
`score: 0` + `reason: "opponent_disconnected"` — because escrow settles
on this exact path in two sessions and "never played" has to survive
into a payout/dispute record as a real type, not a free-form string);
auto-forfeit on backgrounding with no grace period; a `visibilityHidden`
evidence event logged server-side for the whole match session; and
`matchEnded`/the `'ended'` client phase removed as newly-unreachable
dead code.

**Grace period, asked for a reasoned recommendation rather than a
default:** none. Any nonzero window is repeatable with no proposed
cooldown (blur/refocus in a loop buys another window each time), and
these games' own timing precision (Pixel Ninja Dash's own perfect
window is 80ms) means even a "short, forgiving" grace period stays
many multiples wider than what actually matters for reflex timing — the
two goals (feel forgiving, not be exploitable) pull in opposite
directions at any nonzero value. Accepted as proposed.

**A real process finding, not just a bug:** `scripts/matchmaking-check.ts`
had been silently failing 6 of its assertions since session 16 — its
`submitScore` calls predated the `inputLog`/`viewport` requirement score
validation added, and nobody re-ran this unrelated script to notice.
Rewrote it: every `submitScore` call now uses a real `(seed, inputLog)`
pair replayed via the actual shared adapters/driver (same convention as
`score-validation-check.ts`), Test 8 (disconnect) rewritten into three
sub-case tests matching the new resolution policy exactly. One
non-obvious wrinkle while fixing it: the first two attempts at giving
Alice and Bob different honest Neon Runner scores (different jump
timing periods, then an alternating jump/slide pattern) both produced
IDENTICAL scores against a fresh random match seed — turned out jumping
alone never helps against an overhang obstacle, so a jump-only "active"
log can die exactly like a passive one if an overhang happens to be
what's fatal for that seed's obstacle layout; switched the match's own
seed to a fixed constant (rather than `generateSeed()`) specifically so
this class of "does this input pattern actually diverge" question is
answerable and reproducible instead of depending on random-seed luck
each run. All 27 assertions pass now. Added to CLAUDE.md as a standing
rule (rule 5 under "Documentation rules"): run every script in
`scripts/` before reporting a session complete, not just the ones the
session's own work touched, and report each script's pass count
explicitly — "tests pass" without a count isn't verification. Also ran
`determinism-check.ts` (17/17, unchanged) and added 3 new
`determineDisconnectOutcome` unit assertions to
`score-validation-check.ts` (25/25).

**Known Gaps, both additions/corrections asked for, done:** the
freeze-frame entry was rewritten (not just amended) to state plainly
that every mitigation shipped across sessions 16-17 — no pause button,
auto-forfeit on hidden, visibility reporting — is enforced client-side,
in code a modified client can simply not run; the only server-side
signal is the wallMs plausibility check, and that's warning-only. A new
STAKES BLOCKER entry: session 17's disconnect fix means a momentary
network drop now costs a match outright with no reconnection window,
correct for closing the free-escape exploit but a real dispute/
chargeback risk once money is involved — sizing not done, flagged as a
requirement only.

`tsc -b`(client)/`tsc --noEmit`(shared, games, server) clean, `oxlint`
clean (same one pre-existing unrelated warning, `AuthContext.tsx`, every
session since it was first noticed). No commits made this session — ask
before committing, per standing instruction.

### Session 18 (2026-07-31) — Confirmed the viewport gap live: real match, zero deliberate action, 41% score gap

Same-day follow-up. The user ran two real clients through an actual
match with zero input from both sides and got Neon Runner scores of 221
and 157 — asked for a diagnosis, not a fix, in three parts.

**1. Seed issuance.** Confirmed by code — a single `generateSeed()`
call in `packages/server/src/matchmaking/index.ts` feeds both
`matched` emits from the same variable, no path for divergence — but
no log line existed to confirm it against a real run. Added one
(`TEMPORARY DIAGNOSTIC`, `createMatch` in `matches.ts`).

**2. Client seed usage.** Grepped the whole client for `Math.random`/
seed logic: exactly one hit outside the match path (`GameLoader.tsx`,
practice mode's own client-generated seed, architecturally unreachable
from `MatchLoader.tsx`). The match path passes `matchInfo.seed`
straight from the raw `matched` socket payload into `GameModule.init()`
with no client-side generation anywhere in between.

**3. Viewport sensitivity, quantified.** Replayed `RunnerEngine`
headless (same seed, empty inputLog) across swept widths. First pass
tested ~200px gaps (matching the user's original ask) and found only a
20-21 point / ~1.10x max gap — far short of the reported 64-point/
1.41x gap, so the initial conclusion was "too large to explain by
viewport alone at that scale." **User corrected this with a sharper
read of the same data:** working the 221/157 gap backward through the
measured ~0.1-points-per-pixel slope lands on ~1560px and ~920px — a
maximized window vs. a default, never-resized incognito window, which
is exactly the kind of gap a real user would produce without touching
anything. The ~200px assumption was simply the wrong magnitude for
this real case, not evidence against viewport as the cause. **Also
flagged, correctly, and now recorded here: a zero-input run is
seed-independent (every seed tested landed on the identical score at a
given width), so the original diagnostic couldn't have distinguished
"same seed, different width" from "different seed" even if the latter
had been true — it only ever tested the width dimension.**

**Confirmed live and promoted to the higher-priority of the two STAKES
BLOCKER entries in Known Gaps** (ahead of session 17's no-reconnection-
window gap) — see that section for the full writeup, not repeated here:
the measured ~0.1 pts/px slope, the ~33%-at-1920-vs-1280 figure, and
the real 221/157 instance as evidence this isn't theoretical. Extended
the temporary diagnostic logging (both `createMatch` and `submitScore`
in `matches.ts`, plus a matching client-side log in `MatchLoader.tsx`'s
`gameOver` handler) to print viewport alongside seed on both server and
client console — the next reproduction settles seed identity directly
from logs instead of by inference.

**Scoped the eventual fix without building it, per explicit
instruction.** The per-game call-site breakdown from session 16 still
holds (Pixel Ninja Dash: `draw()`-only, smallest; Neon Runner:
moderate, ~3 call sites; Sky Dodge: moderate, ~4 call sites) — see
Known Gaps. Wrote the letterbox-vs-stretch tradeoff as an explicit,
answerable question rather than prose, since the user asked to be able
to answer it before that session starts rather than during it:
letterbox fully closes the gap with a clean correctness argument but
costs screen space (worse on the mobile/touch population already
narrowed by Sky Dodge's keyboard-only match mode); stretch fills the
screen but only partially closes the gap, reopening a smaller version
of the same "different players, different game" problem as shape
distortion instead of a score gap. Recommended letterbox, explicitly
labeled as a recommendation rather than a decision — flagged as a real
product-feel tradeoff, not purely a correctness question.

`tsc -b`(client)/`tsc --noEmit`(server) clean. Re-ran all three
`scripts/` test scripts per the standing rule: `determinism-check.ts`
17/17, `score-validation-check.ts` 25/25, `matchmaking-check.ts` all
checks passed — the new diagnostic `console.log` lines don't touch any
assertion path. No commits made this session — ask before committing,
per standing instruction.

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

**Stale, frozen at roughly session 10-12's understanding — superseded by
"ROADMAP" at the top of this file. Item 2's "matchmaking... not started"
and item 4's "48/51 remaining" are both no longer true (session 15) —
kept unedited below as a historical record, not current status.**

0. ~~Build the determinism foundation~~ ✅ **done, session 13** — seeded
   RNG, fixed-timestep loop (genuinely shared across all 3 games),
   `inputLog`, all 3 games retrofitted. See "Session 13" in the log below
   for full detail and verification.
1. ~~Auth & profile~~ ✅ built AND verified end-to-end against the real
   Supabase database session 8 — signup/login/logout/profile all
   confirmed working via direct API calls and through the actual browser
   UI. Two test accounts (`testplayer1`, `browsertest`) existed in the
   real DB from verification; deleted in session 8's close-out — table
   confirmed empty.
2. **Matchmaking, real-time sync, and wallet — not started, and now the
   actual next priority** (determinism, item 0, was the confirmed
   prerequisite and is done). Build order among these three wasn't
   specified; ask before assuming. Before matchmaking depends on the
   determinism foundation being solid, note the one open anti-cheat gap
   in "Known gaps" above (`sky-dodge` drag input isn't replay-verifiable).
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
