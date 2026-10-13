/** Which nations' map colours must differ, and by how much (OKLab distance, as the map draws them): shared by
 * scripts/dev/nation-colors.ts, which picks the colours, and tests/map.test.ts, which checks them. */
import { GRAPH, MAP } from '../../src/sim/content';
import { newGame } from '../../src/sim/state';

export const MIN_ALL = 0.05; // any two nations
export const MIN_NEAR = 0.1; // neighbours' neighbours, and across a shared sea
export const MIN_NEIGHBOUR = 0.16; // neighbours

/** Nation pairs: neighbours (land or strait between their regions at the start), and near (two steps, or a sea). */
export function nationPairs() {
  const s = newGame({ player: 'FRA', seed: 1 });
  const owner = (id: string) => s.regions[id]?.owner ?? null;
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const neighbours = new Set<string>();
  const adj = new Map<string, Set<string>>();
  for (const r of MAP.regions) {
    const a = owner(r.id);
    if (!a) continue;
    for (const e of GRAPH[r.id]) {
      if (e.kind !== 'land' && e.kind !== 'strait') continue;
      const b = owner(e.to);
      if (!b || b === a) continue;
      neighbours.add(key(a, b));
      if (!adj.has(a)) adj.set(a, new Set());
      adj.get(a)!.add(b);
    }
  }
  const near = new Set<string>();
  for (const [a, bs] of adj) for (const b of bs) for (const c of adj.get(b) ?? []) if (c !== a && !neighbours.has(key(a, c))) near.add(key(a, c));
  for (const sea of MAP.seas) {
    const coast = [...new Set(MAP.regions.filter(r => r.seas.includes(sea.id)).map(r => owner(r.id)).filter((o): o is string => !!o))];
    for (const a of coast) for (const b of coast) if (a < b && !neighbours.has(key(a, b))) near.add(key(a, b));
  }
  return { neighbours, near };
}
