/** Full-height panels: resource breakdowns, declaring war, peace deals and the message log. */
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NATION, REGION, nationName, regionName } from '../../sim/content';
import { boostStability, playerDeclareWar, proposePeace, separatePeace } from '../../sim/commands';
import { ledger, maxManpower, manpowerRecovery, stabilityCost, taxMultiplier } from '../../sim/economy';
import { modifierSources, sideOf, subjectsOf, ownedRegions } from '../../sim/queries';
import { casusBelli, demandableRegions, likelySides, peaceAcceptance, peaceCost, regionPeaceCost, scoreFor, warScore } from '../../sim/war';
import { perceivedThreat, coalitionAgainst } from '../../sim/threat';
import type { PeaceTerms } from '../../sim/types';
import { formatShortDate } from '../../sim/util';
import { store, useStore } from '../../state/store';
import { Flag } from '../components/Flag';
import { Icon } from '../components/Icon';
import { Btn, Empty, Line, Row, Section, T } from '../components/kit';
import { C, fmt, sans, serif, signed } from '../theme';
import { modLines } from '../describe';
import { regionPoint } from '../map/geometry';

export function Panel({ title, children, onClose, footer, right }: { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.panel, { paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Pressable onPress={onClose} hitSlop={10} style={styles.back} accessibilityLabel="Close">
          <Icon name="close" size={20} color={C.chromeText} />
        </Pressable>
        <Text style={styles.headTitle} numberOfLines={1}>
          {title}
        </Text>
        {right ?? <View style={{ width: 36 }} />}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 30 }}>
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: 10 + insets.bottom }]}>{footer}</View> : null}
    </View>
  );
}

// ---------------------------------------------------------------- breakdowns

export function BreakdownPanel({ what }: { what: 'gold' | 'manpower' | 'stability' | 'prestige' | 'threat' }) {
  const st = useStore();
  const s = st.state!;
  const n = s.nations[s.player];
  const close = () => st.close();
  if (what === 'gold') {
    const l = ledger(s, s.player);
    return (
      <Panel title="Gold" onClose={close}>
        <T v="h2">{fmt(n.gold)} gold</T>
        <T v="small">Your treasury changes by {signed(l.balance, 1)} each month.</T>
        <Section title="Income per month">
          {l.income.map(i => (
            <Line key={i.label} label={i.label} value={fmt(i.value, 1)} tone="good" />
          ))}
          <Line label="Total" value={fmt(l.totalIncome, 1)} bold />
          <T v="tiny">Taxes = development × 0.3 per region, ×{taxMultiplier(s, s.player).toFixed(2)} from stability, your ruler and modifiers. Regions that aren’t cores pay half.</T>
        </Section>
        <Section title="Expenses per month">
          {l.expenses.map(i => (
            <Line key={i.label} label={i.label} value={fmt(i.value, 1)} tone="bad" />
          ))}
          <Line label="Total" value={fmt(l.totalExpenses, 1)} bold />
        </Section>
        <T v="small" style={{ marginTop: 10 }}>If gold runs out you borrow automatically (100 gold at 5% a year). More than 10 loans means bankruptcy.</T>
      </Panel>
    );
  }
  if (what === 'manpower') {
    return (
      <Panel title="Manpower" onClose={close}>
        <T v="h2">{fmt(n.manpower)} men</T>
        <Line label="Maximum" value={fmt(maxManpower(s, s.player))} />
        <Line label="Recovery per month" value={`+${fmt(manpowerRecovery(s, s.player))}`} tone="good" />
        <T v="small" style={{ marginTop: 8 }}>Each regiment needs 1,000 men to raise and draws on manpower to refill its losses. The maximum is 3,000 plus 400 per point of development (half for regions that aren’t cores). War exhaustion slows recovery. Mercenaries need no manpower.</T>
      </Panel>
    );
  }
  if (what === 'stability') {
    return (
      <Panel title="Stability" onClose={close}>
        <T v="h2">{signed(n.stability)}</T>
        <T v="small">Stability runs from −3 to +3. Each point changes tax income by 5% and unrest in every region by 0.75.</T>
        <Btn style={{ marginTop: 12 }} label={n.stability >= 3 ? 'Stability is at its peak' : `Raise stability (${stabilityCost(s, s.player)} gold)`} disabled={n.stability >= 3} onPress={() => st.run(boostStability)} />
        <T v="tiny" style={{ marginTop: 6 }}>Wars without a reason, breaking truces, succession crises and bankruptcy all lower stability.</T>
      </Panel>
    );
  }
  if (what === 'prestige') {
    return (
      <Panel title="Prestige" onClose={close}>
        <T v="h2">{fmt(n.prestige)} / 100</T>
        <T v="small">Prestige comes from winning battles and wars, missions and events, and fades by 1% a month. Every 5 prestige adds +1 to how others see you, and high prestige makes Threat fade faster.</T>
      </Panel>
    );
  }
  const watchers = Object.values(s.nations)
    .filter(o => o.alive && o.id !== s.player)
    .map(o => ({ id: o.id, t: perceivedThreat(s, o.id, s.player) }))
    .filter(x => x.t >= 5)
    .sort((a, b) => b.t - a.t)
    .slice(0, 12);
  const c = coalitionAgainst(s, s.player);
  return (
    <Panel title="Threat" onClose={close}>
      <T v="h2">{fmt(n.threat)}</T>
      <T v="small">Taking land raises your Threat (claimed land counts less). Nearby nations, and those of another faith, feel it most. When three or more feel 40+ Threat, they form a coalition that joins any war you start against a member, and may attack you. Threat fades slowly, faster with high prestige.</T>
      {c ? (
        <Section title="Coalition against you">
          {c.members.map(m => (
            <Line key={m} label={nationName(m)} value="member" tone="bad" />
          ))}
        </Section>
      ) : null}
      <Section title="Who feels threatened">{watchers.length ? watchers.map(w => <Line key={w.id} label={nationName(w.id)} value={fmt(w.t)} tone={w.t >= 40 ? 'bad' : undefined} />) : <Empty text="Nobody is worried about you." />}</Section>
    </Panel>
  );
}

export function ModifiersList({ nation }: { nation: string }) {
  const s = store.state!;
  const srcs = modifierSources(s, nation);
  return (
    <View>
      {srcs.map(src => (
        <View key={src.name} style={{ marginBottom: 6 }}>
          <T v="h3">{src.name}</T>
          {modLines(src.mods).map(l => (
            <Text key={l.text} style={{ fontFamily: sans, fontSize: 13, color: l.good ? C.green : C.red }}>
              {l.text}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- declare war

export function DeclareWarPanel({ target }: { target: string }) {
  const st = useStore();
  const s = st.state!;
  const cbs = casusBelli(s, s.player, target);
  const [pick, setPick] = useState(0);
  const sides = likelySides(s, s.player, target);
  const truce = (s.truces[[s.player, target].sort().join('|')] ?? -1) > s.day;
  return (
    <Panel
      title={`War on ${nationName(target)}`}
      onClose={() => st.close()}
      footer={
        <Btn
          tone="danger"
          icon="swords"
          label="Declare war"
          testID="declare-war"
          onPress={() => {
            const r = st.run(x => playerDeclareWar(x, target, pick));
            if (r.ok) st.close();
          }}
        />
      }
    >
      <Section title="Reason for war">
        <View style={{ gap: 6 }}>
          {cbs.map((c, i) => (
            <Pressable key={i} onPress={() => setPick(i)} style={[styles.option, pick === i && styles.optionOn]}>
              <Text style={styles.optionText}>{c.label}</Text>
              {c.goal ? <Text style={styles.optionSub}>War goal: {regionName(c.goal)}. Holding it adds war score every month.</Text> : null}
              {c.cb === 'none' ? <Text style={[styles.optionSub, { color: C.red }]}>−1 stability, +8 Threat, and everyone thinks less of you.</Text> : null}
              {c.cb === 'holy' ? <Text style={styles.optionSub}>A war of faith.</Text> : null}
            </Pressable>
          ))}
        </View>
      </Section>
      {truce ? <T v="small" style={{ color: C.red, marginTop: 8 }}>You have a truce with them. Breaking it costs 2 stability, 20 prestige and 10 Threat.</T> : null}
      <Section title="Likely to fight with you">
        {sides.attackers.map(n => (
          <Row key={n} style={{ marginBottom: 4 }}>
            <Flag nation={n} size={22} />
            <T v="small">{nationName(n)}</T>
          </Row>
        ))}
      </Section>
      <Section title="Likely to fight against you">
        {sides.defenders.map(n => (
          <Row key={n} style={{ marginBottom: 4 }}>
            <Flag nation={n} size={22} />
            <T v="small">{nationName(n)}</T>
          </Row>
        ))}
        <T v="tiny" style={{ marginTop: 4 }}>Their allies decide when called. Members of the Holy Roman Empire may get help from the Emperor.</T>
      </Section>
    </Panel>
  );
}

// ---------------------------------------------------------------- peace

export function PeacePanel({ warId }: { warId: string }) {
  const st = useStore();
  const s = st.state!;
  const w = s.wars[warId];
  const [regions, setRegions] = useState<string[]>([]);
  const [gold, setGold] = useState(0);
  const [vassalize, setVassalize] = useState(false);
  const [release, setRelease] = useState<string[]>([]);
  const [mode, setMode] = useState<'demand' | 'offer'>('demand');
  if (!w || sideOf(w, s.player) === null) {
    return (
      <Panel title="Peace" onClose={() => st.close()}>
        <T>This war is over.</T>
      </Panel>
    );
  }
  const side = sideOf(w, s.player)!;
  const leader = side === 0 ? w.attackers[0] : w.defenders[0];
  const enemy = side === 0 ? w.defenders[0] : w.attackers[0];
  const sc = scoreFor(s, w, s.player);
  const ws = warScore(s, w);
  const flip = side === 1 ? -1 : 1;
  const isLeader = leader === s.player;
  const winner = mode === 'demand' ? s.player : enemy;
  const loser = mode === 'demand' ? enemy : s.player;
  const candidates = demandableRegions(s, w, winner);
  const terms: PeaceTerms = { regions, gold, vassalize, release: mode === 'demand' ? release : [], winner, loser };
  const white: PeaceTerms = { regions: [], gold: 0, vassalize: false, release: [], white: true, winner: s.player, loser: enemy };
  const cost = peaceCost(s, terms);
  const answer = peaceAcceptance(s, w, terms, enemy);
  const whiteAnswer = peaceAcceptance(s, w, white, enemy);
  const toggle = (r: string) => setRegions(rs => (rs.includes(r) ? rs.filter(x => x !== r) : [...rs, r]));
  const canVassalize = mode === 'demand' && !s.nations[enemy].overlord && subjectsOf(s, enemy).length === 0;
  // Nations the enemy could be made to free: its subjects, and peoples with cores on its land.
  const releasable = mode === 'demand'
    ? [
        ...subjectsOf(s, enemy),
        ...Object.keys(NATION).filter(n => n !== enemy && n !== s.player && !s.nations[n]?.alive && ownedRegions(s, enemy).some(r => r.cores.includes(n))),
      ]
    : [];
  return (
    <Panel title={w.name} onClose={() => st.close()}>
      <View style={styles.score}>
        <Text style={styles.scoreLabel}>War score</Text>
        <Text style={[styles.scoreValue, { color: sc >= 0 ? C.green : C.red }]}>{signed(sc)}%</Text>
        <View style={{ width: '100%', marginTop: 6 }}>
          <Line label="Battles" value={signed(ws.battles * flip)} />
          <Line label="Occupation" value={signed(ws.occupation * flip)} />
          <Line label="War goal" value={`${signed(ws.goal * flip)}${w.goal ? ` (${regionName(w.goal)})` : ''}`} />
          <Line label="Blockades" value={signed(ws.blockade * flip)} />
        </View>
      </View>
      <Row style={{ marginTop: 8, flexWrap: 'wrap' }} gap={6}>
        <T v="small">Your side: {(side === 0 ? w.attackers : w.defenders).map(nationName).join(', ')}</T>
      </Row>
      <T v="small">Their side: {(side === 0 ? w.defenders : w.attackers).map(nationName).join(', ')}</T>
      {!isLeader ? (
        <Section title="You are not leading this war">
          <T v="small">{nationName(leader)} negotiates the peace. You can leave the war with a separate white peace.</T>
          <Btn style={{ marginTop: 8 }} tone="secondary" label="Make a separate peace" onPress={() => (st.run(x => separatePeace(x, w.id)), st.close())} />
        </Section>
      ) : (
        <>
          <Row style={{ marginTop: 12 }} gap={6}>
            <Btn small style={{ flex: 1 }} tone={mode === 'demand' ? 'primary' : 'secondary'} label="Demand" onPress={() => (setMode('demand'), setRegions([]), setGold(0), setVassalize(false), setRelease([]))} />
            <Btn small style={{ flex: 1 }} tone={mode === 'offer' ? 'primary' : 'secondary'} label="Offer concessions" onPress={() => (setMode('offer'), setRegions([]), setGold(0), setVassalize(false), setRelease([]))} />
          </Row>
          <Section title={mode === 'demand' ? 'Regions to take' : 'Regions to give up'}>
            {candidates.length ? (
              candidates.map(r => {
                const on = regions.includes(r);
                return (
                  <Pressable key={r} testID={`peace-${r}`} onPress={() => toggle(r)} style={[styles.option, on && styles.optionOn, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                    <Flag nation={s.regions[r].owner ?? ''} size={22} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionText}>{regionName(r)}</Text>
                      <Text style={styles.optionSub}>
                        Dev {s.regions[r].dev}
                        {r in s.nations[winner].claims || s.regions[r].cores.includes(winner) ? ' · claimed' : ''}
                        {s.regions[r].controller === winner ? ' · occupied' : ''}
                      </Text>
                    </View>
                    <Text style={styles.cost}>{regionPeaceCost(s, winner, r)}%</Text>
                  </Pressable>
                );
              })
            ) : (
              <Empty text={mode === 'demand' ? 'Occupy enemy regions (or have claims) to demand them.' : 'You have no regions they could take.'} />
            )}
          </Section>
          <Section title={mode === 'demand' ? 'Gold reparations' : 'Pay gold'}>
            <Row gap={6}>
              {[0, 50, 100, 200, 400].map(g => (
                <Btn key={g} small style={{ flex: 1 }} tone={gold === g ? 'primary' : 'secondary'} label={g ? `${g}` : 'None'} onPress={() => setGold(g)} />
              ))}
            </Row>
            <T v="tiny" style={{ marginTop: 4 }}>Every 10 gold costs 1% war score.</T>
          </Section>
          {releasable.length ? (
            <Section title="Free a nation">
              {releasable.map(n => {
                const on = release.includes(n);
                return (
                  <Pressable key={n} onPress={() => setRelease(rs => (on ? rs.filter(x => x !== n) : [...rs, n]))} style={[styles.option, on && styles.optionOn, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                    <Flag nation={n} size={22} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionText}>{nationName(n)}</Text>
                      <Text style={styles.optionSub}>{s.nations[n]?.alive ? 'Becomes independent' : 'Restored on its old lands'}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </Section>
          ) : null}
          {canVassalize ? (
            <Pressable onPress={() => setVassalize(v => !v)} style={[styles.option, vassalize && styles.optionOn, { marginTop: 10 }]}>
              <Text style={styles.optionText}>Make {nationName(enemy)} your vassal</Text>
              <Text style={styles.optionSub}>They pay tribute and fight your wars. Can be annexed after 15 years.</Text>
            </Pressable>
          ) : null}
          <View style={styles.summary}>
            <Line label="Value of these terms" value={`${cost}%`} bold />
            <Line label={mode === 'demand' ? 'Your war score' : 'Their war score'} value={`${mode === 'demand' ? sc : -sc}%`} />
            <T v="small" style={{ marginTop: 6, color: answer.accept ? C.green : C.red }}>{answer.accept ? `${nationName(enemy)} would accept.` : `${nationName(enemy)} would refuse.`}</T>
          </View>
          <Btn style={{ marginTop: 10 }} label="Send peace offer" disabled={!regions.length && !gold && !vassalize && !release.length} onPress={() => {
            const r = st.run(x => proposePeace(x, w.id, terms));
            if (r.ok) st.close();
          }} testID="send-peace" />
          <Btn style={{ marginTop: 8 }} tone="secondary" label={`White peace${whiteAnswer.accept ? ' (they would accept)' : ' (they would refuse)'}`} onPress={() => {
            const r = st.run(x => proposePeace(x, w.id, white));
            if (r.ok) st.close();
          }} />
        </>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- message log

export function LogPanel() {
  const st = useStore();
  const s = st.state!;
  const [tab, setTab] = useState<'all' | 'battles'>('all');
  const reports = s.reports;
  const unseen = new Set(s.unseenReports);
  return (
    <Panel title="Messages" onClose={() => st.close()}>
      <Row gap={6} style={{ marginBottom: 10 }}>
        <Btn small style={{ flex: 1 }} tone={tab === 'all' ? 'primary' : 'secondary'} label="News" onPress={() => setTab('all')} />
        <Btn small style={{ flex: 1 }} tone={tab === 'battles' ? 'primary' : 'secondary'} label={`Battles${unseen.size ? ` (${unseen.size})` : ''}`} onPress={() => setTab('battles')} />
      </Row>
      {tab === 'all'
        ? s.log.length
          ? s.log.map(l => (
              <Pressable
                key={l.id}
                onPress={() => {
                  if (l.node && (REGION[l.node] || l.node)) {
                    st.close();
                    store.focusOn(...regionPoint(l.node));
                  }
                }}
                style={[styles.logRow, l.important && { borderLeftColor: C.gold }]}
              >
                <Text style={styles.logDate}>{formatShortDate(l.day)}</Text>
                <Text style={styles.logText}>{l.text}</Text>
              </Pressable>
            ))
          : <Empty text="Nothing has happened yet." />
        : reports.length
          ? reports.map(r => {
              const you = r.playerSide;
              return (
                <Pressable key={r.id} onPress={() => st.open({ kind: 'report', id: r.id })} style={[styles.logRow, unseen.has(r.id) && { borderLeftColor: C.red }]}>
                  <Text style={styles.logDate}>{formatShortDate(r.day)}</Text>
                  <Text style={styles.logText}>
                    Battle of {regionName(r.node)}: {r.nations[r.winner].map(n => (NATION[n] ? nationName(n) : 'Rebels')).join(', ')} won
                    {you !== null ? (r.winner === you ? ' (your victory)' : ' (your defeat)') : ''}
                    {r.wiped ? ', annihilation' : ''}.
                  </Text>
                </Pressable>
              );
            })
          : <Empty text="No battles yet." />}
    </Panel>
  );
}


const styles = StyleSheet.create({
  panel: { ...StyleSheet.absoluteFill, backgroundColor: C.parchment },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.chrome, paddingHorizontal: 10, height: 52 },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: C.chrome2 },
  headTitle: { flex: 1, color: C.chromeText, fontFamily: serif, fontSize: 19, fontWeight: '700', textAlign: 'center' },
  footer: { paddingHorizontal: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.parchmentLine, backgroundColor: C.parchment },
  option: { backgroundColor: C.parchment2, borderRadius: 10, padding: 10, borderWidth: 2, borderColor: 'transparent', marginBottom: 6 },
  optionOn: { borderColor: C.gold, backgroundColor: '#f6e7bf' },
  optionText: { fontFamily: sans, fontSize: 15, fontWeight: '700', color: C.ink },
  optionSub: { fontFamily: sans, fontSize: 12, color: C.inkSoft, marginTop: 2 },
  cost: { fontFamily: sans, fontSize: 14, fontWeight: '800', color: C.ink },
  score: { alignItems: 'center', backgroundColor: C.parchment2, borderRadius: 12, padding: 12 },
  scoreLabel: { fontFamily: sans, fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  scoreValue: { fontFamily: serif, fontSize: 36, fontWeight: '700' },
  summary: { marginTop: 12, backgroundColor: C.parchment2, padding: 10, borderRadius: 10 },
  logRow: { paddingVertical: 8, paddingHorizontal: 10, borderLeftWidth: 3, borderLeftColor: 'transparent', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.parchmentLine },
  logDate: { fontFamily: sans, fontSize: 11, color: C.muted },
  logText: { fontFamily: sans, fontSize: 14, color: C.ink, marginTop: 1 },
});

