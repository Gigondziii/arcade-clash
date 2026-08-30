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
import { SpeedTriviaEngine, type SpeedTriviaInput } from "./engine";
import { renderSpeedTrivia } from "./render";

const COUNTDOWN_STEPS = ["3", "2", "1", "TRIVIA CLASH!"];
const COUNTDOWN_STEP_MS = 700;

type ModuleState = "idle" | "countdown" | "running" | "paused" | "ended";

export class SpeedTriviaModule extends EventTarget implements GameModule {
  private root: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private countdownEl: HTMLDivElement | null = null;
  private pauseOverlay: HTMLDivElement | null = null;

  private engine!: SpeedTriviaEngine;
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

  private input: SpeedTriviaInput = {};

  private logInput(action: string) {
    if (!this.fixedLoop) return;
    this.inputLog.push({ tick: this.fixedLoop.tick, action, wallMs: performance.now() - this.runStartTime });
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.state !== "running") return;

    if (e.code === "Digit1" || e.code === "KeyA") {
      e.preventDefault();
      this.input.selectOption = 0;
      this.logInput("selectOption0");
    } else if (e.code === "Digit2" || e.code === "KeyB") {
      e.preventDefault();
      this.input.selectOption = 1;
      this.logInput("selectOption1");
    } else if (e.code === "Digit3" || e.code === "KeyC") {
      e.preventDefault();
      this.input.selectOption = 2;
      this.logInput("selectOption2");
    } else if (e.code === "Digit4" || e.code === "KeyD") {
      e.preventDefault();
      this.input.selectOption = 3;
      this.logInput("selectOption3");
    }
  };

  private handleCanvasClick = (e: MouseEvent) => {
    if (this.state !== "running" || !this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = VIRTUAL_VIEWPORT.width / rect.width;
    const scaleY = VIRTUAL_VIEWPORT.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // 4 Option Card bounding boxes on 1280x720 canvas
    const cardW = 570;
    const cardH = 150;
    const positions = [
      { x: 50, y: 325 },
      { x: 660, y: 325 },
      { x: 50, y: 500 },
      { x: 660, y: 500 },
    ];

    for (let i = 0; i < 4; i++) {
      const pos = positions[i];
      if (clickX >= pos.x && clickX <= pos.x + cardW && clickY >= pos.y && clickY <= pos.y + cardH) {
        this.input.selectOption = i;
        this.logInput(`selectOption${i}`);
        break;
      }
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
    this.engine = new SpeedTriviaEngine(this.seed);

    this.root = document.createElement("div");
    this.root.className = "speed-trivia-root";
    this.root.style.cssText =
      "position:relative;width:100%;height:100%;background:#080a14;overflow:hidden;user-select:none;display:flex;align-items:center;justify-content:center;";

    this.canvas = document.createElement("canvas");
    this.canvas.width = VIRTUAL_VIEWPORT.width;
    this.canvas.height = VIRTUAL_VIEWPORT.height;
    this.canvas.style.cssText =
      "display:block;max-width:100%;max-height:100%;aspect-ratio:16/9;object-fit:contain;cursor:pointer;";
    this.ctx = this.canvas.getContext("2d");

    this.countdownEl = document.createElement("div");
    this.countdownEl.style.cssText =
      "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:sans-serif;font-size:72px;font-weight:bold;color:#7c3aed;display:none;pointer-events:none;";

    this.pauseOverlay = document.createElement("div");
    this.pauseOverlay.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(8,10,20,0.85);display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:#fff;";
    this.pauseOverlay.innerHTML = `<h2 style="font-size:36px;margin:0;">GAME PAUSED</h2>`;
    const resumeBtn = document.createElement("button");
    resumeBtn.textContent = "RESUME";
    resumeBtn.style.cssText =
      "padding:12px 24px;font-size:18px;font-weight:bold;background:#7c3aed;color:#fff;border:none;border-radius:6px;cursor:pointer;";
    resumeBtn.onclick = () => this.resume();
    this.pauseOverlay.appendChild(resumeBtn);

    this.root.appendChild(this.canvas);
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
    this.canvas.addEventListener("click", this.handleCanvasClick);
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
    this.input.selectOption = undefined;

    if (result === "ended") {
      this.endRun("collision"); // mini-game completed naturally
    }
  }

  private render() {
    if (this.ctx) renderSpeedTrivia(this.ctx, this.engine);
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
    this.resizeObserver?.disconnect();
    window.removeEventListener("keydown", this.handleKeyDown);
    if (this.canvas) this.canvas.removeEventListener("click", this.handleCanvasClick);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.root?.remove();
  }
}

const createSpeedTriviaModule: GameModuleFactory = () => new SpeedTriviaModule();
export default createSpeedTriviaModule;
