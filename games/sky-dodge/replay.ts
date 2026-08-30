import type { ReplayAdapter } from "@fugluck/shared";
import { SkyDodgeEngine, type EngineInput } from "./engine";

export const skyDodgeReplayAdapter: ReplayAdapter<EngineInput, SkyDodgeEngine> = {
  createEngine(seed) {
    return new SkyDodgeEngine(seed);
  },
  resize(engine, width, height) {
    engine.resize(width, height);
  },
  createInitialInput() {
    return { moveLeft: false, moveRight: false, boostPressed: false };
  },
  applyAction(input, action) {
    if (action === "moveLeftDown") input.moveLeft = true;
    else if (action === "moveLeftUp") input.moveLeft = false;
    else if (action === "moveRightDown") input.moveRight = true;
    else if (action === "moveRightUp") input.moveRight = false;
    else if (action === "boostPressed") input.boostPressed = true;
    else return false;
    return true;
  },
  clearPulses(input) {
    input.boostPressed = false;
  },
  update(engine, dtSec, input) {
    return engine.update(dtSec, input);
  },
  isTerminal(result) {
    return result === "collision";
  },
};
