import { emptyGame } from './helpers';
import { setEndowment } from '../src/sim/commands';
import { COUNTS, ENDOW, aiEndowment, endow, endowBlocked } from '../src/sim/endowment';
import { advanceCost } from '../src/sim/science';
import { advanceDays } from '../src/sim/tick';
import { yearOf, years } from '../src/sim/util';

const factor = (s: ReturnType<typeof emptyGame>, n: string, id: string, label: RegExp) => advanceCost(s, n, id).factors.find(f => label.test(f.label));

describe('endowment', () => {
  test('the endowed field costs a fifth less, the others a tenth more; nothing without one', () => {
    const s = emptyGame('HUN');
    expect(factor(s, 'HUN', 'bombards', /Endowed/)).toBeUndefined();
    expect(factor(s, 'HUN', 'printing_press', /Endowed/)).toBeUndefined();
    endow(s, 'HUN', 'war');
    expect(factor(s, 'HUN', 'bombards', /Endowed/)).toEqual({ label: 'Endowed: War', value: 1 + ENDOW.own });
    expect(factor(s, 'HUN', 'printing_press', /Endowed/)).toEqual({ label: 'Endowed elsewhere', value: 1 + ENDOW.others });
    expect(factor(s, 'HUN', 'caravels', /Endowed/)?.value).toBeCloseTo(1.1);
    endow(s, 'VEN', 'state');
    expect(factor(s, 'VEN', 'banking', /Endowed/)?.label).toBe('Endowed: Statecraft');
  });

  test('the first choice is free; it changes only after 25 years, never to the same field', () => {
    const s = emptyGame('HUN');
    expect(endowBlocked(s, 'HUN', 'sea')).toBeNull();
    const r = setEndowment(s, 'sea');
    expect(r.ok).toBe(true);
    expect(r.msg).toBe('Your scholars are endowed for Sea: its advances cost 20% less.');
    expect(s.nations.HUN.endowment).toEqual({ field: 'sea', since: s.day });
    expect(endowBlocked(s, 'HUN', 'sea')).toBe('Already endowed');
    const lockYear = yearOf(s.day + years(25));
    expect(endowBlocked(s, 'HUN', 'war')).toBe(`Change again in ${lockYear}`);
    expect(setEndowment(s, 'war').ok).toBe(false);
    s.day += years(24);
    expect(setEndowment(s, 'war').ok).toBe(false);
    s.day += years(1);
    expect(setEndowment(s, 'war').ok).toBe(true);
    expect(s.nations.HUN.endowment?.field).toBe('war');
    // A New World people follows its own ways.
    expect(endowBlocked(s, 'AZT', 'war')).toBe('Your people follow their own ways');
    endow(s, 'AZT', 'war');
    expect(s.nations.AZT.endowment).toBeUndefined();
  });

  test('the AI endows once by its temper and keeps it', () => {
    const s = emptyGame('HUN');
    const before = { ...COUNTS.byField };
    for (const n of ['POR', 'CAS', 'TUR', 'HAB', 'VEN', 'HUN', 'AZT']) aiEndowment(s, s.nations[n]);
    expect(s.nations.POR.endowment?.field).toBe('sea'); // a trader, and a seafarer
    expect(s.nations.CAS.endowment?.field).toBe('sea'); // expansionist, but the sea calls
    expect(s.nations.TUR.endowment?.field).toBe('war'); // expansionist
    expect(s.nations.HAB.endowment?.field).toBe('state'); // defensive
    expect(s.nations.VEN.endowment?.field).toBe('sea'); // a coastal trader
    expect(s.nations.HUN.endowment?.field).toBe('war'); // opportunist
    expect(s.nations.AZT.endowment).toBeUndefined();
    expect(COUNTS.byField.sea - before.sea).toBe(3);
    s.day += years(30);
    for (const n of ['POR', 'TUR', 'HAB']) aiEndowment(s, s.nations[n]);
    expect(s.nations.POR.endowment).toEqual({ field: 'sea', since: s.day - years(30) });
    expect(s.nations.TUR.endowment?.field).toBe('war');
    expect(s.nations.HAB.endowment?.field).toBe('state');
  });

  test('AI crowns endow in their first month of play; the player is left to choose', () => {
    const s = emptyGame('HUN', 7, { live: true });
    advanceDays(s, 31);
    expect(s.nations.POR.endowment?.field).toBe('sea');
    expect(s.nations.FRA.endowment?.field).toBe('war');
    expect(s.nations.HUN.endowment).toBeUndefined();
    expect(s.nations.MAY.endowment).toBeUndefined();
  });

  test("Ocean Navigation costs Portugal 0.8 times as much with the sea endowed", () => {
    const s = emptyGame('HUN');
    const plain = advanceCost(s, 'POR', 'ocean_navigation');
    endow(s, 'POR', 'sea');
    const endowed = advanceCost(s, 'POR', 'ocean_navigation');
    expect(Math.abs(endowed.total - plain.total * 0.8)).toBeLessThanOrEqual(1);
    expect(endowed.factors.length).toBe(plain.factors.length + 1);
  });

  test('an endowment survives a save and load', () => {
    const s = emptyGame('HUN');
    setEndowment(s, 'state');
    const back = JSON.parse(JSON.stringify(s));
    expect(back.nations.HUN.endowment).toEqual(s.nations.HUN.endowment);
    expect(endowBlocked(back, 'HUN', 'war')).toBe(endowBlocked(s, 'HUN', 'war'));
  });
});
