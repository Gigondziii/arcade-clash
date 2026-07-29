import type { GameMode, GameModule, GameOverPayload } from "@arcadeclash/shared";
import { PALETTE } from "./constants";
import { RunnerEngine, type EngineInput } from "./engine";

const COUNTDOWN_STEPS = ["3", "2", "1", "GO!"];
const COUNTDOWN_STEP_MS = 700;

type ModuleState = "idle" | "countdown" | "running" | "paused" | "ended";

// Self-contained vanilla DOM + Canvas module — no framework dependency, so
// it can plug into any host (this phase's React shell or anything else).
// Countdown, live HUD, and the pause overlay live inside the module (part
// of its own in-game visual identity); the post-run results screen with
// navigation ("Play Again" / "Back to Home") is left to the host, since
// "back to lobby" is a host-navigation concern the module has no way to
// perform through this fixed init/start/pause/destroy interface.
export class NeonRunnerModule extends EventTarget implements GameModule {
  private root: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private hud: HTMLDivElement | null = null;
  private countdownEl: HTMLDivElement | null = null;
  private pauseOverlay: HTMLDivElement | null = null;

  private engine = new RunnerEngine();
  private resizeObserver: ResizeObserver | null = null;

  private state: ModuleState = "idle";
  private rafId: number | null = null;
  private lastFrameTime = 0;
  private runStartTime = 0;
  private countdownTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private input: EngineInput = { jumpPressed: false, jumpReleased: false, slidePressed: false };
  private jumpKeyDown = false;
  private pointerStartY = 0;
  private pointerActive = false;
  private pointerSlidTriggered = false;

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      if (!this.jumpKeyDown) {
        this.jumpKeyDown = true;
        this.input.jumpPressed = true;
      }
    } else if (e.code === "ArrowDown") {
      e.preventDefault();
      this.input.slidePressed = true;
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      this.jumpKeyDown = false;
      this.input.jumpReleased = true;
    }
  };

  // Touch/mouse: commit the gesture on release rather than on press, so a
  // downward swipe can still resolve to "slide" instead of firing a jump
  // immediately. Trade-off: unlike keyboard, touch taps can't hold for a
  // higher jump — always a short controlled hop. Documented simplification.
  private handlePointerDown = (e: PointerEvent) => {
    this.pointerStartY = e.clientY;
    this.pointerActive = true;
    this.pointerSlidTriggered = false;
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.pointerActive || this.pointerSlidTriggered) return;
    if (e.clientY - this.pointerStartY > 40) {
      this.pointerSlidTriggered = true;
      this.input.slidePressed = true;
    }
  };

  private handlePointerUp = () => {
    if (this.pointerActive && !this.pointerSlidTriggered) {
      this.input.jumpPressed = true;
      this.input.jumpReleased = true;
    }
    this.pointerActive = false;
  };

  private handleVisibilityChange = () => {
    if (document.hidden && this.state === "running") this.pause();
  };

  init(container: HTMLElement, mode: GameMode, _opponentSocket: WebSocket | null): void {
    if (mode === "match") {
      console.warn(
        "[neon-runner] 'match' mode requested but multiplayer isn't implemented during the games-only build phase — running as practice.",
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
      position:absolute; top:12px; left:16px; color:${PALETTE.cyan};
      font-family: ui-monospace, Consolas, monospace; font-size:20px; font-weight:700;
      text-shadow: 0 0 8px ${PALETTE.cyan}; letter-spacing: 1px; pointer-events:none;
    `;
    this.hud.textContent = "SCORE 0";
    this.root.appendChild(this.hud);

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
    this.input.jumpPressed = false;
    this.input.jumpReleased = false;
    this.input.slidePressed = false;

    if (this.ctx) this.engine.draw(this.ctx);
    if (this.hud) this.hud.textContent = `SCORE ${this.engine.score}`;

    if (result === "collision") {
      this.endRun("collision");
      return;
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private endRun(reason: "collision" | "quit") {
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
  return new NeonRunnerModule();
}
