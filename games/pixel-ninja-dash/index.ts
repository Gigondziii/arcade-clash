import type { GameMode, GameModule, GameOverPayload } from "@arcadeclash/shared";
import { PALETTE } from "./constants";
import { DashEngine, type EngineInput } from "./engine";

const COUNTDOWN_STEPS = ["3", "2", "1", "GO!"];
const COUNTDOWN_STEP_MS = 700;

type ModuleState = "idle" | "countdown" | "running" | "paused" | "ended";

// Same architecture as games/neon-runner: vanilla DOM + Canvas, no
// framework dependency; module owns in-run UI (countdown/HUD/pause), host
// owns the post-run results screen. See PROGRESS.md decisions for why.
export class PixelNinjaDashModule extends EventTarget implements GameModule {
  private root: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private hud: HTMLDivElement | null = null;
  private countdownEl: HTMLDivElement | null = null;
  private pauseOverlay: HTMLDivElement | null = null;

  private engine = new DashEngine();
  private resizeObserver: ResizeObserver | null = null;

  private state: ModuleState = "idle";
  private rafId: number | null = null;
  private lastFrameTime = 0;
  private runStartTime = 0;
  private countdownTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private input: EngineInput = { dashPressed: false };
  private dashKeyDown = false;

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (!this.dashKeyDown) {
        this.dashKeyDown = true;
        this.input.dashPressed = true;
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === "Space") this.dashKeyDown = false;
  };

  private handlePointerDown = () => {
    this.input.dashPressed = true;
  };

  private handleVisibilityChange = () => {
    if (document.hidden && this.state === "running") this.pause();
  };

  init(container: HTMLElement, mode: GameMode, _opponentSocket: WebSocket | null): void {
    if (mode === "match") {
      console.warn(
        "[pixel-ninja-dash] 'match' mode requested but multiplayer isn't implemented during the games-only build phase — running as practice.",
      );
    }

    this.root = document.createElement("div");
    this.root.style.cssText =
      "position:relative;width:100%;height:100%;overflow:hidden;background:#05060a;touch-action:none;";

    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "display:block;width:100%;height:100%;";
    this.root.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");

    this.hud = document.createElement("div");
    this.hud.style.cssText = `
      position:absolute; top:28px; left:16px; color:${PALETTE.cyan};
      font-family: ui-monospace, Consolas, monospace; font-size:20px; font-weight:700;
      text-shadow: 0 0 8px ${PALETTE.cyan}; letter-spacing: 1px; pointer-events:none;
    `;
    this.hud.textContent = "SCORE 0 · 60s";
    this.root.appendChild(this.hud);

    const pauseButton = document.createElement("button");
    pauseButton.textContent = "II";
    pauseButton.setAttribute("aria-label", "Pause");
    pauseButton.style.cssText = `
      position:absolute; top:26px; right:12px; width:34px; height:34px;
      border-radius:9999px; border:1px solid ${PALETTE.purple}; background:rgba(10,10,15,0.6);
      color:${PALETTE.text}; font-family:ui-monospace,monospace; cursor:pointer;
    `;
    pauseButton.addEventListener("click", () => this.pause());
    this.root.appendChild(pauseButton);

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
  };

  start(): void {
    if (this.state === "paused") {
      this.resume();
      return;
    }
    if (this.state === "running" || this.state === "countdown") return;
    this.engine.reset();
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
    this.lastFrameTime = performance.now();
    this.loop();
  }

  private resume() {
    if (this.state !== "paused") return;
    this.state = "running";
    this.lastFrameTime = performance.now();
    if (this.pauseOverlay) this.pauseOverlay.style.display = "none";
    this.loop();
  }

  pause(): void {
    if (this.state !== "running") return;
    this.state = "paused";
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (this.pauseOverlay) this.pauseOverlay.style.display = "flex";
  }

  private loop = () => {
    if (this.state !== "running") return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    const result = this.engine.update(dt, this.input);
    this.input.dashPressed = false;

    if (this.ctx) this.engine.draw(this.ctx);
    if (this.hud) {
      this.hud.textContent = `SCORE ${this.engine.score} · ${Math.ceil(this.engine.timeRemaining)}s`;
    }

    if (result === "finished") {
      this.endRun("finished");
      return;
    }
    if (result === "timeout") {
      this.endRun("timeout");
      return;
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private endRun(reason: "finished" | "timeout" | "quit") {
    this.state = "ended";
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (this.pauseOverlay) this.pauseOverlay.style.display = "none";

    const payload: GameOverPayload = {
      score: this.engine.score,
      reason,
      durationMs: Math.round(performance.now() - this.runStartTime),
    };
    this.dispatchEvent(new CustomEvent("gameOver", { detail: payload }));
  }

  destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (this.countdownTimeoutId !== null) clearTimeout(this.countdownTimeoutId);
    this.resizeObserver?.disconnect();
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.canvas?.removeEventListener("pointerdown", this.handlePointerDown);
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
  return new PixelNinjaDashModule();
}
