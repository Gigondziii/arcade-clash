import { createSeededRandom, type RandomFn } from "@fugluck/shared";
import {
  CELL_HEIGHT,
  CELL_WIDTH,
  CYBER_COLORS,
  GRID_COLS,
  GRID_ROWS,
  HOPPER_HEIGHT,
  HOPPER_WIDTH,
  VIRTUAL_HEIGHT,
  VIRTUAL_WIDTH,
} from "./constants";

export type CyberHopperInput = {
  hopUp?: boolean;
  hopDown?: boolean;
  hopLeft?: boolean;
  hopRight?: boolean;
};

export type Obstacle = {
  id: number;
  laneIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  direction: 1 | -1; // 1 = right, -1 = left
  color: string;
  active: boolean;
};

export type LaneConfig = {
  index: number;
  y: number;
  direction: 1 | -1;
  speed: number;
  color: string;
  spawnIntervalTicks: number;
  lastSpawnTick: number;
};

export class CyberHopperEngine {
  public score = 0;
  public tickCount = 0;
  public gameOver = false;
  public roundsCompleted = 0;

  public gridX = 10;
  public gridY = 0;
  public maxGridY = 0;

  public obstacles: Obstacle[] = [];
  public lanes: LaneConfig[] = [];

  private rng!: RandomFn;
  private nextObstacleId = 1;
  private width = VIRTUAL_WIDTH;
  private height = VIRTUAL_HEIGHT;

  public readonly seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.reset();
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  public reset(): void {
    this.score = 0;
    this.tickCount = 0;
    this.gameOver = false;
    this.roundsCompleted = 0;
    this.gridX = Math.floor(GRID_COLS / 2);
    this.gridY = 0;
    this.maxGridY = 0;
    this.obstacles = [];
    this.nextObstacleId = 1;
    this.rng = createSeededRandom(this.seed).stream("gameplay");

    // Initialize 9 hazard lanes (index 1 to 9)
    this.lanes = [];
    for (let laneIdx = 1; laneIdx < GRID_ROWS - 1; laneIdx++) {
      const direction: 1 | -1 = laneIdx % 2 === 0 ? 1 : -1;
      const baseSpeed = 140 + (laneIdx % 3) * 60 + Math.floor(this.rng() * 40);
      const color = direction === 1 ? CYBER_COLORS.carRight : CYBER_COLORS.carLeft;
      const spawnIntervalTicks = 45 + Math.floor(this.rng() * 35);

      this.lanes.push({
        index: laneIdx,
        y: VIRTUAL_HEIGHT - (laneIdx + 0.5) * CELL_HEIGHT,
        direction,
        speed: baseSpeed,
        color,
        spawnIntervalTicks,
        lastSpawnTick: -spawnIntervalTicks,
      });
    }
  }

  public update(dtSec: number, input: CyberHopperInput): "collision" | null {
    if (this.gameOver) return "collision";

    this.tickCount++;

    // 1. Process Hop Movement
    if (input.hopUp) {
      if (this.gridY < GRID_ROWS - 1) {
        this.gridY++;
        if (this.gridY > this.maxGridY) {
          this.maxGridY = this.gridY;
          this.score += 10;
        }
      }
    }
    if (input.hopDown) {
      if (this.gridY > 0) {
        this.gridY--;
      }
    }
    if (input.hopLeft) {
      if (this.gridX > 0) {
        this.gridX--;
      }
    }
    if (input.hopRight) {
      if (this.gridX < GRID_COLS - 1) {
        this.gridX++;
      }
    }

    // 2. Goal Check (Reached Top Row)
    if (this.gridY >= GRID_ROWS - 1) {
      this.roundsCompleted++;
      this.score += 150; // Goal bonus
      this.gridY = 0; // Return to bottom safe zone for next round
      this.maxGridY = 0;
    }

    // 3. Spawn Obstacles in Lanes (with universal dynamic difficulty scaling)
    const difficultyScale = 1.0 + Math.pow(this.tickCount / 5400, 1.4) * 1.5;

    for (const lane of this.lanes) {
      const effectiveInterval = Math.max(15, Math.floor(lane.spawnIntervalTicks / Math.sqrt(difficultyScale)));
      if (this.tickCount - lane.lastSpawnTick >= effectiveInterval) {
        lane.lastSpawnTick = this.tickCount;
        const obstacleWidth = 70 + Math.floor(this.rng() * 40);
        const spawnX = lane.direction === 1 ? -obstacleWidth : VIRTUAL_WIDTH + obstacleWidth;
        const obsSpeed = lane.speed * (1 + this.roundsCompleted * 0.1) * difficultyScale;

        this.obstacles.push({
          id: this.nextObstacleId++,
          laneIndex: lane.index,
          x: spawnX,
          y: lane.y,
          width: obstacleWidth,
          height: CELL_HEIGHT * 0.7,
          speed: obsSpeed,
          direction: lane.direction,
          color: lane.color,
          active: true,
        });
      }
    }

    // 4. Update Obstacles Position
    for (const obs of this.obstacles) {
      if (!obs.active) continue;
      obs.x += obs.direction * obs.speed * dtSec;

      if (obs.direction === 1 && obs.x > VIRTUAL_WIDTH + 100) {
        obs.active = false;
      } else if (obs.direction === -1 && obs.x < -100) {
        obs.active = false;
      }
    }

    // 5. Player Collision Check
    const playerX = (this.gridX + 0.5) * CELL_WIDTH;
    const playerY = VIRTUAL_HEIGHT - (this.gridY + 0.5) * CELL_HEIGHT;
    const playerRadius = HOPPER_WIDTH * 0.4;

    for (const obs of this.obstacles) {
      if (!obs.active) continue;
      // Check collision if player is in the same row as the obstacle
      if (Math.abs(playerY - obs.y) < CELL_HEIGHT * 0.4) {
        const obsLeft = obs.x - obs.width / 2;
        const obsRight = obs.x + obs.width / 2;
        if (playerX + playerRadius > obsLeft && playerX - playerRadius < obsRight) {
          this.gameOver = true;
          return "collision";
        }
      }
    }

    // Cleanup inactive obstacles
    if (this.tickCount % 120 === 0) {
      this.obstacles = this.obstacles.filter((o) => o.active);
    }

    return null;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const scaleX = this.width / VIRTUAL_WIDTH;
    const scaleY = this.height / VIRTUAL_HEIGHT;

    ctx.save();
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

    // 1. Background
    ctx.fillStyle = CYBER_COLORS.bg;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // 2. Safe / Goal Zones
    // Bottom Safe Zone (row 0)
    ctx.fillStyle = CYBER_COLORS.safeZone;
    ctx.fillRect(0, VIRTUAL_HEIGHT - CELL_HEIGHT, VIRTUAL_WIDTH, CELL_HEIGHT);

    // Top Goal Zone (row 10)
    ctx.fillStyle = CYBER_COLORS.finishZone;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, CELL_HEIGHT);

    // 3. Grid Lines
    ctx.strokeStyle = CYBER_COLORS.gridLine;
    ctx.lineWidth = 1;
    for (let c = 0; c <= GRID_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL_WIDTH, 0);
      ctx.lineTo(c * CELL_WIDTH, VIRTUAL_HEIGHT);
      ctx.stroke();
    }
    for (let r = 0; r <= GRID_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL_HEIGHT);
      ctx.lineTo(VIRTUAL_WIDTH, r * CELL_HEIGHT);
      ctx.stroke();
    }

    // 4. Render Obstacles (Hovercars / Plasma)
    for (const obs of this.obstacles) {
      if (!obs.active) continue;
      ctx.fillStyle = obs.color;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;

      // Hovercar rectangle
      const rectX = obs.x - obs.width / 2;
      const rectY = obs.y - obs.height / 2;
      ctx.beginPath();
      ctx.rect(rectX, rectY, obs.width, obs.height);
      ctx.fill();
      ctx.stroke();

      // Headlight glow
      ctx.fillStyle = CYBER_COLORS.playerSecondary;
      const lightX = obs.direction === 1 ? obs.x + obs.width / 2 - 6 : obs.x - obs.width / 2 + 2;
      ctx.fillRect(lightX, obs.y - 4, 4, 8);
    }

    // 5. Render Cyber Hopper (Player Frog/Runner)
    if (!this.gameOver) {
      const playerX = (this.gridX + 0.5) * CELL_WIDTH;
      const playerY = VIRTUAL_HEIGHT - (this.gridY + 0.5) * CELL_HEIGHT;
      const halfW = HOPPER_WIDTH / 2;
      const halfH = HOPPER_HEIGHT / 2;

      // Outer Cyber Glow
      ctx.fillStyle = CYBER_COLORS.playerGlow;
      ctx.beginPath();
      ctx.arc(playerX, playerY, halfW + 6, 0, Math.PI * 2);
      ctx.fill();

      // Body (Neon Cyber Green Diamond/Frog Shape)
      ctx.fillStyle = CYBER_COLORS.playerPrimary;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.moveTo(playerX, playerY - halfH);
      ctx.lineTo(playerX + halfW, playerY);
      ctx.lineTo(playerX, playerY + halfH);
      ctx.lineTo(playerX - halfW, playerY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cyber Visor Eye
      ctx.fillStyle = CYBER_COLORS.playerSecondary;
      ctx.fillRect(playerX - 10, playerY - 8, 20, 5);
    }

    // 6. HUD Text
    ctx.fillStyle = CYBER_COLORS.textPrimary;
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(`SCORE: ${this.score}  |  ROUNDS: ${this.roundsCompleted}`, 30, 45);

    ctx.restore();
  }
}
