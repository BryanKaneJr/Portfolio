/** What a tap on the map means: select a unit or region, or (with your army/fleet selected) move it there. */
import { MAP_REGION } from '../../sim/content';
import { moveArmy, moveFleet } from '../../sim/commands';
import { store } from '../../state/store';
import { buzz } from '../haptics';
import { FEET_Y } from './anchors';
import { regionAt, seaAt, wasteAt } from './geometry';
import { nameBox } from './landmarkSpot';
import { TOKEN_MIDDLE, tokenScale, unitPositions } from './MapView';

const HIT = 22; // points
const HIT_SWITCH = 14; // with one of your units selected, another of yours takes the tap only if it lands on its token
const ON_TOWN = 10; // points round the middle of a town's picture that count as a tap on the town

/** Did the tap land on this region's written name or on its town's picture? */
function onNameOrTown(id: string, mx: number, my: number, k: number): boolean {
  const b = nameBox(id, k, n => n / k);
  if (b && mx >= b[0] && mx <= b[2] && my >= b[1] && my <= b[3]) return true;
  const [tx, ty] = MAP_REGION[id].town;
  return Math.hypot(mx - tx, my - ty + 6 / k) * k <= ON_TOWN;
}

export function onMapTap(mx: number, my: number, k: number): void {
  const s = store.state;
  if (!s) return;
  const sel = store.selection;
  const ordering = (sel?.kind === 'army' && s.armies[sel.id]?.owner === s.player) || (sel?.kind === 'fleet' && s.fleets[sel.id]?.owner === s.player);
  let best: { kind: string; id: string; d: number; mine: boolean } | null = null;
  // Tokens grow as you zoom in past play zoom, and so does the reach of a tap on one.
  const reach = Math.max(1, tokenScale(k));
  const region = regionAt(mx, my);
  // A neighbour's name or town is the neighbour's, though an army standing next door rises over it (in Italy's small
  // regions): a tap there selects that region, or marches the selected army to it.
  const onLabel = !!region && onNameOrTown(region, mx, my, k);
  for (const c of unitPositions(s, k, sel?.kind === 'army' || sel?.kind === 'fleet' ? sel.id : undefined)) {
    // A unit's figure stands above its point: measure from the middle of the figure.
    const lift = c.kind === 'battle' ? 0 : (TOKEN_MIDDLE * c.scale) / k;
    const d = Math.hypot(c.x - mx, c.y - lift - my) * k;
    if (d > HIT * reach) continue;
    if (onLabel && c.kind === 'army' && regionAt(c.x, c.y + (FEET_Y * c.scale) / k) !== region) continue;
    const mine = c.kind === 'army' ? s.armies[c.id]?.owner === s.player : c.kind === 'fleet' ? s.fleets[c.id]?.owner === s.player : false;
    // While giving orders, a near miss on one of your other units is a march order, not a change of selection.
    if (ordering && mine && c.id !== sel?.id && d > HIT_SWITCH * reach) continue;
    // Prefer your own units, then the closest.
    if (!best || (mine && !best.mine) || (mine === best.mine && d < best.d)) best = { kind: c.kind, id: c.id, d, mine };
  }
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
