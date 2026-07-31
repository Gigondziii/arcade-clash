// Headless replay adapter — see games/neon-runner/replay.ts's header comment
// for what this is and why it exists. DashEngine additionally self-terminates
// via WORLD.raceTimeLimitSec regardless of inputLog length or the shared
// tick cap (see packages/shared/src/replay.ts), since "timeout" is a
// terminal result here just like "finished".
import type { ReplayAdapter } from "@arcadeclash/shared";
import { DashEngine, type EngineInput, type EngineResult } from "./engine";

export const pixelNinjaDashReplayAdapter: ReplayAdapter<EngineInput, DashEngine> = {
  createEngine(seed) {
    return new DashEngine(seed);
  },
  resize(engine, width, height) {
    engine.resize(width, height);
  },
  createInitialInput() {
    return { dashPressed: false };
  },
  applyAction(input, action) {
    if (action === "dashPressed") input.dashPressed = true;
    else return false;
    return true;
  },
  clearPulses(input) {
    input.dashPressed = false;
  },
  update(engine, dtSec, input) {
    return engine.update(dtSec, input);
  },
  isTerminal(result) {
    return (result as EngineResult) === "finished" || (result as EngineResult) === "timeout";
  },
};
