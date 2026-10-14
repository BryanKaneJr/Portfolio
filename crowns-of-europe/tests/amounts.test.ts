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

  test('every event choice shows what applying its effects in order changes', () => {
    // [the number an effect changes, how finely its line shows it]
    const READ: Record<string, [(s: GameState, n: string, v: any, capital: string) => number, number]> = {
      gold: [(s, n) => s.nations[n].gold, 1],
      goldPerDev: [(s, n) => s.nations[n].gold, 1],
      manpower: [(s, n) => s.nations[n].manpower, 1],
      stability: [(s, n) => s.nations[n].stability, 1],
      prestige: [(s, n) => s.nations[n].prestige, 1],
      science: [(s, n) => s.nations[n].science, 1],
      threat: [(s, n) => s.nations[n].threat, 0.1],
      papalFavor: [(s, n) => s.nations[n].papalFavor, 1],
      warExhaustion: [(s, n) => s.nations[n].warExhaustion, 0.1],
      devRegion: [(s, n, v) => s.regions[v.region]?.dev ?? 0, 1],
      devCapital: [(s, n, v, cap) => s.regions[cap]?.dev ?? 0, 1],
      fortRegion: [(s, n, v) => s.regions[v.region]?.fort ?? 0, 1],
      rulerSkill: [(s, n) => s.nations[n].ruler.skill, 1],
    };
    const base = emptyGame('FRA');
    const threatShown: Record<string, string> = {};
    let checked = 0;
    for (const ev of EVENTS) {
      const n = ev.nations?.[0] ?? 'FRA';
      if (!base.nations[n]?.alive) continue;
      ev.choices.forEach((c, ci) => {
        const lines = effectsLines(c.effects, { s: base, n });
        // Answer it on a copy, effect by effect as answerEvent does, and compare each amount with its line.
        const s: GameState = JSON.parse(JSON.stringify(base));
        invalidateMods();
        let at = 0;
        for (const e of c.effects) {
          const mine = lines.slice(at, (at += effectLines(e).filter(l => !/flag/i.test(l.text)).length));
          const k = Object.keys(e)[0];
          const v = (e as any)[k];
          const read = READ[k];
          const cap = s.nations[n].capital;
          const before = read ? read[0](s, n, v, cap) : 0;
          applyEffect(s, n, e);
          invalidateMods();
          if (!read) continue;
          const real = read[0](s, n, v, cap) - before;
          expect([ev.id, ci, mine[0].text, Math.abs(shown(mine[0].text) - real) <= read[1] / 2 + 1e-9]).toEqual([ev.id, ci, mine[0].text, true]);
          if (k === 'threat') threatShown[`${ev.id}#${ci}`] = mine[0].text;
          checked++;
        }
        expect([ev.id, ci, at]).toEqual([ev.id, ci, lines.length]);
      });
    }
    expect(checked).toBeGreaterThan(200);
    // A new ruler's traits come first, then the Threat they raise (shown as written before, +15, +20, +10 and +5).
    for (const [key, nominal] of [['fra_sun_king#1', 15], ['hab_charles_v#0', 20], ['tur_suleiman#1', 10], ['tur_mehmed_ii#0', 5]] as const) {
      expect([key, threatShown[key]]).not.toEqual([key, `Threat +${nominal}`]);
      expect(shown(threatShown[key])).toBeGreaterThan(nominal);
    }
  });

  test('a card can show its lines on every render: the same lines until the game changes', () => {
    const s = emptyGame('FRA');
    const ev = EVENTS.find(e => e.id === 'fra_sun_king')!;
    const a = effectsLines(ev.choices[1].effects, { s, n: 'FRA', version: 1 });
    expect(effectsLines(ev.choices[1].effects, { s, n: 'FRA', version: 1 })).toBe(a);
    expect(effectsLines(ev.choices[1].effects, { s, n: 'FRA', version: 2 })).not.toBe(a);
    // Looking ahead leaves the game as it was.
    const before = JSON.stringify(s);
    effectsLines(ev.choices[1].effects, { s, n: 'FRA' });
    expect(JSON.stringify(s)).toBe(before);
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
