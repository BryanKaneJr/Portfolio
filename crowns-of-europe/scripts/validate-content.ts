/**
 * Validates everything in src/content/: references between files, the event/mission DSL, and text limits.
 * Run: npm run validate   (part of npm run check)
 */
import {
  ACHIEVEMENTS,
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
  TRAITS,
} from '../src/sim/content';
import { EVENT_IMAGES, FAITHS, MODIFIER_KEYS, validateCondition, validateEffect } from '../src/sim/dsl';

const errs: string[] = [];
const warns: string[] = [];
const TERRAIN = ['plains', 'forest', 'hills', 'marsh', 'mountains'];

// Regions and map
for (const r of REGIONS) {
  if (!NATION[r.owner]) errs.push(`region ${r.id}: unknown owner ${r.owner}`);
  if (!TERRAIN.includes(r.terrain)) errs.push(`region ${r.id}: bad terrain`);
  if (!(r.dev >= 1 && r.dev <= 10)) errs.push(`region ${r.id}: dev must be 1-10`);
  if (!(r.fort >= 0 && r.fort <= 3)) errs.push(`region ${r.id}: fort must be 0-3`);
  if (!FAITHS.includes(r.faith)) errs.push(`region ${r.id}: bad faith`);
}
const mapIds = new Set(MAP.regions.map(r => r.id));
for (const r of REGIONS) if (!mapIds.has(r.id)) errs.push(`region ${r.id} is missing from map.json (run npm run map:build)`);
for (const id of mapIds) if (!REGION[id]) errs.push(`map.json has region ${id} that regions.json doesn't (run npm run map:build)`);

// Rivers must run along a real border.
const borderKeys = new Set(MAP.borders.map(b => `${b.a}|${b.b}`));
for (const key of RIVERS.keys()) if (!borderKeys.has(key)) errs.push(`river ${RIVERS.get(key)}: ${key} is not a border between neighbours`);

// Nations
for (const n of NATIONS) {
  if (!REGION[n.capital] || REGION[n.capital].owner !== n.id) errs.push(`nation ${n.id}: capital must be a region it owns`);
  if (!TRAITS.national[n.trait]) errs.push(`nation ${n.id}: unknown trait ${n.trait}`);
  for (const t of [...n.ruler.traits, ...(n.heir?.traits ?? [])]) if (!TRAITS.ruler[t]) errs.push(`nation ${n.id}: unknown ruler trait ${t}`);
}
for (const [id, list] of Object.entries(SCENARIO.claims)) {
  if (!NATION[id]) errs.push(`scenario claims: unknown nation ${id}`);
  for (const r of list) if (!REGION[r]) errs.push(`scenario claims ${id}: unknown region ${r}`);
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
  for (const k of Object.keys(e)) if (!['id', 'pool', 'title', 'text', 'image', 'nations', 'window', 'mtth', 'once', 'news', 'hidden', 'trigger', 'choices'].includes(k)) errs.push(`${w}: unknown field ${k}`);
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

// Achievements
const achIds = new Set<string>();
for (const a of ACHIEVEMENTS) {
  if (achIds.has(a.id)) errs.push(`achievement ${a.id}: duplicate id`);
  achIds.add(a.id);
  validateCondition(a.goal, `achievement ${a.id}.goal`, errs);
  if (a.nations) for (const n of a.nations) if (!NATION[n]) errs.push(`achievement ${a.id}: unknown nation ${n}`);
}

for (const w of warns) console.warn('warn:', w);
if (errs.length) {
  for (const e of errs) console.error('error:', e);
  console.error(`\n${errs.length} content error(s).`);
  process.exit(1);
}
console.log(
  `content ok: ${REGIONS.length} regions, ${NATIONS.length} nations, ${EVENTS.length} events, ${MISSIONS.length} missions, ${ACHIEVEMENTS.length} achievements`,
);
