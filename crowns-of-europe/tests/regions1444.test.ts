/** More regions where 1444 was thin on the map: Ireland, England, the North, the Baltic, Russia, the steppe, Anatolia, and
 * one more land each for Castile, Austria, Hungary, Poland and Bohemia. */
import { GRAPH, MAP, REGION } from '../src/sim/content';
import { newGame } from '../src/sim/state';
import { MIN_NAME_RADIUS, PLAY_K, nameBox } from '../src/ui/map/anchors';
import { regionAt } from '../src/ui/map/geometry';

const NEW = [
  'east_anglia', 'devon', 'northumbria', 'isles', 'ulster', 'connacht', 'schleswig', 'viken', 'vyborg', 'estonia',
  'marienburg', 'nizhny_novgorod', 'dvina', 'sarai', 'ochakov', 'teke', 'amasya', 'leon', 'carniola', 'temes', 'podolia',
  'lusatia',
];
// The Lordship of the Isles is long and thin: its town shows at play zoom, its name a little closer in (from 1.76).
const NO_NAME_AT_PLAY = ['isles'];
const region = (id: string) => MAP.regions.find(r => r.id === id)!;

describe('the lands of 1444', () => {
  const s = newGame({ player: 'ENG', seed: 1 });
  const held = (n: string) => Object.values(s.regions).filter(r => r.owner === n).map(r => r.id).sort();

  test('Ireland is three Gaelic provinces and the Pale; England is eight lands at home', () => {
    expect(held('IRE')).toEqual(['connacht', 'munster', 'ulster']);
    expect(held('ENG')).toEqual(expect.arrayContaining(['pale']));
    const home = ['london', 'east_anglia', 'wessex', 'devon', 'midlands', 'yorkshire', 'northumbria', 'wales'];
    expect(held('ENG')).toEqual(expect.arrayContaining(home));
    expect(held('SCO')).toEqual(['highlands', 'isles', 'lowlands']);
    expect(REGION.ireland).toBeUndefined();
  });

  test('the North and the Baltic: Denmark three at home, Sweden four, Livonia two, the Order three', () => {
    expect(held('DAN')).toEqual(expect.arrayContaining(['jutland', 'schleswig', 'zealand', 'norway', 'viken']));
    expect(held('SWE')).toEqual(['finland', 'gotaland', 'svealand', 'vyborg']);
    expect(held('LIV')).toEqual(['estonia', 'livonia']);
    expect(held('TEU')).toEqual(['danzig', 'marienburg', 'prussia']);
  });

  test('Russia and the steppe: Muscovy four, Novgorod three, the Great Horde two, Crimea three', () => {
    expect(held('MOS')).toEqual(['moscow', 'nizhny_novgorod', 'vladimir', 'yaroslavl']);
    expect(held('NOV')).toEqual(['dvina', 'karelia', 'novgorod']);
    expect(held('GOL')).toEqual(['don', 'sarai']);
    expect(held('CRI')).toEqual(['crimea', 'ochakov', 'zaporozhia']);
    expect(s.nations.GOL.capital).toBe('sarai');
  });

  test('the Ottomans hold five lands in Asia, and the powers one more each', () => {
    expect(held('TUR')).toEqual(expect.arrayContaining(['bithynia', 'aydin', 'teke', 'ankara', 'amasya']));
    for (const [n, id] of [['CAS', 'leon'], ['HAB', 'carniola'], ['HUN', 'temes'], ['POL', 'podolia'], ['BOH', 'lusatia']])
      expect({ n, id, owner: s.regions[id].owner }).toEqual({ n, id, owner: n });
  });

  test('the claims of 1444 follow the new lands', () => {
    expect(s.nations.SCO.claims.northumbria).toBeGreaterThan(s.day); // Berwick and Roxburgh
    expect(s.nations.POL.claims.marienburg).toBeGreaterThan(s.day); // the Prussian Confederation
  });
});

describe('the new lands on the map', () => {
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

  test('Ireland on foot from Ulster; the North Channel to the Lowlands and the Isles; Wales to the Pale only by sea; the steppe on foot', () => {
    const ireland = walk('ulster');
    for (const id of ['connacht', 'munster', 'pale', 'lowlands', 'isles']) expect(ireland.has(id)).toBe(true);
    expect(GRAPH.ulster.filter(e => e.kind === 'strait').map(e => e.to).sort()).toEqual(['isles', 'lowlands']);
    expect(GRAPH.pale.some(e => e.to === 'wales' && e.kind !== 'sea')).toBe(false);
    // The steppe in one piece: Ochakov, Zaporozhia, the Crimea, the Don and Sarai.
    for (const id of ['ochakov', 'zaporozhia', 'don', 'sarai']) expect(walk('crimea').has(id)).toBe(true);
  });

  test('every new region is big enough to tap at play zoom, holds its own town, and shows its name', () => {
    for (const id of NEW) {
      const r = region(id);
      // At least 300 square units (Montferrat is 326, Constantinople 388) and no narrower than Liguria.
      expect({ id, big: r.area >= 300 && r.labelRadius >= 4.5 }).toEqual({ id, big: true });
      expect({ id, on: regionAt(r.town[0], r.town[1]) }).toEqual({ id, on: id });
      const named = r.labelRadius * PLAY_K >= MIN_NAME_RADIUS;
      expect({ id, named }).toEqual({ id, named: !NO_NAME_AT_PLAY.includes(id) });
    }
  });

  test("no new region's name runs into another's at play zoom or closer", () => {
    const touch = (a: number[] | null, b: number[] | null) => !!a && !!b && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    for (const k of [PLAY_K, 2, 2.5, 3]) {
      const px = (n: number) => n / k;
      for (const id of NEW) {
        const mine = nameBox(id, k, px);
        const hits = MAP.regions.filter(o => o.id !== id && touch(mine, nameBox(o.id, k, px))).map(o => o.id);
        expect({ id, k, hits }).toEqual({ id, k, hits: [] });
      }
    }
  });
});
