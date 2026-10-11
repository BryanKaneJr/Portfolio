/** Who owns what: region transfers, subjects, annexation, releasing and the death of nations. */
import { NATION, REGION } from './content';
import { log, involvesPlayer, newsworthy, requestPause } from './log';
import { bumpOwnership, bumpWars, ownedRegions, invalidateMods } from './queries';
import type { GameState, NationId, RegionId } from './types';
import { pairKey } from './util';

let mapDirty = true;
/** Something visible on the political map changed (owner or controller). */
export const markMapDirty = () => {
  mapDirty = true;
};
export const takeMapDirty = () => {
  const d = mapDirty;
  mapDirty = false;
  return d;
};

export function setController(s: GameState, r: RegionId, n: NationId | null): void {
  const reg = s.regions[r];
  if (reg.controller === n) return;
  reg.controller = n;
  reg.siege = undefined;
  markMapDirty();
}

export function transferRegion(s: GameState, r: RegionId, to: NationId, opts: { conquest?: boolean } = {}): void {
  const reg = s.regions[r];
  const from = reg.owner;
  if (from === to) return;
  reg.owner = to;
  bumpOwnership();
  reg.controller = to;
  reg.siege = undefined;
  reg.converting = undefined;
  if (!reg.cores.includes(to)) reg.conquered = s.day;
  if (opts.conquest && s.nations[to]) s.nations[to].record.regionsTaken++;
  // A claim is used up once you own the region.
  delete s.nations[to]?.claims[r];
  markMapDirty();
  if (!from) return;
  const old = s.nations[from];
  if (!old) return;
  if (old.capital === r) {
    const rest = ownedRegions(s, from).sort((a, b) => b.dev - a.dev);
    if (rest.length) old.capital = rest[0].id;
  }
  if (ownedRegions(s, from).length === 0) killNation(s, from, to);
}

export function killNation(s: GameState, n: NationId, by?: NationId): void {
  const nat = s.nations[n];
  if (!nat || !nat.alive) return;
  nat.alive = false;
  for (const id of Object.keys(s.armies)) if (s.armies[id].owner === n) delete s.armies[id];
  for (const id of Object.keys(s.fleets)) if (s.fleets[id].owner === n) delete s.fleets[id];
  for (const k of Object.keys(s.alliances)) if (k.split('|').includes(n)) delete s.alliances[k];
  for (const k of Object.keys(s.marriages)) if (k.split('|').includes(n)) delete s.marriages[k];
  for (const k of Object.keys(s.access)) if (k.split('>').includes(n)) delete s.access[k];
  for (const o of Object.values(s.nations)) {
    if (o.overlord === n) {
      o.overlord = undefined;
      o.subjectType = undefined;
    }
    o.rivals = o.rivals.filter(x => x !== n);
  }
  nat.overlord = undefined;
  nat.subjectType = undefined;
  for (const w of Object.values(s.wars)) {
    w.attackers = w.attackers.filter(x => x !== n);
    w.defenders = w.defenders.filter(x => x !== n);
    if (!w.attackers.length || !w.defenders.length) delete s.wars[w.id];
  }
  bumpWars();
  for (const c of s.coalitions) c.members = c.members.filter(x => x !== n);
  s.coalitions = s.coalitions.filter(c => c.target !== n && c.members.length >= 2);
  s.offers = s.offers.filter(o => o.from !== n);
  s.pendingEvents = s.pendingEvents.filter(e => e.nation !== n);
  if (s.hre.emperor === n) s.hre.emperor = null;
  s.hre.electors = s.hre.electors.filter(x => x !== n);
  if (newsworthy(s, n, by) || NATION[n].tier !== 'minor')
    log(s, 'news', `${NATION[n].name} has ceased to exist${by ? `, absorbed by ${NATION[by]?.name ?? 'rebels'}` : ''}.`, {
      nation: n,
      important: involvesPlayer(s, n, by),
    });
  if (n === s.player) {
    s.gameOver = { reason: 'annexed', day: s.day };
    requestPause(s, 'gameOver');
  }
  markMapDirty();
}

export function makeSubject(s: GameState, overlord: NationId, subject: NationId, type: 'vassal' | 'union'): void {
  const sub = s.nations[subject];
  if (!sub || !sub.alive || overlord === subject) return;
  // Subjects of the new subject go free; a subject can't have subjects of its own here.
  for (const o of Object.values(s.nations)) if (o.overlord === subject) o.overlord = undefined;
  sub.overlord = overlord;
  sub.subjectType = type;
  sub.subjectSince = s.day;
  // End wars between them.
  for (const w of Object.values(s.wars)) {
    const a = w.attackers.includes(overlord) && w.defenders.includes(subject);
    const b = w.defenders.includes(overlord) && w.attackers.includes(subject);
    if (a || b) {
      w.attackers = w.attackers.filter(x => x !== subject);
      w.defenders = w.defenders.filter(x => x !== subject);
      if (!w.attackers.length || !w.defenders.length) delete s.wars[w.id];
    }
  }
  bumpWars();
  delete s.alliances[pairKey(overlord, subject)];
  for (const c of s.coalitions) if (c.target === overlord) c.members = c.members.filter(x => x !== subject);
  invalidateMods();
  markMapDirty();
}

export function releaseSubject(s: GameState, subject: NationId): void {
  const sub = s.nations[subject];
  if (!sub?.overlord) return;
  sub.overlord = undefined;
  sub.subjectType = undefined;
  sub.subjectSince = undefined;
  markMapDirty();
}

/** `by` absorbs `target`: every region, army and fleet changes hands. */
export function annexNation(s: GameState, by: NationId, target: NationId): void {
  const t = s.nations[target];
  if (!t?.alive || by === target) return;
  for (const r of [...ownedRegions(s, target)]) {
    if (!r.cores.includes(by)) r.cores.push(by);
    r.owner = by;
    r.controller = by;
    r.siege = undefined;
  }
  bumpOwnership();
  for (const r of Object.values(s.regions)) if (r.controller === target) r.controller = r.owner;
  for (const a of Object.values(s.armies)) if (a.owner === target) a.owner = by;
  for (const f of Object.values(s.fleets)) if (f.owner === target) f.owner = by;
  s.nations[by].gold += Math.max(0, t.gold);
  s.nations[by].generals.push(...t.generals);
  killNation(s, target, by);
}

/** Bring a nation back to life on the regions where it still has cores (owned by `from`). */
export function releaseNation(s: GameState, from: NationId, n: NationId): boolean {
  const nat = s.nations[n];
  const regions = Object.values(s.regions).filter(r => r.owner === from && r.cores.includes(n));
  if (!nat || !regions.length) return false;
  for (const r of regions) {
    r.owner = n;
    r.controller = n;
    r.siege = undefined;
  }
  bumpOwnership();
  if (!nat.alive) {
    nat.alive = true;
    nat.gold = 30;
    nat.manpower = 3000;
    nat.stability = 1;
    nat.loans = 0;
    nat.overlord = undefined;
    nat.capital = (regions.find(r => r.id === NATION[n].capital) ?? regions.sort((a, b) => b.dev - a.dev)[0]).id;
  } else if (!regions.some(r => r.id === nat.capital)) {
    // keep its capital
  }
  markMapDirty();
  return true;
}

export const regionName = (r: RegionId) => REGION[r]?.name ?? r;
