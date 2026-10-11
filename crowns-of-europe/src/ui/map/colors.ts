/** Fill colours for each map mode. */
import { NATION, REGION, isNativeNation } from '../../sim/content';
import { opinion } from '../../sim/diplomacy';
import { allied, hasTruce, topOverlord, warBetween } from '../../sim/queries';
import { perceivedThreat } from '../../sim/threat';
import type { GameState, Good, Region } from '../../sim/types';
import type { MapMode } from '../../state/store';
import { FAITH_COLOR, TERRAIN_COLOR } from '../theme';

export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}

const PARCHMENT = '#efe3c2';
export const nationColor = (n: string | null) => (n && NATION[n] ? mix(NATION[n].color, PARCHMENT, 0.12) : '#3a3a3a');
/** Uncolonized land: pale and unclaimed, so it reads as "up for grabs". */
export const WILD = '#f1e8cf';
export const GOOD_COLOR: Record<Good, string> = {
  silver: '#a7b3bd',
  gold: '#d9a72e',
  ivory: '#efe8d2',
  sugar: '#e9e2d4',
  tobacco: '#8a6a3a',
  cocoa: '#6b4129',
  dyes: '#7b4fa0',
  furs: '#a0703f',
  fish: '#5f8fae',
  grain: '#d7c46a',
};

/** Per-map-mode colour of a region. Diplomatic and threat modes are computed once per nation per render. */
export function regionFills(s: GameState, mode: MapMode): Record<string, string> {
  const out: Record<string, string> = {};
  const p = s.player;
  const cache = new Map<string, string>();
  for (const r of Object.values(s.regions)) out[r.id] = fill(s, r, mode, p, cache);
  return out;
}

function fill(s: GameState, r: Region, mode: MapMode, p: string, cache: Map<string, string>): string {
  if (mode === 'goods') {
    const g = REGION[r.id].good;
    return g ? GOOD_COLOR[g] : '#d8d0bd';
  }
  if (!r.owner && mode !== 'terrain' && mode !== 'faith') return WILD;
  switch (mode) {
    case 'political':
      return nationColor(r.owner);
    case 'terrain':
      return TERRAIN_COLOR[REGION[r.id].terrain];
    case 'development': {
      const t = (r.dev - 1) / 9;
      return mix('#f3ecd0', '#2f6b34', t);
    }
    case 'science': {
      const o = r.owner!;
      const hit = cache.get(o);
      if (hit) return hit;
      // Deepest blue for the most learned crown alive, paler for each advance behind it (palest at five or more).
      const best = Math.max(...Object.values(s.nations).filter(n => n.alive).map(n => n.advances.length));
      const behind = best - s.nations[o].advances.length;
      const c = isNativeNation(o) ? '#cbbfa6' : mix('#f2e9cf', '#3b4f9a', 1 - Math.min(1, behind / 5));
      cache.set(o, c);
      return c;
    }
    case 'faith':
      return FAITH_COLOR[r.faith];
    case 'diplomatic': {
      const o = r.owner!;
      const hit = cache.get(o);
      if (hit) return hit;
      let c: string;
      if (o === p) c = '#d9a441';
      else if (topOverlord(s, o) === p) c = '#ecd18c';
      else if (warBetween(s, o, p)) c = '#b8392b';
      else if (s.coalitions.some(x => x.target === p && x.members.includes(o))) c = '#7d2a20';
      else if (allied(s, o, p)) c = '#3f74b0';
      else if (hasTruce(s, o, p)) c = '#d08a4a';
      else {
        const op = opinion(s, o, p);
        c = op >= 0 ? mix('#efe6cc', '#4f9a4a', Math.min(1, op / 150)) : mix('#efe6cc', '#c0533f', Math.min(1, -op / 150));
      }
      cache.set(o, c);
      return c;
    }
    case 'threat': {
      const o = r.owner!;
      if (o === p) return '#9b9387';
      const hit = cache.get(o);
      if (hit) return hit;
      const t = perceivedThreat(s, o, p);
      const c = mix('#f2ead2', '#a3241b', Math.min(1, t / 80));
      cache.set(o, c);
      return c;
    }
  }
}

export const MAP_MODES: { key: MapMode; label: string; help: string }[] = [
  { key: 'political', label: 'Political', help: 'Who owns each region. Stripes show occupation.' },
  { key: 'terrain', label: 'Terrain', help: 'Plains, forest, hills, marsh and mountains: they change battles, movement and supply.' },
  { key: 'development', label: 'Prosperity', help: 'Darker regions are richer: more taxes, levies and supply.' },
  { key: 'faith', label: 'Faith', help: 'Catholic (gold), Orthodox (blue), Muslim (green), Protestant (purple), native beliefs (brown).' },
  { key: 'diplomatic', label: 'Diplomatic', help: 'How others see you: allies blue, enemies red, opinion from green to red.' },
  { key: 'threat', label: 'Threat', help: 'How threatened each nation feels by you. Deep red nations may join a coalition against you.' },
  { key: 'science', label: 'Science', help: 'How far each crown is behind the most learned: deep blue leads, each shade paler is one advance behind (palest: five or more).' },
  { key: 'goods', label: 'Exports', help: 'What each overseas region sends home: silver and gold pay most, then ivory, sugar, tobacco, cocoa, dyes, furs, fish and grain.' },
];
