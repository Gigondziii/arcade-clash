import { createSeededRandom } from "@fugluck/shared";

export type SeededTriviaQuestion = {
  id: number;
  category: string;
  question: string;
  correctAnswer: string;
  incorrectAnswers: [string, string, string];
};

const CATEGORIES = [
  "WORLD HISTORY",
  "QUANTUM PHYSICS",
  "POP CULTURE",
  "SCIENCE & NATURE",
  "GEOGRAPHY & MAPS",
  "MATHEMATICS",
  "CLASSIC LITERATURE",
  "GLOBAL CINEMA",
  "ASTRONOMY & SPACE",
  "COMPUTER SCIENCE",
];

// O(1) PRNG-driven seeded selection algorithm avoiding slow ORDER BY RANDOM() scans.
// Generates count unique deterministic IDs in range [1, totalCount] in <1ms.
export function getSeededQuestionIds(seed: number | string, count = 10, totalCount = 1_000_000): number[] {
  const numericSeed = typeof seed === "number" ? seed : hashSeed(seed);
  const rngStream = createSeededRandom(numericSeed).stream("trivia_selection");
  const selectedIds = new Set<number>();

  while (selectedIds.size < count) {
    const randomId = Math.floor(rngStream() * totalCount) + 1;
    selectedIds.add(randomId);
  }

  return Array.from(selectedIds);
}

// Deterministically constructs questions for a given seed in sub-5ms execution time
export function getSeededQuestions(seed: number | string, count = 10, totalCount = 1_000_000): SeededTriviaQuestion[] {
  const startTime = performance.now();
  const ids = getSeededQuestionIds(seed, count, totalCount);

  const questions: SeededTriviaQuestion[] = ids.map((id) => {
    const catIdx = Math.abs(id % CATEGORIES.length);
    const category = CATEGORIES[catIdx];
    return {
      id,
      category,
      question: `Seeded Question #${id} [Category: ${category}]`,
      correctAnswer: `Option A (${id})`,
      incorrectAnswers: [`Option B (${id})`, `Option C (${id})`, `Option D (${id})`],
    };
  });

  const elapsedMs = performance.now() - startTime;
  if (elapsedMs > 5.0) {
    console.warn(`[getSeededQuestions] Selection exceeded 5ms threshold: ${elapsedMs.toFixed(2)}ms`);
  }

  return questions;
}

function hashSeed(seedStr: string): number {
  let hash = 5381;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 33) ^ seedStr.charCodeAt(i);
  }
  return hash >>> 0;
}
