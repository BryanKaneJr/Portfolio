/** Rulers age and die, heirs take over, republics elect, theocracies choose. Generals are hired and retire. */
import { NATION, TRAITS, namePool } from './content';
import { log, involvesPlayer } from './log';
import { invalidateMods, married, REBELS } from './queries';
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

function regnalName(s: GameState, n: NationId): string {
  const base = pick(s, namePool(n));
  const count = (s.nations[n].flags[`_name_${base}`] ?? 0) + 1;
  s.nations[n].flags[`_name_${base}`] = count;
  const numerals = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return count > 1 || chance(s, 0.6) ? `${base} ${numerals[Math.min(12, count + randInt(s, 0, 2))]}` : base;
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
  // No heir: a succession crisis. A married dynasty may inherit through a personal union.
  const claimants = Object.values(s.nations).filter(
    o => o.alive && o.id !== n && married(s, n, o.id) && NATION[o.id].gov === 'monarchy' && !o.overlord && o.faith === nat.faith,
  );
  const claimant = claimants.sort((a, b) => b.prestige - a.prestige)[0];
  if (claimant && chance(s, 0.15) && !nat.overlord && n !== s.player) {
    makeSubject(s, claimant.id, n, 'union');
    nat.ruler = { ...claimant.ruler };
    log(s, 'news', `${def.name}'s line has died out. ${NATION[claimant.id].name} inherits the crown in a personal union.`, {
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
    log(s, 'ruler', `${old.name} dies without an heir. After a bitter succession crisis, ${nat.ruler.name} takes the throne. Stability -2.`, {
      nation: n,
      important: true,
    });
  invalidateMods();
}

// ---------------------------------------------------------------- generals

const SURNAMES = ['de Foix', 'von Stein', 'Sforza', 'Colonna', 'de la Cerda', 'Talbot', 'Percy', 'Báthory', 'Zamoyski', 'Shuisky', 'Pasha', 'Bey', 'Douglas', 'Oxenstierna', 'Wallenstein', 'Tilly', 'Montecuccoli', 'Turenne', 'Condé', 'Vauban', 'Marlborough', 'Eugene', 'Gonzaga', 'Orsini', 'Doria', 'Ruyter', 'Tromp', 'Coligny', 'Guise', 'Alba'];

export function newGeneral(s: GameState, n: NationId, stats?: { fire: number; shock: number; maneuver: number; name?: string }): General {
  const roll = () => Math.max(1, Math.min(5, Math.round(1 + rand(s) * 3.3)));
  const first = n === REBELS ? 'Captain' : pick(s, namePool(n)).split(' ')[0];
  return {
    id: nextId(s, 'g'),
    name: stats?.name ?? `${first} ${pick(s, SURNAMES)}`,
    fire: stats?.fire ?? roll(),
    shock: stats?.shock ?? roll(),
    maneuver: stats?.maneuver ?? roll(),
    hired: s.day,
    lifespan: years(randInt(s, 8, 25)),
  };
}

/** The ruler as an army commander. */
export function rulerAsGeneral(s: GameState, n: NationId): General {
  const r = s.nations[n].ruler;
  const bonus = r.traits.includes('warrior') ? 1 : 0;
  const base = Math.max(1, Math.min(5, Math.round(r.skill * 0.7) + bonus));
  return { id: `ruler_${n}`, name: r.name, fire: base, shock: Math.min(5, base + bonus), maneuver: Math.max(1, base - 1 + bonus), hired: s.day, lifespan: 1e9, isRuler: true };
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

