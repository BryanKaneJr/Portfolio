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
  mercBlocked,
  foundUniversity,
  makeCore,
  moveCapital,
  recruit,
  requestSanction,
} from '../../sim/commands';
import { convertCost, coreCost, devCost, fortCost, FABRICATE_COST, mercCost, regionTax, regionTrade, shipCost, unitCost } from '../../sim/economy';
import { REBELS, armyRegs, isCored, seesUnit } from '../../sim/queries';
import { unrestBreakdown } from '../../sim/rebels';
import { sanctionTargets, SANCTION_COST } from '../../sim/religion';
import { minSiegeRegs, siegeInfo } from '../../sim/siege';
import { yearOf, years } from '../../sim/util';
import { claimReason } from '../../sim/war';
import { GOOD_NAME, charted, goodsIncome } from '../../sim/colonies';
import { GrowSection, UnchartedSheet, WildSheet } from './ColonySheets';
import { CRACKDOWN_HELP, CrackDownBtn } from './RealmActions';
import { UNIVERSITY_MIN_DEV, UNIVERSITY_SCIENCE, advanceFor, prosperityAddsScience, universityCost, unlocked } from '../../sim/science';
import { useStore } from '../../state/store';
import { Shield } from '../components/Flag';
import { Btn, Empty, Line, Pill, Row, Section, Stat, T } from '../components/kit';
import { C, fmt, signed } from '../theme';
import { Sheet } from './Sheet';
import { FAITH_NAME } from '../describe';

export function RegionSheet({ id }: { id: string }) {
  const st = useStore();
  const s = st.state!;
  const r = s.regions[id];
  const def = REGION[id];
  const me = s.nations[s.player];
  const mine = r.owner === s.player;
  const [why, setWhy] = useState<null | 'unrest' | 'income'>(null);
  if (!charted(s, id, s.player)) return <UnchartedSheet />;
  if (!r.owner) return <WildSheet id={id} />;
  const owner = r.owner;
  const tax = regionTax(s, r);
  const goods = goodsIncome(s, r);
  const trade = regionTrade(s, r);
  const unrest = unrestBreakdown(s, r);
  const siege = r.siege ? siegeInfo(s, id) : null;
  const armiesHere = Object.values(s.armies).filter(a => a.node === id && seesUnit(s, s.player, a.owner, id, a.rebelOf));
  const coastal = MAP_REGION[id].seas.length > 0;
  const canArt = unlocked(s, s.player, 'artillery');
  const mercWhy = mine ? mercBlocked(s, id) : null;
  const canWarship = unlocked(s, s.player, 'warships');
  const nearMine = GRAPH[id].some(e => (e.kind === 'land' || e.kind === 'strait') && s.regions[e.to]?.owner === s.player);
  const integratedBy = NATION[owner] && r.cores.length ? `Integrated by ${r.cores.map(nationName).join(', ')}.` : '';
  const fortNote = r.fort ? `Besieging a level ${r.fort} fort takes ${minSiegeRegs(r.fort)} regiments, and enemy forts stop armies marching past them.` : '';
  const coreIn = r.conquered !== undefined && !isCored(r) ? Math.max(0, Math.ceil((r.conquered + years(20) - s.day) / 365)) : null;
  const myClaim = id in me.claims && !mine ? me.claims[id] : undefined;
  const claimWhy = myClaim !== undefined ? claimReason(s, s.player, id) : undefined;
  const claimNote = claimWhy ? `Your claim: ${claimWhy}.` : '';
  // Who could go to war for this region of yours.
  const claimants = mine ? Object.values(s.nations).filter(n => n.alive && n.id !== s.player && id in n.claims) : [];

  return (
    <Sheet
      title={def.name}
      subtitle={`${def.terrain[0].toUpperCase() + def.terrain.slice(1)} · ${FAITH_NAME[r.faith]}${def.hre ? ' · Holy Roman Empire' : ''}${def.trade ? ' · Trade centre' : ''}${def.good ? ` · ${GOOD_NAME[def.good]}` : ''}`}
      onClose={() => st.select(null)}
      left={<Shield nation={owner} size={30} />}
      help={[integratedBy, claimNote, 'Tap Income or Unrest for what makes them up; unrest above 7 can raise rebels.', fortNote].filter(Boolean).join(' ')}
    >
      <Row style={{ marginBottom: 8 }} gap={6}>
        <Btn small tone="secondary" label={nationName(owner)} onPress={() => st.select({ kind: 'nation', id: owner })} />
        {r.controller !== r.owner ? <Pill text={`Occupied by ${nationName(r.controller)}`} color={C.redSoft} textColor={C.red} /> : null}
        {myClaim !== undefined ? <Pill text={myClaim >= 0 ? `Your claim to ${yearOf(myClaim)}` : 'Your claim'} color={C.greenSoft} textColor={C.green} /> : null}
        {claimants.length ? (
          <Pill text={`Claimed by ${nationName(claimants[0].id)}${claimants.length > 1 ? ` +${claimants.length - 1}` : ''}`} color={C.redSoft} textColor={C.red} />
        ) : null}
        {r.cores.includes(s.player) && !mine ? <Pill text="Integrated by you" color={C.greenSoft} textColor={C.green} /> : null}
        {me.capital === id ? <Pill text="Capital" color={C.gold} textColor="#1a1408" /> : null}
        {r.university ? <Pill text="University" color={C.blueSoft} textColor={C.blue} /> : null}
        {r.fort ? <Pill text={`Fort ${r.fort}`} /> : null}
      </Row>
      <Row gap={6}>
        <Stat label="Prosperity" value={`${r.dev}/10`} icon="coins" />
        <Stat label="Income" value={`${fmt(tax + trade + goods, 1)}/mo`} onPress={() => setWhy(why === 'income' ? null : 'income')} icon="gold" />
        <Stat label="Unrest" value={fmt(r.unrest, 1)} tone={r.unrest > 7 ? 'bad' : undefined} onPress={() => setWhy(why === 'unrest' ? null : 'unrest')} icon="rebels" />
      </Row>
      {why === 'unrest' ? (
        <View style={{ marginTop: 8 }}>
          {unrest.length ? unrest.map(u => <Line key={u.label} label={u.label} value={signed(u.value, 1)} tone={u.value > 0 ? 'bad' : 'good'} />) : <Empty text="No unrest" />}
        </View>
      ) : null}
      {why === 'income' ? (
        <View style={{ marginTop: 8 }}>
          <Line label="Taxes" value={fmt(tax, 2)} help={`Prosperity ${r.dev} × 0.3, times your order, ruler and modifiers${isCored(r) ? '' : '; halved until the region is integrated'}.`} />
          <Line label="Trade" value={fmt(trade, 2)} help={def.trade ? 'A trade centre pays 1.2 + 0.12 per point of prosperity.' : 'Only trade centres earn trade.'} />
          {def.good ? <Line label={GOOD_NAME[def.good]} value={fmt(goods, 2)} help="An export: it grows with prosperity." /> : null}
          {r.blockaded ? <Line label="Blockaded" value="−50%" tone="bad" /> : null}
          {r.controller !== r.owner ? <Line label="Occupied" value="0" tone="bad" /> : null}
        </View>
      ) : null}
      {coreIn !== null && mine ? <Line label="Integrated in" value={`${coreIn} years`} help="Until then it pays half its taxes and levies. Integrate now under Invest." /> : null}
      {r.converting ? <Line label="Converting to" value={FAITH_NAME[r.converting.to]} /> : null}
      {r.siege && seesUnit(s, s.player, r.siege.by, id) ? (
        <Line
          label={`Besieged by ${nationName(r.siege.by)}`}
          value={`${Math.round(r.siege.progress * 100)}%${siege && siege.daily > 0 ? ` · ~${Math.ceil((1 - r.siege.progress) / siege.daily)} days` : ''}`}
          tone="bad"
        />
      ) : null}
      {armiesHere.length ? (
        <Section title="Armies here">
          {armiesHere.map(a => (
            <Line key={a.id} label={`${a.owner === REBELS ? 'Rebels' : nationName(a.owner)}: ${a.name}`} value={`${armyRegs(a)} regs`} tone={a.owner === s.player ? 'good' : undefined} />
          ))}
        </Section>
      ) : null}

      {mine && def.nw ? <GrowSection id={id} /> : null}
      {mine ? (
        <Section
          title="Invest"
          help={`Prosperity raises taxes, levies and supply${prosperityAddsScience(s, s.player, id) ? ', and here science too' : ''}. A fort slows sieges and stops enemy armies marching past (upkeep 0.35 gold a month). Integrated land pays full taxes and levies. A university adds ${UNIVERSITY_SCIENCE} science a month. ${CRACKDOWN_HELP}`}
        >
          <View style={{ gap: 6 }}>
            <Btn tone="secondary" icon="coins" label={r.dev >= 10 ? 'As prosperous as it can be' : `Raise prosperity to ${r.dev + 1}`} sub={r.dev >= 10 ? undefined : `${devCost(s, r)} gold`} disabled={r.dev >= 10 || me.gold < devCost(s, r)} onPress={() => st.run(x => develop(x, id))} testID="develop" />
            <Btn tone="secondary" icon="castle" label={r.fort >= 3 ? 'Fort at maximum' : `Build fort level ${r.fort + 1}`} sub={r.fort >= 3 ? undefined : `${fortCost(s, r)} gold`} disabled={r.fort >= 3 || me.gold < fortCost(s, r)} onPress={() => st.run(x => buildFort(x, id))} />
            {!isCored(r) ? <Btn tone="secondary" icon="shield" label="Integrate now" sub={`${coreCost(s, r)} gold`} disabled={me.gold < coreCost(s, r)} onPress={() => st.run(x => makeCore(x, id))} /> : null}
            {r.faith !== me.faith && !r.converting ? <Btn tone="secondary" icon="church" label={`Convert to ${FAITH_NAME[me.faith]}`} sub={`${convertCost(s, r)} gold · 12 months`} disabled={me.gold < convertCost(s, r)} onPress={() => st.run(x => convertRegion(x, id))} /> : null}
            {!r.university ? (
              <Btn tone="secondary" icon="book" label="Found a university" sub={r.dev >= UNIVERSITY_MIN_DEV ? `${universityCost(s, s.player)} gold` : `needs prosperity ${UNIVERSITY_MIN_DEV}`} disabled={r.dev < UNIVERSITY_MIN_DEV || me.gold < universityCost(s, s.player)} onPress={() => st.run(x => foundUniversity(x, id))} testID="university" />
            ) : null}
            <CrackDownBtn id={id} />
            {me.capital !== id && isCored(r) ? <Btn small tone="ghost" label="Move capital here (100 gold)" onPress={() => st.run(x => moveCapital(x, id))} /> : null}
          </View>
        </Section>
      ) : null}
      {mine && r.controller === s.player ? (
        <Section title="Recruit (30 days)" right={<T v="tiny">Levies {fmt(me.manpower)}</T>}>
          <Row gap={6}>
            <Btn small style={{ flex: 1 }} label="Infantry" sub={`${unitCost(s, s.player, 'inf')}g`} onPress={() => st.run(x => recruit(x, id, 'inf'))} testID="recruit-inf" />
            <Btn small style={{ flex: 1 }} label="Cavalry" sub={`${unitCost(s, s.player, 'cav')}g`} onPress={() => st.run(x => recruit(x, id, 'cav'))} />
            <Btn small style={{ flex: 1 }} label="Artillery" sub={canArt ? `${unitCost(s, s.player, 'art')}g` : `needs ${advanceFor('artillery').name}`} disabled={!canArt} onPress={() => st.run(x => recruit(x, id, 'art'))} />
          </Row>
          <Row gap={6} style={{ marginTop: 6 }}>
            <Btn small tone="secondary" style={{ flex: 1 }} label="5 infantry" sub={`${unitCost(s, s.player, 'inf') * 5}g`} onPress={() => st.run(x => recruit(x, id, 'inf', 5))} />
            <Btn small tone="secondary" style={{ flex: 1 }} label="Mercenaries ×4" sub={`${mercCost(s, s.player, 4)}g · no levies`} disabled={!!mercWhy} onPress={() => st.run(x => hireMercenaries(x, id, 4))} />
          </Row>
          {mercWhy ? <T v="tiny" style={{ marginTop: 4 }}>{mercWhy}</T> : null}
          {me.recruiting.filter(q => q.region === id).length ? <T v="tiny" style={{ marginTop: 4 }}>{me.recruiting.filter(q => q.region === id).length} regiment(s) training here.</T> : null}
          {coastal ? (
            <Row gap={6} style={{ marginTop: 6 }}>
              <Btn small tone="secondary" style={{ flex: 1 }} label="Galley" sub={`${shipCost(s, s.player, 'galley')}g`} onPress={() => st.run(x => buildShip(x, id, 'galley'))} />
              <Btn small tone="secondary" style={{ flex: 1 }} label="Transport" sub={`${shipCost(s, s.player, 'transport')}g`} onPress={() => st.run(x => buildShip(x, id, 'transport'))} />
              <Btn small tone="secondary" style={{ flex: 1 }} label={UNITS.ships.warship.name} sub={canWarship ? `${shipCost(s, s.player, 'warship')}g` : `needs ${advanceFor('warships').name}`} disabled={!canWarship} onPress={() => st.run(x => buildShip(x, id, 'warship'))} />
            </Row>
          ) : null}
        </Section>
      ) : null}
      {!mine ? (
        <Section title="Options" help="A claim gives you a reason for war, and the land costs less leverage in a peace.">
          <View style={{ gap: 6 }}>
            {nearMine && !(id in me.claims) ? (
              <Btn tone="secondary" icon="scroll" label={me.fabricating ? `Clerks busy (${REGION[me.fabricating.region].name})` : 'Forge a claim'} sub={`${FABRICATE_COST} gold · 1 year`} disabled={!!me.fabricating} onPress={() => st.run(x => fabricateClaim(x, id))} />
            ) : null}
            {me.faith === 'catholic' && sanctionTargets(s, s.player).includes(id) ? (
              <Btn tone="secondary" icon="church" label="Ask the Pope for a claim" sub={`${SANCTION_COST} Papal Favor (you have ${Math.floor(me.papalFavor)})`} disabled={me.papalFavor < SANCTION_COST} onPress={() => st.run(x => requestSanction(x, id))} />
            ) : null}
            <Btn tone="secondary" icon="flag" label={`Diplomacy with ${nationName(owner)}`} onPress={() => st.select({ kind: 'nation', id: owner })} />
          </View>
        </Section>
      ) : null}
    </Sheet>
  );
}

