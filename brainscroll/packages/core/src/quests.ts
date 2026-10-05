import { QUEST } from './constants';
import type { ProgressState, XpEvent } from './completion';
import type { DailyAllowance } from './daily';
import { milestoneTrophies, trophyInfo, type TrophyCatalog } from './trophies';

/**
 * Weekly Knowledge Quests, on-device. Mirrors the SQL in
 * backend/supabase/migrations/20261007000000_weekly_quests.sql (get_quests,
 * start_quest, open_final_round, answer_final_round, complete_quest); keep
 * quests.test.ts in step with backend/tests/quests.test.sql.
 *
 * Progress is never stored: it's the LEVEL_COMPLETE events in each
 * requirement's skill inside the run's counting window (plus chapter reviews
 * once a skill has no new levels left: chapterReview.ts), capped at the
 * requirement. The trophy is only for a live-week clear; the Archive pays XP.
 */

/** What a quest needs from content/quests.json. */
export interface QuestDefinition {
  id: string;
  /** Null while unscheduled (TBD): the quest never shows. */
  startsOn: string | null;
  requirements: readonly { skillId: string; newLevels: number }[];
  xpReward: number;
  trophy: { id: string; name: string };
}

/** A learner's run at one quest (SQL user_quests + user_quest_answers). */
export interface QuestRun {
  startedAt: string;
  resumedAt?: string;
  archiveActive: boolean;
  finalRoundQuestionIds?: string[];
  /** questionId → when it was answered right. */
  resolved?: Record<string, string>;
  completedAt?: string;
  liveClear?: boolean;
}

/** A trophy on the shelf: a Weekly Quest's (stored) or a milestone (derived, trophies.ts). */
export interface Trophy {
  trophyId: string;
  name: string;
  kind: 'quest' | 'milestone' | 'mastery' | 'subject';
  /** The quest it's from (quest trophies only). */
  questId?: string;
  earnedAt: string;
}

export type QuestState = 'live' | 'archive' | 'completed';

export interface QuestView {
  id: string;
  state: QuestState;
  startsAt: string;
  endsAt: string;
  /** Counting now: the live quest, or the one active Archive quest. */
  active: boolean;
  requirements: { skillId: string; required: number; done: number }[];
  finalRoundUnlocked: boolean;
  finalRound: { questionIds: string[]; resolved: string[] } | null;
  completedAt?: string;
  liveClear?: boolean;
}

/** What the learner shows on Profile: a quest's title and a quest's emblem (each from a trophy they hold). */
export interface Equipped {
  titleQuestId: string | null;
  emblemQuestId: string | null;
}

export interface QuestsView {
  quests: QuestView[];
  trophies: Trophy[];
  equipped: Equipped;
}

export interface FinalRoundAnswer {
  correct: boolean;
  resolved: boolean;
  rationale?: string;
  /** Match and order: which positions are wrong (never what belongs there). */
  wrong?: number[];
  explanation?: string;
}

export interface QuestCompletion {
  questId: string;
  xpAwarded: number;
  liveClear: boolean;
  trophy?: { trophyId: string; name: string };
  /** Brainpower after it, with what the finish paid in `brainpowerEarned` (its last goal, the quest, its trophy). */
  daily?: DailyAllowance;
}

export class QuestError extends Error {
  constructor(readonly code: 'QUEST_NOT_FOUND' | 'FINAL_ROUND_LOCKED' | 'FINAL_ROUND_UNRESOLVED' | 'QUESTION_NOT_IN_FINAL_ROUND' | 'NOT_EARNED') {
    super(code);
  }
}

export function questWindow(def: Pick<QuestDefinition, 'startsOn'>): { startsAt: Date; endsAt: Date } {
  if (def.startsOn === null) throw new QuestError('QUEST_NOT_FOUND');
  const startsAt = new Date(`${def.startsOn}T00:00:00Z`);
  return { startsAt, endsAt: new Date(startsAt.getTime() + QUEST.WEEK_MS) };
}

const runsOf = (state: ProgressState) => state.quests ?? {};

type Counted = { skillId: string; levelId: string; at: string };

/**
 * Per requirement, the first N levels of that skill inside the window, oldest
 * first: first clears, and chapter reviews with quest credit (the skill had
 * no new levels left; each counts as its chapter's last level). A level
 * counts once.
 */
function countedLevels(state: ProgressState, def: QuestDefinition, started: Date, resumed: Date | undefined) {
  const { endsAt } = questWindow(def);
  const inWindow = (e: XpEvent) => {
    const at = new Date(e.at);
    return (at >= started && at < endsAt) || (resumed !== undefined && at >= resumed);
  };
  const seen = new Set<string>();
  const events = state.xpEvents
    .filter((e): e is Extract<XpEvent, Counted> => (e.type === 'LEVEL_COMPLETE' || (e.type === 'CHAPTER_REVIEW' && e.questCredit)) && inWindow(e))
    .sort((a, b) => a.at.localeCompare(b.at))
    .filter((e) => !seen.has(e.levelId) && !!seen.add(e.levelId));
  return def.requirements.map((r, order) => ({ ...r, order, levels: events.filter((e) => e.skillId === r.skillId).slice(0, r.newLevels) }));
}

function runWindow(def: QuestDefinition, run: QuestRun | undefined) {
  return { started: new Date(run?.startedAt ?? questWindow(def).startsAt), resumed: run?.resumedAt ? new Date(run.resumedAt) : undefined };
}

export function questView(state: ProgressState, def: QuestDefinition, now: Date): QuestView {
  const { startsAt, endsAt } = questWindow(def);
  const run = runsOf(state)[def.id];
  const live = now >= startsAt && now < endsAt;
  const counting = live || !!run?.archiveActive || !!run?.completedAt;
  const { started, resumed } = runWindow(def, run);
  const counted = countedLevels(state, def, started, resumed);
  const requirements = counted.map((r) => ({ skillId: r.skillId, required: r.newLevels, done: counting ? r.levels.length : 0 }));
  return {
    id: def.id,
    state: run?.completedAt ? 'completed' : live ? 'live' : 'archive',
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    active: live || !!run?.archiveActive,
    requirements,
    finalRoundUnlocked: counting && requirements.every((r) => r.done >= r.required),
    finalRound: run?.finalRoundQuestionIds
      ? { questionIds: run.finalRoundQuestionIds, resolved: run.finalRoundQuestionIds.filter((q) => run.resolved?.[q]) }
      : null,
    ...(run?.completedAt ? { completedAt: run.completedAt, liveClear: !!run.liveClear } : {}),
  };
}

/**
 * Every quest that has started, newest first, and the learner's trophies:
 * quest trophies plus milestones and masteries (pass the catalog to include them).
 */
export function questsView(state: ProgressState, defs: readonly QuestDefinition[], now: Date, catalog?: TrophyCatalog): QuestsView {
  const milestones: Trophy[] = catalog
    ? milestoneTrophies(state, catalog).flatMap((m) => {
        const info = trophyInfo(m.trophyId, catalog);
        return info ? [{ ...m, kind: info.kind, name: info.name }] : [];
      })
    : [];
  return {
    quests: defs
      .filter((d) => d.startsOn !== null && questWindow(d).startsAt <= now)
      .sort((a, b) => (b.startsOn ?? '').localeCompare(a.startsOn ?? ''))
      .map((d) => questView(state, d, now)),
    trophies: [...(state.trophies ?? []), ...milestones].sort((a, b) => b.earnedAt.localeCompare(a.earnedAt)),
    equipped: state.equipped ?? { titleQuestId: null, emblemQuestId: null },
  };
}

/**
 * Make an ended quest the active Archive quest. Your own unfinished live week
 * carries over; otherwise counting starts now. The quest you switch away from
 * loses its unfinished progress.
 */
export function startQuest(state: ProgressState, def: QuestDefinition, now: Date): ProgressState {
  const { startsAt, endsAt } = questWindow(def);
  if (now < endsAt) return state;
  const runs = runsOf(state);
  const run = runs[def.id];
  if (run?.completedAt || run?.archiveActive) return state;
  const kept = Object.fromEntries(Object.entries(runs).filter(([, r]) => !(r.archiveActive && !r.completedAt)));
  const at = now.toISOString();
  let next: QuestRun;
  if (run) next = { ...run, archiveActive: true, resumedAt: at };
  else if (countedLevels(state, def, startsAt, undefined).some((r) => r.levels.length > 0)) next = { startedAt: startsAt.toISOString(), resumedAt: at, archiveActive: true };
  else next = { startedAt: at, resumedAt: at, archiveActive: true };
  return { ...state, quests: { ...kept, [def.id]: next } };
}

/**
 * Open the Final Round: a short lesson, one card and one question per
 * requirement skill in order, picked once from the latest level that counted
 * for that skill (its `connection` question if it has one; the card is that
 * question's first source card, shown by the app).
 */
export function openFinalRound(
  state: ProgressState,
  def: QuestDefinition,
  now: Date,
  questionsFor: (levelId: string) => readonly { id: string; purpose?: string }[],
): ProgressState {
  if (questWindow(def).startsAt > now) throw new QuestError('QUEST_NOT_FOUND');
  if (!questView(state, def, now).finalRoundUnlocked) throw new QuestError('FINAL_ROUND_LOCKED');
  const run: QuestRun = runsOf(state)[def.id] ?? { startedAt: questWindow(def).startsAt.toISOString(), archiveActive: false };
  if (run.finalRoundQuestionIds) return state;
  const { started, resumed } = runWindow(def, run);
  const ids = countedLevels(state, def, started, resumed)
    .flatMap((r) => {
      const latest = r.levels.at(-1);
      if (!latest) return [];
      const qs = [...questionsFor(latest.levelId)].sort((a, b) => b.id.localeCompare(a.id));
      const pick = qs.find((q) => q.purpose === 'connection') ?? qs[0];
      return pick ? [pick.id] : [];
    });
  return { ...state, quests: { ...runsOf(state), [def.id]: { ...run, finalRoundQuestionIds: ids, resolved: {} } } };
}

/** Answer one Final Round question. Wrong answers are corrected with the source cards; no first-try scoring. */
export function answerFinalRound(
  state: ProgressState,
  def: QuestDefinition,
  input: { questionId: string; now: Date; grade: () => { correct: boolean; rationale?: string; wrong?: number[]; explanation?: string } },
): { state: ProgressState; result: FinalRoundAnswer } {
  const run = runsOf(state)[def.id];
  if (!run?.finalRoundQuestionIds?.includes(input.questionId) || run.completedAt) throw new QuestError('QUESTION_NOT_IN_FINAL_ROUND');
  const g = input.grade();
  const result: FinalRoundAnswer = { correct: g.correct, resolved: g.correct, ...(g.correct ? { explanation: g.explanation } : { rationale: g.rationale, ...(g.wrong ? { wrong: g.wrong } : {}) }) };
  if (!g.correct || run.resolved?.[input.questionId]) return { state, result };
  const next: QuestRun = { ...run, resolved: { ...run.resolved, [input.questionId]: input.now.toISOString() } };
  return { state: { ...state, quests: { ...runsOf(state), [def.id]: next } }, result };
}

/** Finish once every Final Round question is resolved: XP once, the trophy only inside the live week. */
export function completeQuest(state: ProgressState, def: QuestDefinition, now: Date): { state: ProgressState; result: QuestCompletion } {
  const run = runsOf(state)[def.id];
  if (!run?.finalRoundQuestionIds) throw new QuestError('FINAL_ROUND_LOCKED');
  const trophyOf = (live: boolean) => (live ? { trophy: { trophyId: def.trophy.id, name: def.trophy.name } } : {});
  if (run.completedAt) return { state, result: { questId: def.id, xpAwarded: 0, liveClear: !!run.liveClear, ...trophyOf(!!run.liveClear) } };
  if (run.finalRoundQuestionIds.some((q) => !run.resolved?.[q])) throw new QuestError('FINAL_ROUND_UNRESOLVED');
  const live = now < questWindow(def).endsAt;
  const at = now.toISOString();
  const key = `quest_complete:${def.id}`;
  const fresh = !state.xpEvents.some((e) => e.idempotencyKey === key);
  const events: XpEvent[] = fresh ? [{ type: 'QUEST_COMPLETE', amount: def.xpReward, questId: def.id, idempotencyKey: key, at }] : [];
  const trophies = state.trophies ?? [];
  const next: ProgressState = {
    ...state,
    quests: { ...runsOf(state), [def.id]: { ...run, completedAt: at, liveClear: live, archiveActive: false } },
    xpEvents: [...state.xpEvents, ...events],
    trophies: live && !trophies.some((t) => t.trophyId === def.trophy.id) ? [...trophies, { trophyId: def.trophy.id, name: def.trophy.name, kind: 'quest', questId: def.id, earnedAt: at }] : trophies,
  };
  return { state: next, result: { questId: def.id, xpAwarded: fresh ? def.xpReward : 0, liveClear: live, ...trophyOf(live) } };
}

/** Show a title and/or an emblem, each from a quest whose trophy (a live-week clear) you hold; null shows none. */
export function setEquipped(state: ProgressState, next: Equipped): ProgressState {
  const held = (questId: string | null) => questId === null || (state.trophies ?? []).some((t) => t.kind === 'quest' && t.questId === questId);
  if (!held(next.titleQuestId) || !held(next.emblemQuestId)) throw new QuestError('NOT_EARNED');
  // One title shows: a quest title takes off a chest or Mastery title (rewards.ts setLook).
  const look = next.titleQuestId && state.look?.title ? { ...state.look, title: null } : state.look;
  return { ...state, equipped: next, look };
}
