// Fixed-timestep accumulator loop, shared by every game module. The reason
// this exists: gameplay code should only ever see a constant dt (never real
// frame-to-frame timing), because a constant dt is what makes a recorded
// (seed, inputLog) replayable to an identical result later — variable dt
// bakes this session's frame jitter into the simulation itself.
export const FIXED_TIMESTEP_SEC = 1 / 60;

export type FixedTimestepLoopOptions = {
  // Simulated seconds per tick. Defaults to FIXED_TIMESTEP_SEC.
  stepSec?: number;
  // Called once per simulation tick, before the tick is applied. Receives
  // the tick index about to run (0-based). Gameplay logic (engine.update)
  // belongs here, always driven with exactly `stepSec` of simulated time.
  update: (tick: number) => void;
  // Called once per animation frame, after 0+ update() calls have caught
  // the simulation up. Drawing/HUD logic belongs here.
  render: () => void;
  // Upper bound on how many ticks a single frame() call may run to catch
  // up. Real elapsed time beyond this many ticks' worth is clamped away
  // BEFORE it reaches the accumulator — deliberately dropped, not queued
  // for later frames — so a long stall (backgrounded tab, breakpoint, GC
  // pause) can't force a "spiral of death" catch-up freeze. This only
  // affects the live session's real-time pacing; it never touches
  // reproducibility, since replay steps ticks from a recorded log instead
  // of re-running this accumulator against real time. Default 5.
  maxStepsPerFrame?: number;
  // Injectable clock/scheduler so this loop is testable without a real
  // browser frame source. Default to the real browser globals.
  now?: () => number;
  raf?: (cb: (time: number) => void) => number;
  caf?: (handle: number) => void;
};

export type FixedTimestepLoop = {
  start(): void;
  stop(): void;
  readonly running: boolean;
  readonly tick: number;
};

export function createFixedTimestepLoop(options: FixedTimestepLoopOptions): FixedTimestepLoop {
  const stepSec = options.stepSec ?? FIXED_TIMESTEP_SEC;
  const maxStepsPerFrame = options.maxStepsPerFrame ?? 5;
  const now = options.now ?? (() => performance.now());
  const raf = options.raf ?? ((cb) => requestAnimationFrame(cb));
  const caf = options.caf ?? ((handle) => cancelAnimationFrame(handle));

  let running = false;
  let rafId: number | null = null;
  let lastTimeMs = 0;
  let accumulator = 0;
  let tick = 0;

  function frame(nowMs: number) {
    if (!running) return;

    const rawDtSec = (nowMs - lastTimeMs) / 1000;
    lastTimeMs = nowMs;
    const dtSec = Math.min(rawDtSec, maxStepsPerFrame * stepSec);
    accumulator += dtSec;

    let steps = 0;
    while (running && accumulator >= stepSec && steps < maxStepsPerFrame) {
      options.update(tick);
      tick++;
      accumulator -= stepSec;
      steps++;
    }

    if (running) {
      options.render();
      rafId = raf(frame);
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      lastTimeMs = now();
      accumulator = 0;
      rafId = raf(frame);
    },
    stop() {
      running = false;
      if (rafId !== null) caf(rafId);
      rafId = null;
    },
    get running() {
      return running;
    },
    get tick() {
      return tick;
    },
  };
}
