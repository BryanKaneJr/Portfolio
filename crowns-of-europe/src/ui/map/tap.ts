/** What a tap on the map means: select a unit or region, or (with your army/fleet selected) move it there. */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { MAP_REGION } from '../../sim/content';
import { moveArmy, moveFleet } from '../../sim/commands';
import { store } from '../../state/store';
import { regionAt, seaAt, wasteAt } from './geometry';
import { unitPositions } from './MapView';

const HIT = 22; // points

export function buzz() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

export function onMapTap(mx: number, my: number, k: number): void {
  const s = store.state;
  if (!s) return;
  const sel = store.selection;
  let best: { kind: string; id: string; d: number; mine: boolean } | null = null;
  for (const c of unitPositions(s, k)) {
    const d = Math.hypot(c.x - mx, c.y - my) * k;
    if (d > HIT) continue;
    const mine = c.kind === 'army' ? s.armies[c.id]?.owner === s.player : c.kind === 'fleet' ? s.fleets[c.id]?.owner === s.player : false;
    // Prefer your own units, then the closest.
    if (!best || (mine && !best.mine) || (mine === best.mine && d < best.d)) best = { kind: c.kind, id: c.id, d, mine };
  }
  const region = regionAt(mx, my);
  // Wilderness and closed waters are scenery: tapping them selects nothing.
  const sea = region || wasteAt(mx, my) ? null : seaAt(mx, my);

  // With your army selected, tapping a region (not another of your units) sends it there.
  if (sel?.kind === 'army' && s.armies[sel.id]?.owner === s.player && region && !(best && best.mine)) {
    if (best?.kind === 'army' && best.id === sel.id) {
      store.select(null);
      return;
    }
    const r = store.run(st => moveArmy(st, sel.id, region), { map: false });
    if (r.ok) buzz();
    return;
  }
  if (sel?.kind === 'fleet' && s.fleets[sel.id]?.owner === s.player && !(best && best.mine)) {
    const target = sea ?? (region ? MAP_REGION[region].seas[0] : null);
    if (target) {
      const r = store.run(st => moveFleet(st, sel.id, target), { map: false });
      if (r.ok) buzz();
      return;
    }
  }
  if (best) {
    if (sel && sel.kind === best.kind && sel.id === best.id) store.select(null);
    else store.select({ kind: best.kind as 'army' | 'fleet' | 'battle', id: best.id });
    buzz();
    return;
  }
  if (region) {
    store.select(sel?.kind === 'region' && sel.id === region ? null : { kind: 'region', id: region });
    return;
  }
  if (sea) {
    store.select(sel?.kind === 'sea' && sel.id === sea ? null : { kind: 'sea', id: sea });
    return;
  }
  store.select(null);
}
