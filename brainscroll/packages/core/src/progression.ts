import { MASTERY_BAND_SIZE, XP, type LevelType } from './constants';

/**
 * Pure progression math. The server is authoritative (see backend complete_level);
 * these functions exist so the app can *display* progress consistently and so
 * the rules are unit-tested in one place. The SQL mirrors them.
 */

export interface SkillProgressView {
  /** Visible skill level = highest canonical level cleared. Never derived from XP. */
  level: number;
  /** Mastery stars earned: one per completed band (100, 200, …). */
  stars: number;
  /** 1-based band the next level belongs to: 1 = levels 1–100, 2 = 101–200. */
  band: number;
  /** 1-based 10-level chapter within the band for the next level (1 = x01–x10). */
  chapter: number;
  /** Progress through the current band, 0–1. */
  bandProgress: number;
  /** The next canonical level number to play. */
  nextLevel: number;
}

export function skillProgressView(highestCleared: number): SkillProgressView {
  if (!Number.isInteger(highestCleared) || highestCleared < 0) throw new Error(`Invalid level: ${highestCleared}`);
  const nextLevel = highestCleared + 1;
  const stars = Math.floor(highestCleared / MASTERY_BAND_SIZE);
  const band = Math.floor((nextLevel - 1) / MASTERY_BAND_SIZE) + 1;
  const withinBand = (nextLevel - 1) % MASTERY_BAND_SIZE; // 0-based index of next level in its band
  return {
    level: highestCleared,
    stars,
    band,
    chapter: Math.floor(withinBand / 10) + 1,
    bandProgress: withinBand / MASTERY_BAND_SIZE,
    nextLevel,
  };
}

/**
 * The canonical level-type schedule. Content declares `type` explicitly and the
 * validator checks it against this, so the schedule lives in one place.
 */
export function levelTypeFor(levelNumber: number): LevelType {
  if (levelNumber % MASTERY_BAND_SIZE === 0) return 'mastery';
  if (levelNumber % MASTERY_BAND_SIZE === 50) return 'milestone';
  if (levelNumber % 10 === 0) return 'checkpoint';
  return 'regular';
}

export function isMasteryCheckpoint(levelNumber: number): boolean {
  return levelNumber > 0 && levelNumber % MASTERY_BAND_SIZE === 0;
}

/**
 * Overall Knowledge Level: sublinear in total cleared levels so breadth and depth
 * both move it, but it never outruns the skills underneath. Tunable — change here
 * and in SQL `knowledge_level()` together.
 */
export function knowledgeLevel(totalClearedLevels: number): number {
  if (totalClearedLevels < 0) throw new Error('negative');
  return 1 + Math.floor(Math.sqrt(totalClearedLevels * 4));
}

/** Subject rank rolls up the skill levels inside a subject on the same curve. */
export function subjectRank(skillLevelsInSubject: number[]): number {
  return knowledgeLevel(skillLevelsInSubject.reduce((a, b) => a + b, 0));
}

export interface LevelXpBreakdown {
  levelComplete: number;
  questionBonus: number;
  mastery: number;
  total: number;
}

/** XP for first-time completion of a level. Repeat completions award nothing. */
export function levelCompletionXp(levelNumber: number, correctAnswers: number): LevelXpBreakdown {
  const levelComplete = XP.LEVEL_COMPLETE;
  const questionBonus = Math.min(Math.max(correctAnswers, 0) * XP.QUESTION_CORRECT, XP.QUESTION_CORRECT_CAP_PER_LEVEL);
  const mastery = isMasteryCheckpoint(levelNumber) ? XP.MASTERY_CLEAR : 0;
  return { levelComplete, questionBonus, mastery, total: levelComplete + questionBonus + mastery };
}
