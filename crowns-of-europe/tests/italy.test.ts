/** Italy in 1444, dense like its history: 24 regions, the Pope's and the King of Naples' lands in four parts each. */
import { GRAPH, MAP, NATION, REGION, SCENARIO } from '../src/sim/content';
import { SAVE_VERSION, migrateSave, newGame, saveTooOld } from '../src/sim/state';
import type { GameState } from '../src/sim/types';
import { MIN_NAME_RADIUS, PLAY_K } from '../src/ui/map/anchors';
import { regionAt } from '../src/ui/map/geometry';

const ITALY = [
  'savoy', 'piedmont', 'montferrat', 'lombardy', 'parma', 'liguria', 'corsica', 'veneto', 'verona', 'friuli', 'ferrara',
  'tuscany', 'siena', 'romagna', 'marche', 'umbria', 'rome', 'abruzzo', 'naples', 'apulia', 'calabria', 'sicily',
  'messina', 'sardinia',
];
// Too narrow (Liguria, a strip as before; the Marche, a strip between the Apennines and the sea) or small (Montferrat,
// Corsica) for a name at the zoom the game opens at; their towns show there, and their names a little closer in.
const NO_NAME_AT_PLAY = ['montferrat', 'liguria', 'corsica', 'marche'];
const region = (id: string) => MAP.regions.find(r => r.id === id)!;

describe('Italy in 1444', () => {
  const s = newGame({ player: 'NAP', seed: 1 });
  const held = (n: string) => Object.values(s.regions).filter(r => r.owner === n).map(r => r.id).sort();

  test('the Kingdom of Naples and the Papal States each hold at least three regions', () => {
    expect(held('NAP')).toEqual(['abruzzo', 'apulia', 'calabria', 'naples']);
    expect(held('PAP')).toEqual(['marche', 'romagna', 'rome', 'umbria']);
  });

  test('every region of 1444 has its crown: Siena, Ferrara and Montferrat stand on their own', () => {
    for (const id of ITALY) expect(REGION[id]).toBeDefined();
    expect(held('SIE')).toEqual(['siena']);
    expect(held('FER')).toEqual(['ferrara']);
    expect(held('MON')).toEqual(['montferrat']);
    for (const n of ['SIE', 'FER', 'MON']) expect(NATION[n].area).toBe('italy');
    expect(held('VEN')).toEqual(expect.arrayContaining(['veneto', 'verona', 'friuli']));
    expect(held('ARA')).toEqual(expect.arrayContaining(['sicily', 'messina', 'sardinia']));
    // Alfonso's Naples is a crown of its own, allied to Aragon, and claims his other crown.
    expect(SCENARIO.alliances).toContainEqual(['ARA', 'NAP']);
    expect(s.nations.NAP.claims.sicily).toBeGreaterThan(s.day);
  });

  test('every Italian region can be reached: the mainland and Sicily on foot, Corsica and Sardinia by sea', () => {
    const walk = (from: string) => {
      const seen = new Set([from]);
      const queue = [from];
      while (queue.length) {
        const at = queue.shift()!;
        for (const e of GRAPH[at])
          if ((e.kind === 'land' || e.kind === 'strait') && !seen.has(e.to)) {
            seen.add(e.to);
            queue.push(e.to);
          }
      }
      return seen;
    };
    const islands = ['corsica', 'sardinia'];
    const onFoot = walk('rome');
    for (const id of ITALY) expect({ id, onFoot: onFoot.has(id) }).toEqual({ id, onFoot: !islands.includes(id) });
    // Sicily over the Strait of Messina; Corsica and Sardinia across Bonifacio, and both on the sea.
    expect(GRAPH.messina.some(e => e.kind === 'strait' && e.to === 'calabria')).toBe(true);
    expect([...walk('corsica')].sort()).toEqual(islands);
    for (const id of ITALY.filter(r => !['savoy', 'piedmont', 'montferrat', 'lombardy', 'parma', 'verona', 'umbria'].includes(r)))
      expect({ id, coast: region(id).seas.length > 0 }).toEqual({ id, coast: true });
  });

  test('every Italian region is big enough to tap at play zoom, holds its own town, and most show their name', () => {
    const constantinople = region('constantinople');
    for (const id of ITALY) {
      const r = region(id);
      // At least 300 square units (Constantinople, the smallest region in Europe, is 388; Montferrat is 326) and never
      // narrower than Liguria today.
      expect({ id, big: r.area >= 300 && r.labelRadius >= 4.5 }).toEqual({ id, big: true });
      expect({ id, on: regionAt(r.town[0], r.town[1]) }).toEqual({ id, on: id });
      const named = r.labelRadius * PLAY_K >= MIN_NAME_RADIUS;
      expect({ id, named }).toEqual({ id, named: !NO_NAME_AT_PLAY.includes(id) });
    }
    expect(constantinople.area).toBeLessThan(400);
  });
});

describe('old saves', () => {
  test('a save from before Italy was redrawn is refused, and known as old rather than damaged', () => {
    const s = newGame({ player: 'VEN', seed: 2 });
    const old = JSON.parse(JSON.stringify(s)) as GameState;
    old.version = SAVE_VERSION - 1;
    expect(saveTooOld(old)).toBe(true);
    expect(migrateSave(old)).toBeNull();
    expect(migrateSave({ ...old, version: 2 })).toBeNull();
    const now = JSON.parse(JSON.stringify(s)) as GameState;
    expect(saveTooOld(now)).toBe(false);
    expect(migrateSave(now)?.regions.verona.owner).toBe('VEN');
    expect(saveTooOld({})).toBe(false);
  });
});
