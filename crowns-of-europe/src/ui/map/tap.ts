/** What a tap on the map means: select a unit or region, or (with your army/fleet selected) move it there. */
import { MAP_REGION } from '../../sim/content';
import { moveArmy, moveFleet } from '../../sim/commands';
import { store } from '../../state/store';
import { buzz } from '../haptics';
import { regionAt, seaAt, wasteAt } from './geometry';
import { TOKEN_MIDDLE, tokenScale, unitPositions } from './MapView';

const HIT = 22; // points
const HIT_SWITCH = 14; // with one of your units selected, another of yours takes the tap only if it lands on its token

export function onMapTap(mx: number, my: number, k: number): void {
  const s = store.state;
  if (!s) return;
  const sel = store.selection;
  const ordering = (sel?.kind === 'army' && s.armies[sel.id]?.owner === s.player) || (sel?.kind === 'fleet' && s.fleets[sel.id]?.owner === s.player);
  let best: { kind: string; id: string; d: number; mine: boolean } | null = null;
  // Tokens grow as you zoom in past play zoom, and so does the reach of a tap on one.
  const reach = Math.max(1, tokenScale(k));
  for (const c of unitPositions(s, k, sel?.kind === 'army' || sel?.kind === 'fleet' ? sel.id : undefined)) {
    // A unit's figure stands above its point: measure from the middle of the figure.
    const lift = c.kind === 'battle' ? 0 : (TOKEN_MIDDLE * tokenScale(k)) / k;
    const d = Math.hypot(c.x - mx, c.y - lift - my) * k;
    if (d > HIT * reach) continue;
    const mine = c.kind === 'army' ? s.armies[c.id]?.owner === s.player : c.kind === 'fleet' ? s.fleets[c.id]?.owner === s.player : false;
    // While giving orders, a near miss on one of your other units is a march order, not a change of selection.
    if (ordering && mine && c.id !== sel?.id && d > HIT_SWITCH * reach) continue;
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
    store.run(st => moveArmy(st, sel.id, region), { map: false });
    return;
  }
  if (sel?.kind === 'fleet' && s.fleets[sel.id]?.owner === s.player && !(best && best.mine)) {
    const target = sea ?? (region ? MAP_REGION[region].seas[0] : null);
    if (target) {
      store.run(st => moveFleet(st, sel.id, target), { map: false });
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
