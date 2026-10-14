/** Army, fleet, sea and battle sheets. */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ERA, REGION, SEA, UNITS, nationName, regionName } from '../../sim/content';
import { assignGeneral, disband, disbandOutcome, GENERAL_COST, hireGeneral, mergeAt, split, splitHalf, stopArmy } from '../../sim/commands';
import { etaDays, supplyLimit, FRONT_WIDTH } from '../../sim/military';
import { fleetPower, shipCount, transportCapacity } from '../../sim/navy';
import { REBELS, armyMen, armyRegs, maxMorale, friendlyTo, hostile, seesUnit } from '../../sim/queries';
import { battlePhase, battleSides } from '../../sim/battle';
import { attackOdds, type Odds } from '../../sim/forecast';
import { COLONY_HOLD_DAYS, CONTROL_DAYS, minSiegeRegs, siegeInfo } from '../../sim/siege';
import type { Army, UnitType } from '../../sim/types';
import { store, useStore } from '../../state/store';
import { Flag, Shield } from '../components/Flag';
import { Icon } from '../components/Icon';
import { Bar, Btn, ConfirmBtn, Empty, Line, Row, Section, Stars, Stat, T, useConfirm } from '../components/kit';
import { C, G, fmt, kmen, sans } from '../theme';
import { regionPoint } from '../map/geometry';
import { Sheet } from './Sheet';
import { RAID_MAX, RAID_PER_REG, charted } from '../../sim/colonies';
import { STAR_BONUS, rulerAsGeneral } from '../../sim/rulers';
import { UnchartedSheet } from './ColonySheets';

const TYPE_NAME: Record<UnitType, string> = { inf: 'Infantry', cav: 'Cavalry', art: 'Artillery' };

const VERDICT = { favoured: 'Favoured', even: 'Even', outmatched: 'Outmatched' } as const;

/** The odds of the first fight on the army's road, as a line to tap for the numbers behind them. */
function OddsLine({ odds: o }: { odds: Odds }) {
  const r = o.ratio >= 1 ? `We would likely outlast them ${fmt(Math.min(o.ratio, 9.9), 1)} to 1.` : `They would likely outlast us ${fmt(Math.min(1 / Math.max(o.ratio, 0.01), 9.9), 1)} to 1.`;
  return (
    <Line
      label={`Odds at ${regionName(o.node)}`}
      value={VERDICT[o.verdict]}
      tone={o.verdict === 'favoured' ? 'good' : o.verdict === 'outmatched' ? 'bad' : undefined}
      help={`${kmen(o.men[0])} of ours against ${kmen(o.men[1])}. ${r}${o.reasons.length ? ` ${o.reasons.join('. ')}.` : ''} Odds, not a promise: the dice decide.`}
    />
  );
}

/** What disbanding this army will do, as the sim does it (disbandOutcome). */
function disbandLines(a: Army): string[] {
  const o = disbandOutcome(a);
  const out = [o.levies > 0 ? `${fmt(o.levies)} men return to your levies` : 'No men return to your levies'];
  if (o.mercs) out.push(`${o.mercs} mercenary regiment${o.mercs > 1 ? 's are' : ' is'} let go`);
  if (o.general) out.push(o.general.isRuler ? `${o.general.name} returns to court` : `${o.general.name} returns to your generals`);
  return out;
}

export function ArmySheet({ id }: { id: string }) {
  const st = useStore();
  const s = st.state!;
  const a = s.armies[id] as Army | undefined;
  const [splitting, setSplitting] = useState<Record<UnitType, number> | null>(null);
  const [picking, setPicking] = useState(false);
  const disbanding = useConfirm(id);
  if (!a) return null;
  const mine = a.owner === s.player;
  const me = s.nations[s.player];
  const owner = a.owner === REBELS ? 'Rebels' : nationName(a.owner);
  const max = maxMorale(s, a.owner);
  const regs = armyRegs(a);
  const men = armyMen(a);
  const era = a.owner === REBELS ? ERA(1) : ERA(s.nations[a.owner].era);
  const atRegion = !!REGION[a.node];
  const supply = atRegion && a.owner !== REBELS ? supplyLimit(s, a.node, a.owner) : 0;
  const friendlyRegs = atRegion ? Object.values(s.armies).filter(o => o.node === a.node && o.owner !== REBELS && a.owner !== REBELS && friendlyTo(s, o.owner, a.owner) && seesUnit(s, s.player, o.owner, a.node)).reduce((t, o) => t + armyRegs(o), 0) : 0;
  const siege = atRegion ? siegeInfo(s, a.node) : null;
  const reg = atRegion ? s.regions[a.node] : null;
  const others = Object.values(s.armies).filter(o => o.owner === a.owner && o.id !== a.id && o.node === a.node && !o.path.length);
  const dest = a.path.length ? a.path[a.path.length - 1] : null;
  const status = a.battle ? 'In battle' : a.retreating ? `Retreating to ${regionName(dest ?? a.node)}` : dest ? `Marching to ${regionName(dest)} · ${etaDays(s, a)} days` : `At ${regionName(a.node)}`;

  const orders = mine ? (
    splitting ? (
      <Section title="Split off a new army">
        {(['inf', 'cav', 'art'] as UnitType[]).map(t =>
          a.regs[t].n ? (
            <Row key={t} style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <T v="small">{TYPE_NAME[t]}</T>
              <Row gap={10}>
                <Pressable onPress={() => setSplitting({ ...splitting, [t]: Math.max(0, splitting[t] - 1) })} style={stepBtn}>
                  <Icon name="minus" size={16} color={G.text} />
                </Pressable>
                <T v="num">
                  {splitting[t]} / {a.regs[t].n}
                </T>
                <Pressable onPress={() => setSplitting({ ...splitting, [t]: Math.min(a.regs[t].n, splitting[t] + 1) })} style={stepBtn}>
                  <Icon name="plus" size={16} color={G.text} />
                </Pressable>
              </Row>
            </Row>
          ) : null,
        )}
        <Row gap={6}>
          <Btn small style={{ flex: 1 }} label="Split" onPress={() => (st.run(x => split(x, a.id, splitting)), setSplitting(null))} />
          <Btn small tone="ghost" style={{ flex: 1 }} label="Cancel" onPress={() => setSplitting(null)} />
        </Row>
      </Section>
    ) : (
      <View style={{ marginTop: 12 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {/* While disbanding waits for its second tap, it stands alone in the row. */}
          {disbanding.armed ? null : (
            <>
              {a.path.length && !a.retreating ? <Btn small tone="secondary" label="Stop" onPress={() => st.run(x => stopArmy(x, a.id))} /> : null}
              {others.length ? <Btn small tone="secondary" label={`Merge (${others.length + 1})`} onPress={() => st.run(x => mergeAt(x, a.id))} /> : null}
              <Btn small tone="secondary" label="Split in half" onPress={() => st.run(x => splitHalf(x, a.id))} />
              <Btn small tone="secondary" label="Split…" onPress={() => setSplitting({ inf: 0, cav: 0, art: 0 })} />
            </>
          )}
          <ConfirmBtn small armKey={a.id} state={disbanding} label="Disband" confirm="Tap again to disband" consequences={disbandLines(a)} onConfirm={() => st.run(x => disband(x, a.id))} testID="disband" />
        </View>
      </View>
    )
  ) : null;
  const ruler = mine ? rulerAsGeneral(s, s.player) : null;
  const odds = mine ? attackOdds(s, a.id) : null;

  return (
    <Sheet
      title={a.name}
      subtitle={`${owner} · ${status}`}
      left={<Shield nation={a.owner} size={30} />}
      onClose={() => st.select(null)}
      compact={mine}
      help={mine ? 'Tap any region on the map to march there; the dashed line is the route. Tap another of your tokens to switch to it. Disbanding sends half its men home to your levies; mercenaries are let go.' : undefined}
    >
      <Row gap={6}>
        <Stat label="Regiments" value={`${regs}`} icon="flag" />
        <Stat label="Men" value={kmen(men)} tone={men < regs * 700 ? 'bad' : undefined} icon="manpower" />
        <Stat label="Morale" value={`${fmt(a.morale, 1)}/${fmt(max, 1)}`} tone={a.morale < max * 0.5 ? 'bad' : undefined} icon="star" />
      </Row>
      <View style={{ marginTop: 6 }}>
        <Bar value={a.morale / max} color={C.green} />
      </View>
      {odds ? <OddsLine odds={odds} /> : null}
      {orders}
      <Section title="General" help={`Each star adds ${Math.round(STAR_BONUS * 100)}% to everything the army does: damage in battle, steadiness, march and siege speed. Your ruler can lead in person; if they fall, the heir takes the throne.`}>
        {picking ? null : a.general ? <GeneralRow name={a.general.isRuler ? `${a.general.name} (ruler)` : a.general.name} stars={a.general.stars} /> : <Empty text="No general" />}
        {mine ? (
          picking ? (
            <View style={{ gap: 2, marginTop: 6 }}>
              {me.generals.map(g => (
                <GeneralRow key={g.id} name={g.name} stars={g.stars} onPress={() => (st.run(x => assignGeneral(x, a.id, g.id)), setPicking(false))} />
              ))}
              {ruler ? <GeneralRow name={`${me.ruler.name} (ruler, in person)`} stars={ruler.stars} onPress={() => (st.run(x => assignGeneral(x, a.id, 'ruler')), setPicking(false))} /> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                <Btn small tone="secondary" label={`Hire a general (${GENERAL_COST} gold)`} onPress={() => st.run(hireGeneral)} />
                {a.general ? <Btn small tone="ghost" label="Remove general" onPress={() => (st.run(x => assignGeneral(x, a.id, null)), setPicking(false))} /> : null}
                <Btn small tone="ghost" label="Done" onPress={() => setPicking(false)} />
              </View>
            </View>
          ) : (
            <Btn small tone="secondary" style={{ marginTop: 6, alignSelf: 'flex-start' }} label={a.general ? 'Change general' : 'Assign a general'} onPress={() => setPicking(true)} />
          )
        ) : null}
      </Section>
      <Section title="Regiments">
        {(['inf', 'cav', 'art'] as UnitType[]).map(t =>
          a.regs[t].n ? (
            <Line
              key={t}
              label={`${TYPE_NAME[t]} · ${t === 'inf' ? era.inf.name : t === 'cav' ? era.cav.name : (era.art?.name ?? 'Guns')}`}
              value={`${a.regs[t].n} (${Math.round((a.regs[t].men / (a.regs[t].n * 1000)) * 100)}%)`}
            />
          ) : null,
        )}
        {a.mercs ? <Line label="Mercenary regiments" value={`${a.mercs}`} tone="muted" /> : null}
      </Section>
      {atRegion && a.owner !== REBELS ? (
        <Section title="Supply" help="Each region feeds only so many regiments. Above that, every army there loses men each month, worse in northern and eastern winters: split up or move on.">
          <Line label={friendlyRegs > supply ? 'Over the limit: losing men' : `Supply in ${regionName(a.node)}`} value={`${friendlyRegs} / ${supply}`} tone={friendlyRegs > supply ? 'bad' : 'good'} />
        </Section>
      ) : null}
      {reg?.colony && a.owner !== REBELS && reg.colony.by !== a.owner && hostile(s, a.owner, reg.colony.by) ? (
        <Section title="Raid" help={`Standing in a colony being settled by an enemy, each regiment kills ${RAID_PER_REG} settlers a month (${RAID_MAX} at most) unless troops of theirs, or of their friends, are here. At none left, the colony is lost. Land nobody holds can't be besieged.`}>
          <Line label={`${nationName(reg.colony.by)}’s settlers`} value={`${Math.max(0, Math.round(reg.colony.settlers))} left`} />
          <Line label="Killed a month" value={`${Math.min(RAID_MAX, RAID_PER_REG * armyRegs(a))}`} tone={a.owner === s.player ? "good" : "bad"} />
        </Section>
      ) : null}
      {reg && reg.owner && reg.owner !== a.owner && reg.controller !== a.owner ? (
        <Section title="Siege" help={`A fort needs 3 regiments per level to besiege; land without one falls in ${CONTROL_DAYS} days (a colony across the ocean holds out for ${COLONY_HOLD_DAYS}). Artillery (+10% each) and a general’s stars speed a siege up.`}>
          {siege?.enough ? (
            <>
              <Line label={reg.fort ? `Fort level ${reg.fort}` : 'Taking control'} value={`${Math.round((reg.siege?.progress ?? 0) * 100)}% · ~${Math.ceil((1 - (reg.siege?.progress ?? 0)) / Math.max(0.0001, siege.daily))} days`} />
              <Bar value={reg.siege?.progress ?? 0} color={C.red} />
            </>
          ) : siege ? (
            <T v="small">Needs {minSiegeRegs(reg.fort)} regiments.</T>
          ) : (
            <T v="small">Not at war with them, or enemies are here.</T>
          )}
        </Section>
      ) : null}
    </Sheet>
  );
}

/** A general: their name and their stars. */
export function GeneralRow({ name, stars, note, onPress }: { name: string; stars: number; note?: string; onPress?: () => void }) {
  const body = (
    <View style={styles.general}>
      <View style={styles.medal}>
        <Icon name="horse" size={16} color={G.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.genName} numberOfLines={1}>
          {name}
        </Text>
        {note ? (
          <Text style={styles.genNote} numberOfLines={1}>
            {note}
          </Text>
        ) : null}
      </View>
      <Stars n={stars} />
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.6 }]} accessibilityLabel={`${name}, ${stars} stars`}>
      {body}
    </Pressable>
  ) : (
    body
  );
}
const stepBtn = { width: 32, height: 32, borderRadius: 16, backgroundColor: G.raised, alignItems: 'center' as const, justifyContent: 'center' as const };

export function FleetSheet({ id }: { id: string }) {
  const st = useStore();
  const s = st.state!;
  const f = s.fleets[id];
  if (!f) return null;
  const mine = f.owner === s.player;
  const dest = f.path.length ? f.path[f.path.length - 1] : null;
  return (
    <Sheet
      title={f.name}
      subtitle={`${nationName(f.owner)} · ${dest ? `Sailing to the ${SEA[dest].name}` : `In the ${SEA[f.sea].name}`}`}
      left={<Shield nation={f.owner} size={30} />}
      onClose={() => st.select(null)}
      compact={mine}
      help={`${mine ? 'Tap any sea to sail there. ' : ''}Fleets carry armies across the seas they sit in, blockade enemy coasts (less income for them, leverage for you) and fight when enemies meet. Galleys are strong in inland seas, weak in the ocean. Hulls repair next to your own coast.`}
    >
      <Row gap={6}>
        <Stat label="Ships" value={`${shipCount(f)}`} icon="ship" />
        <Stat label="Strength" value={fmt(fleetPower(s, f), 1)} icon="swords" />
        <Stat label="Hull" value={`${Math.round(f.hull * 100)}%`} tone={f.hull < 0.6 ? 'bad' : undefined} icon="shield" />
      </Row>
      <Section title="Ships">
        {(['galley', 'transport', 'warship'] as const).map(t => (f.ships[t] ? <Line key={t} label={UNITS.ships[t].name} value={`${f.ships[t]}`} /> : null))}
        <Line label="Can carry" value={`${transportCapacity([f])} regiments`} />
      </Section>
    </Sheet>
  );
}

export function SeaSheet({ id }: { id: string }) {
  const st = useStore();
  const s = st.state!;
  const fleets = Object.values(s.fleets).filter(f => f.sea === id && seesUnit(s, s.player, f.owner, id));
  if (!charted(s, id)) return <UnchartedSheet />;
  const def = SEA[id];
  return (
    <Sheet
      title={def.name}
      subtitle={`${def.ocean ? 'Open ocean' : 'Sea zone'} · ${def.days ?? 4} days to cross`}
      onClose={() => st.select(null)}
      help="With your transports in a sea next to your army, it can board and sail on, across the ocean if need be. A stronger enemy fleet bars the way and closes nearby straits."
    >
      {fleets.length ? fleets.map(f => <Line key={f.id} label={`${nationName(f.owner)}: ${f.name}`} value={`${shipCount(f)} ships`} />) : <Empty text="No fleets here" />}
    </Sheet>
  );
}

export function BattleSheet({ id }: { id: string }) {
  const st = useStore();
  const s = st.state!;
  const b = s.battles[id];
  if (!b) {
    return (
      <Sheet title="Battle over" onClose={() => st.select(null)}>
        <T v="small">See your messages for the result.</T>
      </Sheet>
    );
  }
  const sides = battleSides(s, b);
  const terrain = REGION[b.node].terrain;
  return (
    <Sheet
      title={`Battle of ${regionName(b.node)}`}
      subtitle={`Day ${b.days} · ${battlePhase(b) === 'volley' ? 'volleys' : 'charges'} · ${terrain}${b.pitched ? ' · pitched' : b.river ? ' · across a river' : ''}`}
      onClose={() => st.select(null)}
      help={`Each day both sides roll a die; the army that marched in attacks and loses 1 in rough terrain (2 in mountains, 1 more across a river). ${b.pitched ? 'This is a pitched battle: both sides were already here when it broke out, so neither suffers that. ' : ''}Damage is the roll times the front line (${FRONT_WIDTH[terrain]} regiments wide here), plus ${Math.round(STAR_BONUS * 100)}% for each star of the side’s best general, whose stars also steady its morale. Three days of volleys favour guns, then three of charges favour horse. At zero morale a side retreats (with nowhere to go, it scatters); with five times the enemy’s remaining men, the winner annihilates them.`}
    >
      {[0, 1].map(i => {
        const side = sides[i];
        const nat = b.sides[i].nations[0];
        return (
          <View key={i} style={{ marginBottom: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={8}>
                <Flag nation={nat} size={26} />
                <T v="h3">{i === 0 ? 'Attacker' : 'Defender'}: {b.sides[i].nations.map(n => (n === REBELS ? 'Rebels' : nationName(n))).join(', ')}</T>
              </Row>
            </Row>
            <Line label="Men" value={`${kmen(side.totalMen)} (lost ${kmen(b.sides[i].losses)})`} />
            <Line label="Infantry · cavalry · guns" value={`${side.regs.inf} / ${side.regs.cav} / ${side.regs.art}`} />
            {side.general.name ? <GeneralRow name={side.general.name} stars={side.general.stars} /> : <Line label="General" value="none" tone="muted" />}
            <Line label="Today's roll" value={`${b.sides[i].roll || '–'}`} />
            <Bar value={side.morale / side.maxMorale} color={i === 0 ? C.blue : C.red} />
          </View>
        );
      })}
      <Btn small tone="secondary" style={{ marginTop: 8 }} label="Show on map" onPress={() => store.focusOn(...regionPoint(b.node))} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  general: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  medal: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(214,178,110,0.12)', borderWidth: 1, borderColor: G.gilt },
  genName: { color: G.text, fontFamily: sans, fontSize: 15, fontWeight: '600' },
  genNote: { color: G.text3, fontFamily: sans, fontSize: 12, marginTop: 1 },
});
