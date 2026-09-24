// Approve / reject, registry editing, and basic search.
import fs from 'node:fs';
import path from 'node:path';
import { paths, settings } from './config.ts';
import { generateMetadata, registerAliases } from './metadata.ts';
import {
  ID_PATTERN, cleanList, cleanText, idToFilename, normalizeConcept,
} from './normalize.ts';
import { aliases, findEntry, queue, registry, saveAliases, saveQueue, saveRegistry, touch } from './store.ts';
import type { QueueItem, RegistryEntry, Specificity } from './types.ts';

export function approve(item: QueueItem): RegistryEntry {
  if (item.status !== 'GENERATED' || !item.image) throw new Error('Only generated images can be approved.');
  if (!ID_PATTERN.test(item.id)) throw new Error(`Invalid asset ID "${item.id}".`);

  const filename = idToFilename(item.id);
  fs.copyFileSync(path.join(paths.assets, item.image), path.join(paths.approved, filename));

  const now = new Date().toISOString();
  const previous = findEntry(item.id);
  const [provider, ...model] = (item.provider_model || 'openai/unknown').split('/');
  const entry: RegistryEntry = {
    id: item.id,
    label: item.label,
    canonical_concept: item.canonical_concept,
    category: item.id.split('.')[0],
    subcategory: previous?.subcategory ?? '',
    description: previous?.description ?? '',
    tags: previous?.tags ?? [],
    aliases: previous?.aliases ?? [],
    related_concepts: previous?.related_concepts ?? [],
    concepts_supported: previous?.concepts_supported ?? [],
    not_for: previous?.not_for ?? [],
    visual_features: [],
    specificity: previous?.specificity ?? 'generic',
    subject_count: 1,
    orientation: '',
    asset_type: 'illustration',
    source_contexts: cleanList([...(previous?.source_contexts ?? []), ...item.contexts]),
    style_version: settings.styleVersion,
    filename,
    format: 'png',
    transparent: !!item.transparent,
    width: item.width ?? 0,
    height: item.height ?? 0,
    provider,
    provider_model: model.join('/'),
    generation_prompt: item.prompt ?? '',
    status: 'approved',
    metadata_status: 'pending',
    created_at: previous?.created_at ?? now,
    approved_at: now,
    updated_at: now,
    notes: previous?.notes ?? '',
  };
  if (previous) registry.splice(registry.indexOf(previous), 1);
  registry.push(entry);
  saveRegistry();

  item.status = 'APPROVED';
  item.existing_id = item.id;
  touch(item);
  saveQueue();

  // Metadata runs in the background; the review grid stays fast.
  void generateMetadata(entry.id, item.inputs);
  return entry;
}

export function reject(item: QueueItem): void {
  if (item.status === 'APPROVED') throw new Error('Approved assets cannot be rejected here.');
  if (item.image?.startsWith('generated/')) {
    const name = path.basename(item.image);
    fs.renameSync(path.join(paths.assets, item.image), path.join(paths.rejected, name));
    item.image = `rejected/${name}`;
  }
  item.status = 'REJECTED';
  touch(item);
  saveQueue();
}

const TEXT_FIELDS = ['label', 'canonical_concept', 'category', 'subcategory', 'description', 'notes'] as const;
const LIST_FIELDS = ['tags', 'aliases', 'related_concepts', 'concepts_supported', 'not_for', 'visual_features'] as const;

export function updateEntry(id: string, patch: Record<string, unknown>): RegistryEntry {
  const e = findEntry(id);
  if (!e) throw new Error(`No asset "${id}".`);

  for (const f of TEXT_FIELDS) if (typeof patch[f] === 'string') e[f] = cleanText(patch[f], 1000);
  e.canonical_concept = normalizeConcept(e.canonical_concept) || e.canonical_concept;
  for (const f of LIST_FIELDS) if (f in patch) e[f] = cleanList(patch[f], 30, f === 'tags');
  if (['generic', 'specific', 'named'].includes(patch.specificity as string)) e.specificity = patch.specificity as Specificity;

  const newId = typeof patch.id === 'string' ? patch.id.trim() : id;
  if (newId !== id) {
    if (!ID_PATTERN.test(newId)) throw new Error(`Invalid asset ID "${newId}". Use lowercase like object.telescope.`);
    if (findEntry(newId)) throw new Error(`Asset "${newId}" already exists.`);
    const filename = idToFilename(newId);
    fs.renameSync(path.join(paths.approved, e.filename), path.join(paths.approved, filename));
    e.id = newId;
    e.filename = filename;
    for (const [k, v] of Object.entries(aliases)) if (v === id) aliases[k] = newId;
    saveAliases();
    for (const q of queue) {
      if (q.id === id) q.id = newId;
      if (q.existing_id === id) q.existing_id = newId;
    }
    saveQueue();
  }
  e.category = e.id.split('.')[0];
  e.updated_at = new Date().toISOString();
  saveRegistry();
  registerAliases(e);
  return e;
}

/** Plain text search with simple field weighting. No embeddings. */
export function search(query: string): RegistryEntry[] {
  const q = normalizeConcept(query);
  if (!q) return [...registry].sort((a, b) => a.label.localeCompare(b.label));
  const tokens = q.split(' ');
  const lc = (s: string) => s.toLowerCase();

  const fields: [(e: RegistryEntry) => string[], number][] = [
    [(e) => [e.id, lc(e.label), e.canonical_concept], 10],
    [(e) => e.aliases.map(lc), 8],
    [(e) => e.tags, 6],
    [(e) => e.concepts_supported.map(lc), 5],
    [(e) => e.related_concepts.map(lc), 3],
  ];

  const scored = registry.map((e) => {
    let score = 0;
    if (e.canonical_concept === q || lc(e.label) === q || e.id === q) score += 100;
    if (aliases[q] === e.id) score += 80;
    for (const [get, weight] of fields) {
      const values = get(e);
      if (values.some((v) => v.includes(q))) score += weight * 2;
      for (const t of tokens) if (values.some((v) => v.split(/[\s.-]+/).map(singular).includes(t))) score += weight;
    }
    return { e, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).map((s) => s.e);
}

const singular = (w: string) => normalizeConcept(w);
