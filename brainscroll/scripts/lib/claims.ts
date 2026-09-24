import type { Card, Concept, Fact, Level, Question, Source, ValidatedContent, VerificationRecord } from '@brainscroll/core';

/**
 * The claim index: every (fact, source) pair with everything a human needs to
 * check it in one place: the exact claim, the source URL, and where it appears
 * (level, card text, questions that test it). Shared by the verification
 * report, the CLI and the admin tool.
 */
export interface ClaimRow {
  fact: Fact;
  concept: Concept;
  source: Source | undefined;
  sourceId: string;
  record: VerificationRecord;
  appearsIn: { level: Level; card: Card; text: string }[];
  testedBy: { level: Level; question: Question; answer: string }[];
}

export function cardText(card: Card): string {
  switch (card.type) {
    case 'text':
      return [card.headline, card.body, card.callout].filter(Boolean).join(' — ');
    case 'fact':
      return [card.fact, card.context].filter(Boolean).join(' — ');
    case 'timeline':
      return `${card.headline}: ${card.events.map((e) => `${e.when}: ${e.label}`).join('; ')}`;
    case 'comparison':
      return `${card.headline}: ${card.items.map((i) => `${i.label} (${i.points.join('; ')})`).join(' vs ')}`;
    case 'checkpoint':
      return `${card.headline}: ${card.learned.join('; ')}`;
    case 'image':
      return card.caption ?? `[image ${card.assetId}]`;
    default:
      return '';
  }
}

export function claimIndex(content: ValidatedContent): ClaimRow[] {
  const sourceById = new Map(content.sources.map((s) => [s.id, s]));
  const records = new Map(content.verification.map((r) => [`${r.factId}|${r.sourceId}`, r]));
  const cardLoc = new Map(content.levels.flatMap((level) => level.cards.map((card) => [card.id, { level, card }] as const)));
  const rows: ClaimRow[] = [];
  for (const concept of content.concepts) {
    for (const fact of concept.facts) {
      const appearsIn = fact.cardIds.flatMap((cid) => {
        const loc = cardLoc.get(cid);
        return loc ? [{ ...loc, text: cardText(loc.card) }] : [];
      });
      const factCards = new Set(fact.cardIds);
      const testedBy = content.levels.flatMap((level) =>
        level.questions
          .filter((q) => q.conceptIds.includes(concept.id) && q.sourceCardIds.some((c) => factCards.has(c)))
          .map((question) => ({ level, question, answer: question.options.find((o) => o.correct)?.label ?? '?' })),
      );
      for (const sourceId of fact.sourceIds) {
        rows.push({
          fact,
          concept,
          sourceId,
          source: sourceById.get(sourceId),
          record: records.get(`${fact.id}|${sourceId}`) ?? { factId: fact.id, sourceId, status: 'unverified' },
          appearsIn,
          testedBy,
        });
      }
    }
  }
  return rows;
}

export function skillSlugOf(factId: string): string {
  return factId.split('.')[1]!;
}
