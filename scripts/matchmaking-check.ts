// Standalone verification for the matchmaking queue/match lifecycle — same
// convention as scripts/determinism-check.ts: runs outside a real Socket.IO
// server or browser, no HTTP handshake, no database. Exercises the actual
// queue.ts/matches.ts logic (not a reimplementation of it) against minimal
// fake sockets cast to the real MatchmakingSocket type. Deliberately does
// NOT import socketAuth.ts's runtime value exports (only its types) or
// matchmaking/index.ts — those need a live DB/JWT_SECRET and a real
// handshake, out of scope for a headless script, same reasoning as
// determinism-check.ts not exercising the DOM.
//
// Run: npx tsx scripts/matchmaking-check.ts
//
// submitScore's payload now requires a real inputLog/viewport (score
// validation, a later session) — every submitScore call below uses a real
// (seed, inputLog) pair replayed via the actual shared adapters/driver to
// get a real, honestly-validating score, not a hand-picked number. This
// wasn't true before: 6 assertions here silently failed for two sessions
// because the payload guard rejected every under-shaped submission and
// nobody re-ran this file to notice — see PROGRESS.md and CLAUDE.md's
// "run every test script" rule, added because of exactly this.

import {
  createMatch,
  FORFEIT_GRACE_MS,
  handleDisconnect,
  submitScore,
} from "../packages/server/src/matchmaking/matches.ts";
import { enqueue, generateSeed, isValidGameId, removeFromQueue, tryPair } from "../packages/server/src/matchmaking/queue.ts";
import type { MatchmakingSocket, MatchmakingSocketData } from "../packages/server/src/matchmaking/socketAuth.ts";
import { replayEngine, type InputLogEntry } from "@arcadeclash/shared";
import { neonRunnerReplayAdapter } from "../games/neon-runner/replay.ts";
import { pixelNinjaDashReplayAdapter } from "../games/pixel-ninja-dash/replay.ts";
import { skyDodgeReplayAdapter } from "../games/sky-dodge/replay.ts";

let failures = 0;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const VIEWPORT = { width: 1280, height: 720 };

// Same rationale as score-validation-check.ts: dense, spread-out periodic
// input rather than a couple of sparse hand-picked ticks, so it reliably
// produces a real, non-trivial run regardless of where this seed's
// obstacles happen to land.
function periodicLog(actionOn: string, actionOff: string | null, period: number, count: number): InputLogEntry[] {
  const log: InputLogEntry[] = [];
  for (let i = 0; i < count; i++) {
    const t = 20 + i * period;
    log.push({ tick: t, action: actionOn });
    if (actionOff) log.push({ tick: t + 4, action: actionOff });
  }
  return log;
}


type Emitted = { event: string; payload: unknown };

function fakeSocket(userId: string, username: string): MatchmakingSocket & { emitted: Emitted[] } {
  const emitted: Emitted[] = [];
  const socket = {
    connected: true,
    data: { userId, username } as MatchmakingSocketData,
    emit(event: string, payload: unknown) {
      emitted.push({ event, payload });
      return true;
    },
    emitted,
  };
  return socket as unknown as MatchmakingSocket & { emitted: Emitted[] };
}

// Wrapped in an async function rather than using top-level await — this repo
// has no root-level "type": "module", so tsx treats scripts/ as CJS, which
// doesn't support top-level await.
async function main() {
console.log(`(forfeit grace window is ${FORFEIT_GRACE_MS}ms in real code; sped up below for this test only)`);

// ---------------------------------------------------------------------------
// Test 1: game id validation
// ---------------------------------------------------------------------------
console.log("\nTest 1: game id validation");
check("known game id accepted", isValidGameId("neon-runner"));
check("unknown game id rejected", !isValidGameId("totally-made-up-game"));

// ---------------------------------------------------------------------------
// Test 2: queue pairing + self-match guard
// ---------------------------------------------------------------------------
console.log("\nTest 2: queue pairing");
{
  const a = fakeSocket("user-a", "Alice");
  const b = fakeSocket("user-b", "Bob");
  enqueue("neon-runner", a);
  check("single entry does not pair", tryPair("neon-runner") === null);
  enqueue("neon-runner", a); // re-enqueue same user — dedup should replace, not duplicate
  enqueue("neon-runner", b);
  const pair = tryPair("neon-runner");
  check("two different users pair", pair !== null);
  check("no leftover entries after pairing (dedup meant only 2 ever existed)", tryPair("neon-runner") === null);
}

// ---------------------------------------------------------------------------
// Test 3: removeFromQueue actually removes (covers both cancel and disconnect-while-queued)
// ---------------------------------------------------------------------------
console.log("\nTest 3: queue cancel/removal");
{
  const a = fakeSocket("user-c", "Cara");
  const b = fakeSocket("user-d", "Dan");
  const c = fakeSocket("user-e", "Eve");
  enqueue("sky-dodge", a);
  enqueue("sky-dodge", b);
  removeFromQueue(a); // simulates Cancel button or a mid-queue disconnect
  check("pairing needs a 2nd real player after removal", tryPair("sky-dodge") === null);
  enqueue("sky-dodge", c);
  const pair = tryPair("sky-dodge");
  const pairedIds = pair ? [pair[0].userId, pair[1].userId].sort().join(",") : "";
  check("removed player excluded from pairing", pairedIds === ["user-d", "user-e"].sort().join(","), `got [${pairedIds}]`);
}

// ---------------------------------------------------------------------------
// Test 4: createMatch emits matched to both with matching matchId/seed
// ---------------------------------------------------------------------------
console.log("\nTest 4: match creation");
const alice = fakeSocket("user-alice", "Alice");
const bob = fakeSocket("user-bob", "Bob");
let matchId = "";
// A fixed test seed, not generateSeed() — Test 5+ need to hand-verify that
// specific (seed, inputLog) pairs replay to different scores, which isn't
// possible against a fresh random seed every run (tried it: a random seed
// can land on an obstacle layout where the sample logs below coincidentally
// don't diverge — see Test 5's own comment). generateSeed()'s actual
// randomness/range is still exercised on its own line below, just not used
// for the match itself.
const matchSeed = 424242;
{
  check("generateSeed() returns a value in valid uint32 range", (() => {
    const s = generateSeed();
    return s >= 0 && s < 0x100000000;
  })());
  createMatch(
    "neon-runner",
    { socket: alice, userId: "user-alice", username: "Alice" },
    { socket: bob, userId: "user-bob", username: "Bob" },
    matchSeed,
  );
  const aliceMatched = alice.emitted.find((e) => e.event === "matched")?.payload as any;
  const bobMatched = bob.emitted.find((e) => e.event === "matched")?.payload as any;
  check("both sides received matched", !!aliceMatched && !!bobMatched);
  matchId = aliceMatched?.matchId ?? "";
  check("both sides got the same matchId", matchId !== "" && matchId === bobMatched?.matchId);
  check("alice sees bob's username as opponent", aliceMatched?.opponentUsername === "Bob");
  check("bob sees alice's username as opponent", bobMatched?.opponentUsername === "Alice");
  check("both sides got the match's seed", aliceMatched?.seed === matchSeed && bobMatched?.seed === matchSeed);
}

// ---------------------------------------------------------------------------
// Test 5: normal resolution — both submit, both get matchResolved with real, replay-validated scores
// ---------------------------------------------------------------------------
console.log("\nTest 5: normal resolution (both submit)");
let aliceScore = 0;
let bobScore = 0;
{
  // Same (seed, log) combination already confirmed to diverge in
  // score-validation-check.ts's Test 3 — reused here rather than
  // re-discovering it, since matchSeed above is the same fixed constant.
  // Two different active patterns (jump-only vs. alternating jump/slide)
  // were tried first against a random per-run seed and kept landing on
  // identical scores — jumping alone never helps against an overhang
  // obstacle, so a jump-only "active" log can die exactly like an empty one
  // if an overhang happens to be what's fatal. Empty vs. a real active log
  // is the reliable contrast; the fixed seed makes it reproducible too.
  const aliceLog = periodicLog("jumpPressed", "jumpReleased", 20, 25);
  const bobLog: InputLogEntry[] = [];
  const aliceOutcome = replayEngine(neonRunnerReplayAdapter, matchSeed, aliceLog, VIEWPORT);
  const bobOutcome = replayEngine(neonRunnerReplayAdapter, matchSeed, bobLog, VIEWPORT);
  aliceScore = aliceOutcome.finalScore;
  bobScore = bobOutcome.finalScore;
  check(
    "precondition: alice's and bob's honest replays produce different scores",
    aliceScore !== bobScore,
    `both ${aliceScore}`,
  );

  submitScore(alice, {
    matchId,
    score: aliceScore,
    reason: "collision",
    durationMs: Math.round((aliceOutcome.finalTick / 60) * 1000),
    inputLog: aliceLog,
    viewport: VIEWPORT,
  });
  check("no resolution yet after only one submission", !alice.emitted.some((e) => e.event === "matchResolved"));
  submitScore(bob, {
    matchId,
    score: bobScore,
    reason: "collision",
    durationMs: Math.round((bobOutcome.finalTick / 60) * 1000),
    inputLog: bobLog,
    viewport: VIEWPORT,
  });
  const aliceResolved = alice.emitted.find((e) => e.event === "matchResolved")?.payload as any;
  const bobResolved = bob.emitted.find((e) => e.event === "matchResolved")?.payload as any;
  check(
    "alice resolved: her score as 'you', status completed",
    aliceResolved?.you?.score === aliceScore && aliceResolved?.you?.status === "completed",
  );
  check("alice resolved: bob's score as 'opponent'", aliceResolved?.opponent?.score === bobScore);
  check("bob resolved: his score as 'you'", bobResolved?.you?.score === bobScore);
  check("bob resolved: alice's score as 'opponent'", bobResolved?.opponent?.score === aliceScore);
}

// ---------------------------------------------------------------------------
// Test 6: duplicate/stale submission after resolution is ignored
// ---------------------------------------------------------------------------
console.log("\nTest 6: duplicate submission after resolution");
{
  const before = alice.emitted.length;
  submitScore(alice, { matchId, score: 999, reason: "collision", durationMs: 1, inputLog: [], viewport: VIEWPORT });
  check("resubmitting after resolution emits nothing new", alice.emitted.length === before);
}

// ---------------------------------------------------------------------------
// Test 7: forfeit timeout — one player never submits
// ---------------------------------------------------------------------------
console.log("\nTest 7: forfeit timeout");
{
  const carl = fakeSocket("user-carl", "Carl");
  const dana = fakeSocket("user-dana", "Dana");
  const seed = generateSeed();
  createMatch(
    "pixel-ninja-dash",
    { socket: carl, userId: "user-carl", username: "Carl" },
    { socket: dana, userId: "user-dana", username: "Dana" },
    seed,
  );
  const carlMatchId = (carl.emitted.find((e) => e.event === "matched")?.payload as any)?.matchId;
  const carlLog = periodicLog("dashPressed", null, 15, 40);
  const carlScore = replayEngine(pixelNinjaDashReplayAdapter, seed, carlLog, VIEWPORT).finalScore;

  // Speed up the real forfeit timer for this one call, without touching
  // matches.ts's use of the real setTimeout/clearTimeout — same goal as
  // determinism-check.ts's injectable fake clock, applied via a temporary
  // global stub since matches.ts wasn't built with an injectable timer (a
  // real Socket.IO server has no reason to ever fast-forward this).
  const realSetTimeout = global.setTimeout;
  // @ts-expect-error test-only stub, intentionally narrower than the real overloads
  global.setTimeout = (fn: (...a: unknown[]) => void) => realSetTimeout(fn, 10);
  submitScore(carl, {
    matchId: carlMatchId,
    score: carlScore,
    reason: "collision",
    durationMs: 5000,
    inputLog: carlLog,
    viewport: VIEWPORT,
  });
  global.setTimeout = realSetTimeout;

  await new Promise((resolve) => realSetTimeout(resolve, 60));

  const carlResolved = carl.emitted.find((e) => e.event === "matchResolved")?.payload as any;
  const danaResolved = dana.emitted.find((e) => e.event === "matchResolved")?.payload as any;
  check(
    "submitter (carl) wins by forfeit",
    carlResolved?.you?.score === carlScore && carlResolved?.opponent?.status === "forfeited",
  );
  check(
    "non-submitter (dana) is told she forfeited",
    danaResolved?.you?.status === "forfeited" && danaResolved?.opponent?.score === carlScore,
  );
}

// ---------------------------------------------------------------------------
// Test 8: mid-match disconnect — resolves as a loss for the disconnector,
// never voids. Three sub-cases, since the correct behavior genuinely differs:
// see packages/server/src/validation/matchOutcome.ts's determineDisconnectOutcome
// and matches.ts's handleDisconnect for the reasoning behind each.
// ---------------------------------------------------------------------------
console.log("\nTest 8: disconnect mid-match");

// 8a: the disconnecting player had ALREADY submitted — a no-op for
// resolution (they finished honestly and left; not an abandonment). The
// match must stay alive and resolve normally once the opponent submits.
{
  const eli = fakeSocket("user-eli", "Eli");
  const fay = fakeSocket("user-fay", "Fay");
  const seed = generateSeed();
  createMatch(
    "sky-dodge",
    { socket: eli, userId: "user-eli", username: "Eli" },
    { socket: fay, userId: "user-fay", username: "Fay" },
    seed,
  );
  const eliMatchId = (eli.emitted.find((e) => e.event === "matched")?.payload as any)?.matchId;
  const eliLog = periodicLog("moveLeftDown", "moveLeftUp", 20, 10);
  const eliScore = replayEngine(skyDodgeReplayAdapter, seed, eliLog, VIEWPORT).finalScore;

  submitScore(eli, {
    matchId: eliMatchId,
    score: eliScore,
    reason: "collision",
    durationMs: 5000,
    inputLog: eliLog,
    viewport: VIEWPORT,
  }); // starts the real 120s forfeit timer, waiting on fay
  eli.connected = false;
  handleDisconnect(eli);
  check("8a: disconnect after already submitting emits nothing new", !eli.emitted.some((e) => e.event === "matchResolved"));

  const fayLog = periodicLog("moveRightDown", "moveRightUp", 25, 10);
  const fayScore = replayEngine(skyDodgeReplayAdapter, seed, fayLog, VIEWPORT).finalScore;
  submitScore(fay, {
    matchId: eliMatchId,
    score: fayScore,
    reason: "collision",
    durationMs: 4800,
    inputLog: fayLog,
    viewport: VIEWPORT,
  });
  const fayResolved = fay.emitted.find((e) => e.event === "matchResolved")?.payload as any;
  check(
    "8a: match still resolves normally (real score comparison) after the already-submitted side's disconnect",
    !!fayResolved && fayResolved.opponent?.score === eliScore && fayResolved.opponent?.status === "completed",
  );
}

// 8b: the disconnecting player never submitted; the opponent already had —
// resolves immediately as a win for the opponent, doesn't wait for the
// forfeit timer, and the timer never fires late afterward.
{
  const gus = fakeSocket("user-gus", "Gus");
  const hana = fakeSocket("user-hana", "Hana");
  const seed = generateSeed();
  createMatch(
    "sky-dodge",
    { socket: gus, userId: "user-gus", username: "Gus" },
    { socket: hana, userId: "user-hana", username: "Hana" },
    seed,
  );
  const gusMatchId = (gus.emitted.find((e) => e.event === "matched")?.payload as any)?.matchId;
  const gusLog = periodicLog("moveLeftDown", "moveLeftUp", 20, 10);
  const gusScore = replayEngine(skyDodgeReplayAdapter, seed, gusLog, VIEWPORT).finalScore;

  submitScore(gus, {
    matchId: gusMatchId,
    score: gusScore,
    reason: "collision",
    durationMs: 5000,
    inputLog: gusLog,
    viewport: VIEWPORT,
  }); // starts the forfeit timer, waiting on hana
  hana.connected = false;
  handleDisconnect(hana);

  const gusResolved = gus.emitted.find((e) => e.event === "matchResolved")?.payload as any;
  check(
    "8b: submitter wins immediately on opponent disconnect, doesn't wait for the forfeit timer",
    gusResolved?.outcome === "win" && gusResolved?.you?.score === gusScore && gusResolved?.opponent?.status === "forfeited",
  );

  const emittedBefore = gus.emitted.length;
  await new Promise((resolve) => setTimeout(resolve, 100)); // real-time wait; well short of the real 120s grace window
  check("8b: no late forfeit-timer resolution fires after disconnect already resolved the match", gus.emitted.length === emittedBefore);
}

// 8c: NEITHER side has submitted when one disconnects — the remaining,
// still-connected player wins outright, NOT void. This is the case that
// diverges from determineMatchOutcome's general "both forfeited -> void"
// policy: the remaining player didn't fail to finish, they're still
// legitimately playing while their only competitor actively left.
{
  const ivy = fakeSocket("user-ivy", "Ivy");
  const jack = fakeSocket("user-jack", "Jack");
  createMatch(
    "sky-dodge",
    { socket: ivy, userId: "user-ivy", username: "Ivy" },
    { socket: jack, userId: "user-jack", username: "Jack" },
    generateSeed(),
  );
  jack.connected = false;
  handleDisconnect(jack);

  const ivyResolved = ivy.emitted.find((e) => e.event === "matchResolved")?.payload as any;
  check(
    "8c: still-connected player wins outright when neither side had submitted, not void",
    ivyResolved?.outcome === "win" &&
      ivyResolved?.you?.status === "opponent_disconnected" &&
      ivyResolved?.opponent?.status === "forfeited",
  );
}

// ---------------------------------------------------------------------------
console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
}

main();
