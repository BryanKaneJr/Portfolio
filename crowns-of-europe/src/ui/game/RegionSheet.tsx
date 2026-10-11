/** Region details and actions: develop, fort, core, convert, recruit, ships, claims. */
import { useState } from 'react';
import { View } from 'react-native';
import { GRAPH, MAP_REGION, NATION, REGION, UNITS, nationName } from '../../sim/content';
import {
  buildFort,
  buildShip,
  convertRegion,
  develop,
  fabricateClaim,
  hireMercenaries,
  makeCore,
  moveCapital,
  recruit,
  requestSanction,
} from '../../sim/commands';
import { convertCost, coreCost, devCost, fortCost, FABRICATE_COST, mercCost, regionTax, regionTrade, shipCost, unitCost } from '../../sim/economy';
import { supplyLimit } from '../../sim/military';
import { REBELS, armyRegs, isCored } from '../../sim/queries';
import { unrestBreakdown } from '../../sim/rebels';
import { sanctionTargets, SANCTION_COST } from '../../sim/religion';
import { minSiegeRegs, siegeInfo } from '../../sim/siege';
import { years } from '../../sim/util';
import { GOOD_NAME, charted, goodsIncome } from '../../sim/colonies';
import { UnchartedSheet, WildSheet } from './ColonySheets';
import { useStore } from '../../state/store';
import { Flag } from '../components/Flag';
import { Btn, Line, Pill, Row, Section, Stat, T } from '../components/kit';
import { C, fmt, signed } from '../theme';
import { Sheet } from './Sheet';

export const FAITH_NAME: Record<string, string> = { catholic: 'Catholic', orthodox: 'Orthodox', muslim: 'Muslim', protestant: 'Protestant', native: 'Native beliefs' };

export function RegionSheet({ id }: { id: string }) {
  const st = useStore();
  const s = st.state!;
  const r = s.regions[id];
  const def = REGION[id];
  const me = s.nations[s.player];
  const mine = r.owner === s.player;
  const [why, setWhy] = useState<null | 'unrest' | 'income'>(null);
  if (!charted(s, id)) return <UnchartedSheet />;
  if (!r.owner) return <WildSheet id={id} />;
  const owner = r.owner;
  const tax = regionTax(s, r);
  const goods = goodsIncome(s, r);
  const trade = regionTrade(s, r);
  const unrest = unrestBreakdown(s, r);
  const siege = r.siege ? siegeInfo(s, id) : null;
  const armiesHere = Object.values(s.armies).filter(a => a.node === id);
  const coastal = MAP_REGION[id].seas.length > 0;
  const nearMine = GRAPH[id].some(e => (e.kind === 'land' || e.kind === 'strait') && s.regions[e.to]?.owner === s.player);
  const coreIn = r.conquered !== undefined && !isCored(r) ? Math.max(0, Math.ceil((r.conquered + years(20) - s.day) / 365)) : null;

  return (
    <Sheet
      title={def.name}
      subtitle={`${def.terrain[0].toUpperCase() + def.terrain.slice(1)} · ${FAITH_NAME[r.faith]}${def.hre ? ' · Holy Roman Empire' : ''}${def.trade ? ' · Trade centre' : ''}${def.good ? ` · ${GOOD_NAME[def.good]}` : ''}`}
      onClose={() => st.select(null)}
      left={<Flag nation={owner} size={34} />}
    >
      <Row style={{ marginBottom: 8 }} gap={6}>
        <Btn small tone="secondary" label={nationName(owner)} onPress={() => st.select({ kind: 'nation', id: owner })} />
        {r.controller !== r.owner ? <Pill text={`Occupied by ${nationName(r.controller)}`} color={C.redSoft} textColor={C.red} /> : null}
        {id in me.claims && !mine ? <Pill text="Your claim" color={C.greenSoft} textColor={C.green} /> : null}
        {r.cores.includes(s.player) && !mine ? <Pill text="Your core" color={C.greenSoft} textColor={C.green} /> : null}
        {me.capital === id ? <Pill text="Capital" color={C.gold} /> : null}
      </Row>
      <Row gap={6}>
        <Stat label="Development" value={`${r.dev}/10`} icon="coins" />
        <Stat label="Fort" value={r.fort ? `Level ${r.fort}` : 'None'} icon="castle" />
        <Stat label="Unrest" value={fmt(r.unrest, 1)} tone={r.unrest > 7 ? 'bad' : undefined} onPress={() => setWhy(why === 'unrest' ? null : 'unrest')} icon="rebels" />
      </Row>
      <Row gap={6} style={{ marginTop: 6 }}>
        <Stat label="Income" value={`${fmt(tax + trade + goods, 1)}/mo`} onPress={() => setWhy(why === 'income' ? null : 'income')} icon="gold" />
        <Stat label="Supply" value={`${supplyLimit(s, id, s.player)} regs`} icon="harvest" />
        <Stat label="Faith" value={FAITH_NAME[r.faith]} icon="church" />
      </Row>
      {why === 'unrest' ? (
        <View style={{ marginTop: 8 }}>
          {unrest.length ? unrest.map(u => <Line key={u.label} label={u.label} value={signed(u.value, 1)} tone={u.value > 0 ? 'bad' : 'good'} />) : <T v="small">No unrest. Above 7, rebels may rise.</T>}
        </View>
      ) : null}
      {why === 'income' ? (
        <View style={{ marginTop: 8 }}>
          <Line label={`Taxes (${r.dev} dev × 0.3${isCored(r) ? '' : ', halved: not a core'})`} value={fmt(tax, 2)} />
          <Line label={def.trade ? 'Trade centre' : 'Trade (not a trade centre)'} value={fmt(trade, 2)} />
          {def.good ? <Line label={`${GOOD_NAME[def.good]} (trade good, grows with development)`} value={fmt(goods, 2)} /> : null}
          {r.blockaded ? <Line label="Blockaded by an enemy fleet" value="−50%" tone="bad" /> : null}
          {r.controller !== r.owner ? <Line label="Occupied: no income" value="0" tone="bad" /> : null}
        </View>
      ) : null}
      {coreIn !== null && mine ? <T v="small" style={{ marginTop: 8 }}>Recently conquered: half taxes and manpower until it becomes a core (in {coreIn} years, or pay to core it now).</T> : null}
      {r.converting ? <T v="small" style={{ marginTop: 6 }}>Missionaries are converting it to {FAITH_NAME[r.converting.to]}.</T> : null}
      {r.siege ? (
        <View style={{ marginTop: 8 }}>
          <Line label={`Under siege by ${nationName(r.siege.by)}`} value={`${Math.round(r.siege.progress * 100)}%`} tone="bad" />
          {siege && siege.daily > 0 ? <T v="tiny">About {Math.ceil((1 - r.siege.progress) / siege.daily)} days left at this pace. {r.fort > 0 ? 'Artillery speeds sieges up.' : ''}</T> : null}
        </View>
      ) : r.fort > 0 && r.owner !== s.player ? (
        <T v="tiny" style={{ marginTop: 6 }}>Besieging this fort takes at least {minSiegeRegs(r.fort)} regiments. Enemy forts stop armies marching past them.</T>
      ) : null}
      {armiesHere.length ? (
        <Section title="Armies here">
          {armiesHere.map(a => (
            <Line key={a.id} label={`${a.owner === REBELS ? 'Rebels' : nationName(a.owner)}: ${a.name}`} value={`${armyRegs(a)} regs`} tone={a.owner === s.player ? 'good' : undefined} />
          ))}
        </Section>
      ) : null}

      {mine ? (
        <Section title="Invest">
          <View style={{ gap: 6 }}>
            <Btn tone="secondary" icon="coins" label={r.dev >= 10 ? 'Fully developed' : `Develop to ${r.dev + 1}`} sub={r.dev >= 10 ? undefined : `${devCost(s, r)} gold · +taxes, manpower, supply`} disabled={r.dev >= 10 || me.gold < devCost(s, r)} onPress={() => st.run(x => develop(x, id))} testID="develop" />
            <Btn tone="secondary" icon="castle" label={r.fort >= 3 ? 'Fort at maximum' : `Build fort level ${r.fort + 1}`} sub={r.fort >= 3 ? undefined : `${fortCost(s, r)} gold · +0.35 gold/mo upkeep`} disabled={r.fort >= 3 || me.gold < fortCost(s, r)} onPress={() => st.run(x => buildFort(x, id))} />
            {!isCored(r) ? <Btn tone="secondary" icon="shield" label="Make core" sub={`${coreCost(s, r)} gold · full taxes and manpower`} disabled={me.gold < coreCost(s, r)} onPress={() => st.run(x => makeCore(x, id))} /> : null}
            {r.faith !== me.faith && !r.converting ? <Btn tone="secondary" icon="church" label={`Convert to ${FAITH_NAME[me.faith]}`} sub={`${convertCost(s, r)} gold · 12 months`} disabled={me.gold < convertCost(s, r)} onPress={() => st.run(x => convertRegion(x, id))} /> : null}
            {me.capital !== id && isCored(r) ? <Btn small tone="ghost" label="Move capital here (100 gold)" onPress={() => st.run(x => moveCapital(x, id))} /> : null}
          </View>
        </Section>
      ) : null}
      {mine && r.controller === s.player ? (
        <Section title="Recruit (30 days)" right={<T v="tiny">Manpower {fmt(me.manpower)}</T>}>
          <Row gap={6}>
            <Btn small style={{ flex: 1 }} label="Infantry" sub={`${unitCost(s, s.player, 'inf')}g`} onPress={() => st.run(x => recruit(x, id, 'inf'))} testID="recruit-inf" />
            <Btn small style={{ flex: 1 }} label="Cavalry" sub={`${unitCost(s, s.player, 'cav')}g`} onPress={() => st.run(x => recruit(x, id, 'cav'))} />
            <Btn small style={{ flex: 1 }} label="Artillery" sub={me.era < 2 ? 'Era 2' : `${unitCost(s, s.player, 'art')}g`} disabled={me.era < 2} onPress={() => st.run(x => recruit(x, id, 'art'))} />
          </Row>
          <Row gap={6} style={{ marginTop: 6 }}>
            <Btn small tone="secondary" style={{ flex: 1 }} label="5 infantry" sub={`${unitCost(s, s.player, 'inf') * 5}g`} onPress={() => st.run(x => recruit(x, id, 'inf', 5))} />
            <Btn small tone="secondary" style={{ flex: 1 }} label="Mercenaries ×4" sub={`${mercCost(s, s.player, 4)}g · no manpower`} onPress={() => st.run(x => hireMercenaries(x, id, 4))} />
          </Row>
          {me.recruiting.filter(q => q.region === id).length ? <T v="tiny" style={{ marginTop: 4 }}>{me.recruiting.filter(q => q.region === id).length} regiment(s) training here.</T> : null}
          {coastal ? (
            <Row gap={6} style={{ marginTop: 6 }}>
              <Btn small tone="secondary" style={{ flex: 1 }} label="Galley" sub={`${shipCost(s, s.player, 'galley')}g`} onPress={() => st.run(x => buildShip(x, id, 'galley'))} />
              <Btn small tone="secondary" style={{ flex: 1 }} label="Transport" sub={`${shipCost(s, s.player, 'transport')}g`} onPress={() => st.run(x => buildShip(x, id, 'transport'))} />
              <Btn small tone="secondary" style={{ flex: 1 }} label="Warship" sub={me.era < 3 ? 'Era 3' : `${shipCost(s, s.player, 'warship')}g`} disabled={me.era < UNITS.ships.warship.era} onPress={() => st.run(x => buildShip(x, id, 'warship'))} />
            </Row>
          ) : null}
        </Section>
      ) : null}
      {!mine ? (
        <Section title="Options">
          <View style={{ gap: 6 }}>
            {nearMine && !(id in me.claims) ? (
              <Btn tone="secondary" icon="scroll" label={me.fabricating ? `Clerks busy (${REGION[me.fabricating.region].name})` : 'Forge a claim'} sub={`${FABRICATE_COST} gold · 1 year · gives a reason for war`} disabled={!!me.fabricating} onPress={() => st.run(x => fabricateClaim(x, id))} />
            ) : null}
            {me.faith === 'catholic' && sanctionTargets(s, s.player).includes(id) ? (
              <Btn tone="secondary" icon="church" label="Ask the Pope for a claim" sub={`${SANCTION_COST} Papal Favor (you have ${Math.floor(me.papalFavor)})`} disabled={me.papalFavor < SANCTION_COST} onPress={() => st.run(x => requestSanction(x, id))} />
            ) : null}
            <Btn tone="secondary" icon="flag" label={`Diplomacy with ${nationName(owner)}`} onPress={() => st.select({ kind: 'nation', id: owner })} />
          </View>
        </Section>
      ) : null}
      <T v="tiny" style={{ marginTop: 10 }}>
        {NATION[owner] ? `Cores: ${r.cores.map(nationName).join(', ')}.` : ''} Tap a region with your army selected to march there.
      </T>
    </Sheet>
  );
}

