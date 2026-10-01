import { skillScenery } from '@brainscroll/core';
import { CARD_ART } from './cardArt';
import { levelMetas } from './index';

/** Card pictures by level: `astronomy:4` → its cards' images (card ids are `card.<skill slug>.<NNN>.cN`). */
const cardArtByLevel = new Map<string, string[]>();
for (const [cardId, art] of Object.entries(CARD_ART)) {
  const [, slug, num] = cardId.split('.');
  const key = `${slug}:${Number(num)}`;
  cardArtByLevel.set(key, [...(cardArtByLevel.get(key) ?? []), art]);
}

const bySkill = new Map<string, Map<number, string>>();

/** The picture beside level `n` on the skill map, if it has one (core scenery.ts: no repeats within three chapters). */
export function sceneryArt(skillId: string, n: number): string | undefined {
  let map = bySkill.get(skillId);
  if (!map) {
    const slug = skillId.split('.').at(-1)!;
    map = skillScenery(levelMetas(skillId), (m) => cardArtByLevel.get(`${slug}:${m}`) ?? []);
    bySkill.set(skillId, map);
  }
  return map.get(n);
}
