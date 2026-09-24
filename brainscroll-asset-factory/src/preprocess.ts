// Turns a pasted list into queue items: normalize, dedupe, match the library, flag abstract concepts.
import { randomUUID } from 'node:crypto';
import { chatJSON, hasLLM } from './llm.ts';
import {
  CATEGORY_GUIDE, cleanText, idError, looksAbstract, normalizeConcept, slugify, titleCase,
} from './normalize.ts';
import { aliases, findEntry, queue, registry, saveQueue } from './store.ts';
import type { QueueItem } from './types.ts';

export const MAX_BATCH = 150;

interface Proposal {
  canonical_concept: string;
  label: string;
  id: string;
  category: string;
  subject: string;
  notes: string;
  existing_id: string | null;
  abstract: boolean;
  reason: string;
}

/** Exact lookups: alias table, canonical concepts, registry aliases, and ID names. */
export function lookupExisting(normalized: string): string | null {
  if (aliases[normalized] && findEntry(aliases[normalized])) return aliases[normalized];
  const slug = slugify(normalized);
  for (const e of registry) {
    if (e.canonical_concept === normalized) return e.id;
    if (e.aliases.some((a) => normalizeConcept(a) === normalized)) return e.id;
  }
  const byName = registry.filter((e) => e.id.split('.').slice(1).join('.') === slug);
  return byName.length === 1 ? byName[0].id : null;
}

function heuristicProposal(concept: string): Proposal {
  const abstract = looksAbstract(concept);
  return {
    canonical_concept: concept,
    label: titleCase(concept),
    id: `object.${slugify(concept)}`,
    category: 'object',
    subject: `${titleCase(concept)}.`,
    notes: '',
    existing_id: null,
    abstract,
    reason: abstract ? 'Looks abstract (keyword check). Override if it can be drawn as one object.' : '',
  };
}

const SYSTEM = `You prepare concept lists for BrainScroll's reusable illustration library.
The library holds simple visual nouns: things that can reasonably be drawn as one isolated, recognizable illustration (telescope, crown, volcano, horse, castle, smartphone).
Abstract ideas (democracy, inflation, gravity, industrialization, supply and demand, the fall of Rome) do not belong; they need diagrams.
Return JSON only. Never use em dashes in any text; use commas, colons, or separate sentences.`;

async function llmProposals(concepts: string[], category: string): Promise<Proposal[]> {
  const library = registry.map((e) => `${e.id}: ${e.canonical_concept}`).join('\n') || '(empty)';
  const user = `Batch context category: ${category || 'none'}. This is context only. Choose the asset category from what the thing IS; a telescope is object.telescope even in an Astronomy batch.

Allowed ID categories (use exactly one of these as the first segment):
${Object.entries(CATEGORY_GUIDE).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

ID format: category.name with lowercase words joined by hyphens, e.g. object.telescope, artifact.roman-helmet, architecture.castle, animal.horse, nature.volcano. Only named entities get a third segment, e.g. science.planet.saturn.

Existing library assets (id: concept):
${library}

Incoming concepts:
${concepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Return {"items": [...]} with exactly one entry per incoming concept, in the same order:
{
  "input": the incoming text,
  "canonical_concept": singular lowercase name of the thing to draw. Drop modifiers that do not change the picture ("astronomical telescope" becomes "telescope"). Keep modifiers that do ("roman helmet" is not "helmet", "sailing ship" is not "ship"),
  "label": clean Title Case display label,
  "id": proposed asset ID,
  "existing_id": the existing library ID if it is the same visual asset, otherwise null,
  "abstract": true if it cannot reasonably be one isolated recognizable illustration,
  "reason": short reason when abstract, otherwise "",
  "subject": one short sentence saying exactly what to depict, e.g. "Optical telescope mounted on a tripod.",
  "notes": optional extra depiction constraints such as "No person wearing it.", otherwise ""
}
Incoming concepts that would produce the same picture must share the same id.`;

  const out = await chatJSON<{ items?: Record<string, unknown>[] }>(SYSTEM, user);
  const items = Array.isArray(out.items) ? out.items : [];
  return concepts.map((concept, i) => {
    const r = items[i] ?? {};
    const base = heuristicProposal(concept);
    const id = typeof r.id === 'string' && !idError(r.id) ? r.id : base.id;
    const canonical = normalizeConcept(cleanText(r.canonical_concept)) || concept;
    const existing = typeof r.existing_id === 'string' && findEntry(r.existing_id) ? r.existing_id : null;
    return {
      canonical_concept: canonical,
      label: cleanText(r.label, 80) || titleCase(canonical),
      id,
      category: id.split('.')[0],
      subject: cleanText(r.subject, 300) || base.subject,
      notes: cleanText(r.notes, 300),
      existing_id: existing,
      abstract: r.abstract === true,
      reason: cleanText(r.reason, 200),
    };
  });
}

function newItem(p: Proposal, inputs: string[], contexts: string[]): QueueItem {
  const now = new Date().toISOString();
  return {
    key: randomUUID(),
    inputs,
    canonical_concept: p.canonical_concept,
    label: p.label,
    id: p.id,
    category: p.category,
    subject: p.subject,
    notes: p.notes,
    contexts,
    status: 'PROPOSED',
    history: [],
    attempts: 0,
    created_at: now,
    updated_at: now,
  };
}

function mergeInto(item: QueueItem, inputs: string[], contexts: string[]) {
  for (const s of inputs) if (!item.inputs.includes(s)) item.inputs.push(s);
  for (const c of contexts) if (!item.contexts.includes(c)) item.contexts.push(c);
}

export async function preprocess(text: string, category: string) {
  const contexts = category.trim() ? [cleanText(category, 60)] : [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > MAX_BATCH) throw new Error(`Please paste at most ${MAX_BATCH} concepts per batch.`);

  // 1-3: normalize, then group exact duplicates within the batch.
  const groups = new Map<string, string[]>();
  for (const line of lines) {
    const n = normalizeConcept(line);
    if (!n) continue;
    groups.set(n, [...(groups.get(n) ?? []), line]);
  }

  // 4-5: exact library matches need no model call.
  const proposals = new Map<string, Proposal>();
  const unresolved: string[] = [];
  for (const n of groups.keys()) {
    const existing = lookupExisting(n);
    if (existing) {
      const e = findEntry(existing)!;
      proposals.set(n, { ...heuristicProposal(n), canonical_concept: e.canonical_concept, label: e.label, id: e.id, category: e.category, existing_id: e.id, abstract: false });
    } else unresolved.push(n);
  }

  // 6-10: language model assistance for aliases, abstractness, IDs, and labels.
  let warning = '';
  if (unresolved.length) {
    let results: Proposal[] = [];
    if (hasLLM()) {
      try {
        for (let i = 0; i < unresolved.length; i += 40) {
          results.push(...(await llmProposals(unresolved.slice(i, i + 40), category)));
        }
      } catch (err) {
        warning = `Language model check failed, used simple rules instead. ${(err as Error).message}`;
        results = [];
      }
    }
    if (results.length !== unresolved.length) results = unresolved.map(heuristicProposal);
    unresolved.forEach((n, i) => proposals.set(n, results[i]));
  }

  // Merge everything that resolved to the same asset ID, in the batch and in the current queue.
  const counts = { added: 0, existing: 0, abstract: 0, merged: 0 };
  const byId = new Map<string, QueueItem>();
  for (const [n, p] of proposals) {
    const inputs = groups.get(n)!;
    const existingId = p.existing_id ?? (findEntry(p.id) ? p.id : null);
    const targetId = existingId ?? p.id;

    const batchTwin = byId.get(targetId);
    if (batchTwin) {
      mergeInto(batchTwin, inputs, contexts);
      counts.merged++;
      continue;
    }
    const queued = queue.find(
      (q) =>
        q.id === targetId &&
        !q.style_test &&
        (existingId ? q.status === 'EXISTING' : !['REJECTED', 'APPROVED', 'EXISTING'].includes(q.status)),
    );
    if (queued) {
      mergeInto(queued, inputs, contexts);
      byId.set(targetId, queued);
      counts.merged++;
      continue;
    }

    const item = newItem(p, inputs, contexts);
    if (existingId) {
      item.status = 'EXISTING';
      item.existing_id = existingId;
      item.id = existingId;
      item.reason = 'Already in the library.';
      counts.existing++;
    } else if (p.abstract) {
      item.status = 'TOO_ABSTRACT';
      item.reason = p.reason || 'Too abstract for a single isolated illustration.';
      counts.abstract++;
    } else counts.added++;
    byId.set(targetId, item);
    queue.push(item);
  }
  saveQueue();
  return { ...counts, total: groups.size, warning };
}
