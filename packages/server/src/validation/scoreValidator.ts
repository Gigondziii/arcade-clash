// Server-side replay validation for a submitted match score. Game-agnostic
// by construction: this file contains no game-specific logic at all — it
// looks up a ReplayAdapter from games/replayAdapters.ts (keyed by gameId,
// itself driven by games/registry.ts) and hands it to the shared
// replayEngine() driver. Adding a 4th game requires zero changes here.
//
// Runs synchronously, inline in the submitScore socket handler — no queue.
// Measured cost (see PROGRESS.md for the methodology): the slowest of the 3
// engines costs ~0.00063ms/tick; even at the MAX_REPLAY_TICKS cap (21,600)
// that's ~13.6ms worst case, safe to run on the event loop.
import {
  checkReplayRequestShape,
  MAX_REPLAY_TICKS,
  replayEngine,
  UnrecognizedActionError,
  type InputLogEntry,
  type ScoreVerdict,
} from "@fugluck/shared";
import { replayAdapters } from "@fugluck/games/replayAdapters";

export type ValidateScoreInput = {
  gameId: string;
  seed: number;
  inputLog: InputLogEntry[];
  claimedScore: number;
  durationMs: number;
  viewport: { width: number; height: number };
};

export type ValidateScoreResult = {
  verdict: ScoreVerdict;
  // Machine-readable, for logs/observability — distinguishes "the replay ran
  // and produced a different score" from "we rejected this before ever
  // attempting replay" without needing a 4th externally-visible outcome
  // (both fold into "invalid" for winner-determination purposes, per the
  // forfeit-precedent policy in matchOutcome.ts).
  reason:
    | "ok"
    | "unknown_game"
    | "malformed_viewport"
    | "input_log_not_array"
    | "log_size_exceeded"
    | "malformed_entry"
    | "tick_cap_exceeded"
    | "unsorted_log"
    | "unrecognized_action"
    | "did_not_terminate"
    | "score_mismatch"
    | "freeze_frame_detected";
  replayedScore?: number;
};

export const FREEZE_FRAME_THRESHOLD_SEC = 3.0;

export function validateScore(input: ValidateScoreInput): ValidateScoreResult {
  const adapter = replayAdapters[input.gameId];
  if (!adapter) return { verdict: "invalid", reason: "unknown_game" };

  if (
    !input.viewport ||
    typeof input.viewport.width !== "number" ||
    typeof input.viewport.height !== "number" ||
    input.viewport.width <= 0 ||
    input.viewport.height <= 0
  ) {
    return { verdict: "invalid", reason: "malformed_viewport" };
  }

  const shapeError = checkReplayRequestShape(input.inputLog);
  if (shapeError) return { verdict: "invalid", reason: shapeError as ValidateScoreResult["reason"] };

  let outcome;
  try {
    outcome = replayEngine(adapter, input.seed, input.inputLog, input.viewport, MAX_REPLAY_TICKS);
  } catch (err) {
    if (err instanceof UnrecognizedActionError) {
      return { verdict: "invalid", reason: "unrecognized_action" };
    }
    throw err; // a real bug in the adapter, not tampering — let it surface
  }

  const freezeError = checkFreezeFrameViolation(input.gameId, input.inputLog, input.durationMs, outcome.finalTick);
  if (freezeError) {
    return { verdict: "invalid", reason: "freeze_frame_detected", replayedScore: outcome.finalScore };
  }

  if (!outcome.terminal) {
    return { verdict: "invalid", reason: "did_not_terminate", replayedScore: outcome.finalScore };
  }
  if (outcome.finalScore !== input.claimedScore) {
    return { verdict: "invalid", reason: "score_mismatch", replayedScore: outcome.finalScore };
  }
  return { verdict: "valid", reason: "ok", replayedScore: outcome.finalScore };
}

// Server-side enforcement for freeze-frame and tab-backgrounding stalls.
// Rejects submissions where real-world elapsed time (durationMs or wallMs gaps)
// exceeds simulated tick progress by more than FREEZE_FRAME_THRESHOLD_SEC (3.0s).
function checkFreezeFrameViolation(
  gameId: string,
  inputLog: InputLogEntry[],
  durationMs: number,
  finalTick: number,
): "freeze_frame_detected" | null {
  const TICK_HZ = 60;

  for (let i = 1; i < inputLog.length; i++) {
    const prev = inputLog[i - 1];
    const cur = inputLog[i];
    if (prev.wallMs === undefined || cur.wallMs === undefined) continue;
    const tickDeltaSec = (cur.tick - prev.tick) / TICK_HZ;
    const wallDeltaSec = (cur.wallMs - prev.wallMs) / 1000;
    if (wallDeltaSec - tickDeltaSec > FREEZE_FRAME_THRESHOLD_SEC) {
      console.warn(
        `[scoreValidator] ${gameId}: freeze-frame detected between ticks ${prev.tick}-${cur.tick} — ` +
          `${wallDeltaSec.toFixed(1)}s real time for ${tickDeltaSec.toFixed(2)}s simulated time`,
      );
      return "freeze_frame_detected";
    }
  }

  const expectedSec = finalTick / TICK_HZ;
  const actualSec = durationMs / 1000;
  if (actualSec - expectedSec > FREEZE_FRAME_THRESHOLD_SEC) {
    console.warn(
      `[scoreValidator] ${gameId}: whole-run freeze-frame detected — ${actualSec.toFixed(1)}s real time for ` +
        `${finalTick} ticks (${expectedSec.toFixed(1)}s expected)`,
    );
    return "freeze_frame_detected";
  }

  return null;
}
