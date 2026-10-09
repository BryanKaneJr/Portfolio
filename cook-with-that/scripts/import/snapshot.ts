import { execFileSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { isAbsolute, join } from 'path';

/**
 * A pinned copy of a source, so a report or draft can always be reproduced:
 * - `git`: one commit of a repository, fetched into .import-cache/ (git-ignored);
 * - `file`: a snapshot committed to this repo (for sites with no repository), relative to the
 *   project root and written by that source's fetch script (e.g. `npm run import:fetch-nhlbi`).
 */
export type Snapshot = { kind: 'git'; url: string; commit: string } | { kind: 'file'; path: string };

/** One line for the report header naming exactly what was read. */
export function describeSnapshot(snapshot: Snapshot): string {
  return snapshot.kind === 'git'
    ? `${snapshot.url.replace(/\.git$/, '')} at \`${snapshot.commit}\``
    : `the committed snapshot \`${snapshot.path}\``;
}

/**
 * Where a source's reader should look: the checkout directory of a git snapshot (fetched on
 * first use; network is fine here, only the app in src/ must stay offline), or the absolute
 * path of a committed file snapshot.
 */
export function openSnapshot(snapshot: Snapshot, opts: { root: string; cacheDir: string }): string {
  if (snapshot.kind === 'file') {
    if (isAbsolute(snapshot.path) || snapshot.path.split(/[\\/]/).includes('..'))
      throw new Error(`snapshot path "${snapshot.path}" must be relative to the project and stay inside it`);
    const path = join(opts.root, snapshot.path);
    if (!existsSync(path)) throw new Error(`snapshot file ${snapshot.path} is missing; see the README next to it`);
    return path;
  }
  const dir = opts.cacheDir;
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', dir, ...args], { stdio: 'pipe' })
      .toString()
      .trim();
  if (existsSync(join(dir, '.git')) && git('rev-parse', 'HEAD') === snapshot.commit) return dir;
  mkdirSync(dir, { recursive: true });
  if (!existsSync(join(dir, '.git'))) git('init', '-q');
  console.log(`Fetching ${snapshot.url} @ ${snapshot.commit.slice(0, 10)}…`);
  git('fetch', '-q', '--depth', '1', snapshot.url, snapshot.commit);
  git('checkout', '-q', '--force', 'FETCH_HEAD');
  return dir;
}
