/** One simulated day. Monthly systems run on the 1st. The UI calls advanceDay() on a timer. */
import { monthlyAI, dailyArmyAI, monthlyFleetAI } from './ai';
import { dailyBattles } from './battle';
import { monthlyDiplomacy } from './diplomacy';
import { monthlyEconomy } from './economy';
import { checkAchievements, monthlyEvents } from './events';
import { drainPauses, log, requestPause } from './log';
import {
  cleanupArmies,
  dailyEngagements,
  dailyMorale,
  dailyMovement,
  dailyRecruitment,
  monthlyAttrition,
  monthlyReinforce,
} from './military';
import { monthlyMissions } from './missions';
import { monthlyColonies } from './colonies';
import { monthlyScience } from './science';
import { dailyFleets, dailyShipyards, monthlyNavy } from './navy';
import { invalidateMods, ownedRegions } from './queries';
import { monthlyUnrest } from './rebels';
import { monthlyReligion } from './religion';
import { monthlyGenerals, monthlyRulers } from './rulers';
import { dailySieges } from './siege';
import { takeMapDirty } from './territory';
import { monthlyThreat } from './threat';
import type { GameState, TickResult } from './types';
import { dateOf, months, years } from './util';
import { monthlyWars, refuseCall } from './war';
import { regionName } from './content';

export const END_YEAR = 1750;

export function advanceDay(s: GameState): TickResult {
  if (s.gameOver) return { pause: ['gameOver'], mapChanged: false };
  s.day++;
  const d = dateOf(s.day);
  dailyRecruitment(s);
  dailyShipyards(s);
  dailyArmyAI(s);
  dailyMovement(s);
  dailyFleets(s);
  dailyEngagements(s);
  dailyBattles(s);
  dailySieges(s);
  dailyMorale(s);
  cleanupArmies(s);
  if (d.day === 1) monthly(s);
  if (d.year >= END_YEAR && !s.gameOver) {
    s.gameOver = { reason: 'end', day: s.day };
    log(s, 'news', `The year ${END_YEAR} dawns. Your reign over history is complete.`, { important: true });
    requestPause(s, 'gameOver');
  }
  return { pause: drainPauses(), mapChanged: takeMapDirty() };
}

function monthly(s: GameState): void {
  invalidateMods();
  monthlyEconomy(s);
  monthlyScience(s);
  monthlyReinforce(s);
  monthlyAttrition(s);
  monthlyUnrest(s);
  monthlyRulers(s);
  monthlyGenerals(s);
  monthlyDiplomacy(s);
  monthlyThreat(s);
  monthlyWars(s);
  monthlyNavy(s);
  monthlyColonies(s);
  monthlyReligion(s);
  monthlyEvents(s);
  monthlyMissions(s);
  monthlyAI(s);
  monthlyFleetAI(s);
  fabrication(s);
  expireOffers(s);
  checkAchievements(s);
  const regions = ownedRegions(s, s.player).length;
  if (regions > s.stats.peakRegions) s.stats.peakRegions = regions;
}

function fabrication(s: GameState): void {
  for (const nat of Object.values(s.nations)) {
    const f = nat.fabricating;
    if (!f || f.done > s.day) continue;
    nat.fabricating = undefined;
    if (s.regions[f.region].owner === nat.id) continue;
    nat.claims[f.region] = s.day + years(25);
    if (nat.id === s.player) log(s, 'diplomacy', `Your clerks have forged a claim on ${regionName(f.region)}.`, { node: f.region, important: true });
  }
}

/** Offers the player ignores lapse after two months (an ignored call to arms counts as a refusal). */
function expireOffers(s: GameState): void {
  const old = s.offers.filter(o => s.day - o.day > months(2));
  if (!old.length) return;
  s.offers = s.offers.filter(o => s.day - o.day <= months(2));
  for (const o of old) if (o.kind === 'callToArms') refuseCall(s, s.player, o.from, s.wars[o.war]?.defenders[0] === o.from);
}

/** Advance several days (tests, fast-forward). Stops early on a pause if `stopOnPause`. */
export function advanceDays(s: GameState, n: number, stopOnPause = false): TickResult {
  const all: TickResult = { pause: [], mapChanged: false };
  for (let i = 0; i < n; i++) {
    const r = advanceDay(s);
    all.mapChanged ||= r.mapChanged;
    for (const p of r.pause) if (!all.pause.includes(p)) all.pause.push(p);
    if (stopOnPause && r.pause.length) break;
    if (s.gameOver) break;
  }
  return all;
}
