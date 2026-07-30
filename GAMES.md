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
| Neon Runner | [`games/neon-runner/`](games/neon-runner/) | runner | BUILT — practice mode only |
| Pixel Ninja Dash | [`games/pixel-ninja-dash/`](games/pixel-ninja-dash/) | reflex-timing | BUILT — practice mode only |
| Sky Dodge | [`games/sky-dodge/`](games/sky-dodge/) | falling-block | BUILT — practice mode only |

**On "Engine Label" vs. the 8-engine cluster model:** the label column
reflects each game's assigned `engine` field in `games/registry.ts` — that
part is BUILT, a real field with a real distinct value per game,
confirmed correct by the user against their design doc on 2026-07-30. But
the underlying idea of an *engine* as reusable shared code across games
is PLANNED, not built: each of the 3 games above has its own fully
independent `engine.ts` with zero shared code between them (verified by
reading all 3 files and grepping every import — none of the three ever
import from another game or from a common module; each only imports its
own local `./constants` and, for the module wiring, `@arcadeclash/shared`).

**No two built games have ever shared an engine cluster, so the reskin/
shared-engine abstraction is completely untested.** Building game #4 in
the `runner` cluster (a true Neon Runner reskin, reusing its `engine.ts`
rather than writing a new one from scratch) would be the first real test
of whether this works at all.

Engine clusters not yet represented by any built game: racer,
arena-shooter, physics-table, turn-based-board, word-trivia.

## Note on file layout consistency (PLANNED convention, not adopted)

These 3 games predate a proposed `index.ts` / `engine.ts` / `skin.ts` /
`README.md` file-layout convention (they use `constants.ts` instead of
`skin.ts`, have no per-game `README.md`, and hardcode their own neon
palette locally rather than sourcing colors from `packages/theme`). This
convention is **PLANNED only** — proposed in session 7, never confirmed
or adopted by any built game. Whether to retrofit the 3 existing games to
it is a separate open question from the determinism retrofit (seeded
RNG/fixed-timestep/`inputLog`) that session 10 greenlit — see
PROGRESS.md's "Exact next step" section for why these two are distinct.
Don't assume either has happened until `PROGRESS.md` or this file says so.
