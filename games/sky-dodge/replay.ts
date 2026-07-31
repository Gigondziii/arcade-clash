// Headless replay adapter — see games/neon-runner/replay.ts's header comment
// for what this is and why it exists.
//
// dragTargetX is deliberately never set here (stays null for the whole
// replay) — pointer-drag movement is excluded from inputLog entirely (it's
// continuous analog input, not a discrete action) and, as of this session,
// disabled client-side in match mode specifically so every match run is
// fully replayable via keyboard-only actions. See PROGRESS.md Known Gaps.
import type { ReplayAdapter } from "@arcadeclash/shared";
import { DodgeEngine, type EngineInput } from "./engine";

export const skyDodgeReplayAdapter: ReplayAdapter<EngineInput, DodgeEngine> = {
  createEngine(seed) {
    return new DodgeEngine(seed);
  },
  resize(engine, width, height) {
    engine.resize(width, height);
  },
  createInitialInput() {
    return { moveLeft: false, moveRight: false, dragTargetX: null, shieldPressed: false };
  },
  applyAction(input, action) {
    if (action === "moveLeftDown") input.moveLeft = true;
    else if (action === "moveLeftUp") input.moveLeft = false;
    else if (action === "moveRightDown") input.moveRight = true;
    else if (action === "moveRightUp") input.moveRight = false;
    else if (action === "shieldPressed") input.shieldPressed = true;
    else return false;
    return true;
  },
  clearPulses(input) {
    // moveLeft/moveRight are held state (set/cleared by their own Down/Up
    // actions above), not single-tick pulses — only shieldPressed is edge-
    // triggered, matching games/sky-dodge/index.ts's tick().
    input.shieldPressed = false;
  },
  update(engine, dtSec, input) {
    return engine.update(dtSec, input);
  },
  isTerminal(result) {
    return result === "collision";
  },
};
