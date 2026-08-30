import { createSeededRandom, type RandomFn } from "@fugluck/shared";
import { METEOR, PALETTE, SHIP, WORLD } from "./constants";

export type EngineInput = {
  moveLeft: boolean;
  moveRight: boolean;
  boostPressed: boolean;
};

type MeteorEntity = {
  id: number;
  x: number;
  y: number;
  vy: number;
  radius: number;
  color: string;
};

type ParticleEntity = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
};

export class SkyDodgeEngine {
  width = WORLD.viewportWidth;
  height = WORLD.viewportHeight;

  private gameplayRng!: RandomFn;
  private cosmeticRng!: RandomFn;

  elapsed = 0;
  distance = 0;
  score = 0;

  playerX = WORLD.viewportWidth / 2;
  playerY = WORLD.viewportHeight - 70;
  isBoosting = false;
  boostRemainingMs = 0;

  meteors: MeteorEntity[] = [];
  particles: ParticleEntity[] = [];
  spawnTimerMs = 0;
  nextMeteorId = 1;

  ended = false;

  private readonly seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.reset();
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.playerY = height - 70;
  }

  reset() {
    const rng = createSeededRandom(this.seed);
    this.gameplayRng = rng.stream("gameplay");
    this.cosmeticRng = rng.stream("cosmetic");

    this.elapsed = 0;
    this.distance = 0;
    this.score = 0;
    this.playerX = this.width / 2;
    this.playerY = this.height - 70;
    this.isBoosting = false;
    this.boostRemainingMs = 0;
    this.meteors = [];
    this.particles = [];
    this.spawnTimerMs = 0;
    this.nextMeteorId = 1;
    this.ended = false;
  }

  update(dtSec: number, input: EngineInput): "ok" | "collision" {
    if (this.ended) return "collision";

    const dtMs = dtSec * 1000;
    this.elapsed += dtSec;
    this.distance += dtSec * 100;

    // Handle boost input
    if (input.boostPressed && this.boostRemainingMs <= 0) {
      this.isBoosting = true;
      this.boostRemainingMs = SHIP.boostDurationMs;
    }

    if (this.boostRemainingMs > 0) {
      this.boostRemainingMs -= dtMs;
      if (this.boostRemainingMs <= 0) {
        this.isBoosting = false;
        this.boostRemainingMs = 0;
      }
    }

    // Ship movement
    const currentSpeed = this.isBoosting ? SHIP.boostSpeed : SHIP.normalSpeed;
    let dx = 0;
    if (input.moveLeft) dx -= currentSpeed * dtSec;
    if (input.moveRight) dx += currentSpeed * dtSec;

    this.playerX += dx;
    const halfW = SHIP.width / 2;
    if (this.playerX < halfW) this.playerX = halfW;
    if (this.playerX > this.width - halfW) this.playerX = this.width - halfW;

    // Accumulate score (survival points + dodge bonus)
    this.score = Math.floor(this.elapsed * 100 + this.distance);

    // Meteor Spawning
    this.spawnTimerMs += dtMs;
    if (this.spawnTimerMs >= METEOR.spawnIntervalMs) {
      this.spawnTimerMs -= METEOR.spawnIntervalMs;
      const radius = METEOR.minRadius + this.gameplayRng() * (METEOR.maxRadius - METEOR.minRadius);
      const spawnX = radius + this.gameplayRng() * (this.width - radius * 2);
      const speed = METEOR.minSpeed + this.gameplayRng() * (METEOR.maxSpeed - METEOR.minSpeed);
      const color = this.gameplayRng() > 0.5 ? PALETTE.magenta : PALETTE.yellow;

      this.meteors.push({
        id: this.nextMeteorId++,
        x: spawnX,
        y: -radius,
        vy: speed,
        radius,
        color,
      });
    }

    // Update meteors & check collision
    for (const m of this.meteors) {
      m.y += m.vy * dtSec;

      // Circle to AABB collision check
      const shipLeft = this.playerX - SHIP.width / 2;
      const shipRight = this.playerX + SHIP.width / 2;
      const shipTop = this.playerY - SHIP.height / 2;
      const shipBottom = this.playerY + SHIP.height / 2;

      const closestX = Math.max(shipLeft, Math.min(m.x, shipRight));
      const closestY = Math.max(shipTop, Math.min(m.y, shipBottom));
      const distX = m.x - closestX;
      const distY = m.y - closestY;
      const distanceSq = distX * distX + distY * distY;

      if (distanceSq < m.radius * m.radius) {
        this.ended = true;

        // Spawn explosion particles
        for (let i = 0; i < 20; i++) {
          const angle = this.cosmeticRng() * Math.PI * 2;
          const pSpeed = 100 + this.cosmeticRng() * 250;
          this.particles.push({
            x: this.playerX,
            y: this.playerY,
            vx: Math.cos(angle) * pSpeed,
            vy: Math.sin(angle) * pSpeed,
            life: 0.4 + this.cosmeticRng() * 0.4,
            color: PALETTE.danger,
          });
        }

        return "collision";
      }
    }

    // Filter out off-screen meteors
    this.meteors = this.meteors.filter((m) => m.y - m.radius < this.height + 40);

    // Engine thruster particles
    if (this.cosmeticRng() > 0.4) {
      this.particles.push({
        x: this.playerX + (this.cosmeticRng() - 0.5) * 12,
        y: this.playerY + SHIP.height / 2,
        vx: (this.cosmeticRng() - 0.5) * 40,
        vy: 120 + this.cosmeticRng() * 100,
        life: 0.3,
        color: this.isBoosting ? PALETTE.yellow : PALETTE.cyan,
      });
    }

    // Update particles
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

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, width, height);

    // Starfield / Grid background lines
    ctx.strokeStyle = "rgba(155, 81, 224, 0.15)";
    ctx.lineWidth = 1;
    const gridOffset = (this.elapsed * 120) % 40;
    for (let gy = gridOffset; gy < height; gy += 40) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(width, gy);
      ctx.stroke();
    }

    // Draw meteors
    for (const m of this.meteors) {
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      ctx.fillStyle = m.color;
      ctx.shadowColor = m.color;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Draw particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.4);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // Draw player ship (triangle / neon fighter silhouette)
    if (!this.ended) {
      const topY = this.playerY - SHIP.height / 2;
      const bottomY = this.playerY + SHIP.height / 2;
      const leftX = this.playerX - SHIP.width / 2;
      const rightX = this.playerX + SHIP.width / 2;

      ctx.beginPath();
      ctx.moveTo(this.playerX, topY);
      ctx.lineTo(rightX, bottomY);
      ctx.lineTo(this.playerX, bottomY - 8);
      ctx.lineTo(leftX, bottomY);
      ctx.closePath();

      ctx.fillStyle = this.isBoosting ? PALETTE.yellow : PALETTE.cyan;
      ctx.shadowColor = this.isBoosting ? PALETTE.yellow : PALETTE.cyan;
      ctx.shadowBlur = 16;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}
