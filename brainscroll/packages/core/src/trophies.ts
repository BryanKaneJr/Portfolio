import type { ProgressState, XpEvent } from './completion';
import { localDate } from './daily';

/**
 * Milestone trophies: what you've learned, how far, how deeply and how
 * consistently (docs/social-expansion.md, the reward test). They're DERIVED
 * from progress that already exists (first clears, first-clear scores,
 * first-try reviews, quest trophies), never stored, each dated by the moment
 * it was reached. Quest trophies are the stored kind (they depend on
 * finishing inside a week). Mirrors SQL milestone_trophies(); keep
 * trophies.test.ts in step with trophies.test.sql.
 *
 * Each has an `art` key (app/assets/images/trophies/<art>.webp); counted ones
 * share one image per series and the app overlays the `count` on it. A
 * series' top tier uses the gold version (`<art>-gold`, owner 2026-09-29):
 * the most of something is its mastery, and gold means mastery.
 * Besides this fixed list there's one mastery trophy per skill
 * (`trophy.mastery_<skill>`: its Level 100) and one per subject
 * (`trophy.subject_<subject>`: every skill in it mastered).
 */
export const MILESTONE_TROPHIES = [
  // The greatest: every skill to Level 100.
  { id: 'trophy.master_of_all', name: 'Master of All', description: 'Every skill to Level 100. The greatest trophy in BrainScroll.', art: 'master-of-all' },
  { id: 'trophy.jack_of_all_trades', name: 'Jack of All Trades', description: 'Level 50 in every skill.', art: 'jack-of-all-trades' },
  { id: 'trophy.first_level', name: 'First Level', description: 'Your first level.', art: 'first-level' },
  { id: 'trophy.warming_up', name: 'Warming Up', description: '25 levels.', art: 'levels', count: 25 },
  { id: 'trophy.century', name: 'Century', description: '100 levels.', art: 'levels', count: 100 },
  { id: 'trophy.five_hundred', name: 'Five Hundred', description: '500 levels.', art: 'levels', count: 500 },
  { id: 'trophy.thousand', name: 'A Thousand Levels', description: '1,000 levels.', art: 'levels-gold', count: 1000 },
  { id: 'trophy.chapter_one', name: 'Chapter One', description: 'A whole chapter: a Level 10 checkpoint.', art: 'chapters' },
  { id: 'trophy.ten_chapters', name: 'Ten Chapters', description: '10 chapter checkpoints cleared.', art: 'chapters', count: 10 },
  { id: 'trophy.fifty_chapters', name: 'Fifty Chapters', description: '50 chapter checkpoints cleared.', art: 'chapters-gold', count: 50 },
  { id: 'trophy.halfway', name: 'Halfway There', description: 'Level 50 in a skill.', art: 'halfway' },
  { id: 'trophy.mastered', name: 'First Mastery', description: 'Your first skill to Level 100.', art: 'first-mastery' },
  { id: 'trophy.perfect_10', name: '10 Perfect Lessons', description: '10 lessons with every question right on the first try.', art: 'perfect-lessons', count: 10 },
  { id: 'trophy.perfect_25', name: '25 Perfect Lessons', description: '25 lessons with every question right on the first try.', art: 'perfect-lessons', count: 25 },
  { id: 'trophy.perfect_50', name: '50 Perfect Lessons', description: '50 lessons with every question right on the first try.', art: 'perfect-lessons', count: 50 },
  { id: 'trophy.perfect_75', name: '75 Perfect Lessons', description: '75 lessons with every question right on the first try.', art: 'perfect-lessons', count: 75 },
  { id: 'trophy.perfect_100', name: '100 Perfect Lessons', description: '100 lessons with every question right on the first try.', art: 'perfect-lessons', count: 100 },
  { id: 'trophy.perfect_200', name: '200 Perfect Lessons', description: '200 lessons with every question right on the first try.', art: 'perfect-lessons', count: 200 },
  { id: 'trophy.perfect_300', name: '300 Perfect Lessons', description: '300 lessons with every question right on the first try.', art: 'perfect-lessons', count: 300 },
  { id: 'trophy.perfect_400', name: '400 Perfect Lessons', description: '400 lessons with every question right on the first try.', art: 'perfect-lessons', count: 400 },
  { id: 'trophy.perfect_500', name: '500 Perfect Lessons', description: '500 lessons with every question right on the first try.', art: 'perfect-lessons', count: 500 },
  { id: 'trophy.perfect_600', name: '600 Perfect Lessons', description: '600 lessons with every question right on the first try.', art: 'perfect-lessons', count: 600 },
  { id: 'trophy.perfect_700', name: '700 Perfect Lessons', description: '700 lessons with every question right on the first try.', art: 'perfect-lessons', count: 700 },
  { id: 'trophy.perfect_800', name: '800 Perfect Lessons', description: '800 lessons with every question right on the first try.', art: 'perfect-lessons', count: 800 },
  { id: 'trophy.perfect_900', name: '900 Perfect Lessons', description: '900 lessons with every question right on the first try.', art: 'perfect-lessons', count: 900 },
  { id: 'trophy.perfect_1000', name: '1,000 Perfect Lessons', description: '1,000 lessons with every question right on the first try.', art: 'perfect-lessons-gold', count: 1000 },
  { id: 'trophy.long_memory', name: 'Long Memory', description: '100 reviews right on the first try.', art: 'reviews', count: 100 },
  { id: 'trophy.steel_trap', name: 'Steel Trap', description: '500 reviews right on the first try.', art: 'reviews-gold', count: 500 },
  { id: 'trophy.curious', name: 'Curious', description: 'A level in 10 different skills.', art: 'curious' },
  { id: 'trophy.explorer', name: 'Explorer', description: 'A level in every skill.', art: 'explorer' },
  { id: 'trophy.well_rounded', name: 'Well Rounded', description: 'Level 10 in five different skills.', art: 'well-rounded' },
  { id: 'trophy.polymath', name: 'Polymath', description: 'A level in every subject.', art: 'polymath' },
  { id: 'trophy.quest_regular', name: 'Quest Regular', description: 'Three weekly quests finished in their week.', art: 'quest-clears', count: 3 },
  { id: 'trophy.quest_veteran', name: 'Quest Veteran', description: 'Ten weekly quests finished in their week.', art: 'quest-clears-gold', count: 10 },
  // Learning streaks (owner, 2026-09-29): the longest run ever, so they're never lost.
  { id: 'trophy.streak_7', name: 'One Week', description: 'Learned something 7 days in a row.', art: 'streak', count: 7 },
  { id: 'trophy.streak_30', name: 'One Month', description: 'Learned something 30 days in a row.', art: 'streak', count: 30 },
  { id: 'trophy.streak_100', name: 'A Hundred Days', description: 'Learned something 100 days in a row.', art: 'streak', count: 100 },
  { id: 'trophy.streak_365', name: 'One Year', description: 'Learned something every day for a year.', art: 'streak', count: 365 },
  { id: 'trophy.streak_500', name: '500 Days', description: 'Learned something 500 days in a row.', art: 'streak', count: 500 },
  { id: 'trophy.streak_1000', name: '1,000 Days', description: 'Learned something 1,000 days in a row.', art: 'streak-gold', count: 1000 },
] as const satisfies readonly { id: string; name: string; description: string; art: string; count?: number }[];

/** Perfect-lesson tiers: 10, 25, 50, 75, then every 100 up to 1,000. Mirrored in SQL. */
export const PERFECT_LESSON_TIERS = [10, 25, 50, 75, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] as const;

/**
 * Streak tiers, in days. Earned when a run of learning days (the streak's own
 * rule: a first clear or a scheduled review answered, in the learner's time
 * zone) first reaches the tier, dated by that day's first learning. Missing a
 * day later takes nothing away. Mirrored in SQL.
 */
export const STREAK_TROPHY_TIERS = [7, 30, 100, 365, 500, 1000] as const;

export type MilestoneTrophyId = (typeof MILESTONE_TROPHIES)[number]['id'];

/** What the per-skill and per-subject trophies are built from: the shipped skills and subjects. */
export interface TrophyCatalog {
  skills: readonly { id: string; subjectId: string; name: string }[];
  subjects: readonly { id: string; name: string }[];
}

/** `skill.science.astronomy` → `trophy.mastery_astronomy`. */
export const masteryTrophyId = (skillId: string) => `trophy.mastery_${skillId.split('.').at(-1)}`;
/** `subject.history` → `trophy.subject_history`. */
export const subjectTrophyId = (subjectId: string) => `trophy.subject_${subjectId.split('.').at(-1)}`;

export type TrophyKind = 'milestone' | 'mastery' | 'subject';

/** Name, description and kind of any derived trophy id. */
export function trophyInfo(
  id: string,
  catalog: TrophyCatalog,
): { name: string; description: string; kind: TrophyKind; art?: string; count?: number; skillId?: string; subjectId?: string } | undefined {
  const fixed = MILESTONE_TROPHIES.find((t) => t.id === id);
  if (fixed) return { name: fixed.name, description: fixed.description, kind: 'milestone', art: fixed.art, ...('count' in fixed ? { count: fixed.count } : {}) };
  const skill = catalog.skills.find((s) => masteryTrophyId(s.id) === id);
  if (skill) return { name: `Mastered: ${skill.name}`, description: `Level 100 in ${skill.name}.`, kind: 'mastery', skillId: skill.id };
  const subject = catalog.subjects.find((s) => subjectTrophyId(s.id) === id);
  if (subject) return { name: `Master of ${subject.name}`, description: `Every ${subject.name} skill to Level 100.`, kind: 'subject', art: `subject-${subject.id.split('.').at(-1)!.replace(/_/g, '-')}`, subjectId: subject.id };
  return undefined;
}

/** `level.science.astronomy.050` → 50. */
const levelNumber = (levelId: string) => Number(levelId.split('.').at(-1));

/** Every milestone and mastery reached, with when. */
export function milestoneTrophies(state: ProgressState, catalog: TrophyCatalog): { trophyId: string; earnedAt: string }[] {
  type Clear = Extract<XpEvent, { type: 'LEVEL_COMPLETE' | 'DELAYED_RECALL' }>;
  const byTime = (a: { at: string }, b: { at: string }) => a.at.localeCompare(b.at);
  const clears = state.xpEvents.filter((e): e is Clear => e.type === 'LEVEL_COMPLETE').sort(byTime);
  const recalls = state.xpEvents.filter((e) => e.type === 'DELAYED_RECALL').sort(byTime);
  const perfect = Object.values(state.levels)
    .filter((l) => l.total > 0 && l.firstAttemptCorrect === l.total)
    .map((l) => l.completedAt)
    .sort();
  const quests = (state.trophies ?? []).filter((t) => t.kind === 'quest').map((t) => t.earnedAt).sort();
  const firstAt = (n: number) => clears.find((e) => levelNumber(e.levelId) === n)?.at;
  const checkpoints = clears.filter((e) => levelNumber(e.levelId) % 10 === 0).map((e) => e.at);
  const firstPer = (key: (e: Clear) => string, only?: (e: Clear) => boolean) => {
    const m = new Map<string, string>();
    for (const e of clears) if ((!only || only(e)) && !m.has(key(e))) m.set(key(e), e.at);
    return m;
  };
  const skillFirsts = firstPer((e) => e.skillId);
  const tens = [...firstPer((e) => e.skillId, (e) => levelNumber(e.levelId) === 10).values()].sort();
  const hundreds = firstPer((e) => e.skillId, (e) => levelNumber(e.levelId) === 100);
  const fifties = firstPer((e) => e.skillId, (e) => levelNumber(e.levelId) === 50);
  const subjectOf = new Map(catalog.skills.map((s) => [s.id, s.subjectId]));
  const subjectFirsts = new Map<string, string>();
  for (const e of clears) {
    const sub = subjectOf.get(e.skillId);
    if (sub && !subjectFirsts.has(sub)) subjectFirsts.set(sub, e.at);
  }
  const subjectsWithSkills = new Set(catalog.skills.map((s) => s.subjectId));
  const lastOf = (xs: (string | undefined)[]) => (xs.every(Boolean) && xs.length ? [...(xs as string[])].sort().at(-1) : undefined);

  const earned: Record<string, string | undefined> = {
    'trophy.first_level': clears[0]?.at,
    'trophy.warming_up': clears[24]?.at,
    'trophy.century': clears[99]?.at,
    'trophy.five_hundred': clears[499]?.at,
    'trophy.thousand': clears[999]?.at,
    'trophy.chapter_one': firstAt(10),
    'trophy.ten_chapters': checkpoints[9],
    'trophy.fifty_chapters': checkpoints[49],
    'trophy.halfway': firstAt(50),
    'trophy.mastered': firstAt(100),
    'trophy.jack_of_all_trades': catalog.skills.length ? lastOf(catalog.skills.map((sk) => fifties.get(sk.id))) : undefined,
    'trophy.master_of_all': catalog.skills.length ? lastOf(catalog.skills.map((sk) => hundreds.get(sk.id))) : undefined,
    'trophy.long_memory': recalls[99]?.at,
    'trophy.steel_trap': recalls[499]?.at,
    'trophy.curious': [...skillFirsts.values()].sort()[9],
    'trophy.explorer': catalog.skills.length ? lastOf(catalog.skills.map((s) => skillFirsts.get(s.id))) : undefined,
    'trophy.well_rounded': tens[4],
    'trophy.polymath': subjectsWithSkills.size ? lastOf([...subjectsWithSkills].map((s) => subjectFirsts.get(s))) : undefined,
    'trophy.quest_regular': quests[2],
    'trophy.quest_veteran': quests[9],
  };
  for (const n of PERFECT_LESSON_TIERS) earned[`trophy.perfect_${n}`] = perfect[n - 1];
  const streakAt = streakReached(state);
  for (const n of STREAK_TROPHY_TIERS) earned[`trophy.streak_${n}`] = streakAt(n);
  for (const s of catalog.skills) earned[masteryTrophyId(s.id)] = hundreds.get(s.id);
  for (const sub of subjectsWithSkills) earned[subjectTrophyId(sub)] = lastOf(catalog.skills.filter((s) => s.subjectId === sub).map((s) => hundreds.get(s.id)));

  return Object.entries(earned)
    .flatMap(([trophyId, at]) => (at ? [{ trophyId, earnedAt: at }] : []))
    .sort((a, b) => a.earnedAt.localeCompare(b.earnedAt) || a.trophyId.localeCompare(b.trophyId));
}

/**
 * When a run of learning days first reached `n` days: the first learning
 * on its nth day. Days are the streak's (learningStreak in completion.ts).
 */
function streakReached(state: ProgressState): (n: number) => string | undefined {
  const firstOn = new Map<string, string>();
  const note = (day: string, at: string) => {
    const prev = firstOn.get(day);
    if (!prev || at < prev) firstOn.set(day, at);
  };
  for (const l of Object.values(state.levels)) note(localDate(new Date(l.completedAt), state.timeZone), l.completedAt);
  // Older saves marked review days `true`, with no time: count them from the day's start.
  for (const [day, at] of Object.entries(state.reviewDays ?? {})) note(day, typeof at === 'string' ? at : `${day}T00:00:00.000Z`);
  const DAY = 86_400_000;
  const days = [...firstOn.keys()].sort();
  const reached = new Map<number, string>();
  let run = 0;
  let prev: number | undefined;
  for (const day of days) {
    const d = Date.parse(`${day}T00:00:00Z`) / DAY;
    run = prev !== undefined && d === prev + 1 ? run + 1 : 1;
    prev = d;
    if (!reached.has(run)) reached.set(run, firstOn.get(day)!);
  }
  return (n) => reached.get(n);
}

/**
 * The line a learner shares with a trophy ("I hit a 100-day learning streak on
 * BrainScroll!"). It's on the share card and in the message. Quest trophies
 * pass their name; everything else is found by id.
 */
export function trophyShareText(trophy: { trophyId: string; name: string; kind: string }, catalog: TrophyCatalog): string {
  const id = trophy.trophyId;
  const info = trophyInfo(id, catalog);
  const n = (info?.count ?? 0).toLocaleString('en-US');
  const on = 'on BrainScroll!';
  if (trophy.kind === 'quest') return `I finished a Weekly Quest in its week ${on} ${trophy.name}`;
  if (info?.kind === 'mastery') return `I mastered ${catalog.skills.find((s) => s.id === info.skillId)?.name ?? trophy.name} ${on}`;
  if (info?.kind === 'subject') return `I mastered ${catalog.subjects.find((s) => s.id === info.subjectId)?.name ?? trophy.name} ${on}`;
  if (id.startsWith('trophy.streak_')) return `I hit a ${n}-day learning streak ${on}`;
  if (id.startsWith('trophy.perfect_')) return `I've had ${n} perfect lessons ${on}`;
  const fixed: Record<string, string> = {
    'trophy.master_of_all': `I mastered every skill ${on}`,
    'trophy.jack_of_all_trades': `I reached Level 50 in every skill ${on}`,
    'trophy.first_level': `I finished my first level ${on}`,
    'trophy.warming_up': `I've cleared ${n} levels ${on}`,
    'trophy.century': `I've cleared ${n} levels ${on}`,
    'trophy.five_hundred': `I've cleared ${n} levels ${on}`,
    'trophy.thousand': `I've cleared ${n} levels ${on}`,
    'trophy.chapter_one': `I finished my first chapter ${on}`,
    'trophy.ten_chapters': `I've finished ${n} chapters ${on}`,
    'trophy.fifty_chapters': `I've finished ${n} chapters ${on}`,
    'trophy.halfway': `I reached Level 50 in a skill ${on}`,
    'trophy.mastered': `I mastered my first skill ${on}`,
    'trophy.long_memory': `I've remembered ${n} reviews on the first try ${on}`,
    'trophy.steel_trap': `I've remembered ${n} reviews on the first try ${on}`,
    'trophy.curious': `I've learned in 10 different skills ${on}`,
    'trophy.explorer': `I've learned in every skill ${on}`,
    'trophy.well_rounded': `I reached Level 10 in five skills ${on}`,
    'trophy.polymath': `I've learned in every subject ${on}`,
    'trophy.quest_regular': `I've finished ${n} Weekly Quests in their week ${on}`,
    'trophy.quest_veteran': `I've finished ${n} Weekly Quests in their week ${on}`,
  };
  return fixed[id] ?? `I earned the ${trophy.name} trophy ${on}`;
}

/** The line shared with the current streak from the streak screen. */
export function streakShareText(days: number): string {
  return `I'm on a ${days.toLocaleString('en-US')}-day learning streak on BrainScroll!`;
}

/** A series' top tier: its gold art (`levels-gold`), shown with the gold edge like a mastery. */
export const isGoldArt = (art: string | undefined) => !!art && art.endsWith('-gold');
