import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The levels in the last app build (app/src/content/built/levels/*.json): the
 * baseline that published levels mustn't change against without a revision
 * bump. Undefined when nothing has been built yet.
 */
export function readBuiltLevels(builtDir: string): unknown[] | undefined {
  const dir = join(builtDir, 'levels');
  if (!existsSync(dir)) return undefined;
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as unknown[]);
}
