import {
  createFixedTimestepLoop,
  FIXED_TIMESTEP_SEC,
  type FixedTimestepLoop,
  type GameMode,
  type GameModule,
  type GameOverPayload,
  type InputLogEntry,
} from "@arcadeclash/shared";
import { PALETTE } from "./constants";
import { DodgeEngine, type EngineInput } from "./engine";

const COUNTDOWN_STEPS = ["3", "2", "1", "GO!"];
const COUNTDOWN_STEP_MS = 700;

type ModuleState = "idle" | "countdown" | "running" | "paused" | "ended";

// Same architecture as neon-runner / pixel-ninja-dash: vanilla DOM +
// Canvas, module owns in-run UI, host owns the results screen.
export class SkyDodgeModule extends EventTarget implements GameModule {
  private root: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private hud: HTMLDivElement | null = null;
  private countdownEl: HTMLDivElement | null = null;
  private pauseOverlay: HTMLDivElement | null = null;

  // Constructed in init() once the seed is known, not as a field
  // initializer — the engine's determinism depends on that seed.
  private engine!: DodgeEngine;
  private resizeObserver: ResizeObserver | null = null;

  private state: ModuleState = "idle";
  private fixedLoop: FixedTimestepLoop | null = null;
  private runStartTime = 0;
  private countdownTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private seed = 0;
  private inputLog: InputLogEntry[] = [];
  private mode: GameMode = "practice";
  // Last size passed to engine.resize() — captured for GameOverPayload so
  // server-side replay can call resize() with the same value (see
  // packages/shared/src/gameModule.ts's GameOverPayload doc comment;
  // DodgeEngine's hazard-spawn/player-bounds math is a function of width).
  private lastResizeWidth = 0;
  private lastResizeHeight = 0;
  // Armed by a first click on the Forfeit control; a second click within
  // this window actually forfeits, otherwise it reverts. Cleared in
  // destroy() and endRun() so a stale timer can't fire against a torn-down
  // or already-ended module.
  private forfeitConfirmTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Continuous held-state input (unlike the edge-triggered single actions in
  // the previous two games) — this game needs analog left/right movement.
  // NOTE: dragTargetX (pointer-drag movement) is deliberately not recorded
  // to inputLog — it's continuous analog input, not a discrete action, so
  // it's out of scope for tick/action replay. In match mode it's disabled
  // outright (see handlePointerDown/handlePointerMove below) rather than
  // exempted from validation, so every match run is fully replayable via
  // keyboard-only actions. Practice mode keeps drag unchanged — see
  // PROGRESS.md Known Gaps.
  private input: EngineInput = { moveLeft: false, moveRight: false, dragTargetX: null, shieldPressed: false };
  private dragging = false;
  private moveLeftKeyDown = false;
  private moveRightKeyDown = false;
  private shieldKeyDown = false;

  // Records a tick-tagged input transition for replay. Only meaningful once
  // the run has actually started (fixedLoop exists) — input received during
  // countdown/idle never reaches engine.update, so there's no tick to tag it
  // with.
  private logInput(action: string) {
    if (!this.fixedLoop) return;
    // wallMs is evidence only — never read by tick/action replay. See the
    // type's doc comment in packages/shared/src/gameModule.ts.
    this.inputLog.push({ tick: this.fixedLoop.tick, action, wallMs: performance.now() - this.runStartTime });
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft") {
      e.preventDefault();
      if (!this.moveLeftKeyDown) {
        this.moveLeftKeyDown = true;
        this.input.moveLeft = true;
        this.logInput("moveLeftDown");
      }
    } else if (e.code === "ArrowRight") {
      e.preventDefault();
      if (!this.moveRightKeyDown) {
        this.moveRightKeyDown = true;
        this.input.moveRight = true;
        this.logInput("moveRightDown");
      }
    } else if (e.code === "Space") {
      e.preventDefault();
      if (!this.shieldKeyDown) {
        this.shieldKeyDown = true;
        this.input.shieldPressed = true;
        this.logInput("shieldPressed");
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft") {
      this.moveLeftKeyDown = false;
      this.input.moveLeft = false;
      this.logInput("moveLeftUp");
    } else if (e.code === "ArrowRight") {
      this.moveRightKeyDown = false;
      this.input.moveRight = false;
      this.logInput("moveRightUp");
    } else if (e.code === "Space") {
      this.shieldKeyDown = false;
    }
  };

  private handlePointerDown = (e: PointerEvent) => {
    // Match mode: keyboard-only, so every match run is fully replayable
    // server-side (see the class-level comment on `input` above).
    if (this.mode === "match") return;
    this.dragging = true;
    this.input.dragTargetX = this.pointerLocalX(e);
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (this.mode === "match") return;
    if (!this.dragging) return;
    this.input.dragTargetX = this.pointerLocalX(e);
  };

  private handlePointerUp = () => {
    this.dragging = false;
    this.input.dragTargetX = null;
  };

  private pointerLocalX(e: PointerEvent): number {
    const rect = this.canvas!.getBoundingClientRect();
    return e.clientX - rect.left;
  }

  private handleVisibilityChange = () => {
    if (!document.hidden || this.state !== "running") return;
    if (this.mode === "match") {
      // Match mode has no pause to fall back to (see pause()'s own guard) —
      // going hidden ends the run immediately as a forfeit, the same real
      // score/inputLog/validation path a manual Forfeit click uses, just a
      // distinct reason string for observability. Deliberately no grace
      // period — see PROGRESS.md's session log for why a short one would
      // just make the freeze-frame exploit repeatable instead of closing it.
      this.endRun("backgrounded");
    } else {
      this.pause();
    }
  };

  init(container: HTMLElement, mode: GameMode, _opponentSocket: WebSocket | null, seed: number): void {
    this.mode = mode;
    this.seed = seed;
    this.engine = new DodgeEngine(seed);

    this.root = document.createElement("div");
    this.root.style.cssText =
      "position:relative;width:100%;height:100%;overflow:hidden;background:#05060a;touch-action:none;";

    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "display:block;width:100%;height:100%;";
    this.root.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");

    this.hud = document.createElement("div");
    this.hud.style.cssText = `
      position:absolute; top:12px; left:16px; color:${PALETTE.cyan};
      font-family: ui-monospace, Consolas, monospace; font-size:20px; font-weight:700;
      text-shadow: 0 0 8px ${PALETTE.cyan}; letter-spacing: 1px; pointer-events:none;
    `;
    this.hud.textContent = "SCORE 0 · SHIELD READY";
    this.root.appendChild(this.hud);

    // No pause affordance in match mode — see pause()'s own guard for why.
    // Match mode gets a Forfeit control in the same spot instead — an
    // honest concede path (real score, real inputLog, real validation,
    // exactly like practice's Quit Run). Click-twice confirm rather than
    // hold-to-confirm: fewer edge cases, still fully prevents a misclick.
    if (this.mode !== "match") {
      const pauseButton = document.createElement("button");
      pauseButton.textContent = "II";
      pauseButton.setAttribute("aria-label", "Pause");
      pauseButton.style.cssText = `
        position:absolute; top:10px; right:12px; width:34px; height:34px;
        border-radius:9999px; border:1px solid ${PALETTE.purple}; background:rgba(10,10,15,0.6);
        color:${PALETTE.text}; font-family:ui-monospace,monospace; cursor:pointer;
      `;
      pauseButton.addEventListener("click", () => this.pause());
      this.root.appendChild(pauseButton);
    } else {
      const forfeitButton = document.createElement("button");
      forfeitButton.textContent = "Forfeit";
      forfeitButton.setAttribute("aria-label", "Forfeit match");
      forfeitButton.title = "Click twice to forfeit — ends the match with your current score.";
      const armedStyle = (color: string) => `
        position:absolute; top:10px; right:12px; height:34px; padding:0 14px;
        border-radius:9999px; border:1px solid ${color}; background:rgba(10,10,15,0.6);
        color:${PALETTE.text}; font-family:ui-monospace,monospace; font-size:13px; cursor:pointer;
      `;
      forfeitButton.style.cssText = armedStyle(PALETTE.purple);
      forfeitButton.addEventListener("click", () => {
        if (this.state !== "running") return;
        if (this.forfeitConfirmTimeoutId) {
          clearTimeout(this.forfeitConfirmTimeoutId);
          this.forfeitConfirmTimeoutId = null;
          this.endRun("quit");
          return;
        }
        forfeitButton.textContent = "Confirm?";
        forfeitButton.style.cssText = armedStyle(PALETTE.magenta);
        this.forfeitConfirmTimeoutId = setTimeout(() => {
          this.forfeitConfirmTimeoutId = null;
          forfeitButton.textContent = "Forfeit";
          forfeitButton.style.cssText = armedStyle(PALETTE.purple);
        }, 3000);
      });
      this.root.appendChild(forfeitButton);
    }

    this.countdownEl = document.createElement("div");
    this.countdownEl.style.cssText = `
      position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      font-family: ui-monospace, Consolas, monospace; font-size:72px; font-weight:700;
      color:${PALETTE.cyan}; text-shadow:0 0 24px ${PALETTE.cyan}; background:rgba(5,6,10,0.4);
      pointer-events:none; visibility:hidden;
    `;
    this.root.appendChild(this.countdownEl);

    this.pauseOverlay = document.createElement("div");
    this.pauseOverlay.style.cssText = `
      position:absolute; inset:0; display:none; flex-direction:column; align-items:center;
      justify-content:center; gap:16px; background:rgba(5,6,10,0.85); font-family: system-ui, sans-serif;
    `;
    const pausedLabel = document.createElement("div");
    pausedLabel.textContent = "PAUSED";
    pausedLabel.style.cssText = `color:${PALETTE.text}; font-size:28px; font-weight:700; letter-spacing:2px;`;
    const resumeBtn = document.createElement("button");
    resumeBtn.textContent = "Resume";
    resumeBtn.style.cssText = overlayButtonStyle(PALETTE.cyan);
    resumeBtn.addEventListener("click", () => this.resume());
    const quitBtn = document.createElement("button");
    quitBtn.textContent = "Quit Run";
    quitBtn.style.cssText = overlayButtonStyle(PALETTE.magenta);
    quitBtn.addEventListener("click", () => this.endRun("quit"));
    this.pauseOverlay.append(pausedLabel, resumeBtn, quitBtn);
    this.root.appendChild(this.pauseOverlay);

    container.appendChild(this.root);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.root);
    this.handleResize();

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerup", this.handlePointerUp);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  private handleResize = () => {
    if (!this.canvas || !this.root || !this.ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.engine.resize(w, h);
    this.lastResizeWidth = w;
    this.lastResizeHeight = h;
    // TEMPORARY DIAGNOSTIC — session 21, ship-not-rendering investigation.
    // Remove once the bug is confirmed fixed (see PROGRESS.md).
    console.log(
      `[sky-dodge] DIAGNOSTIC resize: root=${this.root.clientWidth}x${this.root.clientHeight} ` +
        `canvas=${this.canvas.width}x${this.canvas.height} clientWH=${w}x${h} dpr=${dpr} ` +
        `engineWH=${this.engine.width}x${this.engine.height}`,
    );
  };

  start(): void {
    if (this.state === "paused") {
      this.resume();
      return;
    }
    if (this.state === "running" || this.state === "countdown") return;
    this.engine.reset();
    this.inputLog = [];
    this.state = "countdown";
    this.runCountdown();
  }

  private runCountdown() {
    if (!this.countdownEl) return;
    this.countdownEl.style.visibility = "visible";
    let step = 0;
    const showStep = () => {
      if (!this.countdownEl) return;
      this.countdownEl.textContent = COUNTDOWN_STEPS[step];
      step++;
      if (step < COUNTDOWN_STEPS.length) {
        this.countdownTimeoutId = setTimeout(showStep, COUNTDOWN_STEP_MS);
      } else {
        this.countdownTimeoutId = setTimeout(() => {
          if (this.countdownEl) this.countdownEl.style.visibility = "hidden";
          this.beginRun();
        }, COUNTDOWN_STEP_MS);
      }
    };
    showStep();
  }

  private beginRun() {
    this.state = "running";
    this.runStartTime = performance.now();
    this.fixedLoop = createFixedTimestepLoop({
      update: (tick) => this.tick(tick),
      render: () => this.render(),
    });
    this.fixedLoop.start();
  }

  private tick(_tick: number) {
    const result = this.engine.update(FIXED_TIMESTEP_SEC, this.input);
    this.input.shieldPressed = false;

    if (result === "collision") {
      this.endRun("collision");
    }
  }

  private render() {
    if (this.ctx) this.engine.draw(this.ctx);
    if (this.hud) {
      const shieldLabel = this.engine.shieldActive
        ? "SHIELD ON"
        : this.engine.shieldCooldownRemaining > 0
          ? `SHIELD ${Math.ceil(this.engine.shieldCooldownRemaining)}s`
          : "SHIELD READY";
      this.hud.textContent = `SCORE ${this.engine.score} · ${shieldLabel}`;
    }
  }

  private resume() {
    if (this.state !== "paused") return;
    this.state = "running";
    if (this.pauseOverlay) this.pauseOverlay.style.display = "none";
    this.fixedLoop?.start();
  }

  pause(): void {
    // Disabled in match mode — see games/neon-runner/index.ts's pause() for
    // the full freeze-frame reasoning; identical here. handleVisibilityChange
    // no longer routes through this guard in match mode — it calls
    // endRun("backgrounded") directly instead — but the guard stays as a
    // second line of defense against any other future caller.
    if (this.mode === "match") return;
    if (this.state !== "running") return;
    this.state = "paused";
    this.fixedLoop?.stop();
    // Deliberately NOT forcing input.moveLeft/moveRight false here: the
    // fixed-timestep loop is fully stopped while paused, so engine.update
    // never reads them until resume — leaving them as-is means a still-held
    // arrow key keeps working immediately on resume without needing a
    // release+re-press, and correctly reflects false already if the key was
    // released while paused (handleKeyUp still fires).
    if (this.pauseOverlay) this.pauseOverlay.style.display = "flex";
  }

  private endRun(reason: "collision" | "quit" | "backgrounded") {
    this.state = "ended";
    this.fixedLoop?.stop();
    if (this.pauseOverlay) this.pauseOverlay.style.display = "none";
    if (this.forfeitConfirmTimeoutId) {
      clearTimeout(this.forfeitConfirmTimeoutId);
      this.forfeitConfirmTimeoutId = null;
    }

    const payload: GameOverPayload = {
      score: this.engine.score,
      reason,
      durationMs: Math.round(performance.now() - this.runStartTime),
      seed: this.seed,
      inputLog: this.inputLog,
      viewport: { width: this.lastResizeWidth, height: this.lastResizeHeight },
    };
    this.dispatchEvent(new CustomEvent("gameOver", { detail: payload }));
  }

  destroy(): void {
    this.fixedLoop?.stop();
    this.fixedLoop = null;
    if (this.countdownTimeoutId !== null) clearTimeout(this.countdownTimeoutId);
    if (this.forfeitConfirmTimeoutId !== null) clearTimeout(this.forfeitConfirmTimeoutId);
    this.resizeObserver?.disconnect();
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("pointerup", this.handlePointerUp);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.canvas?.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas?.removeEventListener("pointermove", this.handlePointerMove);
    this.root?.remove();
    this.root = null;
    this.canvas = null;
    this.ctx = null;
    this.hud = null;
    this.countdownEl = null;
    this.pauseOverlay = null;
  }
}

function overlayButtonStyle(color: string): string {
  return `
    padding:10px 28px; border-radius:9999px; border:1px solid ${color};
    background:rgba(10,10,15,0.6); color:${PALETTE.text}; font-size:15px; font-weight:600;
    cursor:pointer; box-shadow:0 0 12px ${color}55;
  `;
}

export default function createGameModule(): GameModule {
  return new SkyDodgeModule();
}
