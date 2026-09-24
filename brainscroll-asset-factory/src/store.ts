// JSON persistence for the registry, aliases, and the working queue.
import fs from 'node:fs';
import { paths } from './config.ts';
import type { QueueItem, RegistryEntry } from './types.ts';

function readJSON<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(file: string, value: unknown): void {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

export const registry: RegistryEntry[] = readJSON(paths.registry, []);
/** normalized phrase -> canonical asset id */
export const aliases: Record<string, string> = readJSON(paths.aliases, {});
export const queue: QueueItem[] = readJSON(paths.queue, []);

// Generations interrupted by a restart go back to PENDING ("Generate Pending" resumes them).
for (const item of queue) if (item.status === 'GENERATING') item.status = 'PENDING';

export const saveRegistry = () => {
  registry.sort((a, b) => a.id.localeCompare(b.id));
  writeJSON(paths.registry, registry);
};
export const saveAliases = () => {
  const sorted = Object.fromEntries(Object.entries(aliases).sort(([a], [b]) => a.localeCompare(b)));
  writeJSON(paths.aliases, sorted);
};
export const saveQueue = () => writeJSON(paths.queue, queue);

export const findEntry = (id: string) => registry.find((e) => e.id === id);
export const findItem = (key: string) => queue.find((q) => q.key === key);

export function touch(item: QueueItem): void {
  item.updated_at = new Date().toISOString();
}
