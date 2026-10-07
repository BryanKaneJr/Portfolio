import { describe, expect, it } from 'vitest';
import {
  BRAINPOWER,
  CHEST_LOOT,
  CHEST_ROLLS,
  COSMETICS,
  RewardError,
  activeBoost,
  brainpowerBalance,
  chestKey,
  chestLevel,
  chestWeights,
  emptyProgress,
  levelBonusPercent,
  lockerView,
  masteryTitleId,
  masteryTitleSkill,
  openChest,
  rollChest,
  setEquipped,
  setLook,
  startBoost,
  type ChestRoll,
  type ProgressState,
} from '../src';

// Mirrors backend/tests/rewards.test.sql.
const NOW = new Date('2026-10-05T15:00:00Z');
const SKILL = 'skill.science.testing';
const fresh = (): ProgressState => emptyProgress(new Date('2026-09-01T00:00:00Z'), 'UTC');
const cleared = (n: number, s = fresh()): ProgressState => ({ ...s, skills: { ...s.skills, [SKILL]: { highestCleared: n, stars: Math.floor(n / 100), totalXp: n * 100 } } });
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof RewardError) return e.code;
    throw e;
  }
  return undefined;
};
const sum = (w: Record<ChestRoll, number>) => CHEST_ROLLS.reduce((n, r) => n + w[r], 0);
/** A roll landing on `r` (the middle of its slice). */
const rollFor = (w: Record<ChestRoll, number>, r: ChestRoll) => {
  let before = 0;
  for (const x of CHEST_ROLLS) {
    if (x === r) return (before + w[r] / 2) / sum(w);
    before += w[x];
  }
  throw new Error(r);
};

describe('the cosmetic catalog', () => {
  it('has unique ids: two name styles and titles per tier, and glows weighted to the top', () => {
    expect(new Set(COSMETICS.map((c) => c.id)).size).toBe(COSMETICS.length);
    const glows = { common: 2, rare: 2, epic: 4, legendary: 3 };
    for (const tier of ['common', 'rare', 'epic', 'legendary'] as const) {
      for (const kind of ['name_style', 'title'] as const) expect(COSMETICS.filter((c) => c.kind === kind && c.tier === tier)).toHaveLength(2);
      expect(COSMETICS.filter((c) => c.kind === 'ring' && c.tier === tier)).toHaveLength(glows[tier]);
    }
  });

  it('names Mastery titles after their skill', () => {
    expect(masteryTitleId(SKILL)).toBe('title.mastery.science.testing');
    expect(masteryTitleSkill('title.mastery.science.testing')).toBe(SKILL);
    expect(masteryTitleSkill('title.sage')).toBeUndefined();
  });
});

describe('chest weights', () => {
  it('total 100 by default', () => expect(sum(CHEST_LOOT)).toBe(100));

  it('keeps every roll for a high-level learner with room for Brainpower', () => {
    expect(chestWeights({ owned: new Set(), knowledgeLevel: 60, unlimited: false, brainpower: BRAINPOWER.MAX - 2 })).toEqual(CHEST_LOOT);
  });

  it('moves out-of-reach tiers, full Brainpower and Unlimited to the 15-minute boost', () => {
    const low = chestWeights({ owned: new Set(), knowledgeLevel: 1, unlimited: false, brainpower: BRAINPOWER.MAX - 1 });
    expect(low).toMatchObject({ boost_15: 25 + 25 + 8 + 5 + 2, brainpower: 0, common: 15, rare: 0, epic: 0, legendary: 0 });
    expect(sum(low)).toBe(100);
    expect(chestWeights({ owned: new Set(), knowledgeLevel: 15, unlimited: true, brainpower: 0 })).toMatchObject({ brainpower: 0, rare: 8, epic: 0 });
  });

  it('drops a tier once every item in it is owned', () => {
    const commons = new Set(COSMETICS.filter((c) => c.tier === 'common').map((c) => c.id));
    expect(chestWeights({ owned: commons, knowledgeLevel: 1, unlimited: false, brainpower: 0 }).common).toBe(0);
  });
});

describe('rolling a chest', () => {
  const w = CHEST_LOOT;
  it('walks the table in order', () => {
    expect(rollChest(w, new Set(), 0, 0)).toEqual({ kind: 'boost', minutes: 15 });
    expect(rollChest(w, new Set(), rollFor(w, 'boost_30'), 0)).toEqual({ kind: 'boost', minutes: 30 });
    expect(rollChest(w, new Set(), rollFor(w, 'boost_60'), 0)).toEqual({ kind: 'boost', minutes: 60 });
    expect(rollChest(w, new Set(), rollFor(w, 'brainpower'), 0)).toEqual({ kind: 'brainpower', amount: 2 });
    expect(rollChest(w, new Set(), 0.9999, 0.9999)).toEqual({ kind: 'cosmetic', itemId: 'title.polymath', tier: 'legendary' });
  });

  it('never gives a cosmetic already owned', () => {
    const owned = new Set(['name.plum', 'name.silver', 'ring.plum', 'ring.silver', 'title.bookworm']);
    for (let i = 0; i < 10; i++) expect(rollChest(w, owned, rollFor(w, 'common'), i / 10)).toEqual({ kind: 'cosmetic', itemId: 'title.curious_mind', tier: 'common' });
  });
});

describe('opening a chest', () => {
  const seq = (...xs: number[]) => () => xs.shift() ?? 0;

  it('opens once, after the chapter\'s 5th level', () => {
    expect(chestLevel(1)).toBe(5);
    expect(chestLevel(3)).toBe(25);
    expect(code(() => openChest(cleared(4), { skillId: SKILL, chapter: 1, now: NOW, boostId: 'b1' }))).toBe('CHEST_LOCKED');
    expect(code(() => openChest(cleared(5), { skillId: SKILL, chapter: 0, now: NOW, boostId: 'b1' }))).toBe('CHEST_NOT_FOUND');
    const { state, reward } = openChest(cleared(5), { skillId: SKILL, chapter: 1, now: NOW, boostId: 'b1', random: seq(0, 0) });
    expect(reward).toEqual({ kind: 'boost', minutes: 15 });
    expect(state.chests?.[chestKey(SKILL, 1)]).toEqual({ openedAt: NOW.toISOString(), reward });
    expect(state.boosts).toEqual([{ id: 'b1', minutes: 15, source: chestKey(SKILL, 1) }]);
    expect(code(() => openChest(state, { skillId: SKILL, chapter: 1, now: NOW, boostId: 'b2' }))).toBe('CHEST_OPENED');
    expect(code(() => openChest(state, { skillId: SKILL, chapter: 2, now: NOW, boostId: 'b2' }))).toBe('CHEST_LOCKED');
  });

  it('pays +2 Brainpower when both fit', () => {
    const s = { ...cleared(5), brainpower: { balance: 3, asOf: '2026-10-05' } };
    const w = chestWeights({ owned: new Set(), knowledgeLevel: 1, unlimited: false, brainpower: 3 });
    const { state, reward } = openChest(s, { skillId: SKILL, chapter: 1, now: NOW, boostId: 'b1', random: seq(rollFor(w, 'brainpower'), 0) });
    expect(reward).toEqual({ kind: 'brainpower', amount: 2 });
    expect(brainpowerBalance(state, NOW)).toBe(5);
    expect(Object.values(state.brainpowerAwards ?? {}).map((a) => a.kind)).toEqual(['chest', 'chest']);
  });

  it('adds a cosmetic to the Locker', () => {
    const w = chestWeights({ owned: new Set(), knowledgeLevel: 1, unlimited: false, brainpower: 5 });
    const { state, reward } = openChest(cleared(5), { skillId: SKILL, chapter: 1, now: NOW, boostId: 'b1', random: seq(rollFor(w, 'common'), 0) });
    expect(reward).toEqual({ kind: 'cosmetic', itemId: 'name.plum', tier: 'common' });
    expect(lockerView(state, NOW).cosmetics).toEqual(['name.plum']);
  });
});

describe('XP boosts', () => {
  const won = (): ProgressState => ({ ...cleared(5), boosts: [{ id: 'b1', minutes: 15, source: 'x' }, { id: 'b2', minutes: 60, source: 'y' }] });
  const later = (min: number) => new Date(NOW.getTime() + min * 60_000);

  it('runs for its minutes, one at a time, once', () => {
    const s = startBoost(won(), 'b1', NOW);
    expect(activeBoost(s, later(14))?.id).toBe('b1');
    expect(activeBoost(s, later(15))).toBeUndefined();
    expect(code(() => startBoost(s, 'b2', later(5)))).toBe('BOOST_ACTIVE');
    expect(code(() => startBoost(s, 'b1', later(20)))).toBe('BOOST_USED');
    expect(code(() => startBoost(s, 'nope', later(20)))).toBe('BOOST_NOT_FOUND');
    expect(activeBoost(startBoost(s, 'b2', later(20)), later(79))?.id).toBe('b2');
  });

  it('pays 2x, never past 2x with the perfect streak', () => {
    expect(levelBonusPercent(30, false)).toBe(30);
    expect(levelBonusPercent(30, true)).toBe(100);
    expect(levelBonusPercent(100, true)).toBe(100);
    expect(levelBonusPercent(0, false)).toBe(0);
  });
});

describe('the look', () => {
  const owning = (): ProgressState => ({
    ...cleared(100),
    cosmetics: ['ring.gold', 'name.ember', 'title.sage'],
    trophies: [{ trophyId: 't', name: 'Q', kind: 'quest', questId: 'quest.q1', earnedAt: NOW.toISOString() }],
  });

  it('wears only owned items of the right kind', () => {
    const s = setLook(owning(), { ring: 'ring.gold', nameStyle: 'name.ember', title: 'title.sage' });
    expect(lockerView(s, NOW).look).toEqual({ ring: 'ring.gold', nameStyle: 'name.ember', title: 'title.sage' });
    expect(code(() => setLook(owning(), { ring: 'ring.galaxy', nameStyle: null, title: null }))).toBe('NOT_OWNED');
    expect(code(() => setLook(owning(), { ring: 'name.ember', nameStyle: null, title: null }))).toBe('NOT_OWNED');
  });

  it('wears a Mastery title once the skill has its star', () => {
    expect(setLook(owning(), { ring: null, nameStyle: null, title: masteryTitleId(SKILL) }).look?.title).toBe(masteryTitleId(SKILL));
    expect(code(() => setLook(cleared(99), { ring: null, nameStyle: null, title: masteryTitleId(SKILL) }))).toBe('NOT_OWNED');
  });

  it('shows one title: a look title and a quest title take each other off', () => {
    const quest = setEquipped(owning(), { titleQuestId: 'quest.q1', emblemQuestId: null });
    const looked = setLook(quest, { ring: null, nameStyle: null, title: 'title.sage' });
    expect(looked.equipped?.titleQuestId).toBeNull();
    expect(setEquipped(looked, { titleQuestId: 'quest.q1', emblemQuestId: null }).look?.title).toBeNull();
  });
});
