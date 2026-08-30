import { createSeededRandom, VIRTUAL_VIEWPORT } from "@fugluck/shared";
import { getMultiplier, TF_RULES } from "./constants";
import { TF_QUESTION_POOL, type TFQuestion } from "./questions";

export type TFSprintInput = {
  selectTrue?: boolean;
  selectFalse?: boolean;
};

export class TFSprintEngine {
  public width = VIRTUAL_VIEWPORT.width;
  public height = VIRTUAL_VIEWPORT.height;
  public score = 0;
  public tickCount = 0;
  public gameOver = false;

  public correctCount = 0;
  public streak = 0;
  public maxStreak = 0;
  public totalResponseTicks = 0;

  public currentQuestionIndex = 0;
  public questionTicksRemaining = TF_RULES.ticksPerQuestion;
  public activeQuestions: TFQuestion[] = [];
  public selectedAnswer: boolean | null = null;
  public answerFeedbackTimer = 0; // Ticks to display green/red feedback before advancing
  public lastAnswerCorrect = false;

  private seed: number;
  private rng!: () => number;

  constructor(seed: number) {
    this.seed = seed;
    this.reset();
  }

  public resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  public reset() {
    this.score = 0;
    this.tickCount = 0;
    this.gameOver = false;
    this.correctCount = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.totalResponseTicks = 0;
    this.currentQuestionIndex = 0;
    this.questionTicksRemaining = TF_RULES.ticksPerQuestion;
    this.selectedAnswer = null;
    this.answerFeedbackTimer = 0;
    this.lastAnswerCorrect = false;

    const seededRng = createSeededRandom(this.seed);
    this.rng = seededRng.stream("gameplay");

    // Deterministically shuffle question pool
    const poolCopy = [...TF_QUESTION_POOL];
    for (let i = poolCopy.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [poolCopy[i], poolCopy[j]] = [poolCopy[j], poolCopy[i]];
    }

    this.activeQuestions = poolCopy.slice(0, TF_RULES.totalQuestions);
  }

  public currentQuestion(): TFQuestion | undefined {
    return this.activeQuestions[this.currentQuestionIndex];
  }

  public update(_dtSec: number, input: TFSprintInput): "ended" | null {
    if (this.gameOver) return "ended";

    this.tickCount++;

    // 1. If currently displaying feedback pause
    if (this.answerFeedbackTimer > 0) {
      this.answerFeedbackTimer--;
      if (this.answerFeedbackTimer <= 0) {
        this.advanceToNextQuestion();
      }
      return this.gameOver ? "ended" : null;
    }

    // 2. Process Timer
    this.questionTicksRemaining--;

    // 3. Process Input
    const playerChoice = input.selectTrue ? true : input.selectFalse ? false : null;

    if (playerChoice !== null && this.selectedAnswer === null) {
      const q = this.currentQuestion();
      if (q) {
        this.selectedAnswer = playerChoice;
        this.lastAnswerCorrect = playerChoice === q.isTrue;
        const ticksTaken = TF_RULES.ticksPerQuestion - this.questionTicksRemaining;

        if (this.lastAnswerCorrect) {
          this.streak++;
          if (this.streak > this.maxStreak) this.maxStreak = this.streak;
          const mult = getMultiplier(this.streak);
          const speedBonus = Math.floor((this.questionTicksRemaining / TF_RULES.ticksPerQuestion) * 1000);
          const pointsEarned = (TF_RULES.baseQuestionScore + speedBonus) * mult;

          this.score += pointsEarned;
          this.correctCount++;
          this.totalResponseTicks += ticksTaken;
        } else {
          this.streak = 0; // Reset streak on wrong answer
        }

        this.answerFeedbackTimer = 25; // ~0.4s feedback display pause
      }
    }

    // 4. Check Question Timeout
    if (this.questionTicksRemaining <= 0) {
      this.selectedAnswer = false; // Timed out
      this.lastAnswerCorrect = false;
      this.streak = 0; // Reset streak on timeout
      this.answerFeedbackTimer = 25;
    }

    return this.gameOver ? "ended" : null;
  }

  private advanceToNextQuestion() {
    const nextIdx = this.currentQuestionIndex + 1;
    if (nextIdx >= this.activeQuestions.length) {
      this.gameOver = true;
      return;
    }

    this.currentQuestionIndex = nextIdx;
    this.selectedAnswer = null;
    this.answerFeedbackTimer = 0;
    this.questionTicksRemaining = TF_RULES.ticksPerQuestion;
  }
}
