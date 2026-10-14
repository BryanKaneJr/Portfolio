/**
 * Validates everything in src/content/: references between files, the event/mission DSL, and text limits.
 * Run: npm run validate   (part of npm run check)
 */
import { CHARGES, FLAG_PATTERNS } from '../src/ui/components/charges';
import {
  ACHIEVEMENTS,
  ADVANCE,
  ADVANCES,
  AIMS,
  BONDS,
  EVENTS,
  MAP,
  MISSIONS,
  NATION,
  NATIONS,
  POLICIES,
  REGION,
  REGIONS,
  RIVERS,
  SCENARIO,
  SEA,
  TRAITS,
  UNITS,
  LEARNING,
  START_ADVANCES,
  CROWN,
  CROWNS,
} from '../src/sim/content';
import fs from 'node:fs';
import path from 'node:path';
import namesJson from '../src/content/names.json';
import genericEventsJson from '../src/content/events-generic.json';
import newWorldEventsJson from '../src/content/events-newworld.json';
import { newGame } from '../src/sim/state';
import { GOOD_VALUE } from '../src/sim/colonies';
import { EVENT_IMAGES, FAITHS, MODIFIER_KEYS, validateCondition, validateEffect } from '../src/sim/dsl';

const errs: string[] = [];
const warns: string[] = [];
const TERRAIN = ['plains', 'forest', 'hills', 'marsh', 'mountains'];

// Regions and map
for (const r of REGIONS) {
  if (r.owner !== null && !NATION[r.owner]) errs.push(`region ${r.id}: unknown owner ${r.owner}`);
  if (r.owner === null && r.fort > 0) errs.push(`region ${r.id}: uncolonized land can't have a fort`);
  if (r.owner === null && r.faith !== 'native') errs.push(`region ${r.id}: uncolonized land has faith "native"`);
  if (r.owner !== null && (r.natives || r.hostility)) errs.push(`region ${r.id}: natives and hostility are for uncolonized land`);
  if (r.natives !== undefined && !(r.natives >= 0 && r.natives <= 8)) errs.push(`region ${r.id}: natives must be 0-8 (thousands)`);
  if (r.hostility !== undefined && !(r.hostility >= 0 && r.hostility <= 3)) errs.push(`region ${r.id}: hostility must be 0-3`);
  if (r.good !== undefined && !(r.good in GOOD_VALUE)) errs.push(`region ${r.id}: unknown good ${r.good}`);
  if (r.nw && !r.good) warns.push(`region ${r.id}: New World regions should trade in a good`);
  if (!TERRAIN.includes(r.terrain)) errs.push(`region ${r.id}: bad terrain`);
  if (!(r.dev >= 1 && r.dev <= 10)) errs.push(`region ${r.id}: dev must be 1-10`);
  if (!(r.fort >= 0 && r.fort <= 3)) errs.push(`region ${r.id}: fort must be 0-3`);
  if (!FAITHS.includes(r.faith)) errs.push(`region ${r.id}: bad faith`);
  const [lon, lat] = r.town?.lonlat ?? [NaN, NaN];
  const { west, east, north, south } = MAP.projection;
  if (!r.town?.name || !(lon > west && lon < east && lat > south && lat < north)) errs.push(`region ${r.id}: needs a town (a name and a [lon, lat] on the map)`);
}
for (const m of MAP.regions) for (const sea of m.seas) if (!SEA[sea]) errs.push(`region ${m.id}: coast on unknown or closed sea ${sea}`);
for (const m of MAP.regions) if (!m.town || m.townName !== REGION[m.id]?.town?.name) errs.push(`region ${m.id}: its town in map.json is out of date (run npm run map:build)`);
const mapIds = new Set(MAP.regions.map(r => r.id));
for (const r of REGIONS) if (!mapIds.has(r.id)) errs.push(`region ${r.id} is missing from map.json (run npm run map:build)`);
for (const id of mapIds) if (!REGION[id]) errs.push(`map.json has region ${id} that regions.json doesn't (run npm run map:build)`);

// Rivers must run along a real border.
const borderKeys = new Set(MAP.borders.map(b => `${b.a}|${b.b}`));
for (const key of RIVERS.keys()) if (!borderKeys.has(key)) errs.push(`river ${RIVERS.get(key)}: ${key} is not a border between neighbours`);

// Nations
// Flags: drawn from known patterns and charges, and no two realms bear the same one.
const flagSeen = new Map<string, string>();
for (const n of NATIONS) {
  const f = n.flag;
  if (!FLAG_PATTERNS.includes(f.pattern)) errs.push(`nation ${n.id}: unknown flag pattern ${f.pattern}`);
  for (const c of [f.charge, f.charge2]) if (c && !CHARGES[c]) errs.push(`nation ${n.id}: unknown flag charge ${c}`);
  if (f.charge2 && f.pattern !== 'quarterly') errs.push(`nation ${n.id}: a second charge needs a quarterly flag`);
  const key = JSON.stringify([f.pattern, f.colors, f.charge ?? null, f.chargeColor ?? null, f.charge2 ?? null, f.charge2Color ?? null]);
  if (flagSeen.has(key)) errs.push(`nation ${n.id}: same flag as ${flagSeen.get(key)}`);
  flagSeen.set(key, n.id);
}
for (const n of NATIONS) {
  if (!REGION[n.capital] || REGION[n.capital].owner !== n.id) errs.push(`nation ${n.id}: capital must be a region it owns`);
  if (!!n.native !== (n.faith === 'native')) errs.push(`nation ${n.id}: native nations (and only they) follow the native faith`);
  if (!TRAITS.national[n.trait]) errs.push(`nation ${n.id}: unknown trait ${n.trait}`);
  for (const t of [...n.ruler.traits, ...(n.heir?.traits ?? [])]) if (!TRAITS.ruler[t]) errs.push(`nation ${n.id}: unknown ruler trait ${t}`);
}
for (const [id, list] of Object.entries(SCENARIO.claims)) {
  if (!NATION[id]) errs.push(`scenario claims: unknown nation ${id}`);
  if (list.length > 4) errs.push(`scenario claims ${id}: ${list.length} claims; keep it to the quarrels of the day (4 at most)`);
  for (const c of list) {
    const r = REGION[c.region];
    if (!r) errs.push(`scenario claims ${id}: unknown region ${c.region}`);
    else if (r.owner === id) errs.push(`scenario claims ${id}: ${c.region} is already its own`);
    if (!(c.until > SCENARIO.start.year && c.until <= 1700)) errs.push(`scenario claims ${id} on ${c.region}: until ${c.until} should be a year after the start`);
    if (!c.why?.trim()) errs.push(`scenario claims ${id} on ${c.region}: give its historical reason ('why')`);
    else if (c.why.length > 48) errs.push(`scenario claims ${id} on ${c.region}: 'why' is over 48 characters`);
  }
}
for (const pair of [...SCENARIO.alliances, ...SCENARIO.rivals, ...SCENARIO.marriages])
  for (const n of pair) if (!NATION[n]) errs.push(`scenario: unknown nation ${n}`);
for (const p of POLICIES) for (const k of Object.keys(p.mods)) if (!MODIFIER_KEYS.includes(k)) errs.push(`policy ${p.id}: unknown modifier ${k}`);
for (const group of Object.values(TRAITS))
  for (const [id, t] of Object.entries(group)) for (const k of Object.keys(t.mods)) if (!MODIFIER_KEYS.includes(k)) errs.push(`trait ${id}: unknown modifier ${k}`);

// Events
const eventIds = new Set<string>();
for (const e of EVENTS) {
  const w = `event ${e.id}`;
  if (!e.id || eventIds.has(e.id)) errs.push(`${w}: missing or duplicate id`);
  eventIds.add(e.id);
  if (!['historical', 'generic', 'era'].includes(e.pool)) errs.push(`${w}: pool must be historical, generic or era`);
  if (!e.title || e.title.length > 42) errs.push(`${w}: title must be 1-42 characters`);
  if (!e.text || e.text.length > 420) errs.push(`${w}: text must be 1-420 characters`);
  const sentences = (e.text.match(/[.!?](\s|$)/g) ?? []).length;
  if (sentences < 1 || sentences > 5) warns.push(`${w}: text should be 2-4 sentences (has ${sentences})`);
  if (!EVENT_IMAGES.includes(e.image)) errs.push(`${w}: image must be one of ${EVENT_IMAGES.join(', ')}`);
  if (e.nations) for (const n of e.nations) if (!NATION[n]) errs.push(`${w}: unknown nation ${n}`);
  if (e.window && (e.window.length !== 2 || e.window[0] > e.window[1])) errs.push(`${w}: window must be [fromYear, toYear]`);
  if (e.mtth !== undefined && !(e.mtth > 0)) errs.push(`${w}: mtth must be positive`);
  validateCondition(e.trigger, `${w}.trigger`, errs);
  if (!Array.isArray(e.choices) || e.choices.length < 1 || e.choices.length > 3) errs.push(`${w}: needs 1-3 choices`);
  else
    e.choices.forEach((c, i) => {
      if (!c.text || c.text.length > 60) errs.push(`${w}.choices[${i}]: text must be 1-60 characters`);
      if (!Array.isArray(c.effects)) errs.push(`${w}.choices[${i}]: effects must be a list`);
      else c.effects.forEach((ef, j) => validateEffect(ef, `${w}.choices[${i}].effects[${j}]`, errs));
    });
  for (const k of Object.keys(e)) if (!['id', 'pool', 'title', 'text', 'image', 'nations', 'window', 'mtth', 'once', 'news', 'hidden', 'onPeace', 'trigger', 'choices'].includes(k)) errs.push(`${w}: unknown field ${k}`);
}

// Missions
const missionIds = new Set<string>();
for (const m of MISSIONS) {
  const w = `mission ${m.id}`;
  if (!m.id || missionIds.has(m.id)) errs.push(`${w}: missing or duplicate id`);
  missionIds.add(m.id);
  if (m.nation !== 'generic' && !NATION[m.nation]) errs.push(`${w}: unknown nation`);
  if (!m.title || m.title.length > 36) errs.push(`${w}: title must be 1-36 characters`);
  if (!m.desc || m.desc.length > 200) errs.push(`${w}: desc must be 1-200 characters`);
  validateCondition(m.goal, `${w}.goal`, errs);
  if (!Array.isArray(m.reward) || !m.reward.length) errs.push(`${w}: needs at least one reward`);
  else m.reward.forEach((ef, j) => validateEffect(ef, `${w}.reward[${j}]`, errs));
}
for (const m of MISSIONS)
  for (const r of m.requires) {
    const req = MISSIONS.find(x => x.id === r);
    if (!req) errs.push(`mission ${m.id}: requires unknown mission ${r}`);
    else if (req.nation !== m.nation) errs.push(`mission ${m.id}: requires a mission of another nation`);
  }
const byNation = new Map<string, number>();
for (const m of MISSIONS) byNation.set(m.nation, (byNation.get(m.nation) ?? 0) + 1);
for (const n of NATIONS.filter(x => x.tier !== 'minor'))
  if ((byNation.get(n.id) ?? 0) < 6 && MISSIONS.length) warns.push(`nation ${n.id} has ${byNation.get(n.id) ?? 0} missions (want 6-10)`);

// Historical aims and bonds (aims.json)
const aimIds = new Set<string>();
for (const a of AIMS) {
  const w = `aim ${a.id}`;
  if (!a.id || aimIds.has(a.id)) errs.push(`${w}: missing or duplicate id`);
  aimIds.add(a.id);
  if (!NATION[a.nation]) errs.push(`${w}: unknown nation ${a.nation}`);
  if (!a.title || a.title.length > 48) errs.push(`${w}: title must be 1-48 characters`);
  if (!a.regions?.length) errs.push(`${w}: needs regions`);
  for (const r of a.regions ?? []) if (!REGION[r]) errs.push(`${w}: unknown region ${r}`);
  if (a.from && a.until && a.from >= a.until) errs.push(`${w}: from must be before until`);
}
for (const b of BONDS) {
  const w = `bond ${b.a}-${b.b}`;
  if (!NATION[b.a] || !NATION[b.b] || b.a === b.b) errs.push(`${w}: needs two different known nations`);
  if (b.kind !== 'friends' && b.kind !== 'foes') errs.push(`${w}: kind must be friends or foes`);
  if (!b.label || b.label.length > 40) errs.push(`${w}: label must be 1-40 characters`);
  if (b.from && b.until && b.from >= b.until) errs.push(`${w}: from must be before until`);
}

// Science (advances.json), and what needs an advance
const advIds = new Set<string>();
for (const a of ADVANCES) {
  const w = `advance ${a.id}`;
  if (advIds.has(a.id)) errs.push(`${w}: duplicate id`);
  advIds.add(a.id);
  if (!['war', 'sea', 'state'].includes(a.field)) errs.push(`${w}: field must be war, sea or state`);
  if (!(a.cost > 0) || !(a.year >= 1400 && a.year <= 1800)) errs.push(`${w}: needs a cost and a year between 1400 and 1800`);
  if (!a.name || a.name.length > 30 || !a.desc || a.desc.length > 160) errs.push(`${w}: name 1-30 and desc 1-160 characters`);
  for (const r of a.requires) if (!ADVANCE[r]) errs.push(`${w}: requires unknown advance ${r}`);
  else if (ADVANCE[r].year > a.year) errs.push(`${w}: requires ${r}, which comes later in history`);
  if (a.armyEra && !UNITS.eras.some(e => e.id === a.armyEra)) errs.push(`${w}: unknown troop age ${a.armyEra}`);
  if (a.unlock && !['artillery', 'warships', 'coastColonies', 'oceanColonies'].includes(a.unlock)) errs.push(`${w}: unknown unlock ${a.unlock}`);
  if (a.mods) for (const k of Object.keys(a.mods)) if (!MODIFIER_KEYS.includes(k)) errs.push(`${w}: unknown modifier ${k}`);
}
for (const u of ['artillery', 'warships', 'coastColonies', 'oceanColonies']) if (ADVANCES.filter(a => a.unlock === u).length !== 1) errs.push(`exactly one advance must unlock ${u}`);
for (const [n, v] of Object.entries(LEARNING)) if (!NATION[n] || !(v > 0)) errs.push(`learning: bad entry ${n}`);
for (const [id, who] of Object.entries(START_ADVANCES)) {
  if (!ADVANCE[id]) errs.push(`start: unknown advance ${id}`);
  for (const n of who) if (!NATION[n]) errs.push(`start ${id}: unknown nation ${n}`);
}
for (const p of POLICIES) if (p.requires && !ADVANCE[p.requires]) errs.push(`policy ${p.id}: requires unknown advance ${p.requires}`);
for (const [t, sh] of Object.entries(UNITS.ships)) if (sh.advance && !ADVANCE[sh.advance]) errs.push(`ship ${t}: needs unknown advance ${sh.advance}`);

// Achievements
const achIds = new Set<string>();
for (const a of ACHIEVEMENTS) {
  if (achIds.has(a.id)) errs.push(`achievement ${a.id}: duplicate id`);
  achIds.add(a.id);
  validateCondition(a.goal, `achievement ${a.id}.goal`, errs);
  if (a.nations) for (const n of a.nations) if (!NATION[n]) errs.push(`achievement ${a.id}: unknown nation ${n}`);
}

// --- T1 checks ---
// Old friends (a `friends` bond) never start as rivals.
for (const [a, b] of SCENARIO.rivals as [string, string][]) {
  const bond = BONDS.find(x => x.kind === 'friends' && ((x.a === a && x.b === b) || (x.a === b && x.b === a)) && (x.from ?? 0) <= SCENARIO.start.year && SCENARIO.start.year < (x.until ?? 9999));
  if (bond) errs.push(`scenario rivals ${a}-${b}: they are old friends (${bond.label})`);
}
// Every name group has generals' names.
for (const group of new Set(Object.values(namesJson.groups))) if (!(namesJson.generals as Record<string, string[]>)[group]?.length) errs.push(`names: no generals for the "${group}" group`);
// The README's counts match the content (fix the README when content is added).
{
  const readme = fs.readFileSync(path.join(__dirname, '../README.md'), 'utf8');
  const generic = EVENTS.filter(e => e.pool === 'generic').length - newWorldEventsJson.filter(e => e.pool === 'generic').length;
  const era = EVENTS.filter(e => e.pool === 'era').length;
  const counts: [RegExp, number, string][] = [
    [/(\d+) events \((\d+) historical, (\d+) generic, (\d+) era, (\d+) New World\)/, 0, ''],
    [/(\d+) missions/, MISSIONS.length, 'missions'],
    [/(\d+) achievements/, ACHIEVEMENTS.length, 'achievements'],
    [/(\d+) regions in Europe/, REGIONS.filter(r => !r.nw).length, 'Old World regions'],
    [/(\d+) coarse\s+New World regions/, REGIONS.filter(r => r.nw).length, 'New World regions'],
    [/(\d+) sea zones/, Object.keys(SEA).length, 'sea zones'],
  ];
  const ev = counts[0][0].exec(readme);
  const want = [EVENTS.length, EVENTS.length - genericEventsJson.length - newWorldEventsJson.length, generic, era, newWorldEventsJson.length];
  if (!ev) errs.push('README: no "N events (N historical, N generic, N era, N New World)" line');
  else if (want.some((n, i) => Number(ev[i + 1]) !== n)) errs.push(`README says "${ev[0]}"; the content has ${want[0]} events (${want[1]} historical, ${want[2]} generic, ${want[3]} era, ${want[4]} New World)`);
  for (const [re, n, what] of counts.slice(1)) {
    const m = re.exec(readme);
    if (!m) errs.push(`README: no count of ${what}`);
    else if (Number(m[1]) !== n) errs.push(`README says ${m[1]} ${what}; the content has ${n}`);
  }
}


// --- T2 checks ---
// Every nation is playable: the picker needs its difficulty and the area it is listed under.
const PICKER_AREAS = ['british_isles', 'france', 'iberia', 'italy', 'empire', 'north', 'east', 'balkans', 'middle_east', 'africa', 'new_world'];
for (const n of NATIONS) {
  if (!n.difficulty || !['easy', 'normal', 'hard', 'very_hard'].includes(n.difficulty)) errs.push(`nation ${n.id}: needs a difficulty (easy, normal, hard or very_hard)`);
  if (!n.area || !PICKER_AREAS.includes(n.area)) errs.push(`nation ${n.id}: needs a picker area (${PICKER_AREAS.join(', ')})`);
}

// --- T3 checks ---
// Greater crowns (formables.json): lands, keys and claims exist; formers are realms or smaller crowns; nothing can be
// proclaimed on the first day unless it waits for a year.
{
  const day1 = newGame({ player: NATIONS[0].id, seed: 1 });
  const holdsOnDay1 = (n: string, r: string) => {
    const o = day1.regions[r]?.owner;
    return !!o && (o === n || (day1.nations[o]?.overlord === n && day1.nations[o].subjectType === 'union'));
  };
  for (const c of CROWNS) {
    const at = `crown ${c.id}`;
    if (NATION[c.id]) errs.push(`${at}: its id is a nation tag`);
    for (const r of [...c.regions, ...(c.claims ?? [])]) if (!REGION[r]) errs.push(`${at}: unknown region ${r}`);
    for (const r of c.key) if (!c.regions.includes(r)) errs.push(`${at}: key region ${r} is not one of its lands`);
    if (!(c.key.length <= c.need && c.need <= c.regions.length)) errs.push(`${at}: need must be between its keys and its lands`);
    for (const f of c.formers) {
      if (CROWN[f]) {
        if (CROWN[f].regions.length >= c.regions.length) errs.push(`${at}: former crown ${f} must be smaller`);
      } else if (!NATION[f]) errs.push(`${at}: unknown former ${f}`);
    }
    if (c.inherits && !NATION[c.inherits]) errs.push(`${at}: inherits unknown nation ${c.inherits}`);
    for (const k of Object.keys(c.mods)) if (!MODIFIER_KEYS.includes(k)) errs.push(`${at}: unknown modifier ${k}`);
    if (!FLAG_PATTERNS.includes(c.flag.pattern)) errs.push(`${at}: unknown flag pattern ${c.flag.pattern}`);
    for (const ch of [c.flag.charge, c.flag.charge2]) if (ch && !CHARGES[ch]) errs.push(`${at}: unknown flag charge ${ch}`);
    if (!c.name || !c.adj || !c.bonus || !c.blurb || !c.history) errs.push(`${at}: needs a name, adj, bonus, blurb and history`);
    if (c.from) continue;
    for (const f of c.formers) {
      if (!NATION[f]) continue;
      const held = c.regions.filter(r => holdsOnDay1(f, r)).length;
      if (held >= c.need && c.key.every(r => holdsOnDay1(f, r))) errs.push(`${at}: ${f} could proclaim it on the first day`);
    }
  }
}

for (const w of warns) console.warn('warn:', w);
if (errs.length) {
  for (const e of errs) console.error('error:', e);
  console.error(`\n${errs.length} content error(s).`);
  process.exit(1);
}
console.log(
  `content ok: ${REGIONS.length} regions, ${NATIONS.length} nations, ${EVENTS.length} events, ${MISSIONS.length} missions, ${ACHIEVEMENTS.length} achievements, ${AIMS.length} aims, ${ADVANCES.length} advances`,
);
