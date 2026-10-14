/** Landmarks (fun batch 2, track L): fifteen famous places, one bonus each for whoever holds the region. */
import { LANDMARKS, LANDMARK_AT, MAP, MAP_REGION, REGION, type LandmarkDef } from '../src/sim/content';
import { MODIFIER_KEYS } from '../src/sim/dsl';
import { heldBy, landmarkErrors, landmarksHeld } from '../src/sim/landmarks';
import { invalidateMods, modifierSources, nationMods } from '../src/sim/queries';
import { annexNation, releaseNation, setController, transferRegion } from '../src/sim/territory';
import { declareWar, makePeace } from '../src/sim/war';
import { newGame } from '../src/sim/state';
import { LANDMARK_ART } from '../src/ui/components/landmarkArt';
import { PLAY_K, REGION_NAMES_K, armyBox, grow } from '../src/ui/map/anchors';
import { K_MAX } from '../src/ui/map/camera';
import { regionAt } from '../src/ui/map/geometry';
import { MARK_MIN, markPlace, nameBox, type TownSize } from '../src/ui/map/landmarkSpot';
import type { RegionId } from '../src/sim/types';
import { emptyGame, forceWar } from './helpers';

/** A fresh 1444 game whose modifiers are read afresh (newGame may read some before it hands out the policies). */
function game() {
  const s = emptyGame('FRA');
  invalidateMods();
  return s;
}

/** How many numbers each SVG path command takes (absolute commands only: the art uses no others). */
const ARGS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, A: 7, C: 6, Q: 4, Z: 0 };

/** Parse a path into its commands; throws on anything we do not draw with. Returns every end point it reaches. */
function endPoints(d: string): [number, number][] {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  const pts: [number, number][] = [];
  let x = 0;
  let y = 0;
  let i = 0;
  if (tokens[0] !== 'M') throw new Error(`${d}: must start with M`);
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (!(cmd in ARGS)) throw new Error(`${d}: unknown command ${cmd}`);
    const n = ARGS[cmd];
    do {
      const args = tokens.slice(i, i + n).map(Number);
      if (args.length !== n || args.some(v => Number.isNaN(v))) throw new Error(`${d}: ${cmd} needs ${n} numbers`);
      i += n;
      if (cmd === 'H') x = args[0];
      else if (cmd === 'V') y = args[0];
      else if (n >= 2) [x, y] = args.slice(n - 2);
      if (n) pts.push([x, y]);
    } while (n && i < tokens.length && !/[A-Za-z]/.test(tokens[i]));
  }
  return pts;
}

describe('the landmarks content', () => {
  test('fifteen, each in a real region of its own with one known bonus and a picture', () => {
    expect(LANDMARKS).toHaveLength(15);
    expect(new Set(LANDMARKS.map(l => l.region)).size).toBe(15);
    for (const lm of LANDMARKS) {
      expect(REGION[lm.region]).toBeDefined();
      expect(Object.keys(lm.mods)).toHaveLength(1);
      expect(MODIFIER_KEYS).toContain(Object.keys(lm.mods)[0]);
      expect(LANDMARK_ART[lm.kind]).toBeDefined();
      expect(LANDMARK_AT[lm.region]).toBe(lm);
    }
    expect(landmarkErrors(LANDMARKS, Object.keys(LANDMARK_ART))).toEqual([]);
  });

  test('every pictogram is plain path data inside its 24 x 24 box', () => {
    for (const [kind, paths] of Object.entries(LANDMARK_ART)) {
      expect(paths.length).toBeGreaterThan(0);
      for (const p of paths) {
        expect(p.d.length).toBeGreaterThan(0);
        const pts = endPoints(p.d);
        expect(pts.length).toBeGreaterThanOrEqual(2);
        for (const [x, y] of pts) {
          if (!(x >= 0 && x <= 24 && y >= 0 && y <= 24)) throw new Error(`${kind}: point ${x},${y} outside the box`);
        }
      }
    }
  });

  test('the checker catches a bad entry', () => {
    const kinds = Object.keys(LANDMARK_ART);
    const good = LANDMARKS[0];
    const bad: LandmarkDef[] = [
      ...LANDMARKS,
      { ...good, id: 'second_here' }, // a second landmark in Constantinople
      { ...good, id: 'odd_bonus', region: 'rome_x', mods: { luck: 1 } as any },
      { ...good, id: 'two_bonuses', region: 'brandenburg', mods: { taxIncome: 0.1, manpower: 0.1 } },
      { ...good, id: 'no_picture', region: 'holland', kind: 'volcano' },
      { ...good, id: 'long_story', region: 'saxony', text: 'x'.repeat(91) },
    ];
    const errs = landmarkErrors(bad, kinds).join('\n');
    expect(errs).toMatch(/second_here: constantinople already has a landmark/);
    expect(errs).toMatch(/odd_bonus: unknown region rome_x/);
    expect(errs).toMatch(/odd_bonus: unknown modifier luck/);
    expect(errs).toMatch(/two_bonuses: needs exactly one bonus/);
    expect(errs).toMatch(/no_picture: no picture for kind volcano/);
    expect(errs).toMatch(/long_story: text is over 90/);
  });
});

describe('holding a landmark', () => {
  test('its holder lists it among its modifiers, and its bonus counts', () => {
    const s = game();
    expect(landmarksHeld(s, 'FRA').map(l => l.id)).toEqual(['notre_dame']);
    expect(heldBy(s, 'hagia_sophia')).toBe('BYZ');
    expect(modifierSources(s, 'FRA')).toContainEqual({ name: 'Notre-Dame', mods: { stabilityCost: -0.2 } });
    expect(modifierSources(s, 'MAM').map(m => m.name)).toEqual(
      expect.arrayContaining(['Dome of the Rock', 'The Pyramids']),
    );
    expect(modifierSources(s, 'ENG').map(m => m.name)).not.toContain('Notre-Dame');
  });

  test('an occupied landmark gives nothing; it comes back when the occupier leaves', () => {
    const s = game();
    const before = nationMods(s, 'FRA').stabilityCost;
    setController(s, 'ile_de_france', 'ENG');
    expect(landmarksHeld(s, 'FRA')).toEqual([]);
    expect(landmarksHeld(s, 'ENG').map(l => l.id)).toEqual(['westminster']); // the occupier gains nothing either
    expect(heldBy(s, 'notre_dame')).toBeNull();
    expect(nationMods(s, 'FRA').stabilityCost).toBeCloseTo(before + 0.2); // same day: no stale cache
    setController(s, 'ile_de_france', 'FRA');
    expect(nationMods(s, 'FRA').stabilityCost).toBeCloseTo(before);
  });

  test('a landmark changes hands with its region, the same day', () => {
    const s = game();
    const eng = nationMods(s, 'ENG').taxIncome;
    const cas = nationMods(s, 'CAS').taxIncome;
    transferRegion(s, 'london', 'CAS', { conquest: true });
    expect(heldBy(s, 'westminster')).toBe('CAS');
    expect(nationMods(s, 'CAS').taxIncome).toBeCloseTo(cas + 0.1);
    expect(nationMods(s, 'ENG').taxIncome).toBeCloseTo(eng - 0.1);
  });

  test('the player hears when a landmark is won or lost', () => {
    const s = game();
    transferRegion(s, 'granada', 'FRA', { conquest: true });
    expect(s.moments?.find(m => m.title === 'The Alhambra is ours')).toMatchObject({
      kind: 'headline',
      card: false,
      tone: 'good',
      node: 'granada',
    });
    transferRegion(s, 'ile_de_france', 'ENG', { conquest: true });
    expect(s.moments?.find(m => m.title === 'Notre-Dame is lost')).toMatchObject({
      kind: 'headline',
      card: false,
      tone: 'bad',
      node: 'ile_de_france',
    });
    // Nobody else's landmarks are news.
    transferRegion(s, 'moscow', 'NOV', { conquest: true });
    expect(s.moments?.some(m => m.title.startsWith('The Kremlin'))).toBe(false);
  });

  test('annexing and releasing a realm move its landmark too, the same day', () => {
    const s = game();
    const fra = nationMods(s, 'FRA').devCost;
    annexNation(s, 'FRA', 'GRA');
    expect(heldBy(s, 'alhambra')).toBe('FRA');
    expect(nationMods(s, 'FRA').devCost).toBeCloseTo(fra - 0.15);
    expect(s.moments?.some(m => m.title === 'The Alhambra is ours')).toBe(true);
    releaseNation(s, 'FRA', 'GRA');
    expect(heldBy(s, 'alhambra')).toBe('GRA');
    expect(nationMods(s, 'FRA').devCost).toBeCloseTo(fra);
    expect(s.moments?.some(m => m.title === 'The Alhambra is lost')).toBe(true);
  });

  test('a realm annexed while it occupies a landmark frees it the same day', () => {
    const s = game();
    const flo = nationMods(s, 'FLO').science;
    setController(s, 'tuscany', 'SAV'); // Savoy holds no landmark of its own
    expect(nationMods(s, 'FLO').science).toBeCloseTo(flo - 0.1);
    annexNation(s, 'FRA', 'SAV');
    expect(heldBy(s, 'duomo')).toBe('FLO');
    expect(nationMods(s, 'FLO').science).toBeCloseTo(flo);
  });

  test('a peace that ends an occupation gives the landmark back the same day', () => {
    const s = game();
    const before = nationMods(s, 'FRA').stabilityCost;
    forceWar(s, 'ENG', 'FRA');
    const w = declareWar(s, 'ENG', 'FRA', 'none')!;
    setController(s, 'ile_de_france', 'ENG');
    expect(nationMods(s, 'FRA').stabilityCost).toBeCloseTo(before + 0.2);
    makePeace(s, w, { regions: [], gold: 0, vassalize: false, release: [], white: true, winner: 'ENG', loser: 'FRA' });
    expect(heldBy(s, 'notre_dame')).toBe('FRA');
    expect(nationMods(s, 'FRA').stabilityCost).toBeCloseTo(before);
  });
});

describe('releasing a realm', () => {
  test('the crown that lets go of its last land is gone; one that keeps some gets a new capital', () => {
    const s = game();
    annexNation(s, 'NAV', 'GRA');
    s.nations.NAV.capital = 'granada';
    releaseNation(s, 'NAV', 'GRA');
    expect(s.nations.NAV.alive).toBe(true);
    expect(s.nations.NAV.capital).toBe('navarre');
    annexNation(s, 'NAV', 'GRA');
    transferRegion(s, 'navarre', 'CAS', { conquest: true });
    releaseNation(s, 'NAV', 'GRA');
    expect(s.regions.granada.owner).toBe('GRA');
    expect(s.nations.NAV.alive).toBe(false);
  });
});

describe('a new game', () => {
  test('reads its modifiers after the starting policies, as a loaded one does', () => {
    const s = newGame({ player: 'FRA', seed: 7 });
    const fresh = nationMods(s, 'CAS');
    const loaded = JSON.parse(JSON.stringify(s)) as typeof s; // a new state object: nothing cached for it
    expect(nationMods(loaded, 'CAS')).toEqual(fresh);
  });
});

describe('landmarks on the map', () => {
  /** Every mark's box (map units) at zoom `k`, with no towns, every town the smallest picture and every town the
   * largest (MapView TOWN_ART 19-30 points, at least 10, capped at 2.2 times the label radius on screen). */
  function marks(k: number) {
    const px = (n: number) => n / k;
    const towns: TownSize[] = [
      () => null,
      ...[19, 30].map(pt => (id: RegionId) => px(Math.min(pt * grow(k), Math.max(10, MAP_REGION[id].labelRadius * k * 2.2)))),
    ];
    return towns.flatMap(town =>
      LANDMARKS.map(lm => {
        const [x, y, size] = markPlace(lm.region, k, px, town);
        return { lm, size, box: [x, y, x + size, y + size] };
      }),
    );
  }
  const overlap = (a: number[] | null, b: number[]) =>
    a ? Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1])) : 0;
  /** Zooms from where names show to the closest, and the one the game opens at. */
  const zooms = [
    PLAY_K,
    ...Array.from({ length: Math.round((K_MAX - REGION_NAMES_K) / 0.1) + 1 }, (_, i) => +(REGION_NAMES_K + i * 0.1).toFixed(2)),
  ];

  test('every mark stands inside its own region, at every zoom it shows at, never under MARK_MIN', () => {
    for (const k of zooms)
      for (const { lm, size, box } of marks(k)) {
        const [x, y] = box;
        expect([k, lm.id, regionAt(x + size / 2, y + size * 0.6), regionAt(x + size / 2, y + size * 0.85)]).toEqual([k, lm.id, lm.region, lm.region]);
        expect(size * k).toBeGreaterThanOrEqual(MARK_MIN - 1e-6);
      }
  });

  test("no mark stands where its region's army stands", () => {
    // Constantinople is too small for both until about 2.2 (its army covers the whole region): the mark stands where
    // the troops hide least of it.
    const tooSmall = (id: string, k: number) => id === 'hagia_sophia' && k < 2.2;
    for (const k of zooms)
      for (const { lm, box } of marks(k)) if (!tooSmall(lm.id, k)) expect([k, lm.id, overlap(armyBox(lm.region, k), box)]).toEqual([k, lm.id, 0]);
  });

  test("no mark covers its own region's name, and hardly a neighbour's", () => {
    // Champagne's name runs into tiny Île-de-France while names are smallest; elsewhere at most a corner.
    const share = (id: string, k: number) => (id === 'notre_dame' && k < 1.5 ? 0.75 : 0.2);
    for (const k of zooms) {
      const px = (n: number) => n / k;
      const names = MAP.regions.map(r => ({ id: r.id, b: nameBox(r.id, k, px) }));
      for (const { lm, size, box } of marks(k))
        for (const { id, b } of names) {
          const f = overlap(b, box) / (size * size);
          if (id === lm.region) expect([k, lm.id, id, f]).toEqual([k, lm.id, id, 0]);
          else if (f > share(lm.id, k)) expect([k, lm.id, id, f]).toEqual([k, lm.id, id, `under ${share(lm.id, k)}`]);
        }
    }
  });
});
