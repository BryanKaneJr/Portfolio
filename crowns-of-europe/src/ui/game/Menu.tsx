/** The realm menu: Military, Diplomacy, Realm, Science, Colonies, Missions, Ledger and Settings (one tap from the map). */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ADVANCE, ERA, NATION, POLICIES, POLICY, TRAITS, displayOf, nationName, regionName } from '../../sim/content';
import { choosePolicy, GENERAL_COST, hireGeneral, repayLoan, boostStability, playerCompleteMission } from '../../sim/commands';
import { ledger, stabilityCost } from '../../sim/economy';
import { availableAdvances, policySlots } from '../../sim/science';
import { etaDays } from '../../sim/military';
import { missionState, missionsFor } from '../../sim/missions';
import { evalCondition } from '../../sim/events';
import {
  aliveNations,
  allied,
  armiesOf,
  armyMen,
  armyRegs,
  fleetsOf,
  forceLimit,
  militaryPower,
  nationMods,
  neighborsOf,
  ownedRegions,
  rulerAge,
  totalDev,
  totalRegiments,
  warsOf,
} from '../../sim/queries';
import { isHreMember, opinion } from '../../sim/diplomacy';
import { diplomaticTies, type Ties } from '../../sim/ties';
import { scoreFor } from '../../sim/war';
import { hreMembers } from '../../sim/religion';
import { shipCount } from '../../sim/navy';
import type { CasusBelli, PauseReason } from '../../sim/types';
import { formatShortDate, yearOf } from '../../sim/util';
import { store, useStore, type MenuTab } from '../../state/store';
import { ColoniesTab, idleColonists } from './ColonySheets';
import { GeneralRow } from './UnitSheets';
import { GLYPH_CREDIT } from '../components/gameIcons';
import { STAR_BONUS } from '../../sim/rulers';
import { ScienceTab } from './Science';
import { colonialCrown } from '../../sim/colonies';
import { saveGame, type SlotId } from '../../state/storage';
import { Flag, Shield } from '../components/Flag';
import { Icon } from '../components/Icon';
import { Bar, Btn, Card, Empty, IconBtn, Line, Pill, Row, Section, Stat, T, Tabs } from '../components/kit';
import { C, fmt, kmen, sans, signed } from '../theme';
import { conditionText, effectsLines, goalParts, modLines } from '../describe';
import { regionPoint } from '../map/geometry';
import { MAP_STYLES, MAP_STYLE_LIST } from '../map/styles';
import { ModifiersList, Panel } from './Panels';
import { CrownsSection } from './Crowns';

export function MenuPanel({ tab }: { tab: MenuTab }) {
  const st = useStore();
  const s = st.state!;
  const missionsReady = missionsFor(s.player).filter(m => missionState(s, s.player, m) === 'ready').length;
  const p = s.player;
  // Colonies only matter to crowns that can settle somewhere, or already do.
  const colonial = colonialCrown(s, p);
  const tabs: { key: MenuTab; label: string; badge?: number }[] = [
    { key: 'military', label: 'Army' },
    { key: 'diplomacy', label: 'Diplomacy' },
    { key: 'economy', label: 'Realm' },
    { key: 'science', label: 'Science', badge: !s.nations[p].researching && availableAdvances(s, p).length ? 1 : 0 },
    ...(colonial || tab === 'colonies' ? [{ key: 'colonies' as MenuTab, label: 'Colonies', badge: idleColonists(s, p) }] : []),
    { key: 'missions', label: 'Missions', badge: missionsReady },
  ];
  return (
    <Panel
      title={nationName(p)}
      onClose={() => st.close()}
      right={
        <Row gap={8}>
          <IconBtn name="gear" label="Settings" onPress={() => st.open({ kind: 'menu', tab: 'settings' })} />
          <Shield nation={p} size={26} />
        </Row>
      }
    >
      <View style={{ marginHorizontal: -16, marginTop: -8, marginBottom: 6 }}>
        <Tabs tabs={tabs} value={tab} onChange={t => st.open({ kind: 'menu', tab: t })} />
      </View>
      {tab === 'military' ? <Military /> : null}
      {tab === 'diplomacy' ? <Diplomacy /> : null}
      {tab === 'economy' ? <Realm /> : null}
      {tab === 'science' ? <ScienceTab /> : null}
      {tab === 'colonies' ? <ColoniesTab /> : null}
      {tab === 'missions' ? <Missions /> : null}
      {tab === 'ledger' ? <Ledger /> : null}
      {tab === 'settings' ? (
        <View>
          <T v="h2" style={{ marginBottom: 4 }}>Settings</T>
          <Settings />
        </View>
      ) : null}
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
  const flMod = nationMods(s, s.player).forceLimit;
  return (
    <View>
      <Row gap={6}>
        <Stat label="Regiments" value={`${regs} / ${fl}`} tone={regs > fl ? 'bad' : undefined} icon="flag" />
        <Stat label="Levies" value={kmen(me.manpower)} icon="manpower" />
        <Stat label="Training" value={`${me.recruiting.length}`} icon="castle" />
      </Row>
      <Section
        title={`Armies (${armies.length})`}
        help={`Your army limit (${fl}) comes from your prosperity${flMod ? `, ${signed(Math.round(flMod * 100))}% from traits and modifiers` : ''}; above it every regiment costs more upkeep. In wartime troops get full pay and refill faster; in peace, half pay.`}
      >
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
      <Section
        title="Generals"
        help={`Each star adds ${Math.round(STAR_BONUS * 100)}% to everything the army a general leads does. Assign one from the army’s sheet.`}
        right={<Btn small tone="secondary" label={`Hire (${GENERAL_COST}g)`} onPress={() => st.run(hireGeneral)} />}
      >
        {me.generals.length ? me.generals.map(g => <GeneralRow key={g.id} name={g.name} stars={g.stars} />) : <Empty text="None waiting for a command" />}
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
  const wars = warsOf(s, p);
  // Recomputed on every new day and every command (the store's version), as the state changes in place.
  const version = st.getVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ties = useMemo(() => diplomaticTies(s, p), [version, p]);
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
      <DangerSection t={ties} />
      <ClaimsSection t={ties} />
      <TiesSection t={ties} />
      {isHreMember(s, p) || s.hre.emperor === p ? (
        <Section title="Holy Roman Empire" help="The Emperor gains levies and renown, and defends member states from outsiders. Electors choose a new Emperor when the old one dies.">
          <Line label="Emperor" value={s.hre.emperor ? nationName(s.hre.emperor) : 'vacant'} />
          <Line label="Electors" value={s.hre.electors.map(nationName).join(', ')} />
          <Line label="Members" value={`${hreMembers(s).length}`} />
        </Section>
      ) : null}
      <Section
        title="Other nations"
        help="Neighbours: the realms whose land borders yours, by land or across a strait, and your allies and subjects wherever they are. All: every realm."
        right={
          <Row gap={4}>
            <Btn small tone={filter === 'neighbors' ? 'primary' : 'secondary'} label="Neighbours" onPress={() => setFilter('neighbors')} />
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
                {regionCount(ownedRegions(s, n.id).length)}
              </Text>
            </View>
            <Text style={[styles.rowNum, { color: n.op >= 0 ? C.green : C.red }]}>{signed(Math.round(n.op))}</Text>
          </Pressable>
        ))}
      </Section>
      <Section title="Great powers">
        <Ledger />
      </Section>
    </View>
  );
}

/** Close the menu and open a crown's sheet. */
function openNation(id: string) {
  store.close();
  store.select({ kind: 'nation', id });
}
/** Close the menu and centre the map on a region (its sheet opens). */
function openRegion(id: string) {
  store.close();
  store.select({ kind: 'region', id });
  store.focusOn(...regionPoint(id));
}

/** A crown as a small tappable chip: its flag, its name and a short note (a year, a bond). */
function NationChip({ id, note }: { id: string; note?: string }) {
  return (
    <Pressable onPress={() => openNation(id)} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={note ? `${nationName(id)}, ${note}` : nationName(id)}>
      <Flag nation={id} size={16} />
      <Text style={styles.chipText} numberOfLines={1}>
        {nationName(id)}
        {note ? <Text style={styles.chipNote}> · {note}</Text> : null}
      </Text>
    </Pressable>
  );
}

function ChipGroup({ label, items }: { label: string; items: { id: string; note?: string }[] }) {
  if (!items.length) return null;
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={styles.blockLabel}>{label}</Text>
      <View style={styles.chips}>
        {items.map(x => (
          <NationChip key={x.id} id={x.id} note={x.note} />
        ))}
      </View>
    </View>
  );
}

const to = (day: number) => `to ${yearOf(day)}`;
const regionCount = (k: number) => `${k} ${k === 1 ? 'region' : 'regions'}`;
const kind = (id: string) => (store.state!.nations[id]?.subjectType === 'union' ? 'union' : 'vassal');

/** The other members of your coalition, as a chip note ("with Aragon"). */
const withOthers = (members: string[]) => {
  const others = members.filter(m => m !== store.state!.player);
  return others.length ? `with ${others.map(nationName).join(', ')}` : undefined;
};

/** Overlord, allies, subjects, marriages, military access, truces, rivals and old bonds. */
function TiesSection({ t }: { t: Ties }) {
  const groups = [
    { label: 'Overlord', items: t.overlord ? [{ id: t.overlord.nation, note: t.overlord.union ? 'personal union' : undefined }] : [] },
    { label: 'Allies', items: t.allies.map(id => ({ id })) },
    { label: 'Subjects', items: t.subjects.map(id => ({ id, note: kind(id) })) },
    { label: 'Royal marriages', items: t.marriages.map(id => ({ id })) },
    { label: 'Let you through', items: t.accessYouHave.map(a => ({ id: a.nation, note: to(a.until) })) },
    { label: 'You let through', items: t.accessYouGive.map(a => ({ id: a.nation, note: to(a.until) })) },
    { label: 'Truces', items: t.truces.map(x => ({ id: x.nation, note: to(x.until) })) },
    { label: 'Your rivals', items: t.rivalsYouNamed.map(id => ({ id })) },
    { label: 'Rivals you', items: t.rivalsOfYou.map(id => ({ id })) },
    { label: 'Old friends', items: t.oldFriends.map(b => ({ id: b.nation, note: b.label })) },
    { label: 'Old foes', items: t.oldFoes.map(b => ({ id: b.nation, note: b.label })) },
    { label: 'In coalition against', items: t.coalitionIn ? [{ id: t.coalitionIn.target, note: withOthers(t.coalitionIn.members) }] : [] },
  ];
  if (!groups.some(g => g.items.length)) return null;
  return (
    <Section
      title="Ties"
      help="Tap a crown for its sheet. Military access lets armies cross the other’s land, for ten years. A truce bars war until the year shown; breaking it costs order, renown and much Threat, and no ally will join you. Old friends and old foes like or dislike each other from history."
    >
      {groups.map(g => (
        <ChipGroup key={g.label} label={g.label} items={g.items} />
      ))}
    </Section>
  );
}

/** Whose land it is when a subject holds it: "your vassal", or "Serbia, your vassal" when the names differ. */
const subjectNote = (region: string, holder: string) => {
  const rel = kind(holder) === 'union' ? 'in union with you' : 'your vassal';
  return regionName(region) === nationName(holder) ? rel : `${nationName(holder)}, ${rel}`;
};

/** Your claims, the claims on your land, and the claim your clerks are forging. */
function ClaimsSection({ t }: { t: Ties }) {
  const s = store.state!;
  if (!t.yourClaims.length && !t.claimsOnYou.length && !t.forging) return null;
  const year = (until: number) =>
    until >= 0 ? (
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.rowNum}>{yearOf(until)}</Text>
        <Text style={styles.rowSub}>lapses</Text>
      </View>
    ) : null;
  return (
    <Section title="Claims" help="A claim is a reason for war on whoever holds the land, until it lapses. One on a subject’s land is a reason for war on its overlord. Forge one from a region’s sheet.">
      {t.yourClaims.length || t.forging ? <Text style={styles.blockLabel}>Yours</Text> : null}
      {t.yourClaims.map(c => (
        <Pressable key={c.region} onPress={() => openRegion(c.region)} style={styles.row} accessibilityRole="button">
          {c.holder ? <Flag nation={c.holder} size={22} /> : <Icon name="scroll" size={18} color={C.muted} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{regionName(c.region)}</Text>
            <Text style={styles.rowSub} numberOfLines={2}>
              {c.holder ? `Held by ${nationName(c.holder)}` : 'Uncolonized'}
              {c.why ? ` · ${c.why}` : ''}
            </Text>
          </View>
          {year(c.until)}
        </Pressable>
      ))}
      {t.forging ? (
        <Pressable onPress={() => openRegion(t.forging!.region)} style={styles.row} accessibilityRole="button">
          <Icon name="scroll" size={18} color={C.gold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{regionName(t.forging.region)}</Text>
            <Text style={styles.rowSub}>Being forged{t.forging.holder ? ` · held by ${nationName(t.forging.holder)}` : ''}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.rowNum}>{formatShortDate(t.forging.done)}</Text>
            <Text style={styles.rowSub}>ready</Text>
          </View>
        </Pressable>
      ) : null}
      {t.claimsOnYou.length ? <Text style={[styles.blockLabel, t.yourClaims.length || t.forging ? { marginTop: 10 } : null]}>On your land</Text> : null}
      {t.claimsOnYou.map(c => (
        <Pressable key={`${c.by}:${c.region}`} onPress={() => openNation(c.by)} style={styles.row} accessibilityRole="button">
          <Flag nation={c.by} size={22} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>
              {regionName(c.region)}
              {c.holder && c.holder !== s.player ? <Text style={styles.rowSub}> · {subjectNote(c.region, c.holder)}</Text> : null}
            </Text>
            <Text style={styles.rowSub} numberOfLines={2}>
              By {nationName(c.by)}
              {c.why ? ` · ${c.why}` : ''}
            </Text>
          </View>
          {year(c.until)}
        </Pressable>
      ))}
    </Section>
  );
}

/** Crowns that could attack you this month, or wait out a truce to, and a coalition against you. */
/** Why a neighbour could attack you, in a few words. */
const THREAT_WHY: Record<CasusBelli, string> = {
  claim: 'Claims on you',
  reconquest: 'Lost land',
  holy: 'Holy war',
  rival: 'Rival',
  coalition: 'Coalition',
  independence: 'Independence',
  none: 'Wants your land',
};

function DangerSection({ t }: { t: Ties }) {
  if (!t.couldAttack.length && !t.coalitionAgainst) return null;
  return (
    <Section
      title="Danger"
      help="Neighbours that could go to war on you, and why. One with a claim on your land that is waiting out a truce with you, or resting from its last war, shows the year that ends. Tap one for its chance of war and what makes it up. A coalition joins any war you start on a member, and may attack you."
    >
      {t.coalitionAgainst ? (
        <Card style={{ borderColor: C.red, borderWidth: 1, marginBottom: 6 }}>
          <T v="h3">A coalition stands against you</T>
          <View style={[styles.chips, { marginTop: 6 }]}>
            {t.coalitionAgainst.members.map(id => (
              <NationChip key={id} id={id} />
            ))}
          </View>
        </Card>
      ) : null}
      {t.couldAttack.map(x => (
        <Pressable key={x.nation} onPress={() => openNation(x.nation)} style={styles.row} accessibilityRole="button">
          <Flag nation={x.nation} size={22} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{nationName(x.nation)}</Text>
            <Text style={styles.rowSub}>
              {x.waitingUntil !== undefined ? `Waiting out a truce to ${yearOf(x.waitingUntil)}` : x.restingUntil !== undefined ? `Resting to ${yearOf(x.restingUntil)}` : 'Could attack'}
            </Text>
          </View>
          <Text style={[styles.dangerWhy, { color: C.red }]}>{THREAT_WHY[x.reason]}</Text>
        </Pressable>
      ))}
    </Section>
  );
}

// ---------------------------------------------------------------- realm (economy, ruler, science summary, policies)

function Realm() {
  const st = useStore();
  const s = st.state!;
  const p = s.player;
  const me = s.nations[p];
  const def = NATION[p];
  const l = ledger(s, p);
  const slots = policySlots(me);
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
              {def.gov === 'monarchy' ? 'Ruler' : def.gov === 'republic' ? 'Head of the republic' : 'Spiritual ruler'} · age {rulerAge(s, p)}
              {me.ruler.regency ? ' · under a regency' : ''}
            </T>
          </View>
        </Row>
        <Row gap={6} style={{ marginTop: 6, flexWrap: 'wrap' }}>
          {me.ruler.traits.map(t => (
            <Pill key={t} text={TRAITS.ruler[t]?.name ?? t} />
          ))}
        </Row>
        <Line label="Skill" value={`${me.ruler.skill} / 5`} help="Above 3, each point raises taxes 5%; below 3, each lowers them. Rulers age and die, and the heir takes over; with no heir, a death means a succession crisis." />
        {me.heir ? <Line label="Heir" value={`${me.heir.name} · skill ${me.heir.skill} · age ${Math.max(0, yearOf(s.day) - me.heir.born)}`} /> : def.gov === 'monarchy' ? <Line label="Heir" value="none" tone="bad" /> : null}
      </Card>
      <CrownsSection />
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
          <Btn small style={{ flex: 1 }} tone="secondary" label="Repay 100" disabled={!me.loans} onPress={() => st.run(repayLoan)} />
          <Btn small style={{ flex: 1 }} tone="secondary" label="Details" onPress={() => st.open({ kind: 'breakdown', what: 'gold' })} />
        </Row>
      </Section>
      <Section title="Order and renown">
        <Line label="Order" value={`${signed(me.stability)} / 3`} tone={me.stability < 0 ? 'bad' : undefined} onPress={() => st.open({ kind: 'breakdown', what: 'stability' })} />
        <Line label="Renown" value={`${fmt(me.prestige)} / 100`} onPress={() => st.open({ kind: 'breakdown', what: 'prestige' })} />
        <Btn small tone="secondary" style={{ marginTop: 6 }} disabled={me.stability >= 3} label={me.stability >= 3 ? 'At its peak' : `Raise order (${stabilityCost(s, p)} gold)`} onPress={() => st.run(boostStability)} />
      </Section>
      <Section title={`Policies (${me.policies.length}/${slots})`} help="One slot, and one more for every three advances. Swapping one out costs 1 order (once per slot).">
        {me.policies.map(id => (
          <View key={id} style={styles.policy}>
            <Text style={styles.rowTitle}>{POLICY[id].name}</Text>
            <Text style={styles.rowSub}>{modLines(POLICY[id].mods).map(m => m.text).join(', ')}</Text>
          </View>
        ))}
        {POLICIES.filter(pol => !me.policies.includes(pol.id) && (!pol.requires || me.advances.includes(pol.requires))).map(pol => {
          const slotFree = me.policies.length < slots;
          return (
            <View key={pol.id} style={styles.policy}>
              <Text style={styles.rowTitle}>{pol.name}</Text>
              <Text style={styles.rowSub}>{pol.desc}</Text>
              <Text style={[styles.rowSub, { color: C.inkSoft }]}>{modLines(pol.mods).map(m => m.text).join(', ')}</Text>
              {slotFree ? (
                  <Btn small style={{ marginTop: 6 }} label="Adopt" onPress={() => st.run(x => choosePolicy(x, pol.id))} />
                ) : policyPick === pol.id ? (
                  <Row gap={6} style={{ marginTop: 6, flexWrap: 'wrap' }}>
                    {me.policies.map(old => (
                      <Btn key={old} small tone="secondary" label={`Replace ${POLICY[old].name}`} onPress={() => (st.run(x => choosePolicy(x, pol.id, old)), setPolicyPick(null))} />
                    ))}
                  </Row>
                ) : (
                  <Btn small tone="ghost" style={{ marginTop: 6 }} label="Swap in…" disabled={me.policySwappedEra === slots} onPress={() => setPolicyPick(pol.id)} />
                )}
            </View>
          );
        })}
        {POLICIES.some(pol => pol.requires && !me.advances.includes(pol.requires)) ? (
          <T v="tiny" style={{ marginTop: 4 }}>
            Later:{' '}
            {POLICIES.filter(pol => pol.requires && !me.advances.includes(pol.requires))
              .map(pol => `${pol.name} (needs ${ADVANCE[pol.requires!].name})`)
              .join(', ')}
            .
          </T>
        ) : null}
      </Section>
      <Section title="Faith" help={me.faith === 'catholic' ? 'Spend Papal Favor from a nation’s sheet (excommunicate its ruler) or a region’s sheet (a claim on heretics’ land).' : undefined}>
        <Line label="State faith" value={me.faith[0].toUpperCase() + me.faith.slice(1)} />
        {me.faith === 'catholic' ? <Line label="Papal Favor" value={`${Math.floor(me.papalFavor)}/100`} /> : null}
      </Section>
      <Section title="All modifiers" right={<Btn small tone="ghost" label={showMods ? 'Hide' : 'Show'} onPress={() => setShowMods(v => !v)} />}>
        {showMods ? <ModifiersList nation={p} /> : null}
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
      {sorted.map(m => {
        const state = missionState(s, s.player, m);
        const parts = goalParts(m.goal);
        return (
          <Card key={m.id} style={[state === 'ready' && { borderColor: C.gold, borderWidth: 2 }, state === 'locked' && { opacity: 0.55 }, state === 'done' && { opacity: 0.7 }]}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="h3" style={{ flex: 1 }}>
                {m.title}
              </T>
              <Pill text={state === 'done' ? 'Done' : state === 'ready' ? 'Ready!' : state === 'active' ? 'In progress' : 'Locked'} color={state === 'ready' ? C.gold : state === 'done' ? C.greenSoft : C.parchment2} textColor={state === 'ready' ? '#1a1408' : state === 'done' ? C.green : undefined} />
            </Row>
            <T v="small" style={{ marginTop: 4 }}>{m.desc}</T>
            {state !== 'done' ? (
              <View style={{ marginTop: 6 }}>
                <Text style={styles.blockLabel}>Goal</Text>
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
            <View style={styles.reward}>
              <Text style={styles.blockLabel}>Reward</Text>
              {effectsLines(m.reward, { s, n: s.player, version: st.version }).map((l, i) => (
                <Text key={i} style={{ fontFamily: sans, fontSize: 12, color: C.goldDark, fontWeight: '600' }}>
                  • {l.text}
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
        <Btn small style={{ flex: 1 }} tone={sort === 'dev' ? 'primary' : 'secondary'} label="Prosperity" onPress={() => setSort('dev')} />
        <Btn small style={{ flex: 1 }} tone={sort === 'army' ? 'primary' : 'secondary'} label="Army" onPress={() => setSort('army')} />
        <Btn small style={{ flex: 1 }} tone={sort === 'income' ? 'primary' : 'secondary'} label="Income" onPress={() => setSort('income')} />
      </Row>
      {rows.map((r, i) => (
        <Pressable key={r.id} onPress={() => (st.close(), st.select({ kind: 'nation', id: r.id }))} style={[styles.row, r.id === s.player && { backgroundColor: 'rgba(214,178,110,0.14)' }]}>
          <Text style={[styles.rowNum, { width: 22 }]}>{i + 1}</Text>
          <Flag nation={r.id} size={24} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{nationName(r.id)}</Text>
            <Bar value={r[sort] / max} color={displayOf(r.id).color} />
          </View>
          <View style={{ alignItems: 'flex-end', minWidth: 70 }}>
            <Text style={styles.rowNum}>{sort === 'income' ? `${fmt(r.income, 1)}/mo` : sort === 'army' ? fmt(r.army) : `${r.dev}`}</Text>
            <Text style={styles.rowSub}>{regionCount(r.regions)}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- settings

/** The pause settings, in the order shown: what needs a decision and the great turns first, then the notices. */
const PAUSE_LABEL: Record<PauseReason, string> = {
  event: 'An event needs your decision',
  warDeclaredOnYou: 'War is declared on you',
  ultimatum: 'An enemy sends you an ultimatum',
  allyAttacked: 'An ally is attacked and calls you to arms',
  peaceOffer: 'An enemy proposes peace',
  offer: 'An alliance, a call to join an attack or another proposal',
  battleStarted: 'A battle begins',
  siegeWon: 'A fortress falls',
  armyArrived: 'Your army arrives',
  gameOver: 'The campaign ends',
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
      <Section title="Save" help={s.settings.ironman ? 'Ironman: the game saves itself every year and when you leave, and there is no reloading.' : 'The game also saves itself every 1 January and when you leave.'}>
        {s.settings.ironman ? (
          <T v="small">Ironman: saved for you.</T>
        ) : (
          <Row gap={6}>
            {(['1', '2', '3'] as SlotId[]).map(slot => (
              <Btn key={slot} small style={{ flex: 1 }} tone="secondary" label={`Slot ${slot}`} onPress={() => save(slot)} />
            ))}
          </Row>
        )}
      </Section>
      <Section title="Map look" help={MAP_STYLE_LIST.map(ms => `${ms.label}: ${MAP_STYLES[ms.id].help}`).join('\n')}>
        <Row gap={6}>
          {MAP_STYLE_LIST.map(ms => (
            <Btn key={ms.id} small style={{ flex: 1 }} tone={ms.id === st.mapStyle ? 'primary' : 'secondary'} label={ms.label} onPress={() => st.setMapStyle(ms.id)} />
          ))}
        </Row>
      </Section>
      <Section title="Pause automatically when…" help="Switched off, it drops in as a notice instead while time runs on: tap the notice, or find it later under the bell. An event’s card still comes up, and the end of the campaign always stops the clock.">
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
      <Section
        title="About"
        help={`Map data © Natural Earth (public domain); relief from the Terrain Tiles on AWS Open Data (ETOPO1, GMTED2010, SRTM; public domain); land colours from the NASA Blue Marble (public domain). Illustrated terrain: elevation from NOAA ETOPO 2022 (public domain); land cover © ESA WorldCover project 2021 / contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium (CC BY 4.0); rivers and lakes from Natural Earth (public domain). Lettering: Cinzel and IM Fell English (SIL Open Font License). ${GLYPH_CREDIT} Towns rendered from 3D models by Kay Lousberg (KayKit, CC0). Troop, ship and mountain drawings made for the game. History, nations and rulers are public domain.`}
      >
        <T v="small">
          Crowns of Europe · {s.settings.difficulty} difficulty{s.settings.ironman ? ' · ironman' : ''}
        </T>
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.parchmentLine },
  rowTitle: { fontFamily: sans, fontSize: 15, fontWeight: '700', color: C.ink },
  rowSub: { fontFamily: sans, fontSize: 12, color: C.muted, marginTop: 1 },
  blockLabel: { fontFamily: sans, fontSize: 10, fontWeight: '800', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  reward: { marginTop: 8, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.parchmentLine },
  rowNum: { fontFamily: sans, fontSize: 14, fontWeight: '800', color: C.ink, fontVariant: ['tabular-nums'] },
  dangerWhy: { fontFamily: sans, fontSize: 13, fontWeight: '700', textAlign: 'right', maxWidth: 130 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%', paddingVertical: 5, paddingLeft: 6, paddingRight: 10, borderRadius: 999, backgroundColor: C.parchment2, borderWidth: StyleSheet.hairlineWidth, borderColor: C.parchmentLine },
  chipText: { flexShrink: 1, fontFamily: sans, fontSize: 13, fontWeight: '600', color: C.ink },
  chipNote: { fontWeight: '400', color: C.muted },
  policy: { backgroundColor: C.parchment2, borderRadius: 10, padding: 10, marginBottom: 6 },
});

