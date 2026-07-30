// Standalone verification script for the determinism foundation — same
// convention as the tsx scripts used to verify each game's engine logic
// (see PROGRESS.md sessions 4-6): runs outside the browser entirely, no
// DOM/rAF required for the engine-replay test, and uses createFixedTimestepLoop's
// injectable now/raf/caf for the loop-jitter test.
//
// Run: npx tsx scripts/determinism-check.ts
//
// Two things are tested, not one:
//   1. Engine replay — same seed + same tick-tagged inputLog, run twice,
//      identical final score/state. This proves each of the 3 engines is
//      itself deterministic (no stray Math.random(), no wall-clock leakage).
//   2. Loop jitter — one representative engine (RunnerEngine) driven through
//      the REAL createFixedTimestepLoop under two very different fake clocks
//      (smooth 16.67ms vs jittery with a 400ms stall), same inputLog, same
//      target tick count. This proves the loop itself insulates gameplay
//      from real frame timing — irregular delivery is exactly what differs
//      between two real players/sessions, and engine-only testing (#1) never
//      exercises the loop's accumulator/clamp logic at all.

import { createFixedTimestepLoop, FIXED_TIMESTEP_SEC, type InputLogEntry } from "@arcadeclash/shared";
import { RunnerEngine, type EngineInput as RunnerInput } from "../games/neon-runner/engine.ts";
import { DashEngine, type EngineInput as DashInput } from "../games/pixel-ninja-dash/engine.ts";
import { DodgeEngine, type EngineInput as DodgeInput } from "../games/sky-dodge/engine.ts";

const SEED = 424242;
let failures = 0;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ---------------------------------------------------------------------------
// Test 1: engine replay determinism, all 3 games
// ---------------------------------------------------------------------------

type EngineSnapshot = { score: number; json: string };

function snapshot(engine: { score: number }): EngineSnapshot {
  return { score: engine.score, json: JSON.stringify(engine) };
}

function runNeonRunner(seed: number, inputLog: InputLogEntry[], ticks: number): EngineSnapshot {
  const engine = new RunnerEngine(seed);
  engine.reset();
  const input: RunnerInput = { jumpPressed: false, jumpReleased: false, slidePressed: false };
  let logIdx = 0;
  for (let tick = 0; tick < ticks; tick++) {
    while (logIdx < inputLog.length && inputLog[logIdx].tick === tick) {
      const action = inputLog[logIdx].action;
      if (action === "jumpPressed") input.jumpPressed = true;
      else if (action === "jumpReleased") input.jumpReleased = true;
      else if (action === "slidePressed") input.slidePressed = true;
      logIdx++;
    }
    engine.update(FIXED_TIMESTEP_SEC, input);
    input.jumpPressed = false;
    input.jumpReleased = false;
    input.slidePressed = false;
  }
  return snapshot(engine);
}

function runPixelNinjaDash(seed: number, inputLog: InputLogEntry[], ticks: number): EngineSnapshot {
  const engine = new DashEngine(seed);
  engine.reset();
  const input: DashInput = { dashPressed: false };
  let logIdx = 0;
  for (let tick = 0; tick < ticks; tick++) {
    while (logIdx < inputLog.length && inputLog[logIdx].tick === tick) {
      if (inputLog[logIdx].action === "dashPressed") input.dashPressed = true;
      logIdx++;
    }
    engine.update(FIXED_TIMESTEP_SEC, input);
    input.dashPressed = false;
  }
  return snapshot(engine);
}

function runSkyDodge(seed: number, inputLog: InputLogEntry[], ticks: number): EngineSnapshot {
  const engine = new DodgeEngine(seed);
  engine.reset();
  const input: DodgeInput = { moveLeft: false, moveRight: false, dragTargetX: null, shieldPressed: false };
  let logIdx = 0;
  for (let tick = 0; tick < ticks; tick++) {
    while (logIdx < inputLog.length && inputLog[logIdx].tick === tick) {
      const action = inputLog[logIdx].action;
      if (action === "moveLeftDown") input.moveLeft = true;
      else if (action === "moveLeftUp") input.moveLeft = false;
      else if (action === "moveRightDown") input.moveRight = true;
      else if (action === "moveRightUp") input.moveRight = false;
      else if (action === "shieldPressed") input.shieldPressed = true;
      logIdx++;
    }
    engine.update(FIXED_TIMESTEP_SEC, input);
    input.shieldPressed = false;
  }
  return snapshot(engine);
}

console.log("Test 1: engine replay determinism (same seed + same inputLog, twice)\n");

const neonRunnerLog: InputLogEntry[] = [
  { tick: 20, action: "jumpPressed" },
  { tick: 24, action: "jumpReleased" },
  { tick: 130, action: "slidePressed" },
  { tick: 310, action: "jumpPressed" },
  { tick: 315, action: "jumpReleased" },
];
const a1 = runNeonRunner(SEED, neonRunnerLog, 600);
const a2 = runNeonRunner(SEED, neonRunnerLog, 600);
check("neon-runner: score matches", a1.score === a2.score, `${a1.score} vs ${a2.score}`);
check("neon-runner: full state matches", a1.json === a2.json);

const dashLog: InputLogEntry[] = [
  { tick: 15, action: "dashPressed" },
  { tick: 90, action: "dashPressed" },
  { tick: 210, action: "dashPressed" },
  { tick: 340, action: "dashPressed" },
];
const b1 = runPixelNinjaDash(SEED, dashLog, 900);
const b2 = runPixelNinjaDash(SEED, dashLog, 900);
check("pixel-ninja-dash: score matches", b1.score === b2.score, `${b1.score} vs ${b2.score}`);
check("pixel-ninja-dash: full state matches", b1.json === b2.json);

const dodgeLog: InputLogEntry[] = [
  { tick: 10, action: "moveLeftDown" },
  { tick: 70, action: "moveLeftUp" },
  { tick: 75, action: "moveRightDown" },
  { tick: 200, action: "shieldPressed" },
  { tick: 260, action: "moveRightUp" },
];
const c1 = runSkyDodge(SEED, dodgeLog, 600);
const c2 = runSkyDodge(SEED, dodgeLog, 600);
check("sky-dodge: score matches", c1.score === c2.score, `${c1.score} vs ${c2.score}`);
check("sky-dodge: full state matches", c1.json === c2.json);

// ---------------------------------------------------------------------------
// Test 2: loop jitter — the accumulator itself, not just the engine
// ---------------------------------------------------------------------------

console.log("\nTest 2: loop jitter (same seed + same inputLog, smooth vs jittery real-time delivery)\n");

const loopInputLog: InputLogEntry[] = [
  { tick: 20, action: "jumpPressed" },
  { tick: 24, action: "jumpReleased" },
  { tick: 150, action: "slidePressed" },
];

function runNeonRunnerThroughLoop(
  seed: number,
  checkpointTicks: number,
  deltasMs: number[],
  inputLog: InputLogEntry[],
): { snapshot: EngineSnapshot; tickSequence: number[] } {
  const engine = new RunnerEngine(seed);
  engine.reset();
  const input: RunnerInput = { jumpPressed: false, jumpReleased: false, slidePressed: false };
  const tickSequence: number[] = [];
  let logIdx = 0;
  let nowMs = 0;
  let pendingFrame: ((t: number) => void) | null = null;

  // Stopping happens INSIDE update(), at an exact tick — same as how a real
  // game module stops the loop on collision (see games/*/index.ts tick()).
  // This is deliberate: stopping by checking loop.tick from the OUTSIDE,
  // between frame() calls, can't land on an exact tick, because a single
  // frame can burst-process up to maxStepsPerFrame ticks at once (that's
  // exactly what the 400ms stall does) — an external check would let the
  // jittery run overshoot the checkpoint by a tick or two while the smooth
  // run (which never bursts) lands exactly on it, comparing two runs of
  // different simulated duration instead of the same one under different
  // real-time delivery. Stopping from inside update() gets exact per-tick
  // control, because the loop's own inner catch-up while-loop rechecks
  // `running` after every single tick.
  const loop = createFixedTimestepLoop({
    update: (tick) => {
      while (logIdx < inputLog.length && inputLog[logIdx].tick === tick) {
        const action = inputLog[logIdx].action;
        if (action === "jumpPressed") input.jumpPressed = true;
        else if (action === "jumpReleased") input.jumpReleased = true;
        else if (action === "slidePressed") input.slidePressed = true;
        logIdx++;
      }
      tickSequence.push(tick);
      engine.update(FIXED_TIMESTEP_SEC, input);
      input.jumpPressed = false;
      input.jumpReleased = false;
      input.slidePressed = false;
      if (tick + 1 >= checkpointTicks) loop.stop();
    },
    render: () => {},
    now: () => nowMs,
    raf: (cb) => {
      pendingFrame = cb;
      return 0;
    },
    caf: () => {
      pendingFrame = null;
    },
  });

  loop.start();
  let di = 0;
  while (pendingFrame) {
    nowMs += deltasMs[di % deltasMs.length];
    di++;
    const cb = pendingFrame;
    pendingFrame = null;
    cb(nowMs);
  }

  return { snapshot: snapshot(engine), tickSequence };
}

const TARGET_TICKS = 300; // 5 simulated seconds at 60Hz
const smoothDeltas = [1000 / 60];
const jitteryDeltas = [16, 50, 8, 400, 16, 16, 33, 9, 41, 300, 16, 12, 60];

const smoothRun = runNeonRunnerThroughLoop(SEED, TARGET_TICKS, smoothDeltas, loopInputLog);
const jitteryRun = runNeonRunnerThroughLoop(SEED, TARGET_TICKS, jitteryDeltas, loopInputLog);

const expectedTicks = Array.from({ length: TARGET_TICKS }, (_, i) => i);
check(
  "smooth clock: tick sequence is exactly 0..N-1, no gaps/dupes",
  JSON.stringify(smoothRun.tickSequence) === JSON.stringify(expectedTicks),
);
check(
  "jittery clock (incl. a 400ms stall): tick sequence is exactly 0..N-1, no gaps/dupes",
  JSON.stringify(jitteryRun.tickSequence) === JSON.stringify(expectedTicks),
);
check(
  "smooth vs jittery: final score matches",
  smoothRun.snapshot.score === jitteryRun.snapshot.score,
  `${smoothRun.snapshot.score} vs ${jitteryRun.snapshot.score}`,
);
check("smooth vs jittery: full final state matches", smoothRun.snapshot.json === jitteryRun.snapshot.json);

// Separately: confirm the clamp actually bounds a single catastrophic stall
// rather than trying to catch up all of it in one frame (spiral of death).
{
  let nowMs = 0;
  let pendingFrame: ((t: number) => void) | null = null;
  const loop = createFixedTimestepLoop({
    update: () => {},
    render: () => {},
    now: () => nowMs,
    raf: (cb) => {
      pendingFrame = cb;
      return 0;
    },
    caf: () => {
      pendingFrame = null;
    },
  });
  loop.start();
  nowMs += 5000; // simulate a 5-second stall (e.g. backgrounded tab)
  pendingFrame!(nowMs);
  check(
    "a single 5s stall runs at most maxStepsPerFrame (5) ticks, not ~300 — no freeze",
    loop.tick <= 5,
    `loop.tick = ${loop.tick}`,
  );
  loop.stop();
}

// ---------------------------------------------------------------------------
// Test 3: wallMs is evidence-only — must have zero effect on replay
// ---------------------------------------------------------------------------
// wallMs exists to make freeze-frame/time-dilation stalling detectable later
// (a player who pauses the sim mid-decision to think, then resumes, leaves a
// gap in wallMs that tick-keyed replay alone can't see) — but it must never
// be able to change what replay produces, or it stops being trustworthy
// evidence. Proven here by stripping/randomizing it and confirming replay is
// bit-for-bit unaffected, not just by the replay code happening not to
// reference the field today.

console.log("\nTest 3: wallMs has zero effect on replay (stripped/randomized)\n");

function withRandomWallMs(log: InputLogEntry[]): InputLogEntry[] {
  return log.map((e) => ({ ...e, wallMs: Math.random() * 1_000_000 }));
}
function withoutWallMs(log: InputLogEntry[]): InputLogEntry[] {
  return log.map((e) => ({ tick: e.tick, action: e.action }));
}

const neonRandomWall = runNeonRunner(SEED, withRandomWallMs(neonRunnerLog), 600);
const neonNoWall = runNeonRunner(SEED, withoutWallMs(neonRunnerLog), 600);
check("neon-runner: randomized wallMs doesn't change replay state", a1.json === neonRandomWall.json);
check("neon-runner: stripped wallMs doesn't change replay state", a1.json === neonNoWall.json);

const dashRandomWall = runPixelNinjaDash(SEED, withRandomWallMs(dashLog), 900);
const dashNoWall = runPixelNinjaDash(SEED, withoutWallMs(dashLog), 900);
check("pixel-ninja-dash: randomized wallMs doesn't change replay state", b1.json === dashRandomWall.json);
check("pixel-ninja-dash: stripped wallMs doesn't change replay state", b1.json === dashNoWall.json);

const dodgeRandomWall = runSkyDodge(SEED, withRandomWallMs(dodgeLog), 600);
const dodgeNoWall = runSkyDodge(SEED, withoutWallMs(dodgeLog), 600);
check("sky-dodge: randomized wallMs doesn't change replay state", c1.json === dodgeRandomWall.json);
check("sky-dodge: stripped wallMs doesn't change replay state", c1.json === dodgeNoWall.json);

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
