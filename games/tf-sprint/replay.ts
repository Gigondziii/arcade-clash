import type { ReplayAdapter } from "@fugluck/shared";
import { TFSprintEngine, type TFSprintInput } from "./engine";

export const tfSprintReplayAdapter: ReplayAdapter<TFSprintInput, TFSprintEngine> = {
  createEngine(seed: number): TFSprintEngine {
    return new TFSprintEngine(seed);
  },

  resize(engine: TFSprintEngine, width: number, height: number): void {
    engine.resize(width, height);
  },

  createInitialInput(): TFSprintInput {
    return {};
  },

  applyAction(input: TFSprintInput, action: string): boolean {
    if (action === "selectTrue") {
      input.selectTrue = true;
    } else if (action === "selectFalse") {
      input.selectFalse = true;
    } else {
      return false;
    }
    return true;
  },

  clearPulses(input: TFSprintInput): void {
    input.selectTrue = undefined;
    input.selectFalse = undefined;
  },

  update(engine: TFSprintEngine, dtSec: number, input: TFSprintInput): "ended" | null {
    return engine.update(dtSec, input);
  },

  isTerminal(result: "ended" | null): boolean {
    return result === "ended";
  },
};
