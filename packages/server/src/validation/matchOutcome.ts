// Combines both sides of a resolved match into an authoritative, personalized
// outcome. Pure function, no I/O — matches.ts calls this once both sides are
// known (both submitted, or the forfeit timer fired) and sends the result to
// each socket.
import type { MatchOutcome, ScoreVerdict } from "@fugluck/shared";

export type SidedSubmission = {
  score: number;
  verdict: ScoreVerdict;
  correctCount?: number;
  totalResponseTicks?: number;
} | null;

export type MatchOutcomeResult = { a: MatchOutcome; b: MatchOutcome };

export function determineMatchOutcome(a: SidedSubmission, b: SidedSubmission): MatchOutcomeResult {
  const aTrusted = a !== null && a.verdict !== "invalid";
  const bTrusted = b !== null && b.verdict !== "invalid";

  if (a === null && b === null) return { a: "void", b: "void" };
  if (a === null) return bTrusted ? { a: "loss", b: "win" } : { a: "void", b: "void" };
  if (b === null) return aTrusted ? { a: "win", b: "loss" } : { a: "void", b: "void" };

  if (aTrusted && !bTrusted) return { a: "win", b: "loss" };
  if (bTrusted && !aTrusted) return { a: "loss", b: "win" };
  if (!aTrusted && !bTrusted) return { a: "void", b: "void" };

  // Primary ranking for Trivia: Most correct answers
  if (a.correctCount !== undefined && b.correctCount !== undefined) {
    if (a.correctCount > b.correctCount) return { a: "win", b: "loss" };
    if (a.correctCount < b.correctCount) return { a: "loss", b: "win" };

    // Secondary tiebreaker: Lowest totalResponseTicks (faster aggregate response speed)
    if (a.totalResponseTicks !== undefined && b.totalResponseTicks !== undefined) {
      if (a.totalResponseTicks < b.totalResponseTicks) return { a: "win", b: "loss" };
      if (a.totalResponseTicks > b.totalResponseTicks) return { a: "loss", b: "win" };
    }
  }

  if (a.score > b.score) return { a: "win", b: "loss" };
  if (a.score < b.score) return { a: "loss", b: "win" };
  return { a: "draw", b: "draw" };
}

// Only ever called for a player who disconnected WITHOUT having submitted a
// result — matches.ts's handleDisconnect treats a disconnect from a player
// who already submitted as a no-op, not routed here (see its own comment for
// why: finishing honestly and closing the tab afterward isn't abandonment).
// `a` is always the disconnecting player.
//
// Deliberately NOT the same as determineMatchOutcome(null, opponent):
//  - opponent has a real submission -> identical policy either way (their
//    own verdict decides: trusted wins, invalid voids) — reuses
//    determineMatchOutcome directly, no divergence.
//  - opponent is ALSO null (hasn't submitted anything either, still mid-run)
//    -> THIS is where it diverges. determineMatchOutcome(null, null) is
//    void, correct for its actual case (neither player did anything,
//    nobody's more at fault than the other). But here, the opponent didn't
//    fail to finish — they're still legitimately playing while their only
//    competitor actively left. Disconnecting is strictly worse than "still
//    connected and still trying," so the opponent wins outright rather than
//    the match voiding. This is the fix for "closing the tab is a free
//    escape from a losing position" — see PROGRESS.md's session log.
export function determineDisconnectOutcome(opponent: SidedSubmission): MatchOutcomeResult {
  if (opponent === null) return { a: "loss", b: "win" };
  return determineMatchOutcome(null, opponent);
}
