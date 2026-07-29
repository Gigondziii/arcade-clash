# Games Manifest

One line per game — jump straight to its folder instead of browsing `games/`.
Update this file every time a game is built or its status changes.

| Name | Folder | Engine Cluster | Status |
|---|---|---|---|
| Neon Runner | [`games/neon-runner/`](games/neon-runner/) | runner | Built (practice mode only) |
| Pixel Ninja Dash | [`games/pixel-ninja-dash/`](games/pixel-ninja-dash/) | reflex-timing | Built (practice mode only) |
| Sky Dodge | [`games/sky-dodge/`](games/sky-dodge/) | falling-block | Built (practice mode only) |

Engine clusters not yet represented: racer, arena-shooter, physics-table,
turn-based-board, word-trivia.

## Note on file layout consistency

These 3 games predate the `index.ts` / `engine.ts` / `skin.ts` / `README.md`
convention (they use `constants.ts` instead of `skin.ts`, have no
per-game `README.md`, and hardcode their own neon palette locally rather
than sourcing colors from `packages/theme`). Whether to retrofit them is an
open question pending the user's answer — see PROGRESS.md "Current phase"
for the full context. Don't assume they've been brought in line until this
file (or PROGRESS.md) says otherwise.
