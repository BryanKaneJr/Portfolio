import { emptyGame, army, forceWar } from './helpers';
import { findPath, orderMove } from '../src/sim/military';
import { declareWar, leaveWar, makePeace } from '../src/sim/war';
import { advanceDay, advanceDays } from '../src/sim/tick';
import { GRAPH, regionName } from '../src/sim/content';
import { REBELS, bumpOwnership } from '../src/sim/queries';
import { makeArmy } from '../src/sim/state';
import { unitCost } from '../src/sim/economy';
import type { Fleet } from '../src/sim/types';

const fleet = (id: string, owner: string, sea: string, ships: Partial<Fleet['ships']>): Fleet => ({
  id,
  name: id,
  owner,
  sea,
  ships: { galley: 0, transport: 0, warship: 0, ...ships },
  hull: 1,
  path: [],
  progress: 0,
  edgeDays: 0,
});

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

  test('a march stops where access ends, and says so', () => {
    const s = emptyGame('FRA');
    const a = army(s, 'FRA', 'champagne', 5);
    s.access['LOR>FRA'] = s.day;
    expect(orderMove(s, a, 'lorraine')!.path).toEqual(['lorraine']);
    delete s.access['LOR>FRA'];
    advanceDay(s);
    expect(a.node).toBe('champagne');
    expect(a.path).toEqual([]);
    expect(s.log[0].text).toMatch(/stopped at Champagne: no access to Lorraine\./);
  });

  test('a retreat that loses its road ends instead of hanging on forever', () => {
    const s = emptyGame('ENG');
    forceWar(s, 'ENG', 'FRA');
    declareWar(s, 'FRA', 'ENG', 'none');
    // Fleeing London for Calais across the Strait of Dover, which an English fleet then closes.
    const a = army(s, 'FRA', 'london', 5);
    a.retreating = true;
    a.path = ['calais'];
    s.fleets.f1 = fleet('f1', 'ENG', 'channel', { galley: 10 });
    advanceDay(s);
    expect(a.node).toBe('london');
    expect(a.path).toEqual([]);
    expect(a.retreating).toBe(false);
    // Marked as retreating with nowhere left to go: it stands down the next day.
    const b = army(s, 'FRA', 'calais', 3);
    b.retreating = true;
    advanceDay(s);
    expect(b.retreating).toBe(false);
  });

  test('hostile armies marching past each other on one road fight', () => {
    const s = emptyGame('ENG');
    forceWar(s, 'FRA', 'BUR');
    declareWar(s, 'FRA', 'BUR', 'none');
    const fra = army(s, 'FRA', 'champagne', 8);
    const bur = army(s, 'BUR', 'burgundy', 8);
    advanceDay(s);
    // Each sets out for the other's region; both would arrive on the same day.
    for (const [a, to] of [[fra, 'burgundy'], [bur, 'champagne']] as const) {
      a.path = [to];
      a.progress = 0;
      a.edgeDays = 6;
    }
    advanceDays(s, 6);
    const b = Object.values(s.battles)[0];
    expect(b).toBeDefined();
    // France got to Burgundy first (it moves first) and caught Burgundy's army still marching out.
    expect(b.node).toBe('burgundy');
    expect(fra.node).toBe('burgundy');
    expect(bur.node).toBe('burgundy');
    expect(b.sides[0].armies).toEqual([fra.id]);
    expect(b.sides[1].armies).toEqual([bur.id]);
    expect(b.pitched).toBeUndefined();
  });

  test('an army landing meets the enemy boarding ships on the same shore', () => {
    const s = emptyGame('FRA');
    forceWar(s, 'ENG', 'FRA');
    declareWar(s, 'ENG', 'FRA', 'none');
    // France boards its transports in Normandy as an English army lands there from the Channel, the same day.
    const fra = army(s, 'FRA', 'normandy', 5);
    const eng = army(s, 'ENG', 'channel', 6);
    s.fleets.f1 = fleet('f1', 'FRA', 'channel', { transport: 2 });
    advanceDay(s);
    for (const [a, to] of [[fra, 'channel'], [eng, 'normandy']] as const) {
      a.path = [to];
      a.progress = 0;
      a.edgeDays = 4;
    }
    advanceDays(s, 4);
    const b = Object.values(s.battles)[0];
    expect(b).toBeDefined();
    expect(b.node).toBe('normandy');
    expect(fra.node).toBe('normandy'); // turned back on the beach
    expect(b.sides[0].armies).toEqual([eng.id]); // the army that landed attacks
    expect(b.sides[1].armies).toEqual([fra.id]);
  });

  test('the army that marched in attacks; armies already standing clash with no attacker penalty', () => {
    // Turkey crossed the Danube into Bulgaria long ago; war breaks out with a Wallachian army standing there too.
    const s = emptyGame('ENG');
    forceWar(s, 'TUR', 'WAL');
    const tur = army(s, 'TUR', 'bulgaria', 6);
    tur.from = 'wallachia';
    tur.arrivedDay = s.day - 100;
    army(s, 'WAL', 'bulgaria', 6);
    advanceDay(s);
    declareWar(s, 'TUR', 'WAL', 'none');
    advanceDay(s);
    const b = Object.values(s.battles)[0];
    expect(b.pitched).toBe(true);
    expect(b.river).toBe(false);
    expect(b.sides[0].armies).toEqual([tur.id]); // the newcomer opens it
    expect(b.sides[0].roll).toBe(b.log[0].rolls[0]); // no hills, no river against it
    // A Wallachian army marching across the Danube today attacks uphill and across the river.
    const s2 = emptyGame('ENG');
    forceWar(s2, 'TUR', 'WAL');
    declareWar(s2, 'TUR', 'WAL', 'none');
    army(s2, 'TUR', 'bulgaria', 6);
    const wal = army(s2, 'WAL', 'wallachia', 6);
    advanceDay(s2);
    wal.path = ['bulgaria'];
    for (let i = 0; i < 30 && !Object.keys(s2.battles).length; i++) advanceDay(s2);
    const b2 = Object.values(s2.battles)[0];
    expect(b2.sides[0].armies).toEqual([wal.id]);
    expect(b2.river).toBe(true);
    expect(b2.pitched).toBeUndefined();
    expect(b2.sides[0].roll).toBe(Math.max(1, b2.log[0].rolls[0] - 2));
  });

  test('rebels rising where an army stands open the battle, without the attacker penalty', () => {
    const s = emptyGame('FRA');
    const fra = army(s, 'FRA', 'champagne', 6);
    advanceDay(s);
    const reb = makeArmy(s, REBELS, 'champagne', 6, 0, 0);
    reb.rebelOf = 'FRA';
    reb.rebelSince = s.day;
    s.armies[reb.id] = reb;
    advanceDay(s);
    const b = Object.values(s.battles)[0];
    expect(b.sides[0].armies).toEqual([reb.id]);
    expect(b.sides[1].armies).toEqual([fra.id]);
    expect(b.pitched).toBe(true);
  });

  test('recruits in land the enemy took muster in the nearest region still held, or come back as gold and levies', () => {
    const s = emptyGame('FRA');
    forceWar(s, 'FRA', 'BUR');
    declareWar(s, 'FRA', 'BUR', 'none');
    const nat = s.nations.FRA;
    s.regions.champagne.controller = 'BUR';
    const raiders = army(s, 'BUR', 'ile_de_france', 3); // next door, but not a place to muster
    // An island of ours wholly in enemy hands: no region of ours in reach over land.
    s.regions.candia.owner = 'FRA';
    s.regions.candia.controller = 'BUR';
    bumpOwnership();
    nat.recruiting = [
      { type: 'inf', region: 'champagne', done: s.day + 1 },
      { type: 'cav', region: 'candia', done: s.day + 1 },
      { type: 'inf', region: 'languedoc', done: s.day + 1 },
    ];
    const gold = nat.gold;
    const levies = nat.manpower;
    advanceDay(s);
    const armies = Object.values(s.armies).filter(a => a.owner === 'FRA');
    expect(armies.reduce((t, a) => t + a.regs.inf.n + a.regs.cav.n, 0)).toBe(2);
    const moved = armies.find(a => a.node !== 'languedoc')!;
    expect(GRAPH.champagne.some(e => e.to === moved.node)).toBe(true);
    expect(moved.node).not.toBe(raiders.node);
    expect(s.regions[moved.node].controller).toBe('FRA');
    expect(nat.gold - gold).toBe(unitCost(s, 'FRA', 'cav'));
    expect(nat.manpower - levies).toBe(1000);
    expect(s.log[0].text).toMatch(/^2 new regiments are ready, 1 at .+ as the enemy holds Champagne\. 1 could not muster in Candia/);
  });

  test('at peace, armies leave land they may no longer enter', () => {
    const s = emptyGame('ENG');
    forceWar(s, 'FRA', 'BUR');
    const w = declareWar(s, 'FRA', 'BUR', 'none')!;
    s.regions.candia.owner = 'BUR';
    s.regions.candia.controller = 'BUR';
    bumpOwnership();
    const deep = army(s, 'FRA', 'flanders', 6);
    const marching = army(s, 'FRA', 'champagne', 4);
    orderMove(s, marching, 'picardy');
    const adrift = army(s, 'FRA', 'channel', 3); // at sea, with no orders
    const island = army(s, 'FRA', 'candia', 3); // no ships to fetch it
    const levies = s.nations.FRA.manpower;
    makePeace(s, w, { regions: [], gold: 0, vassalize: false, release: [], white: true, winner: 'FRA', loser: 'BUR' });
    expect(s.regions[deep.path[deep.path.length - 1]].owner).toBe('FRA');
    expect(deep.homeward).toBe(deep.path[deep.path.length - 1]);
    expect(marching.path).toEqual([]); // already home: it stays
    expect(adrift.path.length).toBeGreaterThan(0);
    expect(s.armies[island.id]).toBeUndefined();
    expect(s.nations.FRA.manpower - levies).toBe(1500);
    advanceDays(s, 120);
    for (const a of [deep, marching, adrift]) {
      expect(s.armies[a.id]).toBe(a);
      expect(s.regions[a.node].owner).toBe('FRA');
      expect(a.path).toEqual([]);
      expect(a.homeward).toBeUndefined();
    }
  });

  test('an army left in land it may no longer enter goes home within a month', () => {
    const s = emptyGame('FRA');
    // A French army in Scotland when the Auld Alliance ends.
    const a = army(s, 'FRA', 'lowlands', 5);
    delete s.alliances['FRA|SCO'];
    advanceDays(s, 25);
    expect(a.homeward).toBeDefined();
    expect(s.regions[a.homeward!].owner).toBe('FRA');
    expect(s.log.some(l => l.text === `The ${a.name} marches home to ${regionName(a.homeward!)}.`)).toBe(true);
    advanceDays(s, 150);
    expect(s.regions[a.node].owner).toBe('FRA');
  });

  test('a realm that makes a separate peace brings its armies home', () => {
    const s = emptyGame('POR');
    forceWar(s, 'FRA', 'ENG');
    const w = declareWar(s, 'FRA', 'ENG', 'none')!;
    if (!w.attackers.includes('SCO')) w.attackers.push('SCO');
    const sco = army(s, 'SCO', 'midlands', 5);
    leaveWar(s, w, 'SCO');
    expect(s.regions[sco.path[sco.path.length - 1]].owner).toBe('SCO');
    advanceDays(s, 60);
    expect(s.regions[sco.node].owner).toBe('SCO');
  });
});
