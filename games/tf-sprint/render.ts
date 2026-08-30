import { getMultiplier, PALETTE, TF_RULES } from "./constants";
import type { TFSprintEngine } from "./engine";

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fillColor: string,
  strokeColor?: string,
  lineWidth = 1,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fillColor;
  ctx.fill();
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function renderTFSprint(ctx: CanvasRenderingContext2D, engine: TFSprintEngine) {
  const w = engine.width;
  const h = engine.height;

  // Background Fill
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, w, h);

  // 1. Header Bar (y = 0..70)
  ctx.fillStyle = "#0c1220";
  ctx.fillRect(0, 0, w, 70);
  ctx.strokeStyle = PALETTE.cardBorder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 70);
  ctx.lineTo(w, 70);
  ctx.stroke();

  // Title Left
  ctx.fillStyle = PALETTE.text;
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("TRUE / FALSE SPRINT", 50, 45);

  // Multiplier Streak Badge Center
  const mult = getMultiplier(engine.streak);
  const badgeColor = mult >= 4 ? "#ef4444" : mult >= 3 ? "#f59e0b" : mult >= 2 ? "#10b981" : PALETTE.cardBorder;
  const badgeText = mult > 1 ? `🔥 ${mult}X STREAK` : `STREAK: ${engine.streak}`;
  drawRoundedRect(ctx, w / 2 - 100, 23, 200, 34, 17, "#1e1b4b", badgeColor, 2);
  ctx.fillStyle = mult > 1 ? "#fbbf24" : PALETTE.textMuted;
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(badgeText, w / 2, 45);

  // Score Right
  ctx.fillStyle = "#00f3ff";
  ctx.font = "bold 26px monospace";
  ctx.textAlign = "right";
  ctx.fillText(`SCORE: ${engine.score}`, w - 50, 45);

  const q = engine.currentQuestion();

  // 2. Question Progress Counter & Timer Line (y = 85..120)
  const qNum = Math.min(engine.currentQuestionIndex + 1, TF_RULES.totalQuestions);
  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = "bold 15px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`STATEMENT ${qNum} OF ${TF_RULES.totalQuestions}`, 50, 100);

  if (q) {
    ctx.textAlign = "right";
    ctx.fillText(`CATEGORY: ${q.category}`, w - 50, 100);
  }

  // Timer Bar Track & Fill
  const timerRatio = Math.max(0, engine.questionTicksRemaining / TF_RULES.ticksPerQuestion);
  const timerW = 1180;
  drawRoundedRect(ctx, 50, 112, timerW, 10, 5, "#1e293b");
  const fillW = timerW * timerRatio;
  const timerColor = timerRatio < 0.25 ? "#ef4444" : timerRatio < 0.5 ? "#f59e0b" : "#3b82f6";
  if (fillW > 0) {
    drawRoundedRect(ctx, 50, 112, fillW, 10, 5, timerColor);
  }

  // 3. Statement Prompt Box (y = 135..295, height = 160)
  drawRoundedRect(ctx, 50, 135, 1180, 160, 16, PALETTE.cardBg, PALETTE.cardBorder, 2);

  if (q) {
    ctx.fillStyle = PALETTE.text;
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";

    // Text Wrap logic for prompt statement
    const words = q.statement.split(" ");
    let line = "";
    const lines: string[] = [];
    const maxLineW = 1100;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxLineW && i > 0) {
        lines.push(line.trim());
        line = words[i] + " ";
      } else {
        line = testLine;
      }
    }
    lines.push(line.trim());

    const startY = 215 - ((lines.length - 1) * 30) / 2;
    lines.forEach((l, idx) => {
      ctx.fillText(l, w / 2, startY + idx * 30);
    });
  }

  // 4. Large Option Cards: [TRUE] Left, [FALSE] Right (y = 325..640, height = 315)
  const cardW = 560;
  const cardH = 310;
  const cardY = 325;
  const leftX = 50;
  const rightX = 670;

  // True Card State Color
  let trueFill: string = PALETTE.cardBg;
  let trueBorder = "#10b981";
  let falseFill: string = PALETTE.cardBg;
  let falseBorder = "#ef4444";

  if (engine.selectedAnswer !== null && q) {
    if (engine.selectedAnswer === true) {
      trueFill = engine.lastAnswerCorrect ? PALETTE.trueBg : "#450a0a";
      trueBorder = engine.lastAnswerCorrect ? "#10b981" : "#ef4444";
    }
    if (engine.selectedAnswer === false) {
      falseFill = engine.lastAnswerCorrect ? PALETTE.trueBg : "#450a0a";
      falseBorder = engine.lastAnswerCorrect ? "#10b981" : "#ef4444";
    }
    if (q.isTrue) {
      trueBorder = "#10b981";
    } else {
      falseBorder = "#10b981";
    }
  }

  // Draw True Card
  drawRoundedRect(ctx, leftX, cardY, cardW, cardH, 20, trueFill, trueBorder, 3);
  ctx.fillStyle = "#10b981";
  ctx.font = "black 56px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("TRUE", leftX + cardW / 2, cardY + 140);
  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = "bold 16px monospace";
  ctx.fillText("PRESS [ T ]  OR  [ ← ]", leftX + cardW / 2, cardY + 220);

  // Draw False Card
  drawRoundedRect(ctx, rightX, cardY, cardW, cardH, 20, falseFill, falseBorder, 3);
  ctx.fillStyle = "#ef4444";
  ctx.font = "black 56px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("FALSE", rightX + cardW / 2, cardY + 140);
  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = "bold 16px monospace";
  ctx.fillText("PRESS [ F ]  OR  [ → ]", rightX + cardW / 2, cardY + 220);

  // 5. Game Over Screen Overlay
  if (engine.gameOver) {
    ctx.fillStyle = "rgba(9, 13, 22, 0.85)";
    ctx.fillRect(0, 0, w, h);

    const dialogW = 500;
    const dialogH = 340;
    drawRoundedRect(ctx, w / 2 - dialogW / 2, h / 2 - dialogH / 2, dialogW, dialogH, 24, "#0f172a", "#38bdf8", 2);

    ctx.fillStyle = PALETTE.text;
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SPRINT COMPLETE!", w / 2, h / 2 - 100);

    ctx.fillStyle = "#00f3ff";
    ctx.font = "bold 42px monospace";
    ctx.fillText(`${engine.score} PTS`, w / 2, h / 2 - 30);

    ctx.fillStyle = PALETTE.textMuted;
    ctx.font = "18px sans-serif";
    ctx.fillText(`Correct Answers: ${engine.correctCount} / ${TF_RULES.totalQuestions}`, w / 2, h / 2 + 25);
    ctx.fillText(`Best Multiplier Streak: ${engine.maxStreak}x`, w / 2, h / 2 + 55);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 14px monospace";
    ctx.fillText("PRESS [ SPACE ] TO PLAY AGAIN", w / 2, h / 2 + 115);
  }
}
