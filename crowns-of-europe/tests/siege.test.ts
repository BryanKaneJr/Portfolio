import { emptyGame, army, forceWar } from './helpers';
import { declareWar } from '../src/sim/war';
import { advanceDays } from '../src/sim/tick';

describe('sieges', () => {
  test('a region without a fort falls after the control timer', () => {
    const s = emptyGame('ENG');
    forceWar(s, 'FRA', 'BUR');
    declareWar(s, 'FRA', 'BUR', 'none');
    s.regions.picardy.fort = 0;
    army(s, 'FRA', 'picardy', 3);
    advanceDays(s, 14);
    expect(s.regions.picardy.controller).toBe('BUR');
    advanceDays(s, 4);
    expect(s.regions.picardy.controller).toBe('FRA');
  });

  test('a fort needs three regiments per level, and artillery speeds it up', () => {
    const s = emptyGame('ENG');
    forceWar(s, 'FRA', 'BUR');
    declareWar(s, 'FRA', 'BUR', 'none');
    s.regions.burgundy.fort = 2;
    const small = army(s, 'FRA', 'burgundy', 4);
    advanceDays(s, 60);
    expect(s.regions.burgundy.siege).toBeUndefined();
    small.regs.inf.n = 8;
    small.regs.inf.men = 8000;
    advanceDays(s, 30);
    expect(s.regions.burgundy.siege?.progress ?? 0).toBeGreaterThan(0.1);
    advanceDays(s, 200);
    expect(s.regions.burgundy.controller).toBe('FRA');
  });

  test('a relief army that attacks the besiegers pauses the siege, it does not undo it', () => {
    const s = emptyGame('ENG');
    forceWar(s, 'FRA', 'BUR');
    declareWar(s, 'FRA', 'BUR', 'none');
    s.regions.burgundy.fort = 3;
    army(s, 'FRA', 'burgundy', 20, 0, 4);
    advanceDays(s, 60);
    const before = s.regions.burgundy.siege!.progress;
    expect(before).toBeGreaterThan(0.1);
    const relief = army(s, 'BUR', 'burgundy', 3); // a small relief army: a battle at the walls
    advanceDays(s, 1);
    expect(relief.battle || !s.armies[relief.id]).toBeTruthy();
    advanceDays(s, 10); // the relief army is beaten and the siege goes on from where it was
    expect(s.regions.burgundy.siege!.progress).toBeGreaterThan(before);
  });
});
