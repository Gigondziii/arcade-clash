// Standalone acceptance-test script for server-side score validation — same
// convention as scripts/determinism-check.ts: runs outside the browser, and
// calls the REAL validator (packages/server/src/validation/
// scoreValidator.ts) and winner-determination logic (packages/server/src/
// validation/matchOutcome.ts) directly, not a reimplementation of either.
//
// Run: npx tsx scripts/score-validation-check.ts
//
// NOTE on the original brief's "Sky Dodge drag run reports UNVERIFIABLE, not
// INVALID" acceptance test: no longer applicable, by a since-revised
// decision (see PROGRESS.md's Known Gaps). Drag input is disabled entirely
// in match mode specifically so every match run is fully replayable — there
// is no longer any way for a real match submission to produce a drag-shaped
// inputLog at all, so there's nothing left to distinguish. UNVERIFIABLE
// stays in the ScoreVerdict type for a future non-tick game, but no current
// adapter can produce it. Sky Dodge's honest keyboard-only run is folded
// into Test 1 below instead — that's the path every real Sky Dodge match now
// always takes.
import { MAX_INPUT_LOG_ENTRIES, MAX_REPLAY_TICKS, replayEngine, type InputLogEntry } from "@arcadeclash/shared";
import { neonRunnerReplayAdapter } from "../games/neon-runner/replay.ts";
import { pixelNinjaDashReplayAdapter } from "../games/pixel-ninja-dash/replay.ts";
import { skyDodgeReplayAdapter } from "../games/sky-dodge/replay.ts";
import { determineDisconnectOutcome, determineMatchOutcome } from "../packages/server/src/validation/matchOutcome.ts";
import { validateScore } from "../packages/server/src/validation/scoreValidator.ts";

const SEED = 424242;
const VIEWPORT = { width: 1280, height: 720 };
let failures = 0;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// Periodic action, repeated `count` times — used instead of a couple of
// sparse hand-picked ticks (determinism-check.ts's samples, which only prove
// "the same log replayed twice matches," not "this input mattered"). The
// first attempt at Test 3 below used sparse early actions and found, via its
// own precondition check, that neon-runner's/pixel-ninja-dash's obstacles
// don't reach the player until well past their tick-20/tick-90 actions
// (spawn + travel time both take longer than that), so those actions were
// never actually load-bearing — dropping them changed nothing. Dense,
// spread-out input avoids depending on knowing exactly where this seed's
// obstacles land.
function periodicLog(actionOn: string, actionOff: string | null, period: number, count: number): InputLogEntry[] {
  const log: InputLogEntry[] = [];
  for (let i = 0; i < count; i++) {
    const t = 20 + i * period;
    log.push({ tick: t, action: actionOn });
    if (actionOff) log.push({ tick: t + 4, action: actionOff });
  }
  return log;
}

const GAMES = [
  {
    id: "neon-runner",
    adapter: neonRunnerReplayAdapter,
    log: periodicLog("jumpPressed", "jumpReleased", 20, 25),
  },
  {
    id: "pixel-ninja-dash",
    adapter: pixelNinjaDashReplayAdapter,
    log: periodicLog("dashPressed", null, 15, 60),
  },
  {
    id: "sky-dodge",
    adapter: skyDodgeReplayAdapter,
    log: [
      { tick: 10, action: "moveLeftDown" },
      { tick: 70, action: "moveLeftUp" },
      { tick: 75, action: "moveRightDown" },
      { tick: 200, action: "shieldPressed" },
      { tick: 260, action: "moveRightUp" },
    ] as InputLogEntry[],
  },
];

// ---------------------------------------------------------------------------
// Test 1: an honest run validates (all 3 games)
// ---------------------------------------------------------------------------
console.log("Test 1: an honest run validates\n");

const honestBaselines = new Map<string, { score: number; durationMs: number }>();

for (const game of GAMES) {
  const outcome = replayEngine(game.adapter, SEED, game.log, VIEWPORT);
  const durationMs = Math.round((outcome.finalTick / 60) * 1000);
  honestBaselines.set(game.id, { score: outcome.finalScore, durationMs });

  const result = validateScore({
    gameId: game.id,
    seed: SEED,
    inputLog: game.log,
    claimedScore: outcome.finalScore,
    durationMs,
    viewport: VIEWPORT,
  });
  check(`${game.id}: honest run validates`, result.verdict === "valid", JSON.stringify(result));
}

// ---------------------------------------------------------------------------
// Test 2: a run with the score tampered upward is rejected
// ---------------------------------------------------------------------------
console.log("\nTest 2: a run with the score tampered upward is rejected\n");

for (const game of GAMES) {
  const baseline = honestBaselines.get(game.id)!;
  const result = validateScore({
    gameId: game.id,
    seed: SEED,
    inputLog: game.log,
    claimedScore: baseline.score + 1_000_000,
    durationMs: baseline.durationMs,
    viewport: VIEWPORT,
  });
  check(
    `${game.id}: tampered-upward score rejected`,
    result.verdict === "invalid" && result.reason === "score_mismatch",
    JSON.stringify(result),
  );
}

// ---------------------------------------------------------------------------
// Test 3: a run with the inputLog tampered is rejected
// ---------------------------------------------------------------------------
console.log("\nTest 3: a run with the inputLog tampered is rejected\n");

for (const game of GAMES) {
  const baseline = honestBaselines.get(game.id)!;
  // Empty log, not "drop the first entry": tried dropping just the first
  // action first, but it turned out not to be load-bearing for any of the 3
  // sample logs (obstacle/hazard spawn timing is RNG-derived independent of
  // player input, so an early jump/dash/move isn't always what determines
  // the outcome — confirmed by this exact precondition check failing when
  // that was tried). An empty log — claiming a score with zero corroborating
  // input — is a stronger, more representative tamper: every game's
  // survival/scoring depends on reacting to obstacles that a real player
  // would have to act on, so "no input at all" reliably diverges from the
  // honest run rather than only sometimes.
  const tamperedLog: InputLogEntry[] = [];

  // Precondition, not the thing under test: confirm the tamper actually
  // changes what the run replays to. If it didn't, the test below would
  // pass/fail for the wrong reason — this makes that failure mode visible
  // instead of silently trusting a hand-picked tamper.
  const tamperedOutcome = replayEngine(game.adapter, SEED, tamperedLog, VIEWPORT);
  check(
    `${game.id}: precondition — an empty inputLog changes the replayed score`,
    tamperedOutcome.finalScore !== baseline.score,
    `both replayed to ${tamperedOutcome.finalScore}`,
  );

  const result = validateScore({
    gameId: game.id,
    seed: SEED,
    inputLog: tamperedLog,
    claimedScore: baseline.score, // claiming the ORIGINAL (honest) score against the tampered log
    durationMs: baseline.durationMs,
    viewport: VIEWPORT,
  });
  check(
    `${game.id}: tampered inputLog rejected`,
    result.verdict === "invalid",
    `verdict=${result.verdict} reason=${result.reason} replayedScore=${result.replayedScore} claimed=${baseline.score}`,
  );
}

// ---------------------------------------------------------------------------
// Test 4: a run over the tick cap is rejected without running the replay
// ---------------------------------------------------------------------------
console.log("\nTest 4: a run over the tick cap is rejected without running the replay\n");

{
  const overCapLog: InputLogEntry[] = [{ tick: MAX_REPLAY_TICKS + 1, action: "jumpPressed" }];
  const start = process.hrtime.bigint();
  const result = validateScore({
    gameId: "neon-runner",
    seed: SEED,
    inputLog: overCapLog,
    claimedScore: 999_999,
    durationMs: 999_999_999,
    viewport: VIEWPORT,
  });
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  check(
    "over-tick-cap submission rejected with tick_cap_exceeded",
    result.verdict === "invalid" && result.reason === "tick_cap_exceeded",
    JSON.stringify(result),
  );
  // A real replay up to a tick this large would take seconds (this repo's
  // slowest engine measured ~0.00063ms/tick); rejecting in well under that
  // is itself evidence replay never started, not just that the verdict
  // happens to be right.
  check("over-tick-cap rejection is fast (no replay attempted)", elapsedMs < 50, `${elapsedMs.toFixed(2)}ms`);
}

{
  const overSizeLog: InputLogEntry[] = Array.from({ length: MAX_INPUT_LOG_ENTRIES + 1 }, (_, i) => ({
    tick: i,
    action: "jumpPressed",
  }));
  const result = validateScore({
    gameId: "neon-runner",
    seed: SEED,
    inputLog: overSizeLog,
    claimedScore: 999_999,
    durationMs: 999_999_999,
    viewport: VIEWPORT,
  });
  check(
    "over-log-size submission rejected with log_size_exceeded",
    result.verdict === "invalid" && result.reason === "log_size_exceeded",
    JSON.stringify(result),
  );
}

// ---------------------------------------------------------------------------
// Test 5: the server records the correct winner from two validated scores
// ---------------------------------------------------------------------------
console.log("\nTest 5: winner determination from two validated scores\n");

{
  const higher = determineMatchOutcome({ score: 100, verdict: "valid" }, { score: 50, verdict: "valid" });
  check("higher score wins, lower loses", higher.a === "win" && higher.b === "loss", JSON.stringify(higher));

  const equal = determineMatchOutcome({ score: 75, verdict: "valid" }, { score: 75, verdict: "valid" });
  check("equal validated scores draw", equal.a === "draw" && equal.b === "draw", JSON.stringify(equal));

  const oneInvalid = determineMatchOutcome({ score: 10, verdict: "valid" }, { score: 9999, verdict: "invalid" });
  check(
    "invalid score never wins, even against a lower valid score",
    oneInvalid.a === "win" && oneInvalid.b === "loss",
    JSON.stringify(oneInvalid),
  );

  const bothInvalid = determineMatchOutcome({ score: 10, verdict: "invalid" }, { score: 20, verdict: "invalid" });
  check("both invalid -> void", bothInvalid.a === "void" && bothInvalid.b === "void", JSON.stringify(bothInvalid));

  const forfeitVsValid = determineMatchOutcome(null, { score: 5, verdict: "valid" });
  check(
    "forfeit vs. a valid score -> the submitter wins",
    forfeitVsValid.a === "loss" && forfeitVsValid.b === "win",
    JSON.stringify(forfeitVsValid),
  );

  const forfeitVsInvalid = determineMatchOutcome(null, { score: 5, verdict: "invalid" });
  check(
    "forfeit vs. an invalid score -> void (invalid doesn't win just because the opponent also forfeited)",
    forfeitVsInvalid.a === "void" && forfeitVsInvalid.b === "void",
    JSON.stringify(forfeitVsInvalid),
  );
}

// ---------------------------------------------------------------------------
// Test 6: mid-match disconnect resolves as a loss for the disconnector,
// never voids — see packages/server/src/matchmaking/matches.ts's
// handleDisconnect (only ever calls this once it already knows the
// disconnecting player never submitted; that case isn't exercised here,
// it's structural, not a policy decision this function makes).
// ---------------------------------------------------------------------------
console.log("\nTest 6: disconnect resolution (matches.ts's handleDisconnect policy)\n");

{
  const opponentAlreadyValid = determineDisconnectOutcome({ score: 42, verdict: "valid" });
  check(
    "opponent already had a valid score -> opponent wins outright, doesn't wait for the forfeit timer",
    opponentAlreadyValid.a === "loss" && opponentAlreadyValid.b === "win",
    JSON.stringify(opponentAlreadyValid),
  );

  const opponentAlreadyInvalid = determineDisconnectOutcome({ score: 999, verdict: "invalid" });
  check(
    "opponent's own score was invalid -> void, an invalid score still doesn't get to win",
    opponentAlreadyInvalid.a === "void" && opponentAlreadyInvalid.b === "void",
    JSON.stringify(opponentAlreadyInvalid),
  );

  const opponentStillPlaying = determineDisconnectOutcome(null);
  check(
    "opponent hasn't submitted either (still mid-run) -> opponent wins anyway, NOT void " +
      "(diverges from determineMatchOutcome(null, null), which is void for a different, non-disconnect case)",
    opponentStillPlaying.a === "loss" && opponentStillPlaying.b === "win",
    JSON.stringify(opponentStillPlaying),
  );
}

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
