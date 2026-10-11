/** The realm menu: Military, Diplomacy, Economy, Missions, Ledger and Settings (one tap from the map). */
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ERA, NATION, POLICIES, POLICY, TRAITS, UNITS, nationName, regionName } from '../../sim/content';
import { adoptEra, choosePolicy, GENERAL_COST, hireGeneral, repayLoan, setArmyMode, takeLoan, boostStability, playerCompleteMission } from '../../sim/commands';
import { ledger, stabilityCost, techCost } from '../../sim/economy';
import { etaDays } from '../../sim/military';
import { missionState, missionsFor } from '../../sim/missions';
import { evalCondition } from '../../sim/events';
import {
  aliveNations,
  allied,
  alliesOf,
  armiesOf,
  armyMen,
  armyRegs,
  availableEra,
  fleetsOf,
  forceLimit,
  militaryPower,
  neighborsOf,
  ownedRegions,
  rulerAge,
  subjectsOf,
  totalDev,
  totalRegiments,
  warsOf,
} from '../../sim/queries';
import { opinion } from '../../sim/diplomacy';
import { coalitionAgainst, coalitionOf } from '../../sim/threat';
import { scoreFor } from '../../sim/war';
import { hreMembers } from '../../sim/religion';
import { shipCount } from '../../sim/navy';
import type { PauseReason } from '../../sim/types';
import { yearOf } from '../../sim/util';
import { store, useStore, type MenuTab } from '../../state/store';
import { saveGame, type SlotId } from '../../state/storage';
import { Flag } from '../components/Flag';
import { Icon } from '../components/Icon';
import { Bar, Btn, Card, Empty, Line, Pill, Row, Section, Stat, T, Tabs } from '../components/kit';
import { C, fmt, kmen, sans, signed } from '../theme';
import { conditionText, effectsLines, goalParts, modLines } from '../describe';
import { regionPoint } from '../map/geometry';
import { ModifiersList, Panel } from './Panels';

export function MenuPanel({ tab }: { tab: MenuTab }) {
  const st = useStore();
  const s = st.state!;
  const missionsReady = missionsFor(s.player).filter(m => missionState(s, s.player, m) === 'ready').length;
  const tabs: { key: MenuTab; label: string; badge?: number }[] = [
    { key: 'military', label: 'Military' },
    { key: 'diplomacy', label: 'Diplomacy' },
    { key: 'economy', label: 'Realm' },
    { key: 'missions', label: 'Missions', badge: missionsReady },
    { key: 'ledger', label: 'Ledger' },
    { key: 'settings', label: 'Settings' },
  ];
  return (
    <Panel title={NATION[s.player].name} onClose={() => st.close()} right={<Flag nation={s.player} size={32} />}>
      <View style={{ marginHorizontal: -14, marginTop: -14, marginBottom: 10, backgroundColor: C.chrome, paddingVertical: 8 }}>
        <Tabs tabs={tabs} value={tab} onChange={t => st.open({ kind: 'menu', tab: t })} />
      </View>
      {tab === 'military' ? <Military /> : null}
      {tab === 'diplomacy' ? <Diplomacy /> : null}
      {tab === 'economy' ? <Realm /> : null}
      {tab === 'missions' ? <Missions /> : null}
      {tab === 'ledger' ? <Ledger /> : null}
      {tab === 'settings' ? <Settings /> : null}
    </Panel>
  );
}

function goTo(node: string, sel?: { kind: 'army' | 'fleet'; id: string }) {
  store.close();
  if (sel) store.select(sel);
  store.focusOn(...regionPoint(node));
}

// ---------------------------------------------------------------- military

function Military() {
  const st = useStore();
  const s = st.state!;
  const me = s.nations[s.player];
  const armies = armiesOf(s, s.player);
  const fleets = fleetsOf(s, s.player);
  const era = ERA(me.era);
  const regs = totalRegiments(s, s.player);
  const fl = forceLimit(s, s.player);
  return (
    <View>
      <Row gap={6}>
        <Stat label="Regiments" value={`${regs} / ${fl}`} tone={regs > fl ? 'bad' : undefined} icon="flag" />
        <Stat label="Manpower" value={kmen(me.manpower)} icon="manpower" />
        <Stat label="Training" value={`${me.recruiting.length}`} icon="castle" />
      </Row>
      <T v="tiny" style={{ marginTop: 4 }}>Above the force limit ({fl}, from your development) every regiment costs more upkeep.</T>
      <Section title="Army pay">
        <Row gap={6}>
          <Btn small style={{ flex: 1 }} tone={me.armyMode === 'peace' ? 'primary' : 'secondary'} label="Peacetime" sub="half upkeep, slow refill" onPress={() => st.run(x => setArmyMode(x, 'peace'))} />
          <Btn small style={{ flex: 1 }} tone={me.armyMode === 'war' ? 'primary' : 'secondary'} label="Wartime" sub="full upkeep, fast refill" onPress={() => st.run(x => setArmyMode(x, 'war'))} />
        </Row>
      </Section>
      <Section title={`Armies (${armies.length})`}>
        {armies.length ? (
          armies.map(a => (
            <Pressable key={a.id} onPress={() => goTo(a.node, { kind: 'army', id: a.id })} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{a.name}</Text>
                <Text style={styles.rowSub}>
                  {a.battle ? 'In battle at ' : a.path.length ? `To ${regionName(a.path[a.path.length - 1])} (${etaDays(s, a)}d) from ` : 'At '}
                  {regionName(a.node)}
                  {a.general ? ` · ${a.general.name}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.rowNum}>{armyRegs(a)} regs</Text>
                <Text style={styles.rowSub}>{kmen(armyMen(a))} men</Text>
              </View>
            </Pressable>
          ))
        ) : (
          <Empty text="You have no armies. Recruit in any region you own." />
        )}
      </Section>
      <Section title={`Fleets (${fleets.length})`}>
        {fleets.length ? (
          fleets.map(f => (
            <Pressable key={f.id} onPress={() => goTo(f.sea, { kind: 'fleet', id: f.id })} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{f.name}</Text>
                <Text style={styles.rowSub}>{regionName(f.sea)}</Text>
              </View>
              <Text style={styles.rowNum}>{shipCount(f)} ships</Text>
            </Pressable>
          ))
        ) : (
          <Empty text="No fleets. Build ships in a coastal region." />
        )}
      </Section>
      <Section title="Generals" right={<Btn small tone="secondary" label={`Hire (${GENERAL_COST}g)`} onPress={() => st.run(hireGeneral)} />}>
        {me.generals.length ? me.generals.map(g => <Line key={g.id} label={g.name} value={`F${g.fire} S${g.shock} M${g.maneuver}`} />) : <Empty text="No generals waiting for a command." />}
      </Section>
      <Section title={`Troops of the ${era.name}`}>
        <Line label={`Infantry: ${era.inf.name}`} value={`strength ${era.inf.power}`} />
        <Line label={`Cavalry: ${era.cav.name}`} value={`strength ${era.cav.power}`} />
        <Line label={`Artillery: ${era.art?.name ?? 'not yet invented'}`} value={era.art ? `strength ${era.art.power}` : '—'} />
        <Line label="Base morale" value={`${era.morale}`} />
      </Section>
    </View>
  );
}

// ---------------------------------------------------------------- diplomacy

function Diplomacy() {
  const st = useStore();
  const s = st.state!;
  const p = s.player;
  const me = s.nations[p];
  const wars = warsOf(s, p);
  const coalition = coalitionAgainst(s, p);
  const myCoalition = coalitionOf(s, p);
  const [filter, setFilter] = useState<'neighbors' | 'all'>('neighbors');
  const neighbors = new Set(neighborsOf(s, p));
  const list = aliveNations(s)
    .filter(n => n.id !== p && (filter === 'all' || neighbors.has(n.id) || allied(s, p, n.id) || n.overlord === p))
    .map(n => ({ id: n.id, op: opinion(s, n.id, p) }))
    .sort((a, b) => b.op - a.op);
  const open = (id: string) => {
    st.close();
    st.select({ kind: 'nation', id });
  };
  return (
    <View>
      <Section title="Wars">
        {wars.length ? (
          wars.map(w => (
            <Pressable key={w.id} onPress={() => st.open({ kind: 'peace', war: w.id })} style={styles.row}>
              <Icon name="swords" size={18} color={C.red} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{w.name}</Text>
                <Text style={styles.rowSub}>Against {(w.attackers.includes(p) ? w.defenders : w.attackers).map(nationName).join(', ')}</Text>
              </View>
              <Text style={[styles.rowNum, { color: scoreFor(s, w, p) >= 0 ? C.green : C.red }]}>{signed(scoreFor(s, w, p))}%</Text>
            </Pressable>
          ))
        ) : (
          <Empty text="At peace." />
        )}
      </Section>
      {coalition ? (
        <Card style={{ marginTop: 10, borderColor: C.red }}>
          <T v="h3">A coalition stands against you</T>
          <T v="small">{coalition.members.map(nationName).join(', ')} will defend each other if you attack any of them, and may strike first. Let your Threat fade.</T>
        </Card>
      ) : null}
      {myCoalition ? <T v="small" style={{ marginTop: 8 }}>You are in the coalition against {nationName(myCoalition.target)}.</T> : null}
      <Section title="Relations">
        <Line label="Overlord" value={me.overlord ? `${nationName(me.overlord)} (${me.subjectType === 'union' ? 'personal union' : 'vassal'})` : 'none'} />
        <Line label="Allies" value={alliesOf(s, p).map(nationName).join(', ') || 'none'} />
        <Line label="Subjects" value={subjectsOf(s, p).map(nationName).join(', ') || 'none'} />
        <Line label="Rivals" value={me.rivals.map(nationName).join(', ') || 'none'} />
        <Line label="Claims" value={Object.keys(me.claims).map(regionName).join(', ') || 'none'} />
      </Section>
      <Section title="Holy Roman Empire">
        <Line label="Emperor" value={s.hre.emperor ? nationName(s.hre.emperor) : 'vacant'} />
        <Line label="Electors" value={s.hre.electors.map(nationName).join(', ')} />
        <Line label="Members" value={`${hreMembers(s).length}`} />
        <T v="tiny">The Emperor gains manpower and reputation, and defends member states from outsiders. Electors choose a new Emperor when the old one dies.</T>
      </Section>
      <Section
        title="Other nations"
        right={
          <Row gap={4}>
            <Btn small tone={filter === 'neighbors' ? 'primary' : 'secondary'} label="Nearby" onPress={() => setFilter('neighbors')} />
            <Btn small tone={filter === 'all' ? 'primary' : 'secondary'} label="All" onPress={() => setFilter('all')} />
          </Row>
        }
      >
        {list.map(n => (
          <Pressable key={n.id} onPress={() => open(n.id)} style={styles.row}>
            <Flag nation={n.id} size={26} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{nationName(n.id)}</Text>
              <Text style={styles.rowSub}>
                {allied(s, p, n.id) ? 'Ally · ' : ''}
                {s.nations[n.id].overlord === p ? 'Your subject · ' : ''}
                {ownedRegions(s, n.id).length} regions
              </Text>
            </View>
            <Text style={[styles.rowNum, { color: n.op >= 0 ? C.green : C.red }]}>{signed(Math.round(n.op))}</Text>
          </Pressable>
        ))}
      </Section>
    </View>
  );
}

// ---------------------------------------------------------------- realm (economy, ruler, eras, policies)

function Realm() {
  const st = useStore();
  const s = st.state!;
  const p = s.player;
  const me = s.nations[p];
  const def = NATION[p];
  const l = ledger(s, p);
  const avail = availableEra(s);
  const nextEra = me.era < UNITS.eras.length ? ERA(me.era + 1) : null;
  const [policyPick, setPolicyPick] = useState<string | null>(null);
  const [showMods, setShowMods] = useState(false);
  const traits = [TRAITS.national[def.trait]];
  return (
    <View>
      <Card>
        <Row>
          <Icon name="crown" size={26} color={C.goldDark} />
          <View style={{ flex: 1 }}>
            <T v="h2">{me.ruler.name}</T>
            <T v="small">
              {def.gov === 'monarchy' ? 'Ruler' : def.gov === 'republic' ? 'Head of the republic' : 'Spiritual ruler'} · age {rulerAge(s, p)} · skill {me.ruler.skill}/5
              {me.ruler.regency ? ' · under a regency' : ''}
            </T>
          </View>
        </Row>
        <Row gap={6} style={{ marginTop: 6, flexWrap: 'wrap' }}>
          {me.ruler.traits.map(t => (
            <Pill key={t} text={TRAITS.ruler[t]?.name ?? t} />
          ))}
        </Row>
        <T v="tiny" style={{ marginTop: 6 }}>Skill above 3 raises taxes 5% per point; below 3 lowers them. Rulers age and die; the heir takes over.</T>
        {me.heir ? <Line label="Heir" value={`${me.heir.name} · skill ${me.heir.skill} · age ${Math.max(0, yearOf(s.day) - me.heir.born)}`} /> : def.gov === 'monarchy' ? <Line label="Heir" value="none: a death now means a succession crisis" tone="bad" /> : null}
      </Card>
      <Section title={`National trait: ${traits[0]?.name}`}>
        <T v="small">{traits[0]?.desc}</T>
        {modLines(traits[0]?.mods ?? {}).map(m => (
          <Text key={m.text} style={{ fontFamily: sans, fontSize: 13, color: m.good ? C.green : C.red }}>
            {m.text}
          </Text>
        ))}
      </Section>
      <Section title="Treasury">
        <Line label="Gold" value={fmt(me.gold)} />
        <Line label="Monthly balance" value={signed(l.balance, 1)} tone={l.balance >= 0 ? 'good' : 'bad'} />
        <Line label="Loans" value={`${me.loans}`} tone={me.loans ? 'bad' : undefined} />
        <Row gap={6} style={{ marginTop: 6 }}>
          <Btn small style={{ flex: 1 }} tone="secondary" label="Borrow 100" onPress={() => st.run(takeLoan)} />
          <Btn small style={{ flex: 1 }} tone="secondary" label="Repay 100" disabled={!me.loans} onPress={() => st.run(repayLoan)} />
          <Btn small style={{ flex: 1 }} tone="secondary" label="Details" onPress={() => st.open({ kind: 'breakdown', what: 'gold' })} />
        </Row>
      </Section>
      <Section title="Stability">
        <Line label="Stability" value={signed(me.stability)} tone={me.stability < 0 ? 'bad' : undefined} />
        <Btn small tone="secondary" style={{ marginTop: 6 }} disabled={me.stability >= 3} label={me.stability >= 3 ? 'At its peak' : `Raise stability (${stabilityCost(s, p)} gold)`} onPress={() => st.run(boostStability)} />
      </Section>
      <Section title="Era">
        <Line label="Adopted" value={`${me.era}. ${ERA(me.era).name}`} />
        {nextEra ? (
          avail > me.era ? (
            <>
              <T v="small">The {nextEra.name} has begun: {nextEra.inf.name}, {nextEra.cav.name}{nextEra.art ? `, ${nextEra.art.name}` : ''}, better morale and a new policy slot. Armies stay weaker until you pay for it.</T>
              <Btn style={{ marginTop: 6 }} label={`Adopt the ${nextEra.name} (${techCost(s, p, me.era + 1)} gold)`} disabled={me.gold < techCost(s, p, me.era + 1)} onPress={() => st.run(adoptEra)} />
            </>
          ) : (
            <T v="small">Next: the {nextEra.name}, from {nextEra.start}.</T>
          )
        ) : (
          <T v="small">You live in the final era.</T>
        )}
      </Section>
      <Section title={`Policies (${me.policies.length}/${me.era})`}>
        {me.policies.map(id => (
          <View key={id} style={styles.policy}>
            <Text style={styles.rowTitle}>{POLICY[id].name}</Text>
            <Text style={styles.rowSub}>{modLines(POLICY[id].mods).map(m => m.text).join(', ')}</Text>
          </View>
        ))}
        <T v="tiny" style={{ marginBottom: 6 }}>One policy per era. You may swap one per era for −1 stability.</T>
        {POLICIES.filter(pol => !me.policies.includes(pol.id)).map(pol => {
          const locked = pol.era > me.era;
          const slotFree = me.policies.length < me.era;
          return (
            <View key={pol.id} style={[styles.policy, { opacity: locked ? 0.5 : 1 }]}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={styles.rowTitle}>{pol.name}</Text>
                {locked ? <Pill text={`Era ${pol.era}`} /> : null}
              </Row>
              <Text style={styles.rowSub}>{pol.desc}</Text>
              <Text style={[styles.rowSub, { color: C.inkSoft }]}>{modLines(pol.mods).map(m => m.text).join(', ')}</Text>
              {!locked ? (
                slotFree ? (
                  <Btn small style={{ marginTop: 6 }} label="Adopt" onPress={() => st.run(x => choosePolicy(x, pol.id))} />
                ) : policyPick === pol.id ? (
                  <Row gap={6} style={{ marginTop: 6, flexWrap: 'wrap' }}>
                    {me.policies.map(old => (
                      <Btn key={old} small tone="secondary" label={`Replace ${POLICY[old].name}`} onPress={() => (st.run(x => choosePolicy(x, pol.id, old)), setPolicyPick(null))} />
                    ))}
                  </Row>
                ) : (
                  <Btn small tone="ghost" style={{ marginTop: 6 }} label="Swap in…" disabled={me.policySwappedEra === me.era} onPress={() => setPolicyPick(pol.id)} />
                )
              ) : null}
            </View>
          );
        })}
      </Section>
      <Section title="Faith">
        <Line label="State faith" value={me.faith[0].toUpperCase() + me.faith.slice(1)} />
        {me.faith === 'catholic' ? <Line label="Papal Favor" value={`${Math.floor(me.papalFavor)}/100`} /> : null}
        {me.faith === 'catholic' ? <T v="tiny">Spend Papal Favor from a nation’s sheet (excommunication) or a region’s sheet (a claim on heretics’ land).</T> : null}
      </Section>
      <Section title="All modifiers" right={<Btn small tone="ghost" label={showMods ? 'Hide' : 'Show'} onPress={() => setShowMods(v => !v)} />}>
        {showMods ? <ModifiersList nation={p} /> : <T v="tiny">Traits, policies and events that change your numbers.</T>}
      </Section>
    </View>
  );
}

// ---------------------------------------------------------------- missions

function Missions() {
  const st = useStore();
  const s = st.state!;
  const list = missionsFor(s.player);
  if (!list.length) return <Empty text="No missions." />;
  const order = { ready: 0, active: 1, locked: 2, done: 3 };
  const sorted = [...list].sort((a, b) => order[missionState(s, s.player, a)] - order[missionState(s, s.player, b)]);
  return (
    <View style={{ gap: 8 }}>
      <T v="small">Concrete goals for your nation. Finish one to unlock the next in its branch.</T>
      {sorted.map(m => {
        const state = missionState(s, s.player, m);
        const parts = goalParts(m.goal);
        return (
          <Card key={m.id} style={[state === 'ready' && { borderColor: C.gold, borderWidth: 2 }, state === 'locked' && { opacity: 0.55 }, state === 'done' && { opacity: 0.7 }]}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="h3" style={{ flex: 1 }}>
                {m.title}
              </T>
              <Pill text={state === 'done' ? 'Done' : state === 'ready' ? 'Ready!' : state === 'active' ? 'In progress' : 'Locked'} color={state === 'ready' ? C.gold : state === 'done' ? C.greenSoft : C.parchment2} />
            </Row>
            <T v="small" style={{ marginTop: 4 }}>{m.desc}</T>
            {state !== 'done' ? (
              <View style={{ marginTop: 6 }}>
                {parts.map((c, i) => {
                  const ok = evalCondition(s, s.player, c);
                  return (
                    <Row key={i} gap={6}>
                      <Icon name={ok ? 'check' : 'target'} size={14} color={ok ? C.green : C.muted} />
                      <Text style={{ fontFamily: sans, fontSize: 13, color: ok ? C.green : C.inkSoft, flex: 1 }}>{conditionText(c)}</Text>
                    </Row>
                  );
                })}
              </View>
            ) : null}
            {state === 'locked' && m.requires.length ? <T v="tiny" style={{ marginTop: 4 }}>After: {m.requires.map(r => list.find(x => x.id === r)?.title ?? r).join(', ')}</T> : null}
            <View style={{ marginTop: 6 }}>
              {effectsLines(m.reward).map((l, i) => (
                <Text key={i} style={{ fontFamily: sans, fontSize: 12, color: C.goldDark, fontWeight: '600' }}>
                  Reward: {l.text}
                </Text>
              ))}
            </View>
            {state === 'ready' ? <Btn style={{ marginTop: 8 }} tone="gold" label="Complete" onPress={() => st.run(x => playerCompleteMission(x, m.id))} /> : null}
          </Card>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- ledger

function Ledger() {
  const st = useStore();
  const s = st.state!;
  const [sort, setSort] = useState<'dev' | 'army' | 'income'>('dev');
  const rows = aliveNations(s)
    .map(n => ({ id: n.id, dev: totalDev(s, n.id), army: militaryPower(s, n.id), income: n.lastMonthIncome, regions: ownedRegions(s, n.id).length }))
    .sort((a, b) => b[sort] - a[sort])
    .slice(0, 25);
  const max = Math.max(...rows.map(r => r[sort]), 1);
  return (
    <View>
      <Row gap={6} style={{ marginBottom: 8 }}>
        <Btn small style={{ flex: 1 }} tone={sort === 'dev' ? 'primary' : 'secondary'} label="Development" onPress={() => setSort('dev')} />
        <Btn small style={{ flex: 1 }} tone={sort === 'army' ? 'primary' : 'secondary'} label="Army" onPress={() => setSort('army')} />
        <Btn small style={{ flex: 1 }} tone={sort === 'income' ? 'primary' : 'secondary'} label="Income" onPress={() => setSort('income')} />
      </Row>
      {rows.map((r, i) => (
        <Pressable key={r.id} onPress={() => (st.close(), st.select({ kind: 'nation', id: r.id }))} style={[styles.row, r.id === s.player && { backgroundColor: '#f6e7bf' }]}>
          <Text style={[styles.rowNum, { width: 22 }]}>{i + 1}</Text>
          <Flag nation={r.id} size={24} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{nationName(r.id)}</Text>
            <Bar value={r[sort] / max} color={NATION[r.id].color} />
          </View>
          <View style={{ alignItems: 'flex-end', minWidth: 70 }}>
            <Text style={styles.rowNum}>{sort === 'income' ? `${fmt(r.income, 1)}/mo` : sort === 'army' ? fmt(r.army) : `${r.dev} dev`}</Text>
            <Text style={styles.rowSub}>{r.regions} regions</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- settings

const PAUSE_LABEL: Record<PauseReason, string> = {
  warDeclaredOnYou: 'War declared on you',
  battleStarted: 'A battle starts',
  event: 'An event happens',
  siegeWon: 'A fortress falls',
  armyArrived: 'Your army arrives',
  peaceOffer: 'Peace offers',
  offer: 'Offers from other rulers',
  gameOver: 'Game over',
};

function Settings() {
  const st = useStore();
  const s = st.state!;
  const save = async (slot: SlotId) => {
    try {
      await saveGame(slot, s);
      st.toast(slot === 'auto' ? 'Autosaved.' : `Saved to slot ${slot}.`, 'good');
    } catch {
      st.toast('Could not save on this device.', 'bad');
    }
  };
  return (
    <View>
      <Section title="Save">
        {s.settings.ironman ? (
          <T v="small">Ironman: the game saves itself every year and when you leave. No reloading.</T>
        ) : (
          <Row gap={6}>
            {(['1', '2', '3'] as SlotId[]).map(slot => (
              <Btn key={slot} small style={{ flex: 1 }} tone="secondary" label={`Slot ${slot}`} onPress={() => save(slot)} />
            ))}
          </Row>
        )}
        <T v="tiny" style={{ marginTop: 4 }}>The game also autosaves every 1 January.</T>
      </Section>
      <Section title="Pause automatically when…">
        {(Object.keys(PAUSE_LABEL) as PauseReason[])
          .filter(k => k !== 'gameOver')
          .map(k => (
            <Row key={k} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
              <T v="small">{PAUSE_LABEL[k]}</T>
              <Switch
                value={s.settings.autoPause[k]}
                onValueChange={v => {
                  s.settings.autoPause[k] = v;
                  st.emit();
                }}
                trackColor={{ true: C.gold, false: C.parchmentLine }}
              />
            </Row>
          ))}
      </Section>
      <Section title="Help">
        <Btn tone="secondary" icon="book" label="How to play" onPress={() => st.open({ kind: 'help' })} />
      </Section>
      <Section title="Leave">
        <Btn
          tone="danger"
          label="Save and quit to title"
          onPress={async () => {
            await saveGame('auto', s).catch(() => {});
            st.unload();
            router.replace('/');
          }}
        />
      </Section>
      <T v="tiny" style={{ marginTop: 16 }}>
        Crowns of Europe · {s.settings.difficulty} difficulty{s.settings.ironman ? ' · ironman' : ''}. Map data © Natural Earth (public domain). History, nations and rulers are public domain.
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.parchmentLine },
  rowTitle: { fontFamily: sans, fontSize: 15, fontWeight: '700', color: C.ink },
  rowSub: { fontFamily: sans, fontSize: 12, color: C.muted, marginTop: 1 },
  rowNum: { fontFamily: sans, fontSize: 14, fontWeight: '800', color: C.ink, fontVariant: ['tabular-nums'] },
  policy: { backgroundColor: C.parchment2, borderRadius: 10, padding: 10, marginBottom: 6 },
});

