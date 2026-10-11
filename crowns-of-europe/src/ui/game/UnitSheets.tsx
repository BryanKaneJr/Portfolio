/** Army, fleet, sea and battle sheets. */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ERA, REGION, SEA, UNITS, nationName, regionName } from '../../sim/content';
import { assignGeneral, disband, GENERAL_COST, hireGeneral, mergeAt, split, splitHalf, stopArmy } from '../../sim/commands';
import { etaDays, supplyLimit, FRONT_WIDTH } from '../../sim/military';
import { fleetPower, shipCount, transportCapacity } from '../../sim/navy';
import { REBELS, armyMen, armyRegs, maxMorale, friendlyTo } from '../../sim/queries';
import { battlePhase, battleSides } from '../../sim/battle';
import { minSiegeRegs, siegeInfo } from '../../sim/siege';
import type { Army, UnitType } from '../../sim/types';
import { store, useStore } from '../../state/store';
import { Flag } from '../components/Flag';
import { Icon } from '../components/Icon';
import { Bar, Btn, Line, Row, Section, Stat, T } from '../components/kit';
import { C, fmt, kmen } from '../theme';
import { regionPoint } from '../map/geometry';
import { Sheet } from './Sheet';

const TYPE_NAME: Record<UnitType, string> = { inf: 'Infantry', cav: 'Cavalry', art: 'Artillery' };

export function ArmySheet({ id }: { id: string }) {
  const st = useStore();
  const s = st.state!;
  const a = s.armies[id] as Army | undefined;
  const [splitting, setSplitting] = useState<Record<UnitType, number> | null>(null);
  const [picking, setPicking] = useState(false);
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
  const friendlyRegs = atRegion ? Object.values(s.armies).filter(o => o.node === a.node && o.owner !== REBELS && a.owner !== REBELS && friendlyTo(s, o.owner, a.owner)).reduce((t, o) => t + armyRegs(o), 0) : 0;
  const siege = atRegion ? siegeInfo(s, a.node) : null;
  const reg = atRegion ? s.regions[a.node] : null;
  const others = Object.values(s.armies).filter(o => o.owner === a.owner && o.id !== a.id && o.node === a.node && !o.path.length);
  const dest = a.path.length ? a.path[a.path.length - 1] : null;
  const status = a.battle ? 'In battle' : a.retreating ? `Retreating to ${regionName(dest ?? a.node)}` : dest ? `Marching to ${regionName(dest)} · ${etaDays(s, a)} days` : `At ${regionName(a.node)}`;

  return (
    <Sheet
      title={a.name}
      subtitle={`${owner} · ${status}`}
      left={<Flag nation={a.owner} size={34} />}
      onClose={() => st.select(null)}
    >
      <Row gap={6}>
        <Stat label="Regiments" value={`${regs}`} icon="flag" />
        <Stat label="Men" value={kmen(men)} tone={men < regs * 700 ? 'bad' : undefined} icon="manpower" />
        <Stat label="Morale" value={`${fmt(a.morale, 1)}/${fmt(max, 1)}`} tone={a.morale < max * 0.5 ? 'bad' : undefined} icon="star" />
      </Row>
      <View style={{ marginTop: 6 }}>
        <Bar value={a.morale / max} color={C.green} />
      </View>
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
      <Section title="General">
        {a.general ? (
          <Line label={a.general.isRuler ? `${a.general.name} (your ruler)` : a.general.name} value={`Fire ${a.general.fire} · Shock ${a.general.shock} · Maneuver ${a.general.maneuver}`} />
        ) : (
          <T v="small">No general. Generals add to every battle roll in their phase, and maneuver speeds marches and offsets terrain.</T>
        )}
        {mine ? (
          picking ? (
            <View style={{ gap: 6, marginTop: 6 }}>
              {me.generals.map(g => (
                <Btn key={g.id} small tone="secondary" label={`${g.name}`} sub={`Fire ${g.fire} · Shock ${g.shock} · Maneuver ${g.maneuver}`} onPress={() => (st.run(x => assignGeneral(x, a.id, g.id)), setPicking(false))} />
              ))}
              <Btn small tone="secondary" label={`Lead in person: ${me.ruler.name}`} sub="Risky: if they fall, the heir takes over" onPress={() => (st.run(x => assignGeneral(x, a.id, 'ruler')), setPicking(false))} />
              <Btn small tone="secondary" label={`Hire a general (${GENERAL_COST} gold)`} onPress={() => st.run(hireGeneral)} />
              {a.general ? <Btn small tone="ghost" label="Remove general" onPress={() => (st.run(x => assignGeneral(x, a.id, null)), setPicking(false))} /> : null}
              <Btn small tone="ghost" label="Done" onPress={() => setPicking(false)} />
            </View>
          ) : (
            <Btn small tone="secondary" style={{ marginTop: 6 }} label={a.general ? 'Change general' : 'Assign a general'} onPress={() => setPicking(true)} />
          )
        ) : null}
      </Section>
      {atRegion && a.owner !== REBELS ? (
        <Section title="Supply">
          <Line label={`Supply limit in ${regionName(a.node)}`} value={`${friendlyRegs} / ${supply} regiments`} tone={friendlyRegs > supply ? 'bad' : 'good'} />
          {friendlyRegs > supply ? <T v="tiny">Too many regiments here: you lose men to attrition every month. Split the army or move on.</T> : null}
        </Section>
      ) : null}
      {reg && reg.owner !== a.owner && reg.controller !== a.owner ? (
        <Section title="Siege">
          {siege?.enough ? (
            <>
              <Line label={reg.fort ? `Besieging the fort (level ${reg.fort})` : 'Taking control'} value={`${Math.round((reg.siege?.progress ?? 0) * 100)}%`} />
              <Bar value={reg.siege?.progress ?? 0} color={C.red} />
              <T v="tiny" style={{ marginTop: 4 }}>About {Math.ceil((1 - (reg.siege?.progress ?? 0)) / Math.max(0.0001, siege.daily))} days left. {reg.fort ? 'Artillery speeds it up.' : ''}</T>
            </>
          ) : siege ? (
            <T v="small">Needs {minSiegeRegs(reg.fort)} regiments to besiege this fort.</T>
          ) : (
            <T v="small">Not at war with the region's holder, or enemies are here.</T>
          )}
        </Section>
      ) : null}
      {mine ? (
        splitting ? (
          <Section title="Split off a new army">
            {(['inf', 'cav', 'art'] as UnitType[]).map(t =>
              a.regs[t].n ? (
                <Row key={t} style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                  <T v="small">{TYPE_NAME[t]}</T>
                  <Row gap={10}>
                    <Pressable onPress={() => setSplitting({ ...splitting, [t]: Math.max(0, splitting[t] - 1) })} style={stepBtn}>
                      <Icon name="minus" size={16} />
                    </Pressable>
                    <T v="num">
                      {splitting[t]} / {a.regs[t].n}
                    </T>
                    <Pressable onPress={() => setSplitting({ ...splitting, [t]: Math.min(a.regs[t].n, splitting[t] + 1) })} style={stepBtn}>
                      <Icon name="plus" size={16} />
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
          <Section title="Orders">
            <T v="tiny" style={{ marginBottom: 6 }}>Tap a region on the map to march there.</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {a.path.length && !a.retreating ? <Btn small tone="secondary" label="Stop" onPress={() => st.run(x => stopArmy(x, a.id))} /> : null}
              {others.length ? <Btn small tone="secondary" label={`Merge (${others.length + 1})`} onPress={() => st.run(x => mergeAt(x, a.id))} /> : null}
              <Btn small tone="secondary" label="Split in half" onPress={() => st.run(x => splitHalf(x, a.id))} />
              <Btn small tone="secondary" label="Split…" onPress={() => setSplitting({ inf: 0, cav: 0, art: 0 })} />
              <Btn small tone="ghost" label="Disband" onPress={() => st.run(x => disband(x, a.id))} />
            </View>
          </Section>
        )
      ) : null}
    </Sheet>
  );
}
const stepBtn = { width: 32, height: 32, borderRadius: 16, backgroundColor: C.parchment2, alignItems: 'center' as const, justifyContent: 'center' as const };

export function FleetSheet({ id }: { id: string }) {
  const st = useStore();
  const s = st.state!;
  const f = s.fleets[id];
  if (!f) return null;
  const mine = f.owner === s.player;
  const dest = f.path.length ? f.path[f.path.length - 1] : null;
  return (
    <Sheet title={f.name} subtitle={`${nationName(f.owner)} · ${dest ? `Sailing to the ${SEA[dest].name}` : `In the ${SEA[f.sea].name}`}`} left={<Flag nation={f.owner} size={34} />} onClose={() => st.select(null)}>
      <Row gap={6}>
        <Stat label="Ships" value={`${shipCount(f)}`} icon="ship" />
        <Stat label="Strength" value={fmt(fleetPower(s, f), 1)} icon="swords" />
        <Stat label="Hull" value={`${Math.round(f.hull * 100)}%`} tone={f.hull < 0.6 ? 'bad' : undefined} icon="shield" />
      </Row>
      <Section title="Ships">
        {(['galley', 'transport', 'warship'] as const).map(t => (f.ships[t] ? <Line key={t} label={UNITS.ships[t].name} value={`${f.ships[t]}`} /> : null))}
        <Line label="Can carry" value={`${transportCapacity([f])} regiments`} />
      </Section>
      <T v="tiny" style={{ marginTop: 8 }}>
        {mine ? 'Tap a sea zone to sail there. ' : ''}Fleets carry armies across seas they sit in, blockade enemy coasts (−income, +war score) and fight in one roll when enemies meet. Galleys are strong in inland seas, weak in the ocean. Hulls repair next to your own coast.
      </T>
    </Sheet>
  );
}

export function SeaSheet({ id }: { id: string }) {
  const st = useStore();
  const s = st.state!;
  const fleets = Object.values(s.fleets).filter(f => f.sea === id);
  return (
    <Sheet title={SEA[id].name} subtitle="Sea zone" onClose={() => st.select(null)}>
      {fleets.length ? fleets.map(f => <Line key={f.id} label={`${nationName(f.owner)}: ${f.name}`} value={`${shipCount(f)} ships`} />) : <T v="small">No fleets here.</T>}
      <T v="tiny" style={{ marginTop: 8 }}>With your own transports here, your armies can sail across. Enemy fleets close nearby straits.</T>
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
        <T v="small">This battle has ended. Check your messages for the result.</T>
      </Sheet>
    );
  }
  const sides = battleSides(s, b);
  const terrain = REGION[b.node].terrain;
  return (
    <Sheet title={`Battle of ${regionName(b.node)}`} subtitle={`Day ${b.days} · ${battlePhase(b) === 'fire' ? 'Fire phase (artillery strong)' : 'Shock phase (cavalry strong)'} · ${terrain}, ${FRONT_WIDTH[terrain]} wide`} onClose={() => st.select(null)}>
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
            <Line label="Regiments (inf / cav / art)" value={`${side.regs.inf} / ${side.regs.cav} / ${side.regs.art}`} />
            <Line label={`General${side.general.name ? `: ${side.general.name}` : ''}`} value={side.general.name ? `F${side.general.fire} S${side.general.shock} M${side.general.maneuver}` : 'none'} />
            <Line label="Today's roll (with modifiers)" value={`${b.sides[i].roll || '–'}`} />
            <Bar value={side.morale / side.maxMorale} color={i === 0 ? C.blue : C.red} />
          </View>
        );
      })}
      <T v="tiny">Each day both sides roll a die, plus their general's skill in this phase; the attacker loses 1 (2 in mountains) in rough terrain. Damage = roll × front-line strength. A side at zero morale retreats; with 5× the enemy's remaining men, the winner annihilates them.</T>
      <Btn small tone="secondary" style={{ marginTop: 8 }} label="Show on map" onPress={() => store.focusOn(...regionPoint(b.node))} />
    </Sheet>
  );
}
