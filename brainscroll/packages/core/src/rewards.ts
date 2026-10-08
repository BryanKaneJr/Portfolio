import { BRAINPOWER, XP } from './constants';
import { brainpowerBalance, grantBrainpower } from './brainpower';
import { knowledgeLevel } from './progression';
import type { ProgressState } from './completion';

/**
 * Map chests, XP boosts and cosmetics (owner, 2026-10-05; docs/specs/REWARDS.md).
 * Mirrors SQL `open_chest` / `start_boost` / `set_look` (migration
 * 20261106000000_rewards.sql); keep rewards.test.ts in step with rewards.test.sql,
 * and COSMETICS with the migration's `cosmetic_items` seed (rewards-sync test).
 *
 * One chest per chapter, after its 5th level. Opening it rolls the loot table
 * once: a timed XP boost (kept until the learner starts it), +2 Brainpower, or a
 * cosmetic the learner doesn't own yet from a tier their Knowledge Level reaches.
 * A roll that can't pay out (Brainpower without room for both, Unlimited, a
 * tier out of reach or collected) becomes the 15-minute boost, so a chest is
 * never empty and never a duplicate.
 */

export type CosmeticKind = 'ring' | 'name_style' | 'title';
export type CosmeticTier = 'common' | 'rare' | 'epic' | 'legendary';
export const COSMETIC_TIERS: readonly CosmeticTier[] = ['common', 'rare', 'epic', 'legendary'];

/** The lowest Knowledge Level at which a tier can come out of a chest. */
export const TIER_MIN_KNOWLEDGE_LEVEL: Record<CosmeticTier, number> = { common: 1, rare: 15, epic: 30, legendary: 50 };

export interface CosmeticItem {
  id: string;
  kind: CosmeticKind;
  tier: CosmeticTier;
  name: string;
}

/** Everything a chest can hold. Their looks are drawn in the app (components/cosmetics.tsx). */
export const COSMETICS: readonly CosmeticItem[] = [
  { id: 'ring.plum', kind: 'ring', tier: 'common', name: 'Fireflies' },
  { id: 'ring.silver', kind: 'ring', tier: 'common', name: 'Ripple' },
  { id: 'ring.ocean', kind: 'ring', tier: 'rare', name: 'Bubbles' },
  { id: 'ring.gold', kind: 'ring', tier: 'rare', name: 'Sunburst' },
  { id: 'ring.flame', kind: 'ring', tier: 'epic', name: 'Embers' },
  { id: 'ring.aurora', kind: 'ring', tier: 'epic', name: 'Aurora' },
  { id: 'ring.galaxy', kind: 'ring', tier: 'legendary', name: 'Galaxy' },
  { id: 'ring.prism', kind: 'ring', tier: 'legendary', name: 'Code Rain' },
  { id: 'ring.equations', kind: 'ring', tier: 'epic', name: 'Equations' },
  { id: 'ring.constellation', kind: 'ring', tier: 'epic', name: 'Constellation' },
  { id: 'ring.neural', kind: 'ring', tier: 'legendary', name: 'Neural Net' },
  { id: 'ring.music', kind: 'ring', tier: 'legendary', name: 'Sheet Music' },
  { id: 'name.plum', kind: 'name_style', tier: 'common', name: 'Plum' },
  { id: 'name.silver', kind: 'name_style', tier: 'common', name: 'Silver' },
  { id: 'name.ocean', kind: 'name_style', tier: 'rare', name: 'Ocean' },
  { id: 'name.gold', kind: 'name_style', tier: 'rare', name: 'Gold' },
  { id: 'name.ember', kind: 'name_style', tier: 'epic', name: 'Ember' },
  { id: 'name.aurora', kind: 'name_style', tier: 'epic', name: 'Aurora' },
  { id: 'name.shimmer', kind: 'name_style', tier: 'legendary', name: 'Shimmer' },
  { id: 'name.holo', kind: 'name_style', tier: 'legendary', name: 'Holo' },
  { id: 'title.curious_mind', kind: 'title', tier: 'common', name: 'Curious Mind' },
  { id: 'title.bookworm', kind: 'title', tier: 'common', name: 'Bookworm' },
  { id: 'title.scholar', kind: 'title', tier: 'rare', name: 'Scholar' },
  { id: 'title.night_owl', kind: 'title', tier: 'rare', name: 'Night Owl' },
  { id: 'title.sage', kind: 'title', tier: 'epic', name: 'Sage' },
  { id: 'title.lucky_star', kind: 'title', tier: 'epic', name: 'Lucky Star' },
  { id: 'title.polymath', kind: 'title', tier: 'legendary', name: 'Polymath' },
  { id: 'title.living_legend', kind: 'title', tier: 'legendary', name: 'Living Legend' },
];

export const cosmeticItem = (id: string): CosmeticItem | undefined => COSMETICS.find((c) => c.id === id);

/**
 * A skill's first Mastery star earns "<Skill> Master" (not from chests). Its id
 * names the skill: `title.mastery.science.astronomy` for `skill.science.astronomy`.
 */
export const masteryTitleId = (skillId: string) => `title.mastery.${skillId.replace(/^skill\./, '')}`;
export const masteryTitleSkill = (titleId: string): string | undefined =>
  titleId.startsWith('title.mastery.') ? `skill.${titleId.slice('title.mastery.'.length)}` : undefined;
export const masteryTitleName = (skillName: string) => `${skillName} Master`;

/** One roll on the loot table, in this order (SQL walks the same order). */
export type ChestRoll = 'boost_15' | 'boost_30' | 'boost_60' | 'brainpower' | CosmeticTier;
export const CHEST_ROLLS: readonly ChestRoll[] = ['boost_15', 'boost_30', 'boost_60', 'brainpower', 'common', 'rare', 'epic', 'legendary'];

/** Default weights (out of 100). Mirrored in app_settings.chest_loot, which the server reads. */
export const CHEST_LOOT: Record<ChestRoll, number> = { boost_15: 25, boost_30: 15, boost_60: 5, brainpower: 25, common: 15, rare: 8, epic: 5, legendary: 2 };

export const CHEST = {
  /** The chest sits after this level of each chapter (Levels 5, 15, 25, ...). */
  LEVEL_IN_CHAPTER: 5,
  /** Brainpower a chest pays: only rolled when both fit under the max. */
  BRAINPOWER: 2,
} as const;

export const BOOST = {
  /** A running boost pays this much extra on a level's first clear (2x); with the perfect streak, never past XP.PERFECT_STREAK_MAX_PERCENT. */
  PERCENT: 100,
  MINUTES: { boost_15: 15, boost_30: 30, boost_60: 60 } as const,
} as const;

export type ChestReward =
  | { kind: 'boost'; minutes: 15 | 30 | 60 }
  | { kind: 'brainpower'; amount: number }
  | { kind: 'cosmetic'; itemId: string; tier: CosmeticTier };

export interface Boost {
  id: string;
  minutes: number;
  /** Where it came from (`chest:<skill>:<chapter>`). */
  source: string;
  startedAt?: string;
  endsAt?: string;
}

/** What the learner wears: one ring, one name style, one title (a chest or Mastery title; a quest title lives in `equipped`). */
export interface Look {
  ring: string | null;
  nameStyle: string | null;
  title: string | null;
}
export const NO_LOOK: Look = { ring: null, nameStyle: null, title: null };

export type RewardErrorCode = 'CHEST_NOT_FOUND' | 'CHEST_LOCKED' | 'CHEST_OPENED' | 'BOOST_NOT_FOUND' | 'BOOST_USED' | 'BOOST_ACTIVE' | 'NOT_OWNED';
export class RewardError extends Error {
  constructor(readonly code: RewardErrorCode) {
    super(code);
    this.name = 'RewardError';
  }
}

export const chestKey = (skillId: string, chapter: number) => `chest:${skillId}:${chapter}`;
/** The level a chapter's chest waits behind (chapters are 10 levels: 1-10, 11-20, ...). */
export const chestLevel = (chapter: number) => (chapter - 1) * 10 + CHEST.LEVEL_IN_CHAPTER;

/**
 * The weights this learner actually rolls with: a roll that can't pay out
 * hands its weight to the 15-minute boost.
 */
export function chestWeights(input: {
  owned: ReadonlySet<string>;
  knowledgeLevel: number;
  unlimited: boolean;
  /** Brainpower now (ignored on Unlimited). */
  brainpower: number;
  loot?: Record<ChestRoll, number>;
}): Record<ChestRoll, number> {
  const w = { ...(input.loot ?? CHEST_LOOT) };
  const moveToBoost = (r: ChestRoll) => {
    w.boost_15 += w[r];
    w[r] = 0;
  };
  if (input.unlimited || input.brainpower > BRAINPOWER.MAX - CHEST.BRAINPOWER) moveToBoost('brainpower');
  for (const tier of COSMETIC_TIERS) {
    const left = COSMETICS.some((c) => c.tier === tier && !input.owned.has(c.id));
    if (input.knowledgeLevel < TIER_MIN_KNOWLEDGE_LEVEL[tier] || !left) moveToBoost(tier);
  }
  return w;
}

/**
 * One roll. `roll` (0 to 1) picks the entry, walking CHEST_ROLLS in order;
 * `pick` (0 to 1) picks the cosmetic among those not owned, by id.
 */
export function rollChest(weights: Record<ChestRoll, number>, owned: ReadonlySet<string>, roll: number, pick: number): ChestReward {
  const total = CHEST_ROLLS.reduce((n, r) => n + weights[r], 0);
  let at = roll * total;
  let chosen: ChestRoll = 'boost_15';
  for (const r of CHEST_ROLLS) {
    if (weights[r] <= 0) continue;
    if (at < weights[r]) {
      chosen = r;
      break;
    }
    at -= weights[r];
  }
  if (chosen === 'boost_15' || chosen === 'boost_30' || chosen === 'boost_60') return { kind: 'boost', minutes: BOOST.MINUTES[chosen] };
  if (chosen === 'brainpower') return { kind: 'brainpower', amount: CHEST.BRAINPOWER };
  const left = COSMETICS.filter((c) => c.tier === chosen && !owned.has(c.id))
    .map((c) => c.id)
    .sort();
  const itemId = left[Math.min(Math.floor(pick * left.length), left.length - 1)]!;
  return { kind: 'cosmetic', itemId, tier: chosen };
}

const totalCleared = (state: ProgressState) => Object.values(state.skills).reduce((n, s) => n + s.highestCleared, 0);

/** Open a chapter's chest: once, after its 5th level. */
export function openChest(
  state: ProgressState,
  input: { skillId: string; chapter: number; now: Date; boostId: string; random?: () => number },
): { state: ProgressState; reward: ChestReward } {
  const { skillId, chapter, now } = input;
  if (!Number.isInteger(chapter) || chapter < 1) throw new RewardError('CHEST_NOT_FOUND');
  const key = chestKey(skillId, chapter);
  if (state.chests?.[key]) throw new RewardError('CHEST_OPENED');
  if ((state.skills[skillId]?.highestCleared ?? 0) < chestLevel(chapter)) throw new RewardError('CHEST_LOCKED');
  const owned = new Set(state.cosmetics ?? []);
  const random = input.random ?? Math.random;
  const weights = chestWeights({ owned, knowledgeLevel: knowledgeLevel(totalCleared(state)), unlimited: state.hasUnlimited, brainpower: brainpowerBalance(state, now) });
  const reward = rollChest(weights, owned, random(), random());
  const at = now.toISOString();
  let next: ProgressState = { ...state, chests: { ...state.chests, [key]: { openedAt: at, reward } } };
  if (reward.kind === 'boost') next = { ...next, boosts: [...(next.boosts ?? []), { id: input.boostId, minutes: reward.minutes, source: key }] };
  if (reward.kind === 'cosmetic') next = { ...next, cosmetics: [...(next.cosmetics ?? []), reward.itemId] };
  if (reward.kind === 'brainpower') for (let i = 1; i <= reward.amount; i++) next = grantBrainpower(next, `${key}:${i}`, 'chest', now);
  return { state: next, reward };
}

/** The boost running at `now`, if any. */
export function activeBoost(state: Pick<ProgressState, 'boosts'>, now: Date): Boost | undefined {
  const t = now.getTime();
  return (state.boosts ?? []).find((b) => b.startedAt && b.endsAt && Date.parse(b.startedAt) <= t && t < Date.parse(b.endsAt));
}

/** Start a saved boost. One at a time; each runs once. */
export function startBoost(state: ProgressState, boostId: string, now: Date): ProgressState {
  const boost = (state.boosts ?? []).find((b) => b.id === boostId);
  if (!boost) throw new RewardError('BOOST_NOT_FOUND');
  if (boost.startedAt) throw new RewardError('BOOST_USED');
  if (activeBoost(state, now)) throw new RewardError('BOOST_ACTIVE');
  const startedAt = now.toISOString();
  const endsAt = new Date(now.getTime() + boost.minutes * 60_000).toISOString();
  return { ...state, boosts: (state.boosts ?? []).map((b) => (b.id === boostId ? { ...b, startedAt, endsAt } : b)) };
}

/**
 * The extra percent a level's first clear pays: the perfect streak's, or, while
 * a boost runs, the boost's; never past XP.PERFECT_STREAK_MAX_PERCENT.
 */
export function levelBonusPercent(streakPercent: number, boosted: boolean): number {
  return Math.min(Math.max(streakPercent, boosted ? BOOST.PERCENT : 0), XP.PERFECT_STREAK_MAX_PERCENT);
}

/** Whether the learner may wear an item: owned from a chest, or a Mastery title for a skill with a star. */
export function ownsCosmetic(state: Pick<ProgressState, 'cosmetics' | 'skills'>, id: string): boolean {
  const skill = masteryTitleSkill(id);
  if (skill) return (state.skills[skill]?.stars ?? 0) >= 1;
  return (state.cosmetics ?? []).includes(id);
}

/**
 * Wear a ring, a name style and a title (null takes one off). Each must be
 * owned and of its kind. Wearing a title takes off a quest title, and the
 * other way round (setEquipped), so one title shows.
 */
export function setLook(state: ProgressState, look: Look): ProgressState {
  const ok = (id: string | null, kind: CosmeticKind) => {
    if (id === null) return true;
    const isMastery = kind === 'title' && masteryTitleSkill(id) !== undefined;
    return (isMastery || cosmeticItem(id)?.kind === kind) && ownsCosmetic(state, id);
  };
  if (!ok(look.ring, 'ring') || !ok(look.nameStyle, 'name_style') || !ok(look.title, 'title')) throw new RewardError('NOT_OWNED');
  const equipped = look.title && state.equipped ? { ...state.equipped, titleQuestId: null } : state.equipped;
  return { ...state, look, equipped };
}

/** Everything the Locker shows. */
export interface LockerView {
  cosmetics: string[];
  boosts: Boost[];
  activeBoost: Boost | null;
  look: Look;
  /** Chests opened, by key. */
  chests: string[];
}

export function lockerView(state: ProgressState, now: Date): LockerView {
  return {
    cosmetics: [...(state.cosmetics ?? [])],
    boosts: [...(state.boosts ?? [])],
    activeBoost: activeBoost(state, now) ?? null,
    look: state.look ?? NO_LOOK,
    chests: Object.keys(state.chests ?? {}),
  };
}

/** The title others see (SQL `shown_title`): a look title, else a quest title. */
export function shownTitle(
  state: Pick<ProgressState, 'look' | 'equipped'>,
  names: { skill: (skillId: string) => string | undefined; questTitle: (questId: string) => string | undefined },
): string | null {
  const t = state.look?.title;
  if (t) {
    const skill = masteryTitleSkill(t);
    const name = skill ? names.skill(skill) : undefined;
    if (skill) return name ? masteryTitleName(name) : null;
    return cosmeticItem(t)?.name ?? null;
  }
  const q = state.equipped?.titleQuestId;
  return q ? (names.questTitle(q) ?? null) : null;
}
