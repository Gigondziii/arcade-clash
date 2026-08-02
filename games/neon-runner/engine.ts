import { createSeededRandom, type RandomFn } from "@arcadeclash/shared";
import { OBSTACLE, PALETTE, PHYSICS, PLAYER, WORLD } from "./constants";

type ObstacleType = "hurdle" | "overhang";

type Obstacle = {
  type: ObstacleType;
  x: number;
  width: number;
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
  jumpPressed: boolean;
  jumpReleased: boolean;
  slidePressed: boolean;
};

export class RunnerEngine {
  width = 0;
  height = 0;
  groundY = 0;

  // Populated by reset() — always call reset() before using the engine.
  private gameplayRng!: RandomFn;
  private cosmeticRng!: RandomFn;

  elapsed = 0;
  distance = 0;
  speed: number = WORLD.initialSpeed;

  playerY = 0;
  velocityY = 0;
  isJumping = false;
  isSliding = false;
  slideRemainingMs = 0;

  obstacles: Obstacle[] = [];
  particles: Particle[] = [];
  spawnTimerMs = 0;

  ended = false;

  // TEMPORARY DIAGNOSTIC — session 21, Sky Dodge ship-not-rendering
  // investigation. Neon Runner baseline for comparison. Remove once the
  // Sky Dodge bug is confirmed fixed (see PROGRESS.md).
  private frameCount = 0;

  private readonly seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.groundY = height * 0.78;
  }

  get playerX() {
    return this.width * PLAYER.xFraction;
  }

  get playerHeight() {
    return this.isSliding ? PLAYER.heightSlide : PLAYER.heightStand;
  }

  get score() {
    return Math.floor(this.distance / 8);
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
    this.distance = 0;
    this.speed = WORLD.initialSpeed;
    this.playerY = 0;
    this.velocityY = 0;
    this.isJumping = false;
    this.isSliding = false;
    this.slideRemainingMs = 0;
    this.obstacles = [];
    this.particles = [];
    this.spawnTimerMs = WORLD.initialSpawnIntervalMs;
    this.ended = false;
  }

  private jump() {
    if (this.isJumping || this.isSliding) return;
    this.velocityY = PHYSICS.jumpVelocity;
    this.isJumping = true;
    this.spawnParticles(6, PALETTE.cyan);
  }

  private cutJump() {
    if (this.isJumping && this.velocityY < 0) {
      this.velocityY *= PHYSICS.jumpCutMultiplier;
    }
  }

  private slide() {
    if (this.isJumping || this.isSliding) return;
    this.isSliding = true;
    this.slideRemainingMs = PHYSICS.slideDurationMs;
    this.spawnParticles(6, PALETTE.lime);
  }

  private spawnParticles(count: number, color: string) {
    const originY = this.groundY - this.playerY - this.playerHeight / 2;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: this.playerX,
        y: originY,
        vx: -this.speed * 0.3 - this.cosmeticRng() * 40,
        vy: (this.cosmeticRng() - 0.5) * 120,
        life: 0.4 + this.cosmeticRng() * 0.3,
        color,
      });
    }
  }

  update(dtSec: number, input: EngineInput): "ok" | "collision" {
    if (this.ended) return "ok";

    this.elapsed += dtSec;
    this.speed = Math.min(WORLD.maxSpeed, WORLD.initialSpeed + this.elapsed * WORLD.speedRampPerSec);
    this.distance += this.speed * dtSec;

    if (input.jumpPressed) this.jump();
    if (input.jumpReleased) this.cutJump();
    if (input.slidePressed) this.slide();

    this.velocityY += PHYSICS.gravity * dtSec;
    this.playerY -= this.velocityY * dtSec;
    if (this.playerY <= 0) {
      this.playerY = 0;
      this.velocityY = 0;
      this.isJumping = false;
    }

    if (this.isSliding) {
      this.slideRemainingMs -= dtSec * 1000;
      if (this.slideRemainingMs <= 0) this.isSliding = false;
    }

    const spawnIntervalMs = Math.max(
      WORLD.minSpawnIntervalMs,
      WORLD.initialSpawnIntervalMs - this.elapsed * WORLD.spawnIntervalDecayPerSec,
    );
    this.spawnTimerMs -= dtSec * 1000;
    if (this.spawnTimerMs <= 0) {
      this.spawnTimerMs = spawnIntervalMs + this.gameplayRng() * 300;
      const type: ObstacleType = this.gameplayRng() < 0.5 ? "hurdle" : "overhang";
      this.obstacles.push({ type, x: this.width + 40, width: type === "hurdle" ? 36 : 46 });
    }

    const playerLeft = this.playerX - PLAYER.width / 2;
    const playerRight = this.playerX + PLAYER.width / 2;
    const playerBottom = this.groundY - this.playerY;
    const playerTop = playerBottom - this.playerHeight;

    for (const obstacle of this.obstacles) {
      obstacle.x -= this.speed * dtSec;

      const xOverlap = obstacle.x + obstacle.width > playerLeft && obstacle.x < playerRight;
      if (!xOverlap) continue;

      if (obstacle.type === "hurdle") {
        const hurdleTop = this.groundY - OBSTACLE.hurdleHeight;
        if (playerBottom > hurdleTop) {
          this.ended = true;
          return "collision";
        }
      } else {
        const gapTop = this.groundY - OBSTACLE.overhangGap;
        if (playerTop < gapTop) {
          this.ended = true;
          return "collision";
        }
      }
    }

    this.obstacles = this.obstacles.filter((o) => o.x + o.width > -20);

    for (const p of this.particles) {
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vy += 400 * dtSec;
      p.life -= dtSec;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    return "ok";
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { width, height, groundY } = this;

    if (this.frameCount < 5) {
      // TEMPORARY DIAGNOSTIC — session 21, Neon Runner baseline. Remove
      // once the Sky Dodge bug is confirmed fixed (see PROGRESS.md).
      console.log(
        `[neon-runner] DIAGNOSTIC draw#${this.frameCount}: engineWH=${width}x${height} groundY=${groundY} ` +
          `playerX=${this.playerX} playerY=${this.playerY}`,
      );
    }

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    const gridOffset = this.distance % 40;
    for (let gx = -gridOffset; gx < width + 40; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, groundY);
      ctx.lineTo(gx - width * 0.15, height);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.strokeStyle = PALETTE.purple;
    ctx.lineWidth = 2;
    ctx.shadowColor = PALETTE.purple;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    for (const o of this.obstacles) {
      if (o.type === "hurdle") {
        ctx.fillStyle = PALETTE.magenta;
        ctx.shadowColor = PALETTE.magenta;
        ctx.shadowBlur = 14;
        ctx.fillRect(o.x, groundY - OBSTACLE.hurdleHeight, o.width, OBSTACLE.hurdleHeight);
      } else {
        ctx.fillStyle = PALETTE.purple;
        ctx.shadowColor = PALETTE.purple;
        ctx.shadowBlur = 14;
        ctx.fillRect(o.x, 0, o.width, groundY - OBSTACLE.overhangGap);
      }
      ctx.shadowBlur = 0;
    }

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.6);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    const playerBottom = groundY - this.playerY;
    const playerH = this.playerHeight;
    if (this.frameCount < 5) {
      // TEMPORARY DIAGNOSTIC — session 21, Neon Runner baseline. Remove
      // once the Sky Dodge bug is confirmed fixed (see PROGRESS.md).
      console.log(
        `[neon-runner] DIAGNOSTIC draw#${this.frameCount} player rect: ` +
          `x=${this.playerX - PLAYER.width / 2} y=${playerBottom - playerH} w=${PLAYER.width} h=${playerH} ` +
          `canvasBounds=0,0,${width},${height}`,
      );
    }
    ctx.fillStyle = PALETTE.cyan;
    ctx.shadowColor = PALETTE.cyan;
    ctx.shadowBlur = 16;
    ctx.fillRect(this.playerX - PLAYER.width / 2, playerBottom - playerH, PLAYER.width, playerH);
    ctx.shadowBlur = 0;

    if (this.frameCount < 5) {
      // TEMPORARY DIAGNOSTIC — session 21, Neon Runner baseline.
      console.log(`[neon-runner] DIAGNOSTIC draw#${this.frameCount} bottom: fillStyleAfter=${ctx.fillStyle}`);
    }
    this.frameCount++;
  }
}
