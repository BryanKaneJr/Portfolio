// LOCKED BRAINSCROLL STYLE + SIMPLE SUBJECT DESCRIPTION
import fs from 'node:fs';
import { paths, settings } from './config.ts';
import type { QueueItem } from './types.ts';

/** The spec file as sent to the model: lines starting with # are editor notes and are dropped. */
export function readStyle(): string {
  return fs
    .readFileSync(paths.style, 'utf8')
    .split(/\r?\n/)
    .filter((l) => !l.trimStart().startsWith('#'))
    .join('\n')
    .trim();
}

export function readStyleFile(): string {
  return fs.readFileSync(paths.style, 'utf8');
}

export function buildPrompt(item: Pick<QueueItem, 'label' | 'subject' | 'notes'>): string {
  const subject = item.subject.trim() || `${item.label}.`;
  const lines = [
    `[${settings.styleVersion}]`,
    readStyle(),
    '',
    'SUBJECT:',
    subject,
    '',
    `Depict one isolated ${item.label.toLowerCase()}.`,
  ];
  if (item.notes.trim()) lines.push(item.notes.trim());
  lines.push(
    'Transparent background.',
    'No environment or scenery.',
    'No text.',
    'The subject must remain instantly recognizable at mobile size.',
  );
  return lines.join('\n');
}
