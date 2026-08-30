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
import { SkyDodgeEngine, type EngineInput } from "./engine";

const COUNTDOWN_STEPS = ["3", "2", "1", "GO!"];
const COUNTDOWN_STEP_MS = 700;

type ModuleState = "idle" | "countdown" | "running" | "paused" | "ended";

export class SkyDodgeModule extends EventTarget implements GameModule {
  private root: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private hud: HTMLDivElement | null = null;
  private countdownEl: HTMLDivElement | null = null;
  private pauseOverlay: HTMLDivElement | null = null;

  private engine!: SkyDodgeEngine;
  private resizeObserver: ResizeObserver | null = null;

  private state: ModuleState = "idle";
  private fixedLoop: FixedTimestepLoop | null = null;
  private runStartTime = 0;
  private countdownTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private seed = 0;
  private inputLog: InputLogEntry[] = [];
  private mode: GameMode = "practice";
  private lastResizeWidth = 0;
  private lastResizeHeight = 0;
  private forfeitConfirmTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private input: EngineInput = { moveLeft: false, moveRight: false, boostPressed: false };
  private leftKeyDown = false;
  private rightKeyDown = false;

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
    } else if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      this.input.boostPressed = true;
      this.logInput("boostPressed");
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
    this.engine = new SkyDodgeEngine(this.seed);

    container.innerHTML = "";
    this.root = document.createElement("div");
    this.root.style.cssText =
      "position:relative;width:100%;height:100%;background:#0b0f19;overflow:hidden;display:flex;align-items:center;justify-content:center;user-select:none;";

    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "display:block;background:#0b0f19;box-shadow:0 0 32px rgba(45,226,255,0.15);";
    this.ctx = this.canvas.getContext("2d");

    this.hud = document.createElement("div");
    this.hud.style.cssText =
      "position:absolute;top:16px;right:24px;color:#2de2ff;font-family:monospace;font-size:24px;font-weight:bold;text-shadow:0 0 8px #2de2ff;";
    this.hud.textContent = "SCORE 0";

    this.countdownEl = document.createElement("div");
    this.countdownEl.style.cssText =
      "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#ffd166;font-family:sans-serif;font-size:96px;font-weight:900;text-shadow:0 0 24px #ffd166;visibility:hidden;pointer-events:none;";

    this.pauseOverlay = document.createElement("div");
    this.pauseOverlay.style.cssText =
      "position:absolute;inset:0;background:rgba(11,15,25,0.85);display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:#ffffff;";
    this.pauseOverlay.innerHTML = "<h2 style='font-size:36px;margin:0;'>PAUSED</h2>";

    this.root.appendChild(this.canvas);
    this.root.appendChild(this.hud);
    this.root.appendChild(this.countdownEl);
    this.root.appendChild(this.pauseOverlay);
    container.appendChild(this.root);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.root);
    this.handleResize();

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  private handleResize = () => {
    if (!this.canvas || !this.root || !this.ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.root.clientWidth || VIRTUAL_VIEWPORT.width;
    const h = this.root.clientHeight || VIRTUAL_VIEWPORT.height;
    const targetRatio = VIRTUAL_VIEWPORT.width / VIRTUAL_VIEWPORT.height;
    const containerRatio = w / h;
    let displayW: number, displayH: number;
    if (containerRatio > targetRatio) {
      displayH = h;
      displayW = h * targetRatio;
    } else {
      displayW = w;
      displayH = w / targetRatio;
    }
    this.canvas.style.width = `${displayW}px`;
    this.canvas.style.height = `${displayH}px`;
    this.canvas.width = VIRTUAL_VIEWPORT.width * dpr;
    this.canvas.height = VIRTUAL_VIEWPORT.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
    this.lastResizeWidth = VIRTUAL_VIEWPORT.width;
    this.lastResizeHeight = VIRTUAL_VIEWPORT.height;
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
    this.input.boostPressed = false;

    if (result === "collision") {
      this.endRun("collision");
    }
  }

  private render() {
    if (this.ctx) this.engine.draw(this.ctx);
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

const createSkyDodgeModule: GameModuleFactory = () => new SkyDodgeModule();
export default createSkyDodgeModule;
