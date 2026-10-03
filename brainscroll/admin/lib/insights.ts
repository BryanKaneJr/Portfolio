import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

/**
 * Turns pulled insights (scripts/insights.ts → admin/.data/insights.json) into
 * per-level views with plain-language flags for the content team. Thresholds
 * are deliberately conservative: nothing is flagged on a handful of learners.
 */
export const MIN_LEARNERS = 20;

interface QuestionStat { question_id: string; level_id: string; learners: number; first_try_rate: number | null; avg_attempts: number | null; first_picks: Record<string, number>; review_attempts: number; review_first_try_rate: number | null }
interface LevelFunnel { level_id: string; started: number; completed: number; completion_rate: number | null; mean_first_try_share: number | null; exits_by_card: Record<string, number> }
interface Report { id: string; level_id: string | null; object_type: string; object_id: string; category: string; message: string | null; created_at: string }
interface UserReport { id: number; reported_id: string; username: string | null; avatar: string | null; reason: string; note: string | null; created_at: string; open_reports: number }
interface FlaggedUsername { id: string; username: string; avatar: string | null }
interface RawInsights { pulledAt: string; source: string; health: Record<string, unknown>; questions: QuestionStat[]; levels: LevelFunnel[]; reports: Report[]; userReports?: UserReport[]; flaggedUsernames?: FlaggedUsername[] }
interface LevelLike { id: string; cards: { id: string }[]; questions: { id: string; kind?: string; options?: { id: string; label: string; correct: boolean }[] }[] }

export function questionFlags(stat: QuestionStat, options: { id: string; label: string; correct: boolean }[]): string[] {
  if (stat.learners < MIN_LEARNERS) return [];
  const flags: string[] = [];
  const rate = Number(stat.first_try_rate ?? 0);
  if (rate < 0.35) flags.push(`Hard: only ${Math.round(rate * 100)}% right first time. Unclear wording, a mis-keyed answer, or not taught well enough?`);
  if (rate > 0.97) flags.push(`Very easy: ${Math.round(rate * 100)}% right first time. Is a distractor giving it away?`);
  const right = options.find((o) => o.correct);
  const rightPicks = right ? (stat.first_picks[right.id] ?? 0) : 0;
  for (const o of options.filter((x) => !x.correct)) {
    const n = stat.first_picks[o.id] ?? 0;
    if (n > rightPicks) flags.push(`“${o.label}” is picked first more often than the answer (${n} vs ${rightPicks}): a common misconception, or mis-keyed?`);
    if (n === 0 && stat.learners >= 50) flags.push(`“${o.label}” is never picked: replace it with a more plausible distractor.`);
  }
  if (stat.review_attempts >= MIN_LEARNERS && Number(stat.review_first_try_rate ?? 1) < 0.5)
    flags.push(`Weak delayed recall: ${Math.round(Number(stat.review_first_try_rate) * 100)}% right first time in review. The teaching card may need work.`);
  return flags;
}

export function levelFlags(f: LevelFunnel, cardCount: number): string[] {
  if (f.started < MIN_LEARNERS) return [];
  const flags: string[] = [];
  const rate = Number(f.completion_rate ?? 1);
  if (rate < 0.8) flags.push(`${Math.round((1 - rate) * 100)}% of learners who start this level don’t finish it.`);
  const exits = Object.entries(f.exits_by_card).sort((a, b) => b[1] - a[1]);
  const total = exits.reduce((s, [, n]) => s + n, 0);
  if (exits[0] && total >= 10 && exits[0][1] / total >= 0.4)
    flags.push(`${Math.round((exits[0][1] / total) * 100)}% of exits happen on card ${Number(exits[0][0]) + 1} of ${cardCount}.`);
  return flags;
}

export function loadInsights(path: string | undefined, levels: LevelLike[]) {
  if (!path || !existsSync(path)) return { available: false as const };
  const raw = JSON.parse(readFileSync(path, 'utf8')) as RawInsights;
  const byLevel: Record<string, unknown> = {};
  for (const level of levels) {
    const funnel = raw.levels.find((f) => f.level_id === level.id);
    const questions = level.questions.map((q) => {
      const stat = raw.questions.find((s) => s.question_id === q.id);
      // Option-pick flags are for multiple choice; match and order have no options to compare.
      return { id: q.id, stat: stat ?? null, flags: stat && q.options ? questionFlags(stat, q.options) : [] };
    });
    const reports = raw.reports.filter((r) => r.level_id === level.id);
    if (!funnel && !questions.some((q) => q.stat) && !reports.length) continue;
    byLevel[level.id] = { funnel: funnel ?? null, flags: funnel ? levelFlags(funnel, level.cards.length) : [], questions, reports };
  }
  return {
    available: true as const, pulledAt: raw.pulledAt, source: raw.source, health: raw.health, minLearners: MIN_LEARNERS, levels: byLevel, reports: raw.reports,
    // Pulls from before moderation existed have neither.
    userReports: raw.userReports ?? [], flaggedUsernames: raw.flaggedUsernames ?? [],
  };
}

/** Rewrites the local pull (atomically) after an action on the live project, so the queues show what's still open. */
function updatePull(path: string | undefined, change: (raw: RawInsights) => RawInsights | null): boolean {
  if (!path || !existsSync(path)) return false;
  const next = change(JSON.parse(readFileSync(path, 'utf8')) as RawInsights);
  if (!next) return false;
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n');
  renameSync(tmp, path);
  return true;
}

/** After a content report is triaged on the server, drop it from the local pull. */
export function removeReport(path: string | undefined, id: string): boolean {
  return updatePull(path, (raw) => {
    const reports = raw.reports.filter((r) => r.id !== id);
    return reports.length === raw.reports.length ? null : { ...raw, reports };
  });
}

/** After a learner report is triaged on the server, drop it from the local pull. */
export function removeUserReport(path: string | undefined, id: number): boolean {
  return updatePull(path, (raw) => {
    const userReports = (raw.userReports ?? []).filter((r) => r.id !== id);
    return userReports.length === (raw.userReports ?? []).length ? null : { ...raw, userReports };
  });
}

/**
 * After a username is reset on the server: its username reports are closed
 * (the server marks them fixed), it's no longer flagged, and its other reports
 * show the new name.
 */
export function applyUsernameReset(path: string | undefined, userId: string, username: string): boolean {
  return updatePull(path, (raw) => ({
    ...raw,
    userReports: (raw.userReports ?? []).filter((r) => !(r.reported_id === userId && r.reason === 'username')).map((r) => (r.reported_id === userId ? { ...r, username } : r)),
    flaggedUsernames: (raw.flaggedUsernames ?? []).filter((f) => f.id !== userId),
  }));
}
