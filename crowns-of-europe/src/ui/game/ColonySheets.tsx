/** Colonies in the UI: the uncharted New World, uncolonized regions (there and on the African coast), colonies being settled, and the Colonies tab. */
import { View } from 'react-native';
import { MAP_REGION, NATION, REGION, nationName } from '../../sim/content';
import {
  COLONY_COST,
  COLONY_UPKEEP,
  DISCOVERY_YEAR,
  EXPEDITION_COST,
  EXPEDITION_MONTHS,
  GOOD_NAME,
  SETTLERS_NEEDED,
  attackChance,
  canColonize,
  canSendExpedition,
  colonistSources,
  colonistsOf,
  coloniesOf,
  goodsIncome,
  monthlySettlers,
  newWorldRegions,
  settlerGrowth,
} from '../../sim/colonies';
import { abandonPlayerColony, colonize, fundExpedition } from '../../sim/commands';
import { REBELS, armyRegs } from '../../sim/queries';
import { formatDate } from '../../sim/util';
import { store, useStore } from '../../state/store';
import { regionPoint } from '../map/geometry';
import { Flag } from '../components/Flag';
import { Bar, Btn, Empty, Line, Pill, Row, Section, Stat, T } from '../components/kit';
import { C, fmt, signed } from '../theme';
import { Sheet } from './Sheet';

/** Close the menu and centre the map on a region. */
function showOnMap(id: string) {
  store.close();
  store.select({ kind: 'region', id });
  store.focusOn(...regionPoint(id));
}

/** A region or sea in the New World before anyone has found it. */
export function UnchartedSheet() {
  const st = useStore();
  const s = st.state!;
  const why = canSendExpedition(s, s.player);
  return (
    <Sheet title="Uncharted" subtitle="Beyond the western ocean" onClose={() => st.select(null)}>
      <T v="small">
        No European ship has come back from these waters yet. Captains whisper of islands to the west and a short way to the Indies. Fund an expedition and you may be the first to find out
        what is there; by {DISCOVERY_YEAR} every pilot in Lisbon will know the way anyway.
      </T>
      <View style={{ marginTop: 10, gap: 6 }}>
        <Btn icon="ship" label={s.nations[s.player].expedition ? 'Your expedition is at sea' : 'Fund an expedition west'} sub={s.nations[s.player].expedition ? `Back around ${formatDate(s.nations[s.player].expedition!.done)}` : `${EXPEDITION_COST} gold · back in about ${EXPEDITION_MONTHS} months`} disabled={!!why} onPress={() => st.run(fundExpedition)} testID="expedition" />
        {why && !s.nations[s.player].expedition ? <T v="tiny">{why}</T> : null}
      </View>
      <T v="tiny" style={{ marginTop: 10 }}>Armies and fleets can’t enter uncharted lands and waters.</T>
    </Sheet>
  );
}

/** Uncolonized land: natives, its export, and settling it. */
export function WildSheet({ id }: { id: string }) {
  const st = useStore();
  const s = st.state!;
  const r = s.regions[id];
  const def = REGION[id];
  const c = r.colony;
  const mine = c?.by === s.player;
  const blocked = canColonize(s, s.player, id);
  const growth = c ? settlerGrowth(s, r) : [];
  const perMonth = c ? monthlySettlers(s, r) : 0;
  const risk = c ? attackChance(s, r) : 0;
  const armiesHere = Object.values(s.armies).filter(a => a.node === id);
  const hostility = def.hostility ?? 0;
  const coastal = MAP_REGION[id].seas.length > 0;
  return (
    <Sheet
      title={def.name}
      subtitle={`${def.terrain[0].toUpperCase() + def.terrain.slice(1)} · ${c ? 'Colony being settled' : 'Uncolonized'}${def.good ? ` · ${GOOD_NAME[def.good]}` : ''}`}
      onClose={() => st.select(null)}
      left={c ? <Flag nation={c.by} size={34} /> : undefined}
    >
      <Row gap={6}>
        <Stat label="Natives" value={r.natives > 0 ? `${fmt(r.natives, 1)}k` : 'None'} icon="manpower" />
        <Stat label="Hostility" value={['Peaceful', 'Wary', 'Hostile', 'Fierce'][hostility]} tone={hostility >= 2 ? 'bad' : undefined} icon="swords" />
        <Stat label="Export" value={def.good ? GOOD_NAME[def.good] : 'None'} icon="coins" />
      </Row>
      {c ? (
        <Section title={mine ? 'Your colony' : `${nationName(c.by)}’s colony`} right={<T v="tiny">{fmt(c.settlers)} / {fmt(SETTLERS_NEEDED)} settlers</T>}>
          <Bar value={c.settlers / SETTLERS_NEEDED} color={NATION[c.by]?.color ?? C.gold} height={8} />
          <View style={{ marginTop: 8 }}>
            {growth.map(g => (
              <Line key={g.label} label={g.label} value={`${signed(g.value, g.value % 1 ? 1 : 0)}/mo`} tone={g.value < 0 ? 'bad' : undefined} />
            ))}
            <Line label="Settlers per month" value={fmt(perMonth, 1)} bold />
            <Line label="Founded in about" value={`${Math.max(1, Math.ceil((SETTLERS_NEEDED - c.settlers) / perMonth / 12))} years`} />
            {r.natives > 0 ? <Line label="Chance of a native attack each month" value={`${Math.round(risk * 100)}%`} tone={risk > 0 ? 'bad' : 'good'} /> : null}
          </View>
          {mine ? (
            <View style={{ gap: 6, marginTop: 8 }}>
              <T v="tiny">
                {risk > 0 ? 'An attack kills settlers; if they all die the colony is lost. Any regiment of yours standing here keeps them safe. ' : r.natives > 0 ? 'Your troops here keep the settlers safe. ' : ''}
                At {fmt(SETTLERS_NEEDED)} settlers the colony becomes a region of yours. It costs {COLONY_UPKEEP} gold a month until then.
              </T>
              <Btn small tone="ghost" label="Abandon the colony" onPress={() => st.run(x => abandonPlayerColony(x, id))} />
            </View>
          ) : null}
        </Section>
      ) : (
        <Section title="Settle it">
          <T v="small">
            {r.natives > 0
              ? `About ${fmt(r.natives * 1000)} natives live here${hostility >= 2 ? ' and will fight settlers' : ''}. They slow a colony down; when it is founded they join it and make it more prosperous.`
              : 'No one lives here: settlers will have the land to themselves.'}
            {def.good ? ` Once founded, its ${GOOD_NAME[def.good].toLowerCase()} pays you on top of taxes.` : ''}
          </T>
          <View style={{ gap: 6, marginTop: 8 }}>
            <Btn icon="ship" label="Start a colony" sub={`${COLONY_COST} gold, then ${COLONY_UPKEEP} gold/mo · uses a charter`} disabled={!!blocked} onPress={() => st.run(x => colonize(x, id))} testID="colonize" />
            {blocked ? <T v="tiny">{blocked}</T> : null}
            {!coastal ? <T v="tiny">Inland: you can only settle here from a region of yours next door.</T> : null}
          </View>
        </Section>
      )}
      {armiesHere.length ? (
        <Section title="Armies here">
          {armiesHere.map(a => (
            <Line key={a.id} label={`${a.owner === REBELS ? 'Rebels' : nationName(a.owner)}: ${a.name}`} value={`${armyRegs(a)} regs`} tone={a.owner === s.player ? 'good' : undefined} />
          ))}
        </Section>
      ) : null}
      <T v="tiny" style={{ marginTop: 10 }}>Uncolonized land belongs to no crown: any army may enter it, but no one can besiege it or win it in a peace deal.</T>
    </Sheet>
  );
}

/** Realm menu tab: charters, colonies being settled, the New World and expeditions. */
export function ColoniesTab() {
  const st = useStore();
  const s = st.state!;
  const me = s.nations[s.player];
  const sources = colonistSources(s, s.player);
  const total = colonistsOf(s, s.player);
  const settling = coloniesOf(s, s.player);
  const owned = newWorldRegions(s, s.player);
  const goods = owned.reduce((t, r) => t + goodsIncome(s, r), 0);
  const why = canSendExpedition(s, s.player);
  return (
    <View>
      {!s.discovery ? (
        <Section title="The western ocean">
          <T v="small">
            Nobody in Europe knows what lies across the Atlantic. Fund an expedition and you may find a New World first: renown, and an extra colonial charter for 30 years. If nobody does, the way west
            becomes common knowledge in {DISCOVERY_YEAR}.
          </T>
          <View style={{ marginTop: 8, gap: 6 }}>
            <Btn icon="ship" label={me.expedition ? 'Your expedition is at sea' : 'Fund an expedition west'} sub={me.expedition ? `Back around ${formatDate(me.expedition.done)}` : `${EXPEDITION_COST} gold · back in about ${EXPEDITION_MONTHS} months`} disabled={!!why} onPress={() => st.run(fundExpedition)} testID="menu-expedition" />
            {why && !me.expedition ? <T v="tiny">{why}</T> : null}
          </View>
          <T v="small" style={{ marginTop: 8 }}>Closer to home, the African coast from Arguin to the Gold Coast is open now: tap a pale region there to settle it.</T>
        </Section>
      ) : (
        <T v="small" style={{ marginBottom: 6 }}>
          The New World was found on {formatDate(s.discovery.day)}{s.discovery.by ? ` by ${nationName(s.discovery.by)}` : ''}. Tap a pale, uncolonized region on the map to settle it.
        </T>
      )}
      <Section title="Colonial charters" right={<Pill text={`${settling.length} / ${total} in use`} color={total ? C.greenSoft : C.parchment2} />}>
        {sources.length ? sources.map(p => <Line key={p.label} label={p.label} value={signed(p.value)} />) : <Empty text="You have no charters yet." />}
        <T v="tiny" style={{ marginTop: 4 }}>
          Each charter settles one colony at a time. Get them from the Chartered Companies decree (era 3), from being first to the New World, from events and ambitions, and from era 3 if
          your realm is large (30+ prosperity) and has an ocean coast.
        </T>
      </Section>
      <Section title="Being settled">
        {settling.length ? (
          settling.map(r => (
            <View key={r.id} style={{ marginBottom: 8 }}>
              <Line label={REGION[r.id].name} value={`${fmt(r.colony!.settlers)} / ${fmt(SETTLERS_NEEDED)}`} />
              <Bar value={r.colony!.settlers / SETTLERS_NEEDED} color={C.green} />
              <Btn small tone="ghost" label="Show on map" onPress={() => showOnMap(r.id)} />
            </View>
          ))
        ) : (
          <Empty text={total ? 'No colonies under way. Tap uncolonized land to start one.' : 'No colonies under way.'} />
        )}
      </Section>
      <Section title="Your lands across the ocean" right={goods ? <T v="tiny">+{fmt(goods, 1)} gold/mo from exports</T> : undefined}>
        {owned.length ? owned.map(r => <Line key={r.id} label={REGION[r.id].name} value={REGION[r.id].good ? `${GOOD_NAME[REGION[r.id].good!]} +${fmt(goodsIncome(s, r), 1)}` : '–'} />) : <Empty text="None yet." />}
      </Section>
    </View>
  );
}
