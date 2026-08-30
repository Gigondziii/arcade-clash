import { createSeededRandom, VIRTUAL_VIEWPORT } from "@fugluck/shared";
import { TRIVIA_RULES } from "./constants";
import { QUESTION_POOL, type ActiveQuestion, type RawQuestion } from "./questions";

export type SpeedTriviaInput = {
  selectOption?: number; // 0, 1, 2, or 3
};

export class SpeedTriviaEngine {
  public width = VIRTUAL_VIEWPORT.width;
  public height = VIRTUAL_VIEWPORT.height;
  public score = 0;
  public tickCount = 0;
  public gameOver = false;

  public correctCount = 0;
  public totalResponseTicks = 0;
  public isSuddenDeath = false;
  public isSuddenDeathRequested = false;

  public currentQuestionIndex = 0;
  public questionTicksRemaining = TRIVIA_RULES.ticksPerQuestion;
  public activeQuestions: ActiveQuestion[] = [];
  public selectedAnswer: number | null = null;
  public answerFeedbackTimer = 0; // Ticks to display green/red before advancing
  public lastAnswerCorrect = false;

  private seed: number;
  private rng!: () => number;
  private rawPoolCopy: RawQuestion[] = [];

  constructor(seed: number) {
    this.seed = seed;
    this.reset();
  }

  public resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  public enableSuddenDeath() {
    this.isSuddenDeathRequested = true;
    if (this.currentQuestionIndex >= TRIVIA_RULES.totalQuestions - 1) {
      this.isSuddenDeath = true;
    }
  }

  public reset() {
    this.score = 0;
    this.tickCount = 0;
    this.gameOver = false;
    this.correctCount = 0;
    this.totalResponseTicks = 0;
    this.isSuddenDeath = false;
    this.isSuddenDeathRequested = false;
    this.currentQuestionIndex = 0;
    this.questionTicksRemaining = TRIVIA_RULES.ticksPerQuestion;
    this.selectedAnswer = null;
    this.answerFeedbackTimer = 0;
    this.lastAnswerCorrect = false;

    const seededRng = createSeededRandom(this.seed);
    this.rng = seededRng.stream("gameplay");

    // Deterministically shuffle question pool
    this.rawPoolCopy = [...QUESTION_POOL];
    for (let i = this.rawPoolCopy.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [this.rawPoolCopy[i], this.rawPoolCopy[j]] = [this.rawPoolCopy[j], this.rawPoolCopy[i]];
    }

    this.activeQuestions = this.rawPoolCopy.map((raw) => this.formatQuestion(raw));
  }

  private formatQuestion(raw: RawQuestion): ActiveQuestion {
    const allOptions = [raw.correctAnswer, ...raw.incorrectAnswers];
    for (let i = allOptions.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
    }
    const correctIndex = allOptions.indexOf(raw.correctAnswer);
    return {
      id: raw.id,
      category: raw.category,
      question: raw.question,
      options: allOptions as [string, string, string, string],
      correctIndex,
    };
  }

  public currentQuestion(): ActiveQuestion | undefined {
    if (this.currentQuestionIndex >= this.activeQuestions.length) {
      // Deterministically generate next question for Sudden Death if pool exhausted
      const rawIndex = this.currentQuestionIndex % QUESTION_POOL.length;
      const nextQuestion = this.formatQuestion(QUESTION_POOL[rawIndex]);
      this.activeQuestions.push(nextQuestion);
    }
    return this.activeQuestions[this.currentQuestionIndex];
  }

  public update(_dtSec: number, input: SpeedTriviaInput): "ended" | null {
    if (this.gameOver) return "ended";

    this.tickCount++;

    // 1. If currently displaying answer feedback delay
    if (this.answerFeedbackTimer > 0) {
      this.answerFeedbackTimer--;
      if (this.answerFeedbackTimer <= 0) {
        this.advanceToNextQuestion();
      }
      return this.gameOver ? "ended" : null;
    }

    // 2. Process Timer
    this.questionTicksRemaining--;

    // 3. Process Player Answer Input
    if (input.selectOption !== undefined && input.selectOption >= 0 && input.selectOption <= 3) {
      const q = this.currentQuestion();
      if (q && this.selectedAnswer === null) {
        this.selectedAnswer = input.selectOption;
        this.lastAnswerCorrect = input.selectOption === q.correctIndex;
        const ticksTaken = TRIVIA_RULES.ticksPerQuestion - this.questionTicksRemaining;

        if (this.lastAnswerCorrect) {
          const pointsEarned = 1000 + Math.floor((this.questionTicksRemaining / TRIVIA_RULES.ticksPerQuestion) * 1000);
          this.score += pointsEarned;
          this.correctCount++;
          this.totalResponseTicks += ticksTaken;
        }

        this.answerFeedbackTimer = 30; // 0.5s pause to show result
      }
    }

    // 4. Check Question Timeout
    if (this.questionTicksRemaining <= 0) {
      this.selectedAnswer = -1; // Timed out
      this.lastAnswerCorrect = false;
      this.answerFeedbackTimer = 30;
    }

    return this.gameOver ? "ended" : null;
  }

  private advanceToNextQuestion() {
    const nextIdx = this.currentQuestionIndex + 1;

    if (nextIdx >= TRIVIA_RULES.totalQuestions && !this.isSuddenDeathRequested && !this.isSuddenDeath) {
      this.gameOver = true;
      return;
    }

    if (nextIdx >= TRIVIA_RULES.totalQuestions) {
      this.isSuddenDeath = true;
    }

    this.currentQuestionIndex = nextIdx;
    this.selectedAnswer = null;
    this.answerFeedbackTimer = 0;
    this.questionTicksRemaining = TRIVIA_RULES.ticksPerQuestion;

    if (this.currentQuestionIndex >= this.activeQuestions.length) {
      const rawIndex = this.currentQuestionIndex % QUESTION_POOL.length;
      const nextQuestion = this.formatQuestion(QUESTION_POOL[rawIndex]);
      this.activeQuestions.push(nextQuestion);
    }
  }
}
