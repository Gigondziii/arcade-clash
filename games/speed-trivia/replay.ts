import type { ReplayAdapter } from "@fugluck/shared";
import { SpeedTriviaEngine, type SpeedTriviaInput } from "./engine";

export const speedTriviaReplayAdapter: ReplayAdapter<SpeedTriviaInput, SpeedTriviaEngine> = {
  createEngine(seed) {
    return new SpeedTriviaEngine(seed);
  },
  resize(engine, width, height) {
    engine.resize(width, height);
  },
  createInitialInput() {
    return {};
  },
  applyAction(input, action) {
    if (action === "selectOption0") input.selectOption = 0;
    else if (action === "selectOption1") input.selectOption = 1;
    else if (action === "selectOption2") input.selectOption = 2;
    else if (action === "selectOption3") input.selectOption = 3;
    else return false;
    return true;
  },
  clearPulses(input) {
    input.selectOption = undefined;
  },
  update(engine, dtSec, input) {
    return engine.update(dtSec, input);
  },
  isTerminal(result) {
    return result === "ended";
  },
};
