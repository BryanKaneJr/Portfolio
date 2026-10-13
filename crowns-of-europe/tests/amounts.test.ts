import { emptyGame, army } from './helpers';
import { applyEffect, effectDelta } from '../src/sim/events';
import { effectLines, effectsLines } from '../src/ui/describe';
import { disband, disbandOutcome } from '../src/sim/commands';
import { invalidateMods, totalDev } from '../src/sim/queries';
import { newGeneral } from '../src/sim/rulers';
import { EVENTS } from '../src/sim/content';
import type { Effect, GameState } from '../src/sim/types';

/** The signed number a line shows ("Pay 84 gold" is −84; "Order stays at +3" is 0). */
function shown(text: string): number {
  if (/stays at|left to lose/.test(text)) return 0;
  const m = text.match(/(Pay )?([+−-])?(\d[\d,]*(?:\.\d+)?)/);
  if (!m) throw new Error(`No amount in "${text}"`);
  const n = Number(m[3].replace(/,/g, ''));
  return m[1] || m[2] === '−' || m[2] === '-' ? -n : n;
}

/** Apply an effect, returning by how much `read` changed. */
function change(s: GameState, e: Effect, read: (s: GameState) => number): number {
  const before = read(s);
  applyEffect(s, 'FRA', e);
  invalidateMods();
  return read(s) - before;
}

describe('effects show what they would really do', () => {
  test('gold per prosperity shows the coins, never the formula', () => {
    const s = emptyGame('FRA');
    const dev = totalDev(s, 'FRA');
    for (const v of [-1.5, -0.5, -2, 1, 2]) {
      const [line] = effectLines({ goldPerDev: v }, { s, n: 'FRA' });
      expect(line.text).not.toMatch(/prosperity/);
      expect(line.text).toBe(v < 0 ? `Pay ${Math.round(-v * dev).toLocaleString('en-US')} gold` : `+${Math.round(v * dev).toLocaleString('en-US')} gold`);
      const paid = change(s, { goldPerDev: v }, x => x.nations.FRA.gold);
      expect(Math.abs(shown(line.text) - paid)).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(line.good).toBe(v > 0);
    }
    // With no game to read (a content listing), the rule as written.
    expect(effectLines({ goldPerDev: -1.5 })[0].text).toBe('Pay gold: 1.5 for each point of prosperity');
  });

  test('every amount shown is the change applying the effect makes, floors and ceilings included', () => {
    const s = emptyGame('FRA');
    const n = s.nations.FRA;
    const cap = n.capital;
    // Put each number near a limit, so the clamps matter.
    n.manpower = 1500;
    n.stability = 2;
    n.prestige = 96.4;
    n.science = 30;
    n.threat = 12;
    n.modifiers.push({ id: 'bold', name: 'Bold', mods: { threatGain: 0.5 }, until: -1 });
    n.papalFavor = 95;
    n.warExhaustion = 2.5;
    s.regions[cap].dev = 9;
    s.regions.champagne.fort = 2;
    n.ruler.skill = 4;
    invalidateMods();
    // [effect, the number it changes, how finely the line shows it]
    const cases: [Effect, (x: GameState) => number, number][] = [
      [{ gold: -50 }, x => x.nations.FRA.gold, 1],
      [{ goldPerDev: -1 }, x => x.nations.FRA.gold, 1],
      [{ manpower: -5000 }, x => x.nations.FRA.manpower, 1], // only 1,500 to lose
      [{ manpower: -1000 }, x => x.nations.FRA.manpower, 1], // none left
      [{ manpower: 2000 }, x => x.nations.FRA.manpower, 1],
      [{ stability: 2 }, x => x.nations.FRA.stability, 1], // +2 → +3: only +1
      [{ stability: 1 }, x => x.nations.FRA.stability, 1], // already at +3
      [{ prestige: 10 }, x => x.nations.FRA.prestige, 1],
      [{ science: -50 }, x => x.nations.FRA.science, 1],
      [{ threat: 10 }, x => x.nations.FRA.threat, 0.1], // half as much again, from the modifier
      [{ threat: -30 }, x => x.nations.FRA.threat, 0.1],
      [{ papalFavor: 10 }, x => x.nations.FRA.papalFavor, 1],
      [{ warExhaustion: -5 }, x => x.nations.FRA.warExhaustion, 0.1],
      [{ devCapital: 2 }, x => x.regions[cap].dev, 1],
      [{ devRegion: { region: cap, amount: 1 } }, x => x.regions[cap].dev, 1], // already at 10
      [{ fortRegion: { region: 'champagne', amount: 2 } }, x => x.regions.champagne.fort, 1],
      [{ rulerSkill: 2 }, x => x.nations.FRA.ruler.skill, 1],
    ];
    const texts: string[] = [];
    for (const [e, read, step] of cases) {
      const d = effectDelta(s, 'FRA', e)!;
      const [line] = effectLines(e, { s, n: 'FRA' });
      texts.push(line.text);
      const real = change(s, e, read);
      expect([e, Math.abs(d - real) < 1e-9]).toEqual([e, true]);
      expect([e, line.text, Math.abs(shown(line.text) - real) <= step / 2 + 1e-9]).toEqual([e, line.text, true]);
    }
    // What the player reads.
    expect(texts).toEqual([
      'Pay 50 gold',
      `Pay ${totalDev(s, 'FRA') - 1} gold`, // the capital has grown by one since
      '−1,500 levies',
      'No levies left to lose',
      '+2,000 levies',
      'Order +1',
      'Order stays at +3',
      'Renown +4',
      '−30 science',
      'Threat +15',
      'Threat −27',
      'Papal Favor +5',
      'War exhaustion −2.5',
      'Île-de-France prosperity +1', // 9 → 10: only +1 of the +2
      'Île-de-France prosperity stays at 10',
      'Champagne fort +1',
      'Ruler skill +1',
    ]);
  });

  test('effects that land somewhere name the place', () => {
    const s = emptyGame('FRA');
    const capital = s.nations.FRA.capital;
    s.regions[capital].dev = 5;
    const where = (e: Effect) => effectLines(e, { s, n: 'FRA' })[0].text;
    expect(where({ devCapital: 1 })).toBe('Île-de-France prosperity +1');
    expect(where({ rebels: { regiments: 3 } })).toMatch(/in .+/);
    expect(where({ addRegiments: { inf: 2, region: 'london' } })).toContain('at ');
    s.regions[capital].controller = 'ENG';
    expect(where({ addRegiments: { inf: 2 } })).toBe('No free army: your capital is not in your hands');
  });

  test('every event choice in the game reads without a formula', () => {
    const s = emptyGame('FRA');
    for (const e of EVENTS) for (const c of e.choices) for (const l of effectsLines(c.effects, { s, n: 'FRA' })) expect(l.text).not.toMatch(/×|per point|NaN|undefined/);
  });
});

describe('disbanding', () => {
  test('the confirmation says what disbanding does, as it does it', () => {
    const s = emptyGame('FRA');
    const a = army(s, 'FRA', 'champagne', 6, 2);
    a.mercs = 2;
    a.general = newGeneral(s, 'FRA', { stars: 3 });
    const o = disbandOutcome(a);
    expect(o.mercs).toBe(2);
    expect(o.general?.name).toBe(a.general.name);
    const before = s.nations.FRA.manpower;
    const pool = s.nations.FRA.generals.length;
    expect(disband(s, a.id).ok).toBe(true);
    expect(s.nations.FRA.manpower - before).toBe(o.levies);
    expect(o.levies).toBeGreaterThan(0);
    expect(s.nations.FRA.generals).toHaveLength(pool + 1);
    expect(s.armies[a.id]).toBeUndefined();
  });
});
