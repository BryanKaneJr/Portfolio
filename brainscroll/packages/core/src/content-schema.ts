import { z } from 'zod';
import { ID_PATTERNS, type IdKind } from './ids';
import { LEVEL_TYPES, QUESTION_PURPOSES, TEXT_BUDGET } from './constants';
import { MASCOT_LINE_MAX, QUIET_MASCOT_POSES } from './mascot';

/**
 * Stage 1: content contract.
 *
 * A level is data. The same JSON is validated here, previewed in admin,
 * published as an immutable revision bundle, and rendered by the app's
 * generic CardRenderer. No level gets bespoke UI.
 */

const id = (kind: IdKind) => z.string().regex(ID_PATTERNS[kind], `must be a valid ${kind} id`);
const text = (max: number) => z.string().trim().min(1).max(max);

export const ContentStatus = z.enum(['draft', 'in_review', 'published', 'retired']);
export type ContentStatus = z.infer<typeof ContentStatus>;

export const License = z.enum([
  'CC0',
  'public_domain',
  'US_gov_public_domain',
  'CC_BY',
  'CC_BY_SA',
  'reference_only', // may be cited for facts; nothing reproduced
  'licensed',
  'unknown', // blocks publish
]);
export type License = z.infer<typeof License>;

export const Source = z.object({
  id: id('source'),
  title: text(200),
  url: z.url(),
  publisher: text(120),
  license: License,
  accessedAt: z.iso.date(),
  /** An editor has checked that the cited facts appear in this source. */
  verified: z.boolean(),
  notes: z.string().optional(),
});
export type Source = z.infer<typeof Source>;

export const Asset = z.object({
  id: id('asset'),
  type: z.enum(['image', 'diagram', 'map']),
  file: z.string().min(1),
  altText: text(250),
  license: License,
  sourceId: id('source'),
  attribution: z.string().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type Asset = z.infer<typeof Asset>;

/**
 * One verifiable claim: the exact statement a human checks against its sources.
 * `cardIds` are the learning/hook cards that state it, so a verifier can see
 * exactly where it appears. Verification status lives in content/verification.json,
 * never here, so checking a claim doesn't touch curriculum files.
 */
export const Fact = z.object({
  id: id('fact'),
  text: text(300),
  sourceIds: z.array(id('source')).min(1),
  cardIds: z.array(id('card')).default([]),
});
export type Fact = z.infer<typeof Fact>;

/**
 * A human's check of one claim against one of its sources. Every (fact, source)
 * pair has one record. Only a person may set `verified`, with who, when and the
 * supporting text from the page.
 */
export const VERIFICATION_STATUSES = ['unverified', 'verified', 'incorrect', 'unsupported'] as const;

/**
 * An automated fact-check against independent sources found by web search
 * (not the cited page). It can correct a claim before a human checks it, but
 * it is never a verification: `status` stays as the human left it.
 */
export const FACT_CHECK_RESULTS = ['corroborated', 'corrected', 'disputed'] as const;
/**
 * Why an automated check is weak evidence, set by `npm run verify:flag-weak`
 * so the claim can be revisited later (owner decision 2026-09-26):
 * `one-page` only one independent page backs it; `weak-pages` only Wikipedia,
 * blogs or forums back it; `unopened-source` the cited page couldn't be opened
 * (blocked, paywalled or read from search snippets).
 */
export const WEAK_EVIDENCE_REASONS = ['one-page', 'weak-pages', 'unopened-source'] as const;
export const FactCheck = z.object({
  result: z.enum(FACT_CHECK_RESULTS),
  /** What the independent sources say, in a sentence or two. */
  evidence: z.string().trim().min(1).max(400),
  urls: z.array(z.url()).min(1).max(3),
  checkedAt: z.iso.date(),
  /** The claim's wording before a correction, so a verifier can see what changed. */
  previousText: z.string().max(300).optional(),
  /** Set when this check is weak evidence; such claims are revisited first. */
  weak: z.array(z.enum(WEAK_EVIDENCE_REASONS)).min(1).optional(),
});
export type FactCheck = z.infer<typeof FactCheck>;

export const VerificationRecord = z.object({
  factId: id('fact'),
  sourceId: id('source'),
  status: z.enum(VERIFICATION_STATUSES),
  /** Exact text copied from the source page that supports the claim. */
  supportingQuote: z.string().trim().min(1).max(600).optional(),
  checkedBy: z.string().trim().min(1).max(80).optional(),
  checkedAt: z.iso.date().optional(),
  notes: z.string().max(600).optional(),
  /** Automated drafting note flagging what to look at. Never a verification. */
  preCheck: z.string().max(600).optional(),
  /** Automated fact-check against independent sources. Never a verification. */
  factCheck: FactCheck.optional(),
});
export type VerificationRecord = z.infer<typeof VerificationRecord>;

export const Concept = z.object({
  id: id('concept'),
  title: text(80),
  description: text(300),
  /** 0 (fundamental) … 1 (specialist). */
  difficulty: z.number().min(0).max(1),
  facts: z.array(Fact).min(1),
});
export type Concept = z.infer<typeof Concept>;

/**
 * An optional Dr. Scroll aside on a learning card: a calm pose and one short
 * line, placed deliberately by the writer (docs/mascot.md). Never on question
 * cards: he doesn't appear before an answer.
 */
export const MascotAside = z.object({ pose: z.enum(QUIET_MASCOT_POSES), line: text(MASCOT_LINE_MAX) });
export type MascotAside = z.infer<typeof MascotAside>;

const cardBase = { id: id('card') };
const learningCardBase = { ...cardBase, mascot: MascotAside.optional() };

export const TextCard = z.object({
  ...learningCardBase,
  type: z.literal('text'),
  /** hook | explain | connect: the editorial role, which lets the player style/pace it. */
  role: z.enum(['hook', 'explain', 'connect']),
  headline: text(TEXT_BUDGET.headline),
  body: text(TEXT_BUDGET.body).optional(),
  callout: text(120).optional(),
});

export const ImageCard = z.object({
  ...learningCardBase,
  type: z.literal('image'),
  assetId: id('asset'),
  caption: text(160).optional(),
});

export const FactCard = z.object({
  ...learningCardBase,
  type: z.literal('fact'),
  fact: text(TEXT_BUDGET.factFact),
  context: text(TEXT_BUDGET.body).optional(),
});

export const TimelineCard = z.object({
  ...learningCardBase,
  type: z.literal('timeline'),
  headline: text(TEXT_BUDGET.headline),
  events: z.array(z.object({ when: text(40), label: text(120) })).min(2).max(6),
});

export const ComparisonCard = z.object({
  ...learningCardBase,
  type: z.literal('comparison'),
  headline: text(TEXT_BUDGET.headline),
  items: z.array(z.object({ label: text(40), points: z.array(text(100)).min(1).max(4) })).min(2).max(3),
});

export const McqCard = z.object({
  ...cardBase,
  type: z.literal('mcq'),
  questionId: id('question'),
});

/** A question that deliberately re-tests a concept taught in an earlier level. */
export const RecallCard = z.object({
  ...cardBase,
  type: z.literal('recall'),
  questionId: id('question'),
});

export const CheckpointCard = z.object({
  ...learningCardBase,
  type: z.literal('checkpoint'),
  headline: text(TEXT_BUDGET.headline),
  learned: z.array(text(120)).min(1).max(5),
});

export const Card = z.discriminatedUnion('type', [
  TextCard,
  ImageCard,
  FactCard,
  TimelineCard,
  ComparisonCard,
  McqCard,
  RecallCard,
  CheckpointCard,
]);
export type Card = z.infer<typeof Card>;
export type CardType = Card['type'];

export const AnswerOption = z.object({
  id: z.string().regex(/^[a-z]$/, 'option ids are single letters a–z'),
  label: text(TEXT_BUDGET.answerLabel),
  correct: z.boolean(),
  /** Why this option is right or wrong (shown after answering). */
  rationale: text(200).optional(),
});

export const Question = z.object({
  id: id('question'),
  kind: z.literal('mcq'),
  /** recall: the core fact · understanding: why/how · connection: link to another idea. */
  purpose: z.enum(QUESTION_PURPOSES),
  conceptIds: z.array(id('concept')).min(1),
  /**
   * The learning cards that teach the answer. After a wrong first attempt they are
   * shown beneath the question ("Take another look") until it's answered correctly.
   * Cards from this level, or from an earlier level of the same skill for recall/
   * connection questions. Never generated at runtime.
   */
  sourceCardIds: z.array(id('card')).min(1),
  prompt: text(TEXT_BUDGET.questionPrompt),
  options: z.array(AnswerOption).min(2).max(4),
  explanation: text(TEXT_BUDGET.explanation),
  difficulty: z.number().min(0).max(1),
});
export type Question = z.infer<typeof Question>;

/**
 * A level's illustration, by its ID in docs/image-manifest.md (e.g.
 * "astronomy.mars"). Decorative; the app shows it only once the image file
 * exists (npm run art:sync).
 */
export const ArtId = z.string().regex(/^[a-z]+\.[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be an image ID like astronomy.mars');

export const LevelConcept = z.object({
  conceptId: id('concept'),
  /** teach · reinforce · recall · preview (mentioned in passing before a later level teaches it fully). */
  role: z.enum(['teach', 'reinforce', 'recall', 'preview']),
  weight: z.number().positive().max(1).default(1),
});

export const Level = z.object({
  id: id('level'),
  skillId: id('skill'),
  number: z.number().int().positive(),
  /** regular | checkpoint | milestone | mastery. It sets the learning structure and the canonical question count (3 · 5 · 7 · 10, LEARNING_STRUCTURE). */
  type: z.enum(LEVEL_TYPES),
  revision: z.number().int().positive(),
  status: ContentStatus,
  title: text(60),
  /** One clear learning objective: "After this level you can …". */
  objective: text(200),
  summary: text(200),
  concepts: z.array(LevelConcept).min(1),
  prerequisites: z.array(id('level')),
  cards: z.array(Card),
  questions: z.array(Question),
  sourceIds: z.array(id('source')).min(1),
  art: ArtId.optional(),
});
export type Level = z.infer<typeof Level>;
export type LevelInput = z.input<typeof Level>;

export const Skill = z.object({
  id: id('skill'),
  subjectId: id('subject'),
  name: text(40),
  order: z.number().int().nonnegative(),
  status: ContentStatus,
  description: text(200),
  /** What reaching Level 100 means, as the learner would say it ("I can walk through a major museum and understand what I'm looking at"). */
  masteryPromise: text(140).optional(),
});
export type Skill = z.infer<typeof Skill>;

export const Subject = z.object({
  id: id('subject'),
  name: text(40),
  order: z.number().int().nonnegative(),
  status: ContentStatus,
});
export type Subject = z.infer<typeof Subject>;

/**
 * The planned 1–100 outline for a skill: chapter titles and, per level, the
 * title and learning objective. Levels are drafted against it; the validator
 * warns when a drafted level drifts from its plan.
 */
export const Syllabus = z.object({
  skillId: id('skill'),
  chapters: z
    .array(z.object({ number: z.number().int().positive(), title: text(60), levels: z.tuple([z.number().int().positive(), z.number().int().positive()]) }))
    .min(1),
  levels: z.array(z.object({ number: z.number().int().positive(), title: text(60), objective: text(200), art: ArtId.optional() })).min(1),
});
export type Syllabus = z.infer<typeof Syllabus>;
