import { LEARNING_STRUCTURE, type LearningStructure } from './constants';
import type { Card, Level } from './content-schema';

/**
 * How a level's cards break down: hook → learning → questions → recap.
 * Used by the validator (and later the admin editor) to check a level against
 * the structure its type calls for.
 */
export type CardRole = 'hook' | 'learning' | 'question' | 'recap';

export function cardRole(card: Card): CardRole {
  if (card.type === 'text' && card.role === 'hook') return 'hook';
  if (card.type === 'mcq' || card.type === 'recall') return 'question';
  if (card.type === 'checkpoint') return 'recap';
  return 'learning';
}

export function structureFor(level: Pick<Level, 'type'>): LearningStructure {
  return LEARNING_STRUCTURE[level.type];
}

export function learningCards(level: Pick<Level, 'cards'>): Card[] {
  return level.cards.filter((c) => cardRole(c) === 'learning');
}

const countWords = (s: string | undefined) => (s ? (s.match(/\S+/g) ?? []).length : 0);

/** Words of reading content on learning cards (the hook and questions excluded). */
export function learningWordCount(level: Pick<Level, 'cards'>): number {
  let n = 0;
  for (const c of learningCards(level)) {
    switch (c.type) {
      case 'text':
        n += countWords(c.headline) + countWords(c.body) + countWords(c.callout);
        break;
      case 'fact':
        n += countWords(c.fact) + countWords(c.context);
        break;
      case 'timeline':
        n += countWords(c.headline) + c.events.reduce((m, e) => m + countWords(e.when) + countWords(e.label), 0);
        break;
      case 'comparison':
        n += countWords(c.headline) + c.items.reduce((m, i) => m + countWords(i.label) + i.points.reduce((k, p) => k + countWords(p), 0), 0);
        break;
      case 'image':
        n += countWords(c.caption);
        break;
    }
  }
  return n;
}
