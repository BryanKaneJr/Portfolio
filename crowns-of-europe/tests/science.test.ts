import { emptyGame } from './helpers';
import { foundUniversity, recruit, setResearch, setScienceFunding } from '../src/sim/commands';
import { ledger } from '../src/sim/economy';
import { advanceCost, availableAdvances, learnAdvance, monthlyScience, policySlots, prosperityAddsScience, scienceRate, universityCost } from '../src/sim/science';
import { REGION } from '../src/sim/content';
import { bumpOwnership } from '../src/sim/queries';
import { advanceDays } from '../src/sim/tick';
import { dayOf } from '../src/sim/util';

describe('science', () => {
  test('crowns start with the advances they had in 1444', () => {
    const s = emptyGame('HUN');
    expect(s.nations.POR.advances).toContain('caravels');
    expect(s.nations.VEN.advances).toContain('banking');
    expect(s.nations.TUR.advances).toContain('bombards');
    expect(s.nations.HUN.advances).toEqual([]);
    expect(availableAdvances(s, 'HUN').map(a => a.id)).toContain('bombards');
    expect(availableAdvances(s, 'HUN').map(a => a.id)).not.toContain('pike_and_shot'); // needs Bombards
  });

  test('scholars study what you pick, and an advance unlocks what it promises', () => {
    const s = emptyGame('HUN');
    s.armies = {};
    s.nations.HUN.gold = 1000;
    s.nations.HUN.manpower = 20000;
    expect(recruit(s, 'hungary', 'art').ok).toBe(false);
    expect(setResearch(s, 'pike_and_shot').ok).toBe(false);
    expect(setResearch(s, 'bombards').ok).toBe(true);
    s.nations.HUN.science = advanceCost(s, 'HUN', 'bombards').total;
    monthlyScience(s);
    expect(s.nations.HUN.advances).toContain('bombards');
    expect(s.nations.HUN.researching).toBeNull();
    expect(recruit(s, 'hungary', 'art').ok).toBe(true);
    // The war advances raise the age of your troops.
    learnAdvance(s, 'HUN', 'pike_and_shot');
    expect(s.nations.HUN.era).toBe(2);
  });

  test('science comes faster in learned lands, and with funding and universities', () => {
    const s = emptyGame('HUN');
    const factor = (n: string) => scienceRate(s, n).factors.find(f => /learned|Far from/i.test(f.label))?.value;
    expect(factor('FLO')).toBeGreaterThan(1.2);
    expect(factor('JOL')).toBeLessThan(0.7);
    const before = scienceRate(s, 'HUN').total;
    const gold = ledger(s, 'HUN').totalExpenses;
    expect(setScienceFunding(s, true).ok).toBe(true);
    expect(scienceRate(s, 'HUN').total).toBeGreaterThan(before);
    expect(ledger(s, 'HUN').totalExpenses).toBeGreaterThan(gold); // funding is paid in gold
    s.nations.HUN.gold = 1000;
    s.regions.hungary.dev = 8;
    const first = universityCost(s, 'HUN');
    expect(foundUniversity(s, 'hungary').ok).toBe(true);
    expect(universityCost(s, 'HUN')).toBeGreaterThan(first); // each one dearer than the last
    expect(foundUniversity(s, 'hungary').ok).toBe(false);
  });

  test('learning lives in rich towns: a small, rich crown keeps up with a big one', () => {
    const s = emptyGame('HUN');
    // One rich city outlearns a kingdom of eight regions.
    expect(scienceRate(s, 'FLO').total).toBeGreaterThan(scienceRate(s, 'FRA').total);
    // Conquering a lot of poor land adds little science and makes every advance dearer.
    const before = scienceRate(s, 'FRA').total;
    const costBefore = advanceCost(s, 'FRA', 'printing_press').total;
    for (const r of Object.values(s.regions).filter(x => x.owner && x.owner !== 'FRA' && x.dev <= 3 && !REGION[x.id].nw).slice(0, 12)) {
      r.owner = 'FRA';
      r.controller = 'FRA';
    }
    bumpOwnership();
    expect(scienceRate(s, 'FRA').total).toBeLessThan(before * 1.2);
    expect(advanceCost(s, 'FRA', 'printing_press').total).toBeGreaterThan(costBefore);
    expect(advanceCost(s, 'FRA', 'printing_press').factors.some(f => /Large realm/.test(f.label))).toBe(true);
    // Raising prosperity in one of the richest regions adds science; in a poor one it doesn't.
    expect(prosperityAddsScience(s, 'FRA', 'ile_de_france')).toBe(true);
    const poorest = Object.values(s.regions).filter(r => r.owner === 'FRA').sort((a, b) => a.dev - b.dev)[0];
    expect(prosperityAddsScience(s, 'FRA', poorest.id)).toBe(false);
  });

  test('advances cost more before their time and less once neighbours know them', () => {
    const s = emptyGame('HUN');
    const early = advanceCost(s, 'HUN', 'printing_press').total;
    s.day = dayOf(1480, 0, 1);
    const late = advanceCost(s, 'HUN', 'printing_press').total;
    expect(late).toBeLessThan(early);
    for (const n of ['HAB', 'POL', 'BOH']) learnAdvance(s, n, 'printing_press');
    expect(advanceCost(s, 'HUN', 'printing_press').total).toBeLessThan(late);
  });

  test('the AI chooses what to study and learns over time; every three advances open a policy slot', () => {
    const s = emptyGame('HUN', 7, { live: true });
    advanceDays(s, 365 * 10);
    expect(s.nations.FRA.researching ?? s.nations.FRA.advances.length).toBeTruthy();
    expect(s.nations.FRA.advances.length).toBeGreaterThan(1);
    const n = s.nations.HUN;
    n.advances = ['bombards', 'caravels'];
    expect(policySlots(n)).toBe(1);
    n.advances.push('printing_press');
    expect(policySlots(n)).toBe(2);
  }, 60000);
});
