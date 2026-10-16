/** Faith: conversions, Reformation spread, Papal Favor, and the Holy Roman Empire's elections. */
import { NATION, REGION, MAP_REGION, GRAPH, nationName } from './content';
import { log, involvesPlayer, moment } from './log';
import { aliveNations, ownedRegions, totalDev, REBELS } from './queries';
import { opinion, isHreMember, addOpinion } from './diplomacy';
import type { GameState, NationId, RegionId } from './types';
import { chance, clamp, yearOf, years } from './util';

export const SANCTION_COST = 50;
export const EXCOMMUNICATE_COST = 60;

export function monthlyReligion(s: GameState): void {
  const year = yearOf(s.day);
  for (const nat of aliveNations(s)) {
    if (nat.faith === 'catholic') nat.papalFavor = clamp(nat.papalFavor + 0.4 + (nat.ruler.traits.includes('pious') ? 0.4 : 0), 0, 100);
  }
  // The Reformation spreads region to region once Luther's ideas are out (until the counter-reformation wins).
  if ('reformation' in s.flags && year < 1660) {
    const fade = year > 1600 ? 0.4 : 1;
    for (const r of Object.values(s.regions)) {
      if (r.faith !== 'catholic' || !r.owner) continue;
      const def = REGION[r.id];
      const [lon, lat] = MAP_REGION[r.id].lonlat;
      const zone = def.hre || lat > 53 || (lon > 12 && lat > 50) || ['switzerland', 'bohemia', 'hungary', 'transylvania', 'lowlands', 'london', 'east_anglia', 'midlands'].includes(r.id);
      if (!zone) continue;
      const protestantNeighbour = GRAPH[r.id].some(e => s.regions[e.to]?.faith === 'protestant');
      const ownerProtestant = s.nations[r.owner]?.faith === 'protestant';
      const p = (protestantNeighbour ? 0.004 : 0.0008) * (ownerProtestant ? 3 : 1) * fade;
      if (chance(s, p)) {
        r.faith = 'protestant';
        if (r.owner === s.player) log(s, 'event', `${def.name} turns Protestant.`, { node: r.id, important: s.nations[s.player].faith !== 'protestant' });
      }
    }
  }
  hreUpkeep(s);
}

/** A sanction from the Pope: a claim on a neighbouring region of a non-Catholic or excommunicated ruler. */
export function sanctionTargets(s: GameState, n: NationId): RegionId[] {
  const out = new Set<RegionId>();
  for (const r of ownedRegions(s, n))
    for (const e of GRAPH[r.id]) {
      if (e.kind !== 'land' && e.kind !== 'strait') continue;
      const reg = s.regions[e.to];
      const owner = reg.owner ? s.nations[reg.owner] : undefined;
      if (!owner || owner.id === n || e.to in s.nations[n].claims) continue;
      if (owner.faith !== 'catholic' || owner.flags.excommunicated) out.add(e.to);
    }
  return [...out];
}

export function excommunicate(s: GameState, by: NationId, target: NationId): string | null {
  const B = s.nations[by];
  const T = s.nations[target];
  if (B.faith !== 'catholic' || T?.faith !== 'catholic') return 'Only Catholics can ask the Pope to excommunicate a Catholic ruler.';
  if (B.papalFavor < EXCOMMUNICATE_COST) return `You need ${EXCOMMUNICATE_COST} Papal Favor.`;
  if (T.flags.excommunicated && s.day - T.flags.excommunicated < years(10)) return 'They are already excommunicated.';
  B.papalFavor -= EXCOMMUNICATE_COST;
  T.flags.excommunicated = s.day;
  T.stability = clamp(T.stability - 1, -3, 3);
  T.prestige = clamp(T.prestige - 15, 0, 100);
  for (const o of aliveNations(s)) if (o.faith === 'catholic' && o.id !== target) addOpinion(s, o.id, target, 'excommunicated', 'Excommunicated', -30, 0.3);
  log(s, 'news', `The Pope excommunicates ${nationName(target)}'s ruler at ${nationName(by)}'s urging.`, { important: involvesPlayer(s, by, target) });
  return null;
}

// ---------------------------------------------------------------- Holy Roman Empire

export const hreMembers = (s: GameState) => aliveNations(s).filter(n => isHreMember(s, n.id) && n.id !== REBELS).map(n => n.id);

function hreUpkeep(s: GameState): void {
  const emp = s.hre.emperor;
  const key = emp ? `${emp}:${s.nations[emp]?.ruler.name}` : '';
  // A new emperor is elected when the old one's ruler dies or the emperor's realm falls.
  if (!emp || !s.nations[emp]?.alive || (s.hre.rulerKey && s.hre.rulerKey !== key)) holdImperialElection(s);
  const now = s.hre.emperor;
  s.hre.rulerKey = now ? `${now}:${s.nations[now].ruler.name}` : '';
  // Electors that died or left the Empire are replaced by the biggest member that isn't one.
  s.hre.electors = s.hre.electors.filter(e => s.nations[e]?.alive && isHreMember(s, e));
  while (s.hre.electors.length < 7) {
    const cand = hreMembers(s)
      .filter(m => !s.hre.electors.includes(m))
      .sort((a, b) => totalDev(s, b) - totalDev(s, a))[0];
    if (!cand) break;
    s.hre.electors.push(cand);
  }
}

export function holdImperialElection(s: GameState): void {
  const members = hreMembers(s).filter(m => s.nations[m].faith !== 'muslim' && NATION[m].gov === 'monarchy' && !s.nations[m].overlord);
  if (!members.length) {
    s.hre.emperor = null;
    return;
  }
  const votes = new Map<NationId, number>();
  for (const e of s.hre.electors) {
    let best = members[0];
    let bestScore = -Infinity;
    for (const c of members) {
      // Electors favour themselves a little and the sitting Emperor's house a lot: the crown rarely changes hands.
      const score = (c === e ? 20 : 0) + opinion(s, e, c) + totalDev(s, c) / 3 + s.nations[c].prestige / 4 + (c === s.hre.emperor ? 40 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    votes.set(best, (votes.get(best) ?? 0) + 1);
  }
  const winner = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? members[0];
  const old = s.hre.emperor;
  s.hre.emperor = winner;
  if (old !== winner) log(s, 'news', `${nationName(winner)} is elected Holy Roman Emperor.`, { important: involvesPlayer(s, winner, old ?? undefined) || isHreMember(s, s.player) });
  if (old !== winner) moment(s, { kind: 'headline', card: false, tone: winner === s.player ? 'good' : 'info', title: `${nationName(winner)} is elected Emperor`, nation: winner });
}
