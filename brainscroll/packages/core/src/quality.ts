import type { Asset, Card, Concept, Level, Question, Source } from './content-schema';
import { cardRole } from './structure';

/**
 * Editorial quality checks that go beyond the schema and cross-references
 * (BUILD_ORDER "Automated validation before publish"): answer leakage,
 * near-duplicate questions, unsupported numbers, weak evidence, concept
 * coverage, card counts and rights. Most are warnings for editors; the ones
 * that would ship something broken or unlicensed are errors.
 */

type Report = (where: string, message: string) => void;

/** Most cards one level may hold: hook + learning + 10 questions + recap fits comfortably. */
export const MAX_CARDS_PER_LEVEL = 16;
/** Prompt similarity (Jaccard over content words) at or above which two questions look like duplicates. */
export const NEAR_DUPLICATE_THRESHOLD = 0.75;
/** Share of a skill's questions where the right answer is conspicuously the longest option before we warn. */
export const LONGEST_ANSWER_MAX_SHARE = 0.25;
/** How much longer (ratio) the right answer must be than every distractor to count as a length tell. */
export const LONGEST_ANSWER_RATIO = 1.3;

const STOPWORDS = new Set(
  'a an the of to in on at for from by with and or but is are was were be been it its this that these those what which who whom why how when where does do did can could would should will your you we our they their them than then there as about into over under after before between why from level'.split(' '),
);

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9.,'° ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function contentWords(s: string): Set<string> {
  return new Set(
    normalizeText(s)
      .replace(/[.,]/g, ' ')
      .split(' ')
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Numbers as written ("4.6", "1,670", "23.5", "1543", "99.8"), normalized without thousands separators. */
export function numbersIn(s: string): string[] {
  return [...s.matchAll(/(?<![\w.])(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?![\w])/g)].map((m) => m[1]!.replace(/,/g, ''));
}

/** Text a learner reads on a card (questions excluded). */
export function readableText(card: Card): string {
  switch (card.type) {
    case 'text':
      return [card.headline, card.body, card.callout].filter(Boolean).join(' ');
    case 'fact':
      return [card.fact, card.context].filter(Boolean).join(' ');
    case 'timeline':
      return [card.headline, ...card.events.flatMap((e) => [e.when, e.label])].join(' ');
    case 'comparison':
      return [card.headline, ...card.items.flatMap((i) => [i.label, ...i.points])].join(' ');
    case 'image':
      return card.caption ?? '';
    case 'checkpoint':
      return [card.headline, ...card.learned].join(' ');
    default:
      return '';
  }
}

const correctLabel = (q: Question) => q.options.find((o) => o.correct)?.label ?? '';

export function checkQuality(
  input: { levels: Level[]; concepts: Concept[]; sources: Source[]; assets: Asset[]; levelFiles?: Map<string, string> },
  err: Report,
  warn: Report,
): void {
  const { levels, concepts, sources, assets } = input;
  const conceptById = new Map(concepts.map((c) => [c.id, c]));
  const factsOnCard = new Map<string, string[]>();
  for (const c of concepts)
    for (const f of c.facts) for (const cid of f.cardIds) factsOnCard.set(cid, [...(factsOnCard.get(cid) ?? []), f.text]);

  // ── Per level ──────────────────────────────────────────────────────────────
  for (const level of levels) {
    const file = input.levelFiles?.get(level.id);
    if (file) {
      const m = /(\d+)\.json$/.exec(file);
      if (m && Number(m[1]) !== level.number) err(level.id, `file ${file} holds level ${level.number}; name it ${String(level.number).padStart(3, '0')}.json`);
    }
    if (level.cards.length > MAX_CARDS_PER_LEVEL) err(level.id, `has ${level.cards.length} cards; at most ${MAX_CARDS_PER_LEVEL} fit a mobile level`);

    // Unsupported numbers: every figure a learner reads should come from a claim on that card.
    for (const card of level.cards) {
      const role = cardRole(card);
      if (role !== 'hook' && role !== 'learning') continue;
      const text = readableText(card);
      const facts = factsOnCard.get(card.id) ?? [];
      if (role === 'learning' && facts.length === 0 && card.type !== 'image')
        warn(card.id, 'states no claim; add this card to the cardIds of the facts it states');
      const backed = new Set(facts.flatMap(numbersIn));
      // "Level 10" or "Chapter 3" are references, not figures.
      for (const n of numbersIn(text.replace(/\b(levels?|chapters?|lv\.)\s*\d+(\s*[–-]\s*\d+)?/gi, ' ')))
        if (!backed.has(n) && !/^[0-9]$/.test(n)) warn(card.id, `number ${n} is not in any claim on this card (unsupported or mismatched figure)`);
    }

    // Answer leakage inside the level.
    const qOrder = level.cards.flatMap((c) => (c.type === 'mcq' || c.type === 'recall' ? [c.questionId] : []));
    const qById = new Map(level.questions.map((q) => [q.id, q]));
    const ordered = qOrder.map((id) => qById.get(id)).filter((q): q is Question => !!q);
    ordered.forEach((q, i) => {
      const answer = normalizeText(correctLabel(q));
      if (answer.length >= 4 && normalizeText(q.prompt).includes(answer)) warn(q.id, `the prompt contains the correct answer "${correctLabel(q)}"`);
      // An earlier question's feedback revealing a later answer makes the later one trivial.
      for (const earlier of ordered.slice(0, i)) {
        const feedback = normalizeText([earlier.explanation, ...earlier.options.map((o) => o.rationale ?? '')].join(' '));
        if (answer.split(' ').length >= 3 && feedback.includes(answer)) warn(q.id, `its answer "${correctLabel(q)}" is given away by the feedback of ${earlier.id}`);
      }
      const labels = q.options.map((o) => normalizeText(o.label));
      if (labels.some((l) => /\b(all|none) of (the|these) (above|options)\b/.test(l))) warn(q.id, 'avoid "all/none of the above": it tests the format, not the idea');
      if (q.options.length < 3) warn(q.id, `has only ${q.options.length} options; 3–4 make guessing less rewarding`);
      // Evidence: the source cards should state a claim about what the question tests.
      const conceptFacts = new Set(q.conceptIds.flatMap((cid) => (conceptById.get(cid)?.facts ?? []).flatMap((f) => f.cardIds)));
      if (!q.sourceCardIds.some((c) => conceptFacts.has(c)))
        warn(q.id, 'none of its sourceCardIds states a claim of the concepts it tests; the "Take another look" cards may not contain the answer');
    });
  }

  // ── Across the skill ───────────────────────────────────────────────────────
  const bySkill = new Map<string, Level[]>();
  for (const l of levels) bySkill.set(l.skillId, [...(bySkill.get(l.skillId) ?? []), l]);
  for (const [skill, list] of bySkill) {
    const qs = list.flatMap((l) => l.questions.map((q) => ({ q, words: contentWords(q.prompt), answer: normalizeText(correctLabel(q)) })));
    for (let i = 0; i < qs.length; i++)
      for (let j = i + 1; j < qs.length; j++) {
        const a = qs[i]!, b = qs[j]!;
        if (normalizeText(a.q.prompt) === normalizeText(b.q.prompt)) err(b.q.id, `duplicates the prompt of ${a.q.id}`);
        else if (jaccard(a.words, b.words) >= NEAR_DUPLICATE_THRESHOLD && a.answer === b.answer)
          warn(b.q.id, `near-duplicate of ${a.q.id} (same answer, very similar prompt); vary it or test a different angle`);
      }
    // A consistently longest right answer teaches learners to pick the longest option.
    const multi = qs.filter(({ q }) => q.options.length >= 3);
    const longest = multi.filter(({ q }) => {
      const len = (s: string) => s.length;
      const right = len(correctLabel(q));
      return q.options.every((o) => o.correct || len(o.label) * LONGEST_ANSWER_RATIO <= right);
    }).length;
    if (multi.length >= 8 && longest / multi.length > LONGEST_ANSWER_MAX_SHARE)
      warn(skill, `the correct answer is conspicuously the longest option (≥30% longer) in ${longest}/${multi.length} questions; make distractors as specific as the answer`);

    // Concept coverage: taught once, tested so it can enter review, used somewhere.
    const teachers = new Map<string, string[]>();
    for (const l of list) for (const c of l.concepts) if (c.role === 'teach') teachers.set(c.conceptId, [...(teachers.get(c.conceptId) ?? []), l.id]);
    for (const [cid, ls] of teachers) if (ls.length > 1) warn(cid, `is taught by ${ls.join(', ')}; teach once, then reinforce or recall`);
    const tested = new Set(list.flatMap((l) => l.questions.flatMap((q) => q.conceptIds)));
    for (const cid of teachers.keys()) if (!tested.has(cid)) warn(cid, 'is taught but no question tests it, so it can never come back in review');
    const sorted = [...list].sort((a, b) => a.number - b.number);
    sorted.forEach((l, i) => {
      const before = new Set(sorted.slice(0, i).flatMap((x) => x.concepts.filter((c) => c.role === 'teach').map((c) => c.conceptId)));
      for (const c of l.concepts) if (c.role === 'reinforce' && !before.has(c.conceptId) && !l.concepts.some((x) => x.conceptId === c.conceptId && x.role === 'teach'))
        warn(l.id, `reinforces ${c.conceptId}, which no earlier level teaches`);
      // A preview promises a later lesson: some later level must actually teach it.
      const later = new Set(sorted.slice(i + 1).flatMap((x) => x.concepts.filter((c) => c.role === 'teach').map((c) => c.conceptId)));
      for (const c of l.concepts) if (c.role === 'preview' && !later.has(c.conceptId)) warn(l.id, `previews ${c.conceptId}, but no later level teaches it`);
    });
  }
  const usedConcepts = new Set(levels.flatMap((l) => l.concepts.map((c) => c.conceptId)));
  for (const c of concepts) if (!usedConcepts.has(c.id)) warn(c.id, 'is not used by any level');

  // Rights and registry hygiene.
  const cited = new Set([...levels.flatMap((l) => l.sourceIds), ...concepts.flatMap((c) => c.facts.flatMap((f) => f.sourceIds)), ...assets.map((a) => a.sourceId)]);
  for (const s of sources) if (!cited.has(s.id)) warn(s.id, 'is not cited by any level, fact or asset');
  for (const a of assets) if (a.license === 'reference_only') err(a.id, 'reference_only material may be cited for facts but never reproduced as an asset');
}

/**
 * Stable-ID and revision safety against the last published snapshot: a
 * published level whose content changed must bump its revision, and stable
 * card/question IDs must never be reused for different content silently.
 */
export function checkRevisions(previous: Level[], current: Level[], err: Report, warn: Report): void {
  const prev = new Map(previous.map((l) => [l.id, l]));
  const strip = (l: Level) => JSON.stringify({ ...l, status: undefined, revision: undefined });
  for (const l of current) {
    const p = prev.get(l.id);
    if (!p) continue;
    if (l.revision < p.revision) err(l.id, `revision went backwards (${p.revision} → ${l.revision})`);
    const changed = strip(l) !== strip(p);
    if (p.status === 'published' && changed && l.revision === p.revision)
      err(l.id, `published revision ${p.revision} changed; bump "revision" to publish a correction`);
    if (p.number !== l.number) err(l.id, `level number changed (${p.number} → ${l.number}); stable IDs never move`);
    const ids = (lv: Level) => new Set([...lv.cards.map((c) => c.id), ...lv.questions.map((q) => q.id)]);
    const removed = [...ids(p)].filter((x) => !ids(l).has(x));
    if (p.status === 'published' && removed.length) warn(l.id, `removes published IDs ${removed.join(', ')}; learners' history points at them`);
  }
  const now = new Set(current.map((l) => l.id));
  for (const p of previous) if (p.status === 'published' && !now.has(p.id)) err(p.id, 'published level was deleted; retire it instead (status "retired")');
}
