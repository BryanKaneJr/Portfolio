import { z } from 'zod';
import { ID_PATTERNS, type IdKind } from './ids';
import { LEVEL_TYPES, QUESTION_PURPOSES, TEXT_BUDGET } from './constants';

/**
 * Stage 1 — content contract.
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

export const Fact = z.object({
  text: text(300),
  sourceIds: z.array(id('source')).min(1),
});

export const Concept = z.object({
  id: id('concept'),
  title: text(80),
  description: text(300),
  /** 0 (fundamental) … 1 (specialist). */
  difficulty: z.number().min(0).max(1),
  facts: z.array(Fact).min(1),
});
export type Concept = z.infer<typeof Concept>;

const cardBase = { id: id('card') };

export const TextCard = z.object({
  ...cardBase,
  type: z.literal('text'),
  /** hook | explain | connect — editorial role, lets the player style/pace it. */
  role: z.enum(['hook', 'explain', 'connect']),
  headline: text(TEXT_BUDGET.headline),
  body: text(TEXT_BUDGET.body).optional(),
  callout: text(120).optional(),
});

export const ImageCard = z.object({
  ...cardBase,
  type: z.literal('image'),
  assetId: id('asset'),
  caption: text(160).optional(),
});

export const FactCard = z.object({
  ...cardBase,
  type: z.literal('fact'),
  fact: text(TEXT_BUDGET.factFact),
  context: text(TEXT_BUDGET.body).optional(),
});

export const TimelineCard = z.object({
  ...cardBase,
  type: z.literal('timeline'),
  headline: text(TEXT_BUDGET.headline),
  events: z.array(z.object({ when: text(40), label: text(120) })).min(2).max(6),
});

export const ComparisonCard = z.object({
  ...cardBase,
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
  ...cardBase,
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
  /** Why this option is right or wrong — shown after answering. */
  rationale: text(200).optional(),
});

export const Question = z.object({
  id: id('question'),
  kind: z.literal('mcq'),
  /** recall: the core fact · understanding: why/how · connection: link to another idea. */
  purpose: z.enum(QUESTION_PURPOSES),
  conceptIds: z.array(id('concept')).min(1),
  prompt: text(TEXT_BUDGET.questionPrompt),
  options: z.array(AnswerOption).min(2).max(4),
  explanation: text(TEXT_BUDGET.explanation),
  difficulty: z.number().min(0).max(1),
});
export type Question = z.infer<typeof Question>;

export const LevelConcept = z.object({
  conceptId: id('concept'),
  role: z.enum(['teach', 'reinforce', 'recall']),
  weight: z.number().positive().max(1).default(1),
});

export const Level = z.object({
  id: id('level'),
  skillId: id('skill'),
  number: z.number().int().positive(),
  /** regular | checkpoint | milestone | mastery. It sets the expected learning/question structure. */
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
});
export type Skill = z.infer<typeof Skill>;

export const Subject = z.object({
  id: id('subject'),
  name: text(40),
  order: z.number().int().nonnegative(),
  status: ContentStatus,
});
export type Subject = z.infer<typeof Subject>;
