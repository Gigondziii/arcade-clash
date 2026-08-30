import type { ReplayAdapter } from "@fugluck/shared";
import { SpaceBlasterEngine, type SpaceBlasterInput } from "./engine";

export const spaceBlasterReplayAdapter: ReplayAdapter<SpaceBlasterInput, SpaceBlasterEngine> = {
  createEngine(seed) {
    return new SpaceBlasterEngine(seed);
  },
  resize(engine, width, height) {
    engine.resize(width, height);
  },
  createInitialInput() {
    return {
      moveLeft: false,
      moveRight: false,
      moveUp: false,
      moveDown: false,
      shootPressed: false,
    };
  },
  applyAction(input, action) {
    if (action === "moveLeftDown") input.moveLeft = true;
    else if (action === "moveLeftUp") input.moveLeft = false;
    else if (action === "moveRightDown") input.moveRight = true;
    else if (action === "moveRightUp") input.moveRight = false;
    else if (action === "moveUpDown") input.moveUp = true;
    else if (action === "moveUpUp") input.moveUp = false;
    else if (action === "moveDownDown") input.moveDown = true;
    else if (action === "moveDownUp") input.moveDown = false;
    else if (action === "shootPressed") input.shootPressed = true;
    else return false;
    return true;
  },
  clearPulses(input) {
    input.shootPressed = false;
  },
  update(engine, dtSec, input) {
    return engine.update(dtSec, input);
  },
  isTerminal(result) {
    return result === "collision";
  },
};
