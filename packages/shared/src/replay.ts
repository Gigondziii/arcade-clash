// Generic, game-agnostic replay driver — shared by scripts/determinism-check.ts
// (compares two replays of the same log to each other) and the server's score
// validator (compares one replay to a claimed score). Contains zero
// game-specific logic; each game supplies a ReplayAdapter (see
// games/<id>/replay.ts) that knows its own engine, its own action-string
// vocabulary, and its own terminal conditions. Adding a new game means
// writing that game's adapter and registering it in games/replayAdapters.ts —
// nothing in this file changes.
import { FIXED_TIMESTEP_SEC } from "./fixedTimestepLoop";
import type { InputLogEntry } from "./gameModule";

// A run this size or larger is rejected before replay ever starts — see
// packages/server/src/validation/scoreValidator.ts for the derivation
// (measured per-tick engine cost x this project's own 60-180s round-length
// design target). Exported from here, not the validator, so
// determinism-check.ts's hand-authored test logs can be checked against the
// same ceiling the real validator enforces, rather than a second copy of the
// number drifting out of sync.
export const MAX_REPLAY_TICKS = 21_600; // 360s at 60Hz — 2x this project's stated round-length upper bound
export const MAX_INPUT_LOG_ENTRIES = 10_000;

// Every field an engine needs to run headless, decoupled from whatever
// class shape a particular game's engine.ts happens to use.
export type ReplayAdapter<TInput, TEngine extends { score: number }> = {
  createEngine(seed: number): TEngine;
  // Called once, before reset() — mirrors live play, where init() constructs
  // the engine and the first ResizeObserver callback fires (both before
  // start()/reset()). Some engines derive spawn/collision state from
  // width/height inside reset() (e.g. DodgeEngine.reset() reads this.width
  // for the player's starting position), so getting this ordering wrong
  // silently desyncs replay from a real run without ever throwing.
  resize(engine: TEngine, width: number, height: number): void;
  createInitialInput(): TInput;
  // Mutates `input` to reflect one inputLog action; returns false if `action`
  // isn't one this game recognizes. replayEngine() throws
  // UnrecognizedActionError on a false return rather than silently skipping
  // it — an action string outside the game's own vocabulary is exactly the
  // kind of tampering this exists to catch.
  applyAction(input: TInput, action: string): boolean;
  // Clears single-tick pulse fields (e.g. jumpPressed) after each tick, the
  // same way each game's own tick() does today. Held-state fields
  // (moveLeft/moveRight) are edge-triggered by applyAction and shouldn't be
  // touched here.
  clearPulses(input: TInput): void;
  update(engine: TEngine, dtSec: number, input: TInput): unknown;
  // True when `result` (update()'s return value) means the run is over.
  isTerminal(result: unknown): boolean;
};

export type ReplayOutcome<TEngine> = {
  finalScore: number;
  finalTick: number;
  // False if the log was exhausted / the tick budget ran out without the
  // engine ever reaching a terminal state — a legitimate collision/finish
  // should always set this true; false is itself evidence something's off
  // (an inputLog that doesn't actually end the run it claims to).
  terminal: boolean;
  // The engine instance in its final state — the score validator only ever
  // needs finalScore, but determinism-check.ts's "full internal state
  // matches" assertions (not just score) need the whole thing, so it's
  // exposed here rather than making score-only the shared contract.
  engine: TEngine;
};

// Thrown by replayEngine when an inputLog entry's action string isn't one
// the adapter recognizes — a shape problem checkReplayRequestShape can't
// catch on its own (it has no adapter, so no vocabulary to check against).
// Callers should treat this the same as any other malformed-log rejection.
export class UnrecognizedActionError extends Error {
  readonly action: string;
  readonly tick: number;

  constructor(action: string, tick: number) {
    super(`Unrecognized action "${action}" at tick ${tick}`);
    this.name = "UnrecognizedActionError";
    this.action = action;
    this.tick = tick;
  }
}

// Pre-replay shape/size checks — cheap, run before any engine is constructed.
// Returns a rejection reason, or null if the log is worth attempting to
// replay at all.
export function checkReplayRequestShape(inputLog: InputLogEntry[]): string | null {
  if (!Array.isArray(inputLog)) return "input_log_not_array";
  if (inputLog.length > MAX_INPUT_LOG_ENTRIES) return "log_size_exceeded";
  let lastTick = -1;
  for (const entry of inputLog) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof entry.tick !== "number" ||
      !Number.isInteger(entry.tick) ||
      entry.tick < 0 ||
      typeof entry.action !== "string"
    ) {
      return "malformed_entry";
    }
    if (entry.tick > MAX_REPLAY_TICKS) return "tick_cap_exceeded";
    if (entry.tick < lastTick) return "unsorted_log";
    lastTick = entry.tick;
  }
  return null;
}

export function replayEngine<TInput, TEngine extends { score: number }>(
  adapter: ReplayAdapter<TInput, TEngine>,
  seed: number,
  inputLog: InputLogEntry[],
  viewport: { width: number; height: number },
  maxTicks: number = MAX_REPLAY_TICKS,
): ReplayOutcome<TEngine> {
  const engine = adapter.createEngine(seed);
  adapter.resize(engine, viewport.width, viewport.height);
  const engineWithReset = engine as TEngine & { reset(): void };
  engineWithReset.reset();

  const input = adapter.createInitialInput();
  let logIdx = 0;

  for (let tick = 0; tick < maxTicks; tick++) {
    while (logIdx < inputLog.length && inputLog[logIdx].tick === tick) {
      const recognized = adapter.applyAction(input, inputLog[logIdx].action);
      if (!recognized) throw new UnrecognizedActionError(inputLog[logIdx].action, tick);
      logIdx++;
    }
    const result = adapter.update(engine, FIXED_TIMESTEP_SEC, input);
    adapter.clearPulses(input);
    if (adapter.isTerminal(result)) {
      return { finalScore: engine.score, finalTick: tick, terminal: true, engine };
    }
  }

  return { finalScore: engine.score, finalTick: maxTicks, terminal: false, engine };
}
