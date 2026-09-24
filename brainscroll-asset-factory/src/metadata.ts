// Automatic semantic + visual metadata for approved assets, based on the concept and the actual image.
import fs from 'node:fs';
import path from 'node:path';
import { paths } from './config.ts';
import { chatJSON, hasLLM } from './llm.ts';
import { cleanList, cleanText, normalizeConcept } from './normalize.ts';
import { aliases, findEntry, saveAliases, saveRegistry } from './store.ts';
import type { RegistryEntry, Specificity } from './types.ts';

const SYSTEM = `You write asset metadata for BrainScroll, an educational mobile app with a reusable illustration library.
You receive one approved illustration and its canonical concept.
Describe what is actually visible in the image, and describe when the illustration is appropriate for a lesson.
Return JSON only. Never use em dashes in any text; use commas, colons, or separate sentences.`;

function userPrompt(e: RegistryEntry, inputs: string[]): string {
  return `Concept: ${e.canonical_concept}
Label: ${e.label}
Asset ID: ${e.id}
Category: ${e.category}
Lesson contexts it was requested for: ${e.source_contexts.join(', ') || 'none'}
Input phrasings: ${inputs.join(', ') || 'none'}

Return a JSON object with:
- "description": one or two plain sentences describing exactly what the image shows. Base it on the image, not only the concept.
- "subcategory": short lowercase phrase, e.g. "science equipment", "ancient armor", "landform".
- "tags": 6 to 12 lowercase search keywords.
- "aliases": 0 to 6 other names for this same picture. Do not repeat the concept itself.
- "related_concepts": 3 to 8 nearby topics or things often taught alongside it.
- "concepts_supported": 4 to 10 lesson topics that could reasonably use this image. Broader than the literal object; a Roman coin supports "Roman economy", "ancient money", "trade in ancient Rome".
- "not_for": 0 to 6 obvious semantic traps where this image would be wrong. A generic optical telescope is not for "radio telescope", "Hubble Space Telescope", "microscope". Leave empty when there are none.
- "visual_features": 2 to 6 visible parts or features.
- "specificity": "generic" (broad reusable type: planet, ship, coin), "specific" (recognizable subtype: gas giant, sailing ship, Roman coin), or "named" (one particular entity: Saturn, HMS Victory).
- "orientation": short phrase such as "front view", "side view", "three-quarter view".
- "subject_count": number of distinct subjects visible.
- "image_matches_concept": false only if the image clearly shows something other than the concept.`;
}

const SPECIFICITY: Specificity[] = ['generic', 'specific', 'named'];

export function registerAliases(e: RegistryEntry, extra: string[] = []): void {
  for (const phrase of [e.canonical_concept, e.label, ...e.aliases, ...extra]) {
    const n = normalizeConcept(phrase);
    if (n && (!aliases[n] || !findEntry(aliases[n]))) aliases[n] = e.id;
  }
  saveAliases();
}

function fallbackMetadata(e: RegistryEntry, inputs: string[]): void {
  const words = e.canonical_concept.split(' ');
  e.description ||= `Illustration of ${e.label}.`;
  e.tags = cleanList([e.canonical_concept, ...words, e.category, ...e.source_contexts], 12, true);
  e.aliases = cleanList(inputs.map(normalizeConcept).filter((a) => a !== e.canonical_concept), 6);
  e.concepts_supported = cleanList([e.canonical_concept, ...e.source_contexts], 10);
  e.metadata_status = 'fallback';
}

export async function generateMetadata(id: string, inputs: string[] = []): Promise<void> {
  const e = findEntry(id);
  if (!e) return;
  e.metadata_status = 'pending';
  e.metadata_error = undefined;
  saveRegistry();

  try {
    if (!hasLLM()) {
      fallbackMetadata(e, inputs);
    } else {
      const png = fs.readFileSync(path.join(paths.approved, e.filename));
      const r = await chatJSON<Record<string, unknown>>(SYSTEM, userPrompt(e, inputs), png);
      const inputAliases = inputs.map(normalizeConcept).filter((a) => a && a !== e.canonical_concept);
      e.description = cleanText(r.description) || e.description;
      e.subcategory = cleanText(r.subcategory, 60).toLowerCase();
      e.tags = cleanList([e.canonical_concept, ...cleanList(r.tags, 12)], 12, true);
      e.aliases = cleanList([...inputAliases, ...cleanList(r.aliases, 6)], 10).filter(
        (a) => a.toLowerCase() !== e.canonical_concept,
      );
      e.related_concepts = cleanList(r.related_concepts, 8);
      e.concepts_supported = cleanList(r.concepts_supported, 10);
      e.not_for = cleanList(r.not_for, 6);
      e.visual_features = cleanList(r.visual_features, 6, true);
      e.specificity = SPECIFICITY.includes(r.specificity as Specificity) ? (r.specificity as Specificity) : 'generic';
      e.orientation = cleanText(r.orientation, 40).toLowerCase();
      e.subject_count = Number.isInteger(r.subject_count) ? (r.subject_count as number) : 1;
      if (r.image_matches_concept === false && !e.notes.includes('Check image')) {
        e.notes = `Check image: metadata model thought it may not match the concept. ${e.notes}`.trim();
      }
      e.metadata_status = 'generated';
    }
  } catch (err) {
    e.metadata_status = 'failed';
    e.metadata_error = (err as Error).message;
  }
  e.updated_at = new Date().toISOString();
  saveRegistry();
  registerAliases(e, inputs);
}
