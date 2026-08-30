import { VIRTUAL_VIEWPORT } from "@fugluck/shared";
import { PALETTE, TRIVIA_RULES } from "./constants";
import type { SpeedTriviaEngine } from "./engine";

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill?: string,
  stroke?: string,
  lineWidth = 2
) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    try {
      ctx.roundRect(x, y, w, h, r);
    } catch {
      ctx.rect(x, y, w, h);
    }
  } else {
    ctx.rect(x, y, w, h);
  }
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function renderSpeedTrivia(ctx: CanvasRenderingContext2D, engine: SpeedTriviaEngine) {
  const w = VIRTUAL_VIEWPORT.width; // 1280
  const h = VIRTUAL_VIEWPORT.height; // 720

  // 1. Background
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, w, h);

  // 2. Draw Top Bar (Header Bar y = 0 to 70)
  ctx.fillStyle = PALETTE.cardBg;
  ctx.fillRect(0, 0, w, 70);
  ctx.strokeStyle = "#8b5cf6";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 70);
  ctx.lineTo(w, 70);
  ctx.stroke();

  // Title Left (y = 45)
  ctx.fillStyle = PALETTE.text;
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("SPEED TRIVIA CLASH", 50, 45);

  // Score Right (y = 45)
  ctx.fillStyle = "#00f3ff";
  ctx.font = "bold 26px monospace";
  ctx.textAlign = "right";
  ctx.fillText(`SCORE: ${engine.score}`, w - 50, 45);

  const q = engine.currentQuestion();

  // Category Badge Center Top Header (y = 23 to 57)
  if (q) {
    let catText = q.category.toUpperCase();
    if (!catText.startsWith("CATEGORY:")) {
      catText = `CATEGORY: ${catText}`;
    }
    if (catText.length > 30) {
      catText = catText.substring(0, 27) + "...";
    }

    const badgeW = Math.min(320, Math.max(220, catText.length * 10 + 20));
    drawRoundedRect(ctx, w / 2 - badgeW / 2, 23, badgeW, 34, 17, "#1e1b4b", "#00f3ff", 2);
    ctx.fillStyle = PALETTE.text;
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(catText, w / 2, 45);
  }

  // 2.5 Sudden Death Alert Banner
  if (engine.isSuddenDeath) {
    ctx.fillStyle = "#7f1d1d";
    ctx.fillRect(0, 70, w, 24);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 70, w, 24);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("⚡ SUDDEN DEATH — FAST ANSWER WINS! ⚡", w / 2, 87);
  }

  if (!q || engine.gameOver) {
    ctx.fillStyle = PALETTE.text;
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(engine.isSuddenDeath ? "SUDDEN DEATH COMPLETE" : "GAME OVER", w / 2, h / 2 - 40);
    ctx.font = "bold 30px monospace";
    ctx.fillStyle = "#00f3ff";
    ctx.fillText(`FINAL SCORE: ${engine.score}`, w / 2, h / 2 + 10);
    ctx.font = "bold 20px monospace";
    ctx.fillStyle = PALETTE.secondary;
    ctx.fillText(`CORRECT: ${engine.correctCount} | SPEED TIME: ${(engine.totalResponseTicks / 60).toFixed(2)}s`, w / 2, h / 2 + 50);
    return;
  }

  // 3. Question Progress & Timer Line (y = 95 to 120)
  const qNumText = engine.isSuddenDeath
    ? `SUDDEN DEATH — QUESTION ${engine.currentQuestionIndex + 1}`
    : `QUESTION ${engine.currentQuestionIndex + 1} / ${TRIVIA_RULES.totalQuestions}`;
  ctx.font = "bold 18px monospace";
  ctx.fillStyle = engine.isSuddenDeath ? PALETTE.danger : PALETTE.secondary;
  ctx.textAlign = "left";
  ctx.fillText(qNumText, 50, 108);

  // Timer Bar
  const timerFraction = Math.max(0, engine.questionTicksRemaining / TRIVIA_RULES.ticksPerQuestion);
  const barWidth = w - 100; // 1180px
  drawRoundedRect(ctx, 50, 118, barWidth, 10, 5, PALETTE.cardBg);

  const fillWidth = barWidth * timerFraction;
  if (fillWidth > 0) {
    const timerColor = timerFraction > 0.3 ? PALETTE.secondary : PALETTE.danger;
    drawRoundedRect(ctx, 50, 118, fillWidth, 10, 5, timerColor);
  }

  // 4. Question Prompt Box (y = 135, height = 160px)
  drawRoundedRect(ctx, 50, 135, w - 100, 160, 12, PALETTE.cardBg, engine.isSuddenDeath ? "#ef4444" : "#8b5cf6", 2);

  ctx.fillStyle = PALETTE.text;
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  wrapText(ctx, q.question, w / 2, 195, w - 180, 34);

  // 5. Option Cards (2x2 Grid)
  const cardW = 570;
  const cardH = 150;
  const positions = [
    { x: 50, y: 325 },
    { x: 660, y: 325 },
    { x: 50, y: 500 },
    { x: 660, y: 500 },
  ];

  const keys = ["A", "B", "C", "D"];

  for (let i = 0; i < 4; i++) {
    const pos = positions[i];
    let fillStyle: string = PALETTE.cardBg;
    let borderStyle: string = "#252e50";

    if (engine.selectedAnswer !== null) {
      if (i === q.correctIndex) {
        fillStyle = "#064e3b";
        borderStyle = PALETTE.success;
      } else if (i === engine.selectedAnswer) {
        fillStyle = "#7f1d1d";
        borderStyle = PALETTE.danger;
      }
    } else {
      borderStyle = "#252e50";
    }

    drawRoundedRect(ctx, pos.x, pos.y, cardW, cardH, 12, fillStyle, borderStyle, 2);

    // Key badge [A], [B], [C], [D]
    ctx.fillStyle = PALETTE.secondary;
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`[${keys[i]}]`, pos.x + 25, pos.y + 40);

    // Option Text
    ctx.fillStyle = PALETTE.text;
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    wrapText(ctx, q.options[i], pos.x + cardW / 2, pos.y + 75, cardW - 60, 30);
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (!ctx.measureText) {
    ctx.fillText(text, x, y);
    return;
  }
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n] + " ";
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
}

