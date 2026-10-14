/** Landmarks (fun batch 2, track L): fifteen famous places, one bonus each for whoever holds the region. */
import { LANDMARKS, LANDMARK_AT, REGION, type LandmarkDef } from '../src/sim/content';
import { MODIFIER_KEYS } from '../src/sim/dsl';
import { heldBy, landmarkErrors, landmarksHeld } from '../src/sim/landmarks';
import { invalidateMods, modifierSources, nationMods } from '../src/sim/queries';
import { setController, transferRegion } from '../src/sim/territory';
import { LANDMARK_ART } from '../src/ui/components/landmarkArt';
import { emptyGame } from './helpers';

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
});
