/** Rulers age and die, heirs take over, republics elect, theocracies choose. Generals are hired and retire. */
import { NAME_ALIASES, NATION, REGNAL, TRAITS, generalPool, namePool, nationName } from './content';
import { log, involvesPlayer } from './log';
import { invalidateMods, married, REBELS, totalDev } from './queries';
import type { GameState, General, NationId, Ruler } from './types';
import { chance, pick, rand, randInt, yearOf, years, nextId } from './util';
import { makeSubject } from './territory';

const RULER_TRAITS = Object.keys(TRAITS.ruler);
const GOOD = ['warrior', 'administrator', 'diplomat', 'pious', 'just', 'scholar', 'shrewd', 'builder', 'merchant', 'ambitious'];
const BAD = ['spendthrift', 'cruel', 'craven', 'feeble'];

/** Skill 1-5, centred on 3. */
export function rollSkill(s: GameState): number {
  const r = rand(s) + rand(s);
  return Math.max(1, Math.min(5, Math.round(r * 2.4 + 0.6)));
}

export function rollTraits(s: GameState, skill: number): string[] {
  const pool = skill >= 3 ? (chance(s, 0.8) ? GOOD : BAD) : chance(s, 0.6) ? BAD : GOOD;
  const traits = [pick(s, pool)];
  if (chance(s, 0.25)) {
    const t2 = pick(s, RULER_TRAITS);
    if (!traits.includes(t2)) traits.push(t2);
  }
  return traits;
}

/** Roman numerals, with no upper limit. */
export function toRoman(k: number): string {
  const table: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, r] of table)
    while (k >= v) {
      out += r;
      k -= v;
    }
  return out;
}

const ROMAN_VALUE: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
function fromRoman(r: string): number {
  let total = 0;
  for (let i = 0; i < r.length; i++) {
    const v = ROMAN_VALUE[r[i]];
    total += v < (ROMAN_VALUE[r[i + 1]] ?? 0) ? -v : v;
  }
  return total;
}

/** The number in a name such as "Frederick III" when it is `base` (or another spelling of it), else 0. */
function ordinalIn(name: string | undefined, base: string): number {
  if (!name) return 0;
  for (const spelling of [base, ...(NAME_ALIASES[base] ?? [])]) {
    const m = name.startsWith(spelling + ' ') ? /^([IVXLCDM]+)\b/.exec(name.slice(spelling.length + 1)) : null;
    if (m) return fromRoman(m[1]);
  }
  return 0;
}

/** A new royal name: the number follows the realm's real list, the names given in this game and the ruler and heir. */
function regnalName(s: GameState, n: NationId): string {
  const base = pick(s, namePool(n));
  const nat = s.nations[n];
  const count = Math.max(nat.flags[`_name_${base}`] ?? 0, REGNAL[n]?.[base] ?? 0, ordinalIn(nat.ruler?.name, base), ordinalIn(nat.heir?.name, base)) + 1;
  nat.flags[`_name_${base}`] = count;
  return count > 1 || chance(s, 0.6) ? `${base} ${toRoman(count)}` : base;
}

export function newPerson(s: GameState, n: NationId, ageMin: number, ageMax: number, name?: string): Ruler {
  const skill = rollSkill(s);
  return { name: name ?? regnalName(s, n), born: yearOf(s.day) - randInt(s, ageMin, ageMax), skill, traits: rollTraits(s, skill) };
}

/** Monthly: rulers may die (more likely when old), heirs may be born, republics hold elections. */
export function monthlyRulers(s: GameState): void {
  const year = yearOf(s.day);
  for (const nat of Object.values(s.nations)) {
    if (!nat.alive) continue;
    const def = NATION[nat.id];
    const age = year - nat.ruler.born;
    const p = age < 30 ? 0.0006 : age < 45 ? 0.0015 : age < 60 ? 0.004 : age < 70 ? 0.009 : 0.018;
    if (chance(s, p)) {
      rulerDies(s, nat.id, 'natural causes');
      continue;
    }
    if (def.gov === 'monarchy') {
      if (nat.ruler.regency && year - nat.ruler.born >= 16) {
        nat.ruler.regency = false;
        if (involvesPlayer(s, nat.id)) log(s, 'ruler', `${nat.ruler.name} comes of age and rules alone.`, { nation: nat.id });
      }
      if (!nat.heir && chance(s, age < 50 ? 0.02 : 0.006)) {
        nat.heir = newPerson(s, nat.id, 0, 0);
        if (involvesPlayer(s, nat.id)) log(s, 'ruler', `An heir is born: ${nat.heir.name}.`, { nation: nat.id });
      }
      if (nat.heir && chance(s, 0.0008)) {
        if (involvesPlayer(s, nat.id)) log(s, 'ruler', `Your heir ${nat.heir.name} has died.`, { nation: nat.id, important: true });
        nat.heir = undefined;
      }
    }
    if (def.gov === 'republic' && nat.electionDay !== undefined && s.day >= nat.electionDay) {
      holdElection(s, nat.id);
    }
  }
}

function holdElection(s: GameState, n: NationId): void {
  const nat = s.nations[n];
  const next = newPerson(s, n, 40, 65);
  next.skill = Math.max(2, next.skill);
  nat.ruler = next;
  nat.electionDay = s.day + years(n === 'VEN' ? 8 : 5);
  invalidateMods();
  if (involvesPlayer(s, n)) log(s, 'ruler', `${next.name} is elected to lead the republic (skill ${next.skill}).`, { nation: n, important: true });
}

export function rulerDies(s: GameState, n: NationId, cause: string): void {
  const nat = s.nations[n];
  const def = NATION[n];
  const old = nat.ruler;
  // A ruler commanding an army leaves the army without a general.
  for (const a of Object.values(s.armies)) if (a.owner === n && a.general?.isRuler) a.general = undefined;
  if (def.gov === 'republic') {
    holdElection(s, n);
    return;
  }
  if (def.gov === 'theocracy') {
    nat.ruler = newPerson(s, n, 45, 70);
    if (involvesPlayer(s, n)) log(s, 'ruler', `${old.name} has died (${cause}). ${nat.ruler.name} now leads (skill ${nat.ruler.skill}).`, { nation: n, important: true });
    invalidateMods();
    return;
  }
  if (nat.heir) {
    const heir = nat.heir;
    nat.ruler = { ...heir, regency: yearOf(s.day) - heir.born < 16 };
    nat.heir = undefined;
    nat.prestige = Math.max(0, nat.prestige - 5);
    if (involvesPlayer(s, n))
      log(s, 'ruler', `${old.name} has died (${cause}). Long live ${nat.ruler.name} (skill ${nat.ruler.skill})${nat.ruler.regency ? ', under a regency' : ''}.`, {
        nation: n,
        important: true,
      });
    invalidateMods();
    return;
  }
  // No heir: a succession crisis. A married dynasty may inherit through a personal union, if it is at least as
  // great as the realm (its lords won't bow to a lesser king).
  const claimants = Object.values(s.nations).filter(
    o =>
      o.alive &&
      o.id !== n &&
      married(s, n, o.id) &&
      NATION[o.id].gov === 'monarchy' &&
      !o.overlord &&
      o.faith === nat.faith &&
      totalDev(s, o.id) >= totalDev(s, n),
  );
  const claimant = claimants.sort((a, b) => b.prestige - a.prestige)[0];
  if (claimant && chance(s, 0.15) && !nat.overlord && n !== s.player) {
    makeSubject(s, claimant.id, n, 'union');
    nat.ruler = { ...claimant.ruler };
    log(s, 'news', `${nationName(n)}'s line has died out. ${nationName(claimant.id)} inherits the crown in a personal union.`, {
      nation: n,
      important: involvesPlayer(s, n, claimant.id),
    });
    invalidateMods();
    return;
  }
  nat.ruler = newPerson(s, n, 18, 50);
  nat.stability = Math.max(-3, nat.stability - 2);
  nat.prestige = Math.max(0, nat.prestige - 10);
  if (involvesPlayer(s, n))
    log(s, 'ruler', `${old.name} dies without an heir. After a bitter succession crisis, ${nat.ruler.name} takes the throne. Order −2.`, {
      nation: n,
      important: true,
    });
  invalidateMods();
}

// ---------------------------------------------------------------- generals


/** What each of a general's stars adds to everything their army does: damage in battle, steadiness (morale lost),
 * march speed and siege speed. */
export const STAR_BONUS = 0.1;
export const MAX_STARS = 5;
export const starBonus = (g: Pick<General, 'stars'> | undefined | null): number => (g ? g.stars * STAR_BONUS : 0);

/** How often a hired general has 1, 2, 3, 4 or 5 stars: most are journeymen, a great captain is rare. */
const STAR_ODDS = [0.25, 0.35, 0.25, 0.12, 0.03];
function rollStars(s: GameState): number {
  let r = rand(s);
  for (let i = 0; i < STAR_ODDS.length; i++) {
    r -= STAR_ODDS[i];
    if (r < 0) return i + 1;
  }
  return 1;
}

export function newGeneral(s: GameState, n: NationId, known?: { stars: number; name?: string }): General {
  // A noble house of the realm's own people (or a title, where surnames were not used), and a full first name.
  const name = n === REBELS ? 'Captain' : pick(s, generalPool(n)).replace('{first}', pick(s, namePool(n)));
  return {
    id: nextId(s, 'g'),
    name: known?.name ?? name,
    stars: known ? Math.max(1, Math.min(MAX_STARS, Math.round(known.stars))) : rollStars(s),
    hired: s.day,
    lifespan: years(randInt(s, 8, 25)),
  };
}

/** The ruler as an army commander: stars from their skill, one more for a warrior. */
export function rulerAsGeneral(s: GameState, n: NationId): General {
  const r = s.nations[n].ruler;
  const bonus = r.traits.includes('warrior') ? 1 : 0;
  const stars = Math.max(1, Math.min(MAX_STARS, Math.round(r.skill * 0.7) + bonus));
  return { id: `ruler_${n}`, name: r.name, stars, hired: s.day, lifespan: 1e9, isRuler: true };
}

export function monthlyGenerals(s: GameState): void {
  for (const a of Object.values(s.armies)) {
    const g = a.general;
    if (g && !g.isRuler && s.day - g.hired > g.lifespan) {
      if (a.owner === s.player) log(s, 'ruler', `General ${g.name} retires from the ${a.name}.`, { node: a.node });
      a.general = undefined;
    }
  }
  for (const nat of Object.values(s.nations)) {
    nat.generals = nat.generals.filter(g => s.day - g.hired <= g.lifespan);
  }
}

