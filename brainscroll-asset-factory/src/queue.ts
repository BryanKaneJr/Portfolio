// Low-concurrency generation worker.
import fs from 'node:fs';
import path from 'node:path';
import { paths, settings } from './config.ts';
import { generateImage } from './image-provider.ts';
import { inspectPng } from './png.ts';
import { buildPrompt } from './prompt.ts';
import { queue, saveQueue, touch } from './store.ts';
import type { QueueItem } from './types.ts';

export const run = { total: 0, done: 0, failed: 0 };
let active = 0;

const GENERATABLE = new Set(['PROPOSED', 'PENDING', 'FAILED', 'REJECTED', 'GENERATED', 'APPROVED']);

export function enqueue(items: QueueItem[]): number {
  if (active === 0 && !queue.some((q) => q.status === 'PENDING')) Object.assign(run, { total: 0, done: 0, failed: 0 });
  let added = 0;
  for (const item of items) {
    if (!GENERATABLE.has(item.status)) continue;
    item.status = 'PENDING';
    item.error = undefined;
    touch(item);
    added++;
  }
  // Items left PENDING from a restart also count toward this run.
  run.total = run.done + active + queue.filter((q) => q.status === 'PENDING').length;
  saveQueue();
  pump();
  return added;
}

function pump(): void {
  while (active < settings.concurrency) {
    const next = queue.find((q) => q.status === 'PENDING');
    if (!next) return;
    next.status = 'GENERATING';
    active++;
    generateOne(next).finally(() => {
      active--;
      run.done++;
      saveQueue();
      pump();
    });
  }
}

async function generateOne(item: QueueItem): Promise<void> {
  touch(item);
  item.attempts++;
  const prompt = buildPrompt(item);
  item.prompt = prompt;
  saveQueue();
  try {
    const result = await generateImage(prompt, item.id);
    const info = inspectPng(result.png);
    const file = `${item.id.replace(/\./g, '_')}__${Date.now()}.png`;
    fs.writeFileSync(path.join(paths.generated, file), result.png);
    if (item.image) item.history.push(item.image);
    Object.assign(item, {
      image: `generated/${file}`,
      transparent: info.transparent,
      width: info.width,
      height: info.height,
      provider_model: `${result.provider}/${result.model}`,
      status: 'GENERATED',
    });
  } catch (err) {
    item.status = 'FAILED';
    item.error = (err as Error).message;
    run.failed++;
  }
  touch(item);
}
