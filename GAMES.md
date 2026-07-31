# Games Manifest

One line per game — jump straight to its folder instead of browsing `games/`.
Update this file every time a game is built or its status changes.

**Status key:** BUILT = exists in code, verified working (see PROGRESS.md
for how). PLANNED = described somewhere (this doc, PROGRESS.md, or the
external design doc) but not yet implemented. See PROGRESS.md's
"Architecture status: BUILT vs PLANNED" section for the full 2026-07-30
audit this file's wording was corrected against.

| Name | Folder | Engine Label | Status |
|---|---|---|---|
| Neon Runner | [`games/neon-runner/`](games/neon-runner/) | runner | BUILT — practice + for-fun matchmaking |
| Pixel Ninja Dash | [`games/pixel-ninja-dash/`](games/pixel-ninja-dash/) | reflex-timing | BUILT — practice + for-fun matchmaking |
| Sky Dodge | [`games/sky-dodge/`](games/sky-dodge/) | falling-block | BUILT — practice + for-fun matchmaking |

**On "for-fun matchmaking" (session 15, see PROGRESS.md) — read the
verification confidence carefully, it is not uniform.** Session 15
itself changed nothing in `games/*/index.ts` — matchmaking was built
strictly against the `GameModule`/`GameOverPayload` interface that
session. **That stopped being true session 16 (server-side score
validation + winner determination):** all 3 games' `index.ts` now
capture `viewport` for `GameOverPayload`, gate `pause()` off in match
mode, and (Sky Dodge only) gate drag input off in match mode — see
PROGRESS.md's session 16 entry. Session 15's PROTOCOL verification
(queue/pairing/seed/username/score-resolution, live against the real
server and real Supabase DB, plus fake-socket unit assertions) is
unaffected by this — it's still solid, and still the strongest-verified
part of matchmaking. What's NOT solid, stated plainly rather than left
implicit: no player has ever played an actual two-player match to
completion (this sandbox's Browser pane can't drive
`requestAnimationFrame` at all); no UI screen past the pre-match
"queued" screen has ever been rendered in any browser (still true
session 16 — the new `outcome` display and the pause/drag removals are
also unrendered); a genuinely silent (non-graceful) disconnect has
never been tested, only explicit clean disconnects; there is no
heartbeat/liveness mechanism (the forfeit-timeout is a one-shot timer,
not a recurring check). Tick-based winner determination **now exists**
(session 16, server-side replay + `outcome`) — no longer "a plain
client-side score comparison, nothing more," see PROGRESS.md. Full
breakdown in `PROGRESS.md`'s "BUILT AND VERIFIED" section — this note
is a summary, not the source of truth. No real-time in-game state sync
(async, independent rounds off a shared server-issued seed), no stakes.

**On "Engine Label" vs. the 8-engine cluster model:** the label column
reflects each game's assigned `engine` field in `games/registry.ts` — that
part is BUILT, a real field with a real distinct value per game,
confirmed correct by the user against their design doc on 2026-07-30. But
the underlying idea of an *engine* as reusable shared **simulation**
code across games is still PLANNED, not built: each of the 3 games above
has its own fully independent `engine.ts` state/physics/scoring logic —
`RunnerEngine`, `DashEngine`, `DodgeEngine` share zero simulation code
(verified by reading all 3 files). As of session 13 (2026-07-30) this is
no longer "zero shared code" in the absolute sense, though: all 3 games'
`engine.ts` and `index.ts` now import real shared infrastructure from
`@arcadeclash/shared` — seeded RNG (`rng.ts`) and a fixed-timestep loop
(`fixedTimestepLoop.ts`), the first genuine cross-game code sharing in
this repo. That's scheduling/randomness infrastructure, not game logic —
it doesn't move this repo any closer to a validated shared-*engine*
model, see below.

**No two built games have ever shared an engine cluster, so the reskin/
shared-engine abstraction is completely untested.** A second `runner`
game (a true Neon Runner reskin, reusing its `engine.ts`) would be the
first real test of whether this works at all — but **the revised game
plan (session 15, see PROGRESS.md "Product direction") prioritizes
breadth over this test**: build the first game in every untouched
cluster before a second game in any cluster. Don't assume a `runner`
reskin is next just because it would be the most interesting technical
test — ask before picking.

Engine clusters not yet represented by any built game: racer,
arena-shooter, physics-table, turn-based-board, word-trivia. Per the
revised game plan, the next game most likely belongs in one of these,
not a second `runner`/`reflex-timing`/`falling-block` entry.

## Note on file layout consistency (PLANNED convention, not adopted)

These 3 games predate a proposed `index.ts` / `engine.ts` / `skin.ts` /
`README.md` file-layout convention (they use `constants.ts` instead of
`skin.ts`, have no per-game `README.md`, and hardcode their own neon
palette locally rather than sourcing colors from `packages/theme`). This
convention is **PLANNED only** — proposed in session 7, never confirmed
or adopted by any built game. Whether to retrofit the 3 existing games to
it is a separate open question from the determinism retrofit (seeded
RNG/fixed-timestep/`inputLog`) that session 10 greenlit and completed —
see PROGRESS.md's "ROADMAP" section for what's actually next (this isn't
on it). Don't assume either has happened until `PROGRESS.md` or this
file says so.
