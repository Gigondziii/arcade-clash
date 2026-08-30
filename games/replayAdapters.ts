// Static gameId -> ReplayAdapter map. This, plus the generic driver in
// packages/shared/src/replay.ts, is what makes score validation
// game-agnostic: nothing in the validator branches on a game name — it looks
// up this map and calls the same driver regardless of which game it is.
// Adding a game means adding its replay.ts (analogous to it already needing
// an engine.ts) and one line here — no other file changes.
//
// A static map rather than dynamic import(): there are only 3 games, all
// already statically known to this package, and the server process restarts
// to pick up a new game anyway (see gameRegistry) — no benefit to deferring
// the load, and it keeps score validation fully synchronous (see
// packages/server/src/validation/scoreValidator.ts for why that matters).
import type { ReplayAdapter } from "@fugluck/shared";
import { neonRunnerReplayAdapter } from "./neon-runner/replay";
import { pixelNinjaDashReplayAdapter } from "./pixel-ninja-dash/replay";
import { spaceBlasterReplayAdapter } from "./space-blaster/replay";
import { cyberHopperReplayAdapter } from "./cyber-hopper/replay";
import { speedTriviaReplayAdapter } from "./speed-trivia/replay";
import { tfSprintReplayAdapter } from "./tf-sprint/replay";
import { gameRegistry } from "./registry";

// `any` here is deliberate type erasure — each game's adapter has its own
// concrete TInput/TEngine, and this map has to hold all of them uniformly;
// callers only ever get an adapter back and pass it straight to
// replayEngine(), never touch its type parameters directly.
export const replayAdapters: Record<string, ReplayAdapter<any, any>> = {
  "neon-runner": neonRunnerReplayAdapter,
  "pixel-ninja-dash": pixelNinjaDashReplayAdapter,
  "space-blaster": spaceBlasterReplayAdapter,
  "cyber-hopper": cyberHopperReplayAdapter,
  "speed-trivia": speedTriviaReplayAdapter,
  "tf-sprint": tfSprintReplayAdapter,
};

// Fails fast at module load if a registry entry has no matching adapter (or
// vice versa) rather than failing silently the first time someone submits a
// score for the mismatched game.
const registryIds = new Set(gameRegistry.map((g) => g.id));
const adapterIds = new Set(Object.keys(replayAdapters));
for (const id of registryIds) {
  if (!adapterIds.has(id)) throw new Error(`games/replayAdapters.ts: no replay adapter registered for "${id}"`);
}
for (const id of adapterIds) {
  if (!registryIds.has(id)) throw new Error(`games/replayAdapters.ts: adapter registered for unknown game id "${id}"`);
}
