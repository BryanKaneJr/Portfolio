/** Colonies in the UI: the uncharted New World, uncolonized regions (there and on the African coast), colonies being settled, and the Colonies tab. */
import { View } from 'react-native';
import { NATION, REGION, nationName } from '../../sim/content';
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
import { Shield } from '../components/Flag';
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
    <Sheet
      title="Uncharted"
      subtitle="Beyond the western ocean"
      onClose={() => st.select(null)}
      help={`Fund an expedition and you may be the first to find what lies west; by ${DISCOVERY_YEAR} the way becomes common knowledge anyway. Armies and fleets can’t enter uncharted lands and waters.`}
    >
      <T v="small">No ship has come back from these waters yet.</T>
      <View style={{ marginTop: 10, gap: 6 }}>
        <Btn icon="ship" label={s.nations[s.player].expedition ? 'Your expedition is at sea' : 'Fund an expedition west'} sub={s.nations[s.player].expedition ? `Back around ${formatDate(s.nations[s.player].expedition!.done)}` : `${EXPEDITION_COST} gold · back in about ${EXPEDITION_MONTHS} months`} disabled={!!why} onPress={() => st.run(fundExpedition)} testID="expedition" />
        {why && !s.nations[s.player].expedition ? <T v="tiny">{why}</T> : null}
      </View>
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
  return (
    <Sheet
      title={def.name}
      subtitle={`${def.terrain[0].toUpperCase() + def.terrain.slice(1)} · ${c ? 'Colony being settled' : 'Uncolonized'}${def.good ? ` · ${GOOD_NAME[def.good]}` : ''}`}
      onClose={() => st.select(null)}
      left={c ? <Shield nation={c.by} size={30} /> : undefined}
      help="Uncolonized land belongs to no crown: any army may enter it, but no one can besiege it or win it in a peace."
    >
      <Row gap={6}>
        <Stat label="Natives" value={r.natives > 0 ? `${fmt(r.natives, 1)}k` : 'None'} icon="manpower" />
        <Stat label="Hostility" value={['Peaceful', 'Wary', 'Hostile', 'Fierce'][hostility]} tone={hostility >= 2 ? 'bad' : undefined} icon="swords" />
        <Stat label="Export" value={def.good ? GOOD_NAME[def.good] : 'None'} icon="coins" />
      </Row>
      {c ? (
        <Section
          title={mine ? 'Your colony' : `${nationName(c.by)}’s colony`}
          right={<T v="tiny">{fmt(c.settlers)} / {fmt(SETTLERS_NEEDED)} settlers</T>}
          help={`At ${fmt(SETTLERS_NEEDED)} settlers the colony becomes a region of its founder's; until then it costs ${COLONY_UPKEEP} gold a month. A native attack kills settlers, and if they all die the colony is lost; any regiment of the founder's standing here keeps them safe.`}
        >
          <Bar value={c.settlers / SETTLERS_NEEDED} color={NATION[c.by]?.color ?? C.gold} height={8} />
          <View style={{ marginTop: 8 }}>
            {growth.map(g => (
              <Line key={g.label} label={g.label} value={`${signed(g.value, g.value % 1 ? 1 : 0)}/mo`} tone={g.value < 0 ? 'bad' : undefined} />
            ))}
            <Line label="Settlers per month" value={fmt(perMonth, 1)} bold />
            <Line label="Founded in about" value={`${Math.max(1, Math.ceil((SETTLERS_NEEDED - c.settlers) / perMonth / 12))} years`} />
            {r.natives > 0 ? <Line label="Native attacks" value={`${Math.round(risk * 100)}% a month`} tone={risk > 0 ? 'bad' : 'good'} /> : null}
          </View>
          {mine ? (
            <View style={{ gap: 6, marginTop: 8 }}>
              <Btn small tone="ghost" label="Abandon the colony" onPress={() => st.run(x => abandonPlayerColony(x, id))} />
            </View>
          ) : null}
        </Section>
      ) : (
        <Section
          title="Settle it"
          help={`Natives slow a colony down${hostility >= 2 ? ' and these will fight settlers' : ''}; once it is founded they join it and make it more prosperous.${def.good ? ` Its ${GOOD_NAME[def.good].toLowerCase()} then pays you on top of taxes.` : ''} Inland land can only be settled from a region of yours next door.`}
        >
          <View style={{ gap: 6 }}>
            <Btn icon="ship" label="Start a colony" sub={`${COLONY_COST} gold, then ${COLONY_UPKEEP} gold/mo · uses a colonist`} disabled={!!blocked} onPress={() => st.run(x => colonize(x, id))} testID="colonize" />
            {blocked ? <T v="tiny">{blocked}</T> : null}
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
    </Sheet>
  );
}

/** Realm menu tab: colonists, colonies being settled, the New World and expeditions. */
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
        <Section
          title="The western ocean"
          help={`Find a New World first for renown and an extra colonist for 30 years; if nobody does, the way west becomes common knowledge in ${DISCOVERY_YEAR}. Closer to home, the African coast from Arguin to the Gold Coast can be settled once you know Caravels: tap a pale region there.`}
        >
          <View style={{ gap: 6 }}>
            <Btn icon="ship" label={me.expedition ? 'Your expedition is at sea' : 'Fund an expedition west'} sub={me.expedition ? `Back around ${formatDate(me.expedition.done)}` : `${EXPEDITION_COST} gold · back in about ${EXPEDITION_MONTHS} months`} disabled={!!why} onPress={() => st.run(fundExpedition)} testID="menu-expedition" />
            {why && !me.expedition ? <T v="tiny">{why}</T> : null}
          </View>
        </Section>
      ) : (
        <T v="small" style={{ marginBottom: 6 }}>
          New World found {formatDate(s.discovery.day)}{s.discovery.by ? ` by ${nationName(s.discovery.by)}` : ''}.
        </T>
      )}
      <Section
        title="Colonists"
        right={<Pill text={`${settling.length} / ${total} busy`} color={total ? C.greenSoft : C.parchment2} />}
        help="Each colonist settles one colony at a time; tap a pale, uncolonized region to start one. Colonists come from the Overseas Charters policy, from being first to the New World, from events and missions, and in the third era to a large realm (30+ prosperity) with an ocean coast."
      >
        {sources.length ? sources.map(p => <Line key={p.label} label={p.label} value={signed(p.value)} />) : <Empty text="None yet" />}
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
          <Empty text="None under way" />
        )}
      </Section>
      <Section title="Your lands across the ocean" right={goods ? <T v="tiny">+{fmt(goods, 1)} gold/mo from exports</T> : undefined}>
        {owned.length ? owned.map(r => <Line key={r.id} label={REGION[r.id].name} value={REGION[r.id].good ? `${GOOD_NAME[REGION[r.id].good!]} +${fmt(goodsIncome(s, r), 1)}` : '–'} />) : <Empty text="None yet" />}
      </Section>
    </View>
  );
}
