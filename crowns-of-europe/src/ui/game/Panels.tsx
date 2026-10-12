/** Full-height panels: the page frame, resource breakdowns, declaring war and the message log (the war itself is in WarScreen). */
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NATION, REGION, nationName, regionName } from '../../sim/content';
import { boostStability, playerDeclareWar } from '../../sim/commands';
import { ledger, maxManpower, manpowerRecovery, stabilityCost, taxMultiplier } from '../../sim/economy';
import { modifierSources } from '../../sim/queries';
import { casusBelli, likelySides } from '../../sim/war';
import { perceivedThreat, coalitionAgainst } from '../../sim/threat';
import { formatShortDate } from '../../sim/util';
import { store, useStore } from '../../state/store';
import { Flag } from '../components/Flag';
import { Icon } from '../components/Icon';
import { Btn, Empty, HelpButton, HelpNote, Line, Row, Section, T } from '../components/kit';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { C, G, R, fmt, sans, serif, signed } from '../theme';
import { modLines } from '../describe';
import { regionPoint } from '../map/geometry';

/**
 * A full-screen page, like a phone's modal screen dressed for court: a dark page with a faint glow at the top, a
 * round close button, the title in classical capitals, and a gilded rule with a small diamond under the header.
 */
export function Panel({ title, children, onClose, footer, right, help }: { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode; right?: ReactNode; help?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <View style={[styles.panel, { paddingTop: insets.top }]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <SvgGradient id="pageGlow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1d222b" />
            <Stop offset="0.35" stopColor={G.bg} />
            <Stop offset="1" stopColor="#090b0e" />
          </SvgGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#pageGlow)" />
      </Svg>
      <View style={styles.head}>
        <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]} accessibilityLabel="Close">
          <Icon name="close" size={15} color={G.text2} />
        </Pressable>
        <Text style={styles.headTitle} numberOfLines={1}>
          {title}
        </Text>
        {right ?? (help ? (
          <View style={{ width: 32, alignItems: 'center' }}>
            <HelpButton open={helpOpen} onPress={() => setHelpOpen(o => !o)} label={`About ${title}`} />
          </View>
        ) : (
          <View style={{ width: 32 }} />
        ))}
      </View>
      <GiltRule />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
        {helpOpen ? <HelpNote style={{ marginBottom: 12 }}>{help}</HelpNote> : null}
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: 10 + insets.bottom }]}>{footer}</View> : null}
    </View>
  );
}

/** A gilded rule that fades out at both ends, with a small diamond in the middle. */
export function GiltRule({ style }: { style?: object }) {
  return (
    <Svg height={9} width="100%" style={style} pointerEvents="none">
      <Defs>
        <SvgGradient id="giltRule" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={G.gold} stopOpacity={0} />
          <Stop offset="0.5" stopColor={G.gold} stopOpacity={0.7} />
          <Stop offset="1" stopColor={G.gold} stopOpacity={0} />
        </SvgGradient>
      </Defs>
      <Rect x="4%" y={4} width="92%" height={1} fill="url(#giltRule)" />
      <Rect x="50%" y={1.5} width={6} height={6} fill={G.panel} stroke={G.gold} strokeWidth={1} transform="translate(-3 0) rotate(45 3 3)" />
    </Svg>
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
      <Panel title="Gold" onClose={close} help="If gold runs out you borrow automatically: 100 gold at 5% a year. More than 10 loans means bankruptcy.">
        <T v="h2">{fmt(n.gold)} gold</T>
        <Line label="Each month" value={signed(l.balance, 1)} tone={l.balance >= 0 ? 'good' : 'bad'} bold />
        <Section title="Income per month" help={`Taxes are prosperity × 0.3 in each region, ×${taxMultiplier(s, s.player).toFixed(2)} from order, your ruler and modifiers; regions not yet integrated pay half.`}>
          {l.income.map(i => (
            <Line key={i.label} label={i.label} value={fmt(i.value, 1)} tone="good" />
          ))}
          <Line label="Total" value={fmt(l.totalIncome, 1)} bold />
        </Section>
        <Section title="Expenses per month">
          {l.expenses.map(i => (
            <Line key={i.label} label={i.label} value={fmt(i.value, 1)} tone="bad" />
          ))}
          <Line label="Total" value={fmt(l.totalExpenses, 1)} bold />
        </Section>
      </Panel>
    );
  }
  if (what === 'manpower') {
    return (
      <Panel title="Levies" onClose={close} help="The men your realm can call up. Each regiment needs 1,000 to raise and draws on them to refill its losses. The maximum is 3,000 plus 400 per point of prosperity (half for regions not yet integrated). War exhaustion slows recovery; mercenaries need no levies.">
        <T v="h2">{fmt(n.manpower)} men</T>
        <Line label="Maximum" value={fmt(maxManpower(s, s.player))} />
        <Line label="Recovery per month" value={`+${fmt(manpowerRecovery(s, s.player))}`} tone="good" />
      </Panel>
    );
  }
  if (what === 'stability') {
    return (
      <Panel title="Order" onClose={close} help="How settled your realm is, from −3 to +3. Each point changes tax income by 5% and unrest in every region by 0.75. Wars without a reason, broken truces, succession crises and bankruptcy all lower it.">
        <T v="h2">{signed(n.stability)} / 3</T>
        <Line label="Taxes" value={`${signed(n.stability * 5)}%`} tone={n.stability < 0 ? 'bad' : n.stability > 0 ? 'good' : undefined} />
        <Line label="Unrest in every region" value={signed(-n.stability * 0.75, 2)} tone={n.stability < 0 ? 'bad' : n.stability > 0 ? 'good' : undefined} />
        <Btn style={{ marginTop: 12 }} label={n.stability >= 3 ? 'Order is at its peak' : `Raise order (${stabilityCost(s, s.player)} gold)`} disabled={n.stability >= 3} onPress={() => st.run(boostStability)} />
      </Panel>
    );
  }
  if (what === 'prestige') {
    return (
      <Panel title="Renown" onClose={close} help="Your crown’s good name. It comes from winning battles and wars, missions and events, and fades by 1% a month. From 10 renown on, every 5 adds 1 to how others see you, and high renown makes Threat fade faster.">
        <T v="h2">{fmt(n.prestige)} / 100</T>
        <Line label="Opinion of you" value={n.prestige >= 10 ? signed(Math.round(n.prestige / 5)) : '0'} tone={n.prestige >= 10 ? 'good' : undefined} />
        <Line label="Fades" value="1% a month" tone="muted" />
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
    <Panel
      title="Threat"
      onClose={close}
      help="Taking land raises your Threat (claimed land counts less). Nearby nations, and those of another faith, feel it most. When three or more feel 40 or more, they form a coalition that joins any war you start against a member, and may attack you. Threat fades slowly, faster with high renown."
    >
      <T v="h2">{fmt(n.threat)}</T>
      {c ? (
        <Section title="Coalition against you">
          {c.members.map(m => (
            <Line key={m} label={nationName(m)} value="member" tone="bad" />
          ))}
        </Section>
      ) : null}
      <Section title="Who feels threatened">{watchers.length ? watchers.map(w => <Line key={w.id} label={nationName(w.id)} value={fmt(w.t)} tone={w.t >= 40 ? 'bad' : undefined} />) : <Empty text="Nobody" />}</Section>
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
      <Section title="Reason for war" help="Holding the war goal adds leverage every month. A war without a reason costs 1 order and 8 Threat, and every crown thinks less of you.">
        <View style={{ gap: 6 }}>
          {cbs.map((c, i) => (
            <Pressable key={i} onPress={() => setPick(i)} style={[styles.option, pick === i && styles.optionOn]}>
              <Text style={styles.optionText}>{c.label}</Text>
              {c.goal ? <Text style={styles.optionSub}>War goal: {regionName(c.goal)}</Text> : null}
              {c.cb === 'none' ? <Text style={[styles.optionSub, { color: C.red }]}>−1 order · +8 Threat · −opinion</Text> : null}
            </Pressable>
          ))}
        </View>
      </Section>
      {truce ? <T v="small" style={{ color: C.red, marginTop: 8 }}>Breaks a truce: −2 order, −20 renown, +10 Threat.</T> : null}
      <Section title="Likely to fight with you">
        {sides.attackers.map(n => (
          <Row key={n} style={{ marginBottom: 4 }}>
            <Flag nation={n} size={22} />
            <T v="small">{nationName(n)}</T>
          </Row>
        ))}
      </Section>
      <Section title="Likely to fight against you" help="Their allies decide when they are called. Members of the Holy Roman Empire may get help from the Emperor.">
        {sides.defenders.map(n => (
          <Row key={n} style={{ marginBottom: 4 }}>
            <Flag nation={n} size={22} />
            <T v="small">{nationName(n)}</T>
          </Row>
        ))}
      </Section>
    </Panel>
  );
}

// ---------------------------------------------------------------- peace

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
  panel: { ...StyleSheet.absoluteFill, backgroundColor: G.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 54 },
  back: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.09)' },
  headTitle: { flex: 1, color: G.text, fontFamily: serif, fontSize: 19, letterSpacing: 1, textAlign: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: G.line, backgroundColor: 'rgba(13,16,21,0.94)' },
  option: { backgroundColor: G.group, borderRadius: R.md, padding: 12, borderWidth: 1.5, borderColor: 'transparent', marginBottom: 6 },
  optionOn: { borderColor: C.gold, backgroundColor: 'rgba(214,178,110,0.14)' },
  optionText: { fontFamily: sans, fontSize: 15, fontWeight: '700', color: C.ink },
  optionSub: { fontFamily: sans, fontSize: 12, color: C.inkSoft, marginTop: 2 },
  logRow: { paddingVertical: 10, paddingHorizontal: 12, borderLeftWidth: 3, borderLeftColor: 'transparent', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: G.line },
  logDate: { fontFamily: sans, fontSize: 11, color: C.muted },
  logText: { fontFamily: sans, fontSize: 14, color: C.ink, marginTop: 1 },
});

