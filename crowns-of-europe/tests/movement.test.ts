import { emptyGame, army, forceWar } from './helpers';
import { findPath, orderMove } from '../src/sim/military';
import { declareWar } from '../src/sim/war';
import { advanceDays } from '../src/sim/tick';

describe('movement', () => {
  test('armies walk region to region and arrive', () => {
    const s = emptyGame('FRA');
    const a = army(s, 'FRA', 'ile_de_france', 5);
    const res = orderMove(s, a, 'languedoc');
    expect(res).not.toBeNull();
    expect(res!.path[res!.path.length - 1]).toBe('languedoc');
    advanceDays(s, res!.days + 2);
    expect(a.node).toBe('languedoc');
    expect(a.path).toHaveLength(0);
  });

  test('no access means no route through foreign land', () => {
    const s = emptyGame('FRA');
    const a = army(s, 'FRA', 'champagne', 5);
    // Lorraine is foreign and not allied: France cannot enter at peace.
    expect(findPath(s, a, 'lorraine')).toBeNull();
    s.access['LOR>FRA'] = s.day;
    expect(findPath(s, a, 'lorraine')).not.toBeNull();
  });

  test('a hostile fort stops armies from walking past it', () => {
    const s = emptyGame('TUR');
    forceWar(s, 'HUN', 'HAB');
    declareWar(s, 'HUN', 'HAB', 'none');
    s.regions.austria.fort = 2;
    const a = army(s, 'HUN', 'hungary', 10);
    // Tyrol lies beyond Austria; the only way is through the fort, or around through Styria.
    const res = findPath(s, a, 'tyrol')!;
    expect(res).not.toBeNull();
    expect(res.path).not.toContain('austria');
    // Ending on the fort is allowed.
    expect(findPath(s, a, 'austria')).not.toBeNull();
  });

  test('an army standing in a region catches enemies marching out of it', () => {
    const s = emptyGame('TUR');
    forceWar(s, 'TUR', 'BYZ');
    declareWar(s, 'TUR', 'BYZ', 'none');
    const byz = army(s, 'BYZ', 'bulgaria', 5);
    orderMove(s, byz, 'constantinople');
    advanceDays(s, 1);
    expect(byz.node).toBe('bulgaria'); // still on the way out
    const tur = army(s, 'TUR', 'bulgaria', 10);
    advanceDays(s, 1);
    expect(byz.battle).toBeTruthy();
    expect(tur.battle).toBe(byz.battle);
  });

  test('islands need transports; enemy fleets close straits', () => {
    const s = emptyGame('ENG');
    const a = army(s, 'ENG', 'wales', 4);
    expect(findPath(s, a, 'pale')).toBeNull();
    s.fleets.f1 = { id: 'f1', name: 'Fleet', owner: 'ENG', sea: 'irish_sea', ships: { galley: 0, transport: 2, warship: 0 }, hull: 1, path: [], progress: 0, edgeDays: 0 };
    expect(findPath(s, a, 'pale')).not.toBeNull();
    // Dover strait: open at peace, closed by a stronger enemy fleet.
    const b = army(s, 'ENG', 'london', 4);
    expect(findPath(s, b, 'calais')!.path).toEqual(['calais']);
    forceWar(s, 'ENG', 'FRA');
    declareWar(s, 'FRA', 'ENG', 'none');
    s.fleets.f2 = { id: 'f2', name: 'French', owner: 'FRA', sea: 'channel', ships: { galley: 10, transport: 0, warship: 0 }, hull: 1, path: [], progress: 0, edgeDays: 0 };
    const p = findPath(s, b, 'calais');
    expect(p === null || !p.path.includes('calais') || p.path[0] !== 'calais').toBe(true);
  });
});
