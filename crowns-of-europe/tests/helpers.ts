import { newGame } from '../src/sim/state';
import { makeArmy } from '../src/sim/state';
import type { Army, GameState, NationId } from '../src/sim/types';

/** A fresh game with every starting army and fleet removed, so a test controls exactly what is on the map. */
export function emptyGame(player: NationId = 'FRA', seed = 7, opts: { live?: boolean } = {}): GameState {
  const s = newGame({ player, seed });
  s.armies = {};
  s.fleets = {};
  if (!opts.live) {
    // A quiet world: no AI moves, no random events or rebels, so the test controls everything.
    s.flags.__noAI = 1;
    s.flags.__noEvents = 1;
  }
  s.settings.autoPause = Object.fromEntries(Object.keys(s.settings.autoPause).map(k => [k, true])) as any;
  return s;
}

export function army(s: GameState, owner: NationId, node: string, inf: number, cav = 0, art = 0): Army {
  const a = makeArmy(s, owner, node, inf, cav, art);
  a.morale = 10; // clamped to max on the next tick
  s.armies[a.id] = a;
  return a;
}

export function forceWar(s: GameState, a: NationId, b: NationId) {
  delete s.truces[[a, b].sort().join('|')];
  delete s.alliances[[a, b].sort().join('|')];
}
