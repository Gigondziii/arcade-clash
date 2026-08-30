import {
  createFixedTimestepLoop,
  FIXED_TIMESTEP_SEC,
  VIRTUAL_VIEWPORT,
  type FixedTimestepLoop,
  type GameOverPayload,
  type GameMode,
  type GameModule,
  type GameModuleFactory,
  type InputLogEntry,
} from "@fugluck/shared";
import { SpaceBlasterEngine, type SpaceBlasterInput } from "./engine";

const COUNTDOWN_STEPS = ["3", "2", "1", "GO!"];
const COUNTDOWN_STEP_MS = 700;

type ModuleState = "idle" | "countdown" | "running" | "paused" | "ended";

export class SpaceBlasterModule extends EventTarget implements GameModule {
  private root: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private hud: HTMLDivElement | null = null;
  private countdownEl: HTMLDivElement | null = null;
  private pauseOverlay: HTMLDivElement | null = null;

  private engine!: SpaceBlasterEngine;
  private resizeObserver: ResizeObserver | null = null;

  private state: ModuleState = "idle";
  private fixedLoop: FixedTimestepLoop | null = null;
  private runStartTime = 0;
  private countdownTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private seed = 0;
  private inputLog: InputLogEntry[] = [];
  private mode: GameMode = "practice";
  private lastResizeWidth = VIRTUAL_VIEWPORT.width;
  private lastResizeHeight = VIRTUAL_VIEWPORT.height;
  private forfeitConfirmTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private input: SpaceBlasterInput = {
    moveLeft: false,
    moveRight: false,
    moveUp: false,
    moveDown: false,
    shootPressed: false,
  };
  private leftKeyDown = false;
  private rightKeyDown = false;
  private upKeyDown = false;
  private downKeyDown = false;

  private logInput(action: string) {
    if (!this.fixedLoop) return;
    this.inputLog.push({ tick: this.fixedLoop.tick, action, wallMs: performance.now() - this.runStartTime });
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      e.preventDefault();
      if (!this.leftKeyDown) {
        this.leftKeyDown = true;
        this.input.moveLeft = true;
        this.logInput("moveLeftDown");
      }
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      if (!this.rightKeyDown) {
        this.rightKeyDown = true;
        this.input.moveRight = true;
        this.logInput("moveRightDown");
      }
    } else if (e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      if (!this.upKeyDown) {
        this.upKeyDown = true;
        this.input.moveUp = true;
        this.logInput("moveUpDown");
      }
    } else if (e.code === "ArrowDown" || e.code === "KeyS") {
      e.preventDefault();
      if (!this.downKeyDown) {
        this.downKeyDown = true;
        this.input.moveDown = true;
        this.logInput("moveDownDown");
      }
    } else if (e.code === "Space") {
      e.preventDefault();
      this.input.shootPressed = true;
      this.logInput("shootPressed");
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      this.leftKeyDown = false;
      this.input.moveLeft = false;
      this.logInput("moveLeftUp");
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      this.rightKeyDown = false;
      this.input.moveRight = false;
      this.logInput("moveRightUp");
    } else if (e.code === "ArrowUp" || e.code === "KeyW") {
      this.upKeyDown = false;
      this.input.moveUp = false;
      this.logInput("moveUpUp");
    } else if (e.code === "ArrowDown" || e.code === "KeyS") {
      this.downKeyDown = false;
      this.input.moveDown = false;
      this.logInput("moveDownUp");
    }
  };

  private handleVisibilityChange = () => {
    if (document.hidden && this.state === "running") {
      if (this.mode === "match") {
        this.endRun("backgrounded");
        this.dispatchEvent(new CustomEvent("visibilityHidden", { detail: { matchForfeited: true } }));
      } else {
        this.pause();
      }
    }
  };

  init(container: HTMLElement, mode: GameMode, _opponentSocket: WebSocket | null, seed: number): void {
    this.seed = seed;
    this.mode = mode;
    this.engine = new SpaceBlasterEngine(this.seed);

    this.root = document.createElement("div");
    this.root.className = "space-blaster-root";
    this.root.style.cssText =
      "position:relative;width:100%;height:100%;background:#090d16;overflow:hidden;user-select:none;";

    this.canvas = document.createElement("canvas");
    this.canvas.width = VIRTUAL_VIEWPORT.width;
    this.canvas.height = VIRTUAL_VIEWPORT.height;
    this.canvas.style.cssText = "display:block;width:100%;height:100%;object-fit:contain;";
    this.ctx = this.canvas.getContext("2d");

    this.hud = document.createElement("div");
    this.hud.style.cssText =
      "position:absolute;top:16px;left:24px;font-family:monospace;font-size:24px;font-weight:bold;color:#00f0ff;pointer-events:none;";
    this.hud.textContent = "SCORE 0";

    this.countdownEl = document.createElement("div");
    this.countdownEl.style.cssText =
      "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:sans-serif;font-size:72px;font-weight:bold;color:#00f0ff;display:none;pointer-events:none;";

    this.pauseOverlay = document.createElement("div");
    this.pauseOverlay.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(9,13,22,0.85);display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:#fff;";
    this.pauseOverlay.innerHTML = `<h2 style="font-size:36px;margin:0;">GAME PAUSED</h2>`;
    const resumeBtn = document.createElement("button");
    resumeBtn.textContent = "RESUME";
    resumeBtn.style.cssText =
      "padding:12px 24px;font-size:18px;font-weight:bold;background:#00f0ff;color:#090d16;border:none;border-radius:6px;cursor:pointer;";
    resumeBtn.onclick = () => this.resume();
    this.pauseOverlay.appendChild(resumeBtn);

    this.root.appendChild(this.canvas);
    this.root.appendChild(this.hud);
    this.root.appendChild(this.countdownEl);
    this.root.appendChild(this.pauseOverlay);
    container.appendChild(this.root);

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          this.lastResizeWidth = width;
          this.lastResizeHeight = height;
          this.engine.resize(width, height);
        }
      }
    });
    this.resizeObserver.observe(container);

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);

    this.lastResizeWidth = VIRTUAL_VIEWPORT.width;
    this.lastResizeHeight = VIRTUAL_VIEWPORT.height;
    this.engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  }

  start(): void {
    if (this.state !== "idle") return;
    this.state = "countdown";
    this.inputLog = [];
    this.runStartTime = performance.now();
    this.runCountdown(0);
  }

  private runCountdown(stepIndex: number) {
    if (!this.countdownEl) return;
    if (stepIndex >= COUNTDOWN_STEPS.length) {
      this.countdownEl.style.display = "none";
      this.beginRun();
      return;
    }
    this.countdownEl.style.display = "block";
    this.countdownEl.textContent = COUNTDOWN_STEPS[stepIndex];
    this.countdownTimeoutId = setTimeout(() => this.runCountdown(stepIndex + 1), COUNTDOWN_STEP_MS);
  }

  private beginRun() {
    this.state = "running";
    this.runStartTime = performance.now();
    this.engine.reset();
    this.fixedLoop = createFixedTimestepLoop({
      update: (tick) => this.tick(tick),
      render: () => this.render(),
    });
    this.fixedLoop.start();
  }

  private tick(_tick: number) {
    const result = this.engine.update(FIXED_TIMESTEP_SEC, this.input);
    this.input.shootPressed = false;

    if (result === "collision") {
      this.endRun("collision");
    }
  }

  private render() {
    if (this.ctx) this.engine.render(this.ctx);
    if (this.hud) this.hud.textContent = `SCORE ${this.engine.score}`;
  }

  private resume() {
    if (this.state !== "paused") return;
    this.state = "running";
    if (this.pauseOverlay) this.pauseOverlay.style.display = "none";
    this.fixedLoop?.start();
  }

  pause(): void {
    if (this.mode === "match") return;
    if (this.state !== "running") return;
    this.state = "paused";
    this.fixedLoop?.stop();
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
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.root?.remove();
  }
}

const createSpaceBlasterModule: GameModuleFactory = () => new SpaceBlasterModule();
export default createSpaceBlasterModule;
