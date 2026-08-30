import type { ReplayAdapter } from "@fugluck/shared";
import { CyberHopperEngine, type CyberHopperInput } from "./engine";

export const cyberHopperReplayAdapter: ReplayAdapter<CyberHopperInput, CyberHopperEngine> = {
  createEngine(seed) {
    return new CyberHopperEngine(seed);
  },
  resize(engine, width, height) {
    engine.resize(width, height);
  },
  createInitialInput() {
    return {
      hopUp: false,
      hopDown: false,
      hopLeft: false,
      hopRight: false,
    };
  },
  applyAction(input, action) {
    if (action === "hopUp") input.hopUp = true;
    else if (action === "hopDown") input.hopDown = true;
    else if (action === "hopLeft") input.hopLeft = true;
    else if (action === "hopRight") input.hopRight = true;
    else return false;
    return true;
  },
  clearPulses(input) {
    input.hopUp = false;
    input.hopDown = false;
    input.hopLeft = false;
    input.hopRight = false;
  },
  update(engine, dtSec, input) {
    return engine.update(dtSec, input);
  },
  isTerminal(result) {
    return result === "collision";
  },
};
