/**
 * What to do next: the few goals within reach, most pressing first, for the strip under the top bar. Read-only: it
 * never changes the game and never draws on the random numbers.
 */
import { ADVANCE, CROWN, regionName } from './content';
import { crownProgress } from './crowns';
import { evalCondition } from './events';
import { missionState, missionsFor } from './missions';
import { hasTruce } from './queries';
import { advanceCost, availableAdvances, scienceRate } from './science';
import { SETTLERS_NEEDED } from './colonies';
import { canDeclareWar } from './war';
import type { Condition, GameState, NationId, RegionId } from './types';
import { formatShortDate, pairKey, yearOf } from './util';

/** Where tapping a goal leads. */
export type GoalGo = { tab: 'missions' | 'science' | 'realm' } | { region: RegionId };

export interface Goal {
  key: string;
  text: string;
  /** Can be done now (a mission to claim, a claim to press, a crown to proclaim). */
  ready?: boolean;
  go: GoalGo;
}

/** Split a goal into checkable parts (for the mission list and the strip). */
export function goalParts(c: Condition): Condition[] {
  return 'all' in c ? c.all : [c];
}

const live = (s: GameState, until: number) => until === -1 || until > s.day;

/** The next goals for `n`, at most `max`, in this order: a ready mission (or crown), a claim to press (or the next truce to run
 * out), the mission nearest done, a claim being forged, a colony's settlers, the next advance, the nearest crown. */
export function nextGoals(s: GameState, n: NationId, max = 3): Goal[] {
  const nat = s.nations[n];
  if (!nat?.alive) return [];
  const out: Goal[] = [];
  const missions = missionsFor(n).map(m => ({ m, state: missionState(s, n, m) }));

  const ready = missions.find(x => x.state === 'ready');
  if (ready) out.push({ key: `mission-ready`, text: `${ready.m.title}: ready`, ready: true, go: { tab: 'missions' } });
  // A crown ready to proclaim is as pressing as a mission ready to claim; one still out of reach comes last.
  const crown = [...crownProgress(s, n)].sort(
    (a, b) => Number(b.ready) - Number(a.ready) || b.held / b.need - a.held / a.need,
  )[0];
  const crownGoal: Goal | null =
    crown && CROWN[crown.id]
      ? {
          key: `crown-${crown.id}`,
          text: crown.ready
            ? `Proclaim ${CROWN[crown.id].name}`
            : `${CROWN[crown.id].name}: ${crown.held} of ${crown.need} lands`,
          ready: crown.ready,
          go: { tab: 'realm' },
        }
      : null;
  if (crownGoal?.ready) out.push(crownGoal);

  // Claims on land others hold: one that can be pressed now (the richest), else the one whose truce ends first.
  const claims = Object.entries(nat.claims)
    .filter(([r, until]) => live(s, until) && s.regions[r]?.owner && s.regions[r].owner !== n)
    .map(([r]) => ({ r, owner: s.regions[r].owner! }));
  const open = claims
    .filter(c => !canDeclareWar(s, n, c.owner) && !hasTruce(s, n, c.owner))
    .sort((a, b) => s.regions[b.r].dev - s.regions[a.r].dev)[0];
  if (open)
    out.push({
      key: `claim-${open.r}`,
      text: `Press the claim on ${regionName(open.r)}`,
      ready: true,
      go: { region: open.r },
    });
  else {
    // Only a claim that outlasts the truce: one that lapses first is no goal.
    const waiting = claims
      .filter(c => hasTruce(s, n, c.owner) && (nat.claims[c.r] === -1 || nat.claims[c.r] > truceEnd(s, n, c.owner)))
      .sort((a, b) => truceEnd(s, n, a.owner) - truceEnd(s, n, b.owner))[0];
    if (waiting)
      out.push({
        key: `claim-${waiting.r}`,
        text: `${regionName(waiting.r)}: truce ends ${yearOf(truceEnd(s, n, waiting.owner))}`,
        go: { region: waiting.r },
      });
  }

  const active = missions
    .filter(x => x.state === 'active')
    .map(x => {
      const parts = goalParts(x.m.goal);
      return { m: x.m, met: parts.filter(c => evalCondition(s, n, c)).length, of: parts.length };
    })
    .sort((a, b) => b.met / b.of - a.met / a.of)[0];
  if (active)
    out.push({
      key: `mission-${active.m.id}`,
      text: active.of > 1 ? `${active.m.title}: ${active.met} of ${active.of}` : active.m.title,
      go: { tab: 'missions' },
    });

  if (nat.fabricating)
    out.push({
      key: 'forge',
      text: `Claim on ${regionName(nat.fabricating.region)}: ${formatShortDate(nat.fabricating.done)}`,
      go: { region: nat.fabricating.region },
    });

  const colony = Object.values(s.regions)
    .filter(r => r.colony?.by === n)
    .sort((a, b) => b.colony!.settlers - a.colony!.settlers)[0];
  if (colony)
    out.push({
      key: `colony-${colony.id}`,
      text: `${regionName(colony.id)}: ${Math.floor(colony.colony!.settlers)} of ${SETTLERS_NEEDED} settlers`,
      go: { region: colony.id },
    });

  if (nat.researching && ADVANCE[nat.researching]) {
    const rate = scienceRate(s, n).total;
    const left = Math.max(0, advanceCost(s, n, nat.researching).total - nat.science);
    const mo = rate > 0 ? Math.max(1, Math.ceil(left / rate)) : null;
    out.push({
      key: 'advance',
      text: `${ADVANCE[nat.researching].name}${mo ? `: ${mo} mo` : ''}`,
      go: { tab: 'science' },
    });
  } else if (availableAdvances(s, n).length)
    out.push({ key: 'advance', text: 'Pick an advance', go: { tab: 'science' } });

  if (crownGoal && !crownGoal.ready) out.push(crownGoal);

  return out.slice(0, max);
}

const truceEnd = (s: GameState, a: NationId, b: NationId) => s.truces[pairKey(a, b)] ?? s.day;
