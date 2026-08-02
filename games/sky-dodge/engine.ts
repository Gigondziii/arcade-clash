import { createSeededRandom, type RandomFn } from "@arcadeclash/shared";
import { PALETTE, SHIELD, WORLD } from "./constants";

type HazardShape = "block" | "shard";

type Hazard = {
  x: number;
  y: number;
  size: number;
  shape: HazardShape;
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
  moveLeft: boolean;
  moveRight: boolean;
  dragTargetX: number | null;
  shieldPressed: boolean;
};

export class DodgeEngine {
  width = 0;
  height = 0;

  // Populated by reset() — always call reset() before using the engine.
  private gameplayRng!: RandomFn;
  private cosmeticRng!: RandomFn;

  elapsed = 0;
  fallSpeed: number = WORLD.baseFallSpeed;

  playerX = 0;

  shieldActive = false;
  shieldRemainingSec = 0;
  shieldCooldownRemaining = 0;

  hazards: Hazard[] = [];
  spawnTimerSec = 0;
  particles: Particle[] = [];

  ended = false;

  // TEMPORARY DIAGNOSTIC — session 21, ship-not-rendering investigation.
  // Remove once the bug is confirmed fixed (see PROGRESS.md).
  private frameCount = 0;

  private readonly seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.playerX = Math.min(Math.max(this.playerX, WORLD.shipWidth / 2), width - WORLD.shipWidth / 2);
  }

  get shipY() {
    return this.height - 60;
  }

  get score() {
    // Epsilon guards against float accumulation landing just under a whole
    // second (e.g. 2.999999999996 after 180 summed 1/60 steps) and under-
    // reporting the score by 1 right at second boundaries.
    return Math.floor(this.elapsed + 1e-6);
  }

  reset() {
    // Re-derived every call (not just once in the constructor) so reset()
    // is fully idempotent: calling it any number of times always restarts
    // this seed's sequence from the beginning, rather than relying on
    // callers to only ever reset an engine once.
    const rng = createSeededRandom(this.seed);
    this.gameplayRng = rng.stream("gameplay");
    this.cosmeticRng = rng.stream("cosmetic");

    this.elapsed = 0;
    this.fallSpeed = WORLD.baseFallSpeed;
    this.playerX = this.width / 2;
    this.shieldActive = false;
    this.shieldRemainingSec = 0;
    this.shieldCooldownRemaining = 0;
    this.hazards = [];
    this.spawnTimerSec = WORLD.baseSpawnIntervalSec;
    this.particles = [];
    this.ended = false;
  }

  private spawnParticles(count: number, color: string, x: number, y: number) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: (this.cosmeticRng() - 0.5) * 160,
        vy: (this.cosmeticRng() - 0.5) * 160,
        life: 0.3 + this.cosmeticRng() * 0.25,
        color,
      });
    }
  }

  private spawnHazard() {
    const size = WORLD.hazardMinSize + this.gameplayRng() * (WORLD.hazardMaxSize - WORLD.hazardMinSize);
    const shape: HazardShape = this.gameplayRng() < 0.5 ? "block" : "shard";
    const x = size / 2 + this.gameplayRng() * (this.width - size);
    this.hazards.push({ x, y: -size, size, shape });
  }

  update(dtSec: number, input: EngineInput): "ok" | "collision" {
    if (this.ended) return "ok";

    this.elapsed += dtSec;
    this.fallSpeed = Math.min(WORLD.maxFallSpeed, WORLD.baseFallSpeed + this.elapsed * WORLD.fallSpeedRampPerSec);

    const prevX = this.playerX;
    if (input.dragTargetX !== null) {
      const rate = Math.min(1, WORLD.dragLerpRatePerSec * dtSec);
      this.playerX += (input.dragTargetX - this.playerX) * rate;
    } else {
      if (input.moveLeft) this.playerX -= WORLD.shipMoveSpeed * dtSec;
      if (input.moveRight) this.playerX += WORLD.shipMoveSpeed * dtSec;
    }
    this.playerX = Math.min(Math.max(this.playerX, WORLD.shipWidth / 2), this.width - WORLD.shipWidth / 2);
    if (Math.abs(this.playerX - prevX) > 0.5 && this.cosmeticRng() < 0.5) {
      this.spawnParticles(1, PALETTE.cyan, this.playerX, this.shipY + WORLD.shipHeight / 2);
    }

    if (this.shieldActive) {
      this.shieldRemainingSec -= dtSec;
      if (this.shieldRemainingSec <= 0) this.shieldActive = false;
    }
    if (this.shieldCooldownRemaining > 0) this.shieldCooldownRemaining -= dtSec;
    if (input.shieldPressed && !this.shieldActive && this.shieldCooldownRemaining <= 0) {
      this.shieldActive = true;
      this.shieldRemainingSec = SHIELD.durationSec;
      this.shieldCooldownRemaining = SHIELD.cooldownSec;
      this.spawnParticles(14, PALETTE.lime, this.playerX, this.shipY);
    }

    this.spawnTimerSec -= dtSec;
    if (this.spawnTimerSec <= 0) {
      const intervalSec = Math.max(
        WORLD.minSpawnIntervalSec,
        WORLD.baseSpawnIntervalSec - this.elapsed * WORLD.spawnIntervalRampPerSec,
      );
      this.spawnTimerSec = intervalSec + this.gameplayRng() * 0.15;
      this.spawnHazard();
    }

    const shipTop = this.shipY - WORLD.shipHeight / 2;
    const shipBottom = this.shipY + WORLD.shipHeight / 2;
    const shipLeft = this.playerX - WORLD.shipWidth / 2;
    const shipRight = this.playerX + WORLD.shipWidth / 2;

    for (const h of this.hazards) {
      h.y += this.fallSpeed * dtSec;

      if (!this.shieldActive) {
        const hLeft = h.x - h.size / 2;
        const hRight = h.x + h.size / 2;
        const hTop = h.y - h.size / 2;
        const hBottom = h.y + h.size / 2;
        const overlap = hRight > shipLeft && hLeft < shipRight && hBottom > shipTop && hTop < shipBottom;
        if (overlap) {
          this.ended = true;
          return "collision";
        }
      }
    }

    this.hazards = this.hazards.filter((h) => h.y - h.size / 2 < this.height + 20);

    for (const p of this.particles) {
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.life -= dtSec;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    return "ok";
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { width, height } = this;

    if (this.frameCount < 5) {
      // TEMPORARY DIAGNOSTIC — session 21, ship-not-rendering investigation.
      // Remove once the bug is confirmed fixed (see PROGRESS.md).
      console.log(
        `[sky-dodge] DIAGNOSTIC draw#${this.frameCount}: engineWH=${width}x${height} ` +
          `playerX=${this.playerX} shipY=${this.shipY} shieldActive=${this.shieldActive}`,
      );
    }

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, width, height);

    for (const h of this.hazards) {
      ctx.fillStyle = h.shape === "block" ? PALETTE.magenta : PALETTE.purple;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 12;
      if (h.shape === "block") {
        ctx.fillRect(h.x - h.size / 2, h.y - h.size / 2, h.size, h.size);
      } else {
        ctx.beginPath();
        ctx.moveTo(h.x, h.y - h.size / 2);
        ctx.lineTo(h.x + h.size / 2, h.y + h.size / 2);
        ctx.lineTo(h.x - h.size / 2, h.y + h.size / 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    if (this.shieldActive) {
      ctx.beginPath();
      ctx.arc(this.playerX, this.shipY, WORLD.shipWidth * 0.9, 0, Math.PI * 2);
      ctx.strokeStyle = PALETTE.lime;
      ctx.shadowColor = PALETTE.lime;
      ctx.shadowBlur = 16;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    if (this.frameCount < 5) {
      // TEMPORARY DIAGNOSTIC — session 21, ship-not-rendering investigation.
      // Remove once the bug is confirmed fixed (see PROGRESS.md).
      console.log(
        `[sky-dodge] DIAGNOSTIC draw#${this.frameCount} ship path: ` +
          `apex=(${this.playerX},${this.shipY - WORLD.shipHeight / 2}) ` +
          `baseR=(${this.playerX + WORLD.shipWidth / 2},${this.shipY + WORLD.shipHeight / 2}) ` +
          `baseL=(${this.playerX - WORLD.shipWidth / 2},${this.shipY + WORLD.shipHeight / 2}) ` +
          `canvasBounds=0,0,${width},${height}`,
      );
    }
    ctx.beginPath();
    ctx.moveTo(this.playerX, this.shipY - WORLD.shipHeight / 2);
    ctx.lineTo(this.playerX + WORLD.shipWidth / 2, this.shipY + WORLD.shipHeight / 2);
    ctx.lineTo(this.playerX - WORLD.shipWidth / 2, this.shipY + WORLD.shipHeight / 2);
    ctx.closePath();
    ctx.fillStyle = PALETTE.cyan;
    ctx.shadowColor = PALETTE.cyan;
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;

    if (this.frameCount < 5) {
      // TEMPORARY DIAGNOSTIC — session 21, ship-not-rendering investigation.
      console.log(
        `[sky-dodge] DIAGNOSTIC draw#${this.frameCount} bottom: fillStyleAfter=${ctx.fillStyle} alpha=${ctx.globalAlpha}`,
      );
    }
    this.frameCount++;
  }
}
