import { PALETTE, PLAYER, SCORE, TIMING, WORLD } from "./constants";

type ObstacleResult = "perfect" | "good" | "miss";

type Obstacle = {
  distance: number;
  resolved: boolean;
  result: ObstacleResult | null;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
};

export type EngineInput = {
  dashPressed: boolean;
};

export type EngineResult = "ok" | "finished" | "timeout";

export class DashEngine {
  width = 0;
  height = 0;
  groundY = 0;

  elapsed = 0;
  distance = 0;
  speed: number = WORLD.baseSpeed;

  stumbleRemainingMs = 0;
  dashFlashRemainingMs = 0;

  obstacles: Obstacle[] = [];
  particles: Particle[] = [];

  perfectCount = 0;
  goodCount = 0;
  missCount = 0;

  ended = false;
  finished = false;

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.groundY = height * 0.78;
  }

  get playerX() {
    return this.width * PLAYER.xFraction;
  }

  get progress() {
    return Math.min(1, this.distance / WORLD.trackLength);
  }

  get timeRemaining() {
    return Math.max(0, WORLD.raceTimeLimitSec - this.elapsed);
  }

  get score() {
    const base = Math.round(this.progress * 1000);
    const style = this.perfectCount * SCORE.perfectBonus + this.goodCount * SCORE.goodBonus;
    const finishBonus = this.finished
      ? Math.round(Math.max(0, WORLD.raceTimeLimitSec - this.elapsed) * SCORE.finishBonusPerSecRemaining)
      : 0;
    return base + style + finishBonus;
  }

  reset() {
    this.elapsed = 0;
    this.distance = 0;
    this.speed = WORLD.baseSpeed;
    this.stumbleRemainingMs = 0;
    this.dashFlashRemainingMs = 0;
    this.particles = [];
    this.perfectCount = 0;
    this.goodCount = 0;
    this.missCount = 0;
    this.ended = false;
    this.finished = false;

    // Fixed-length course — pre-generate the whole layout up front rather
    // than streaming spawns, since (unlike Neon Runner) the track has a
    // known end.
    this.obstacles = [];
    let d = WORLD.obstacleSpacingMin;
    while (d < WORLD.trackLength - 200) {
      this.obstacles.push({ distance: d, resolved: false, result: null });
      d += WORLD.obstacleSpacingMin + Math.random() * (WORLD.obstacleSpacingMax - WORLD.obstacleSpacingMin);
    }
  }

  private currentObstacle(): Obstacle | undefined {
    return this.obstacles.find((o) => !o.resolved);
  }

  private spawnParticles(count: number, color: string) {
    const y = this.groundY - PLAYER.height / 2;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: this.playerX,
        y,
        vx: -this.speed * 0.3 - Math.random() * 40,
        vy: (Math.random() - 0.5) * 140,
        life: 0.35 + Math.random() * 0.25,
        color,
      });
    }
  }

  private triggerStumble() {
    this.stumbleRemainingMs = WORLD.stumbleDurationMs;
    this.missCount++;
    this.spawnParticles(8, PALETTE.danger);
  }

  private pressDash() {
    this.dashFlashRemainingMs = 180;
    this.spawnParticles(4, PALETTE.cyan);

    const ob = this.currentObstacle();
    if (!ob) return;

    const effectiveSpeed = this.stumbleRemainingMs > 0 ? this.speed * WORLD.stumbleSpeedFactor : this.speed;
    const timeToArrivalSec = (ob.distance - this.distance) / Math.max(1, effectiveSpeed);
    const deltaMs = timeToArrivalSec * 1000;

    if (Math.abs(deltaMs) <= TIMING.perfectWindowMs) {
      ob.resolved = true;
      ob.result = "perfect";
      this.perfectCount++;
      this.spawnParticles(10, PALETTE.lime);
    } else if (Math.abs(deltaMs) <= TIMING.goodWindowMs) {
      ob.resolved = true;
      ob.result = "good";
      this.goodCount++;
      this.spawnParticles(6, PALETTE.purple);
    }
    // Outside the good window: no-op — pressing early/late with nothing
    // imminent doesn't penalize, only failing to clear an arriving gate does.
  }

  update(dtSec: number, input: EngineInput): EngineResult {
    if (this.ended) return this.finished ? "finished" : "ok";

    this.elapsed += dtSec;

    const effectiveSpeed = this.stumbleRemainingMs > 0 ? this.speed * WORLD.stumbleSpeedFactor : this.speed;
    if (this.stumbleRemainingMs > 0) this.stumbleRemainingMs -= dtSec * 1000;
    if (this.dashFlashRemainingMs > 0) this.dashFlashRemainingMs -= dtSec * 1000;

    this.distance += effectiveSpeed * dtSec;

    if (input.dashPressed) this.pressDash();

    // Resolve any obstacle the player has now passed without clearing.
    for (const ob of this.obstacles) {
      if (!ob.resolved && this.distance >= ob.distance) {
        ob.resolved = true;
        ob.result = "miss";
        this.triggerStumble();
      }
    }

    for (const p of this.particles) {
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vy += 400 * dtSec;
      p.life -= dtSec;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    if (this.distance >= WORLD.trackLength) {
      this.ended = true;
      this.finished = true;
      return "finished";
    }
    if (this.elapsed >= WORLD.raceTimeLimitSec) {
      this.ended = true;
      this.finished = false;
      return "timeout";
    }
    return "ok";
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { width, height, groundY } = this;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, width, height);

    // progress bar
    ctx.fillStyle = PALETTE.track;
    ctx.fillRect(16, 16, width - 32, 6);
    ctx.fillStyle = PALETTE.lime;
    ctx.shadowColor = PALETTE.lime;
    ctx.shadowBlur = 8;
    ctx.fillRect(16, 16, (width - 32) * this.progress, 6);
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.strokeStyle = PALETTE.purple;
    ctx.lineWidth = 2;
    ctx.shadowColor = PALETTE.purple;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // upcoming obstacle gate marker
    const ob = this.currentObstacle();
    const effectiveSpeed = this.stumbleRemainingMs > 0 ? this.speed * WORLD.stumbleSpeedFactor : this.speed;
    if (ob) {
      const gateX = this.playerX + (ob.distance - this.distance);
      if (gateX < width + 40) {
        ctx.fillStyle = PALETTE.magenta;
        ctx.shadowColor = PALETTE.magenta;
        ctx.shadowBlur = 14;
        ctx.fillRect(gateX - 4, groundY - 70, 8, 70);
        ctx.shadowBlur = 0;
      }

      const timeToArrivalSec = (ob.distance - this.distance) / Math.max(1, effectiveSpeed);
      const leadSec = TIMING.leadTimeMs / 1000;
      const goodSec = TIMING.goodWindowMs / 1000;
      if (timeToArrivalSec <= leadSec && timeToArrivalSec > -goodSec) {
        const t = Math.min(1, Math.max(0, 1 - timeToArrivalSec / leadSec));
        const maxR = 42;
        const minR = 14;
        const radius = maxR - (maxR - minR) * t;
        const inGoodWindow = Math.abs(timeToArrivalSec * 1000) <= TIMING.goodWindowMs;
        ctx.beginPath();
        ctx.arc(this.playerX, groundY - PLAYER.height / 2, radius, 0, Math.PI * 2);
        ctx.strokeStyle = inGoodWindow ? PALETTE.lime : PALETTE.cyan;
        ctx.shadowColor = inGoodWindow ? PALETTE.lime : PALETTE.cyan;
        ctx.shadowBlur = 10;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // player (pixel-ninja block silhouette)
    const stumbling = this.stumbleRemainingMs > 0;
    const dashing = this.dashFlashRemainingMs > 0;
    const px = this.playerX + (dashing ? 6 : 0);
    ctx.fillStyle = stumbling ? PALETTE.danger : PALETTE.cyan;
    ctx.shadowColor = stumbling ? PALETTE.danger : PALETTE.cyan;
    ctx.shadowBlur = 16;
    ctx.fillRect(px - PLAYER.width / 2, groundY - PLAYER.height, PLAYER.width, PLAYER.height);
    ctx.shadowBlur = 0;
  }
}
