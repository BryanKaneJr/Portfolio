import { emptyGame } from './helpers';
import { newGame } from '../src/sim/state';
import { advanceDays } from '../src/sim/tick';
import { EVENT } from '../src/sim/content';
import { applyEffect } from '../src/sim/events';
import { forceLimit, ownedRegions, totalDev } from '../src/sim/queries';
import { rulerDies } from '../src/sim/rulers';
import { advanceCost, scienceRate } from '../src/sim/science';
import { pairKey } from '../src/sim/util';

/** The AI's pick for an event: the choice with the highest weight. */
const aiChoice = (id: string) => [...EVENT[id].choices].sort((a, b) => (b.ai ?? 1) - (a.ai ?? 1))[0];

describe('the Ottoman threat', () => {
  test('the Ottomans win their opening war and take Constantinople', () => {
    const s = newGame({ player: 'POR', seed: 1 });
    s.flags.__spectate = 1; // the AI plays everyone
    advanceDays(s, 365 * 3);
    expect(s.regions.constantinople.owner).toBe('TUR');
    // Hungary is still mourning the dead of Varna.
    expect(s.nations.HUN.modifiers.some(m => m.id === 'dead_of_varna')).toBe(true);
  }, 60000);

  test('the Ottomans raise bigger armies than their prosperity alone allows', () => {
    const s = emptyGame('HUN');
    let dev = 0;
    for (const r of ownedRegions(s, 'TUR')) dev += r.dev;
    expect(forceLimit(s, 'TUR')).toBeGreaterThan(Math.round(6 + dev / 2.5));
    expect(forceLimit(s, 'TUR')).toBeGreaterThan(forceLimit(s, 'HUN'));
  });

  test('the printing ban and the proud janissaries let Europe pull ahead in science', () => {
    const s = emptyGame('HUN');
    const rate = scienceRate(s, 'TUR').total;
    for (const e of aiChoice('tur_printing_ban').effects) applyEffect(s, 'TUR', e);
    expect(scienceRate(s, 'TUR').total).toBeLessThan(rate * 0.8);
    applyEffect(s, 'TUR', { modifier: { id: 'tur_janissaries', name: 'Janissaries', months: -1, mods: { infantryPower: 0.1 } } });
    const cost = advanceCost(s, 'TUR', 'pike_and_shot').total;
    for (const e of aiChoice('tur_proud_janissaries').effects) applyEffect(s, 'TUR', e);
    expect(advanceCost(s, 'TUR', 'pike_and_shot').total).toBeGreaterThan(cost * 1.4);
    expect(s.nations.TUR.modifiers.some(m => m.id === 'tur_janissaries')).toBe(false);
  });

  test('a minor king cannot inherit an empire, but a great one can inherit a small realm', () => {
    const s = emptyGame('HUN');
    s.marriages[pairKey('TUR', 'KAR')] = s.day;
    expect(totalDev(s, 'KAR') * 2).toBeLessThan(totalDev(s, 'TUR'));
    for (let i = 0; i < 60; i++) {
      s.nations.TUR.heir = undefined;
      rulerDies(s, 'TUR', 'old age');
    }
    expect(s.nations.TUR.overlord).toBeFalsy();
    // The other way round: the Ottomans may inherit Karaman.
    for (let i = 0; i < 60 && !s.nations.KAR.overlord; i++) {
      s.nations.KAR.heir = undefined;
      rulerDies(s, 'KAR', 'old age');
    }
    expect(s.nations.KAR.overlord).toBe('TUR');
  });
});
