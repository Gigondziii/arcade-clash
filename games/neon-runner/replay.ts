// Headless replay adapter — the game-agnostic driver in
// packages/shared/src/replay.ts calls through this to run RunnerEngine
// without a DOM, for both scripts/determinism-check.ts and the server's
// score validator. This is the single place that knows how an inputLog
// action string maps onto RunnerEngine's EngineInput; games/neon-runner/
// index.ts's live tick() and this file must stay in sync by construction
// (both ultimately mirror the same jumpPressed/jumpReleased/slidePressed
// vocabulary the DOM handlers in index.ts log), since nothing enforces that
// automatically.
import type { ReplayAdapter } from "@fugluck/shared";
import { RunnerEngine, type EngineInput } from "./engine";

export const neonRunnerReplayAdapter: ReplayAdapter<EngineInput, RunnerEngine> = {
  createEngine(seed) {
    return new RunnerEngine(seed);
  },
  resize(engine, width, height) {
    engine.resize(width, height);
  },
  createInitialInput() {
    return { jumpPressed: false, jumpReleased: false, slidePressed: false };
  },
  applyAction(input, action) {
    if (action === "jumpPressed") input.jumpPressed = true;
    else if (action === "jumpReleased") input.jumpReleased = true;
    else if (action === "slidePressed") input.slidePressed = true;
    else return false;
    return true;
  },
  clearPulses(input) {
    input.jumpPressed = false;
    input.jumpReleased = false;
    input.slidePressed = false;
  },
  update(engine, dtSec, input) {
    return engine.update(dtSec, input);
  },
  isTerminal(result) {
    return result === "collision";
  },
};
