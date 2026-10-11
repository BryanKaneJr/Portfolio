import { newGame } from '../src/sim/state';
import { advanceDay } from '../src/sim/tick';
import { REGION, isSea } from '../src/sim/content';
import { ownedRegions } from '../src/sim/queries';

const canonical = (x: unknown): string =>
  JSON.stringify(x, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v));

describe('long AI game', () => {
  test('25 years of AI play keep the world consistent', () => {
    const s = newGame({ player: 'POR', seed: 11 });
    s.flags.__spectate = 1;
    for (let i = 0; i < 365 * 25; i++) advanceDay(s);
    for (const n of Object.values(s.nations)) {
      for (const v of [n.gold, n.manpower, n.prestige, n.threat, n.stability]) expect(Number.isFinite(v)).toBe(true);
      if (n.alive) expect(ownedRegions(s, n.id).length).toBeGreaterThan(0);
      if (n.alive) expect(s.regions[n.capital].owner).toBe(n.id);
    }
    for (const r of Object.values(s.regions)) {
      expect(s.nations[r.owner].alive).toBe(true);
      expect(r.dev).toBeGreaterThanOrEqual(1);
      expect(r.dev).toBeLessThanOrEqual(10);
    }
    for (const a of Object.values(s.armies)) {
      expect(REGION[a.node] || isSea(a.node)).toBeTruthy();
      for (const t of ['inf', 'cav', 'art'] as const) expect(a.regs[t].men).toBeGreaterThanOrEqual(0);
      if (a.owner !== 'REB') expect(s.nations[a.owner].alive).toBe(true);
    }
    for (const w of Object.values(s.wars)) {
      for (const n of [...w.attackers, ...w.defenders]) expect(s.nations[n].alive).toBe(true);
    }
    // Something happened.
    const changed = Object.values(s.regions).filter(r => r.owner !== REGION[r.id].owner).length;
    expect(changed).toBeGreaterThan(3);
  }, 120000);

  test('the simulation is deterministic for a seed, and survives a save/load round trip', () => {
    const run = (days: number) => {
      const s = newGame({ player: 'FRA', seed: 99 });
      for (let i = 0; i < days; i++) advanceDay(s);
      return s;
    };
    const a = run(400);
    const b = run(400);
    expect(canonical(a)).toBe(canonical(b));
    const c = JSON.parse(JSON.stringify(a));
    for (let i = 0; i < 200; i++) {
      advanceDay(a);
      advanceDay(c);
    }
    // Key order can differ after a reload (fields set to undefined vanish from JSON), so compare canonically.
    expect(canonical(c)).toBe(canonical(a));
  }, 120000);
});
