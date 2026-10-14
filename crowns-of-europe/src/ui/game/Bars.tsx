/**
 * The controls that float over the map, in glass: the top bar (your arms and resources: tap any for why; messages),
 * the dock in the thumb zone (time on the left, the realm's panels as a tab bar on the right), the map lens button,
 * banners, and your wars (each enemy's arms on fire, down the left edge).
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { readyMissionCount } from '../../sim/missions';
import { availableAdvances, scienceRate } from '../../sim/science';
import { ledger } from '../../sim/economy';
import { liveUnseenReports } from '../../sim/queries';
import { warScore } from '../../sim/war';
import { formatShortDate } from '../../sim/util';
import { FAST, SPEEDS, SPEED_LABELS, allowedSpeed, store, useStore, type MapMode, type MenuTab } from '../../state/store';
import { BurningShield } from '../components/BurningShield';
import { Shield } from '../components/Flag';
import { Glass } from '../components/Glass';
import { Icon, type IconName } from '../components/Icon';
import { Badge, HelpButton, HelpNote } from '../components/kit';
import { G, R, display, fmt, kmen, sans, signed } from '../theme';
import { MAP_MODES } from '../map/colors';
import { MAP_STYLE_LIST } from '../map/styles';

import { DOCK_H, GOAL_STRIP_H, TOP_BAR_H } from '../layout';
import { useGoals } from './GoalStrip';
import { idleColonists as idleColonistsOf } from './ColonySheets';
export { DOCK_H, TOP_BAR_H };

/** One number in the top bar, with a caption naming it (or, for gold, the monthly balance). Tap for the breakdown. */
function Res({ icon, value, sub, onPress, tone, subTone, label }: { icon: IconName; value: string; sub?: string; onPress: () => void; tone?: 'bad'; subTone?: 'good' | 'bad'; label: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.res, pressed && { opacity: 0.6 }]} accessibilityLabel={`${label}: ${value}`} hitSlop={4}>
      <View style={styles.resRow}>
        <Icon name={icon} size={13} color={G.gold} />
        <Text style={[styles.resValue, tone === 'bad' && { color: G.bad }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Text style={[styles.resSub, subTone === 'good' && { color: G.good }, subTone === 'bad' && { color: G.bad }]} numberOfLines={1}>
        {sub ?? label}
      </Text>
    </Pressable>
  );
}

export function TopBar() {
  const st = useStore();
  const s = st.state!;
  const insets = useSafeAreaInsets();
  const n = s.nations[s.player];
  const bal = ledger(s, s.player).balance;
  const open = (what: 'gold' | 'manpower' | 'stability' | 'threat') => st.open({ kind: 'breakdown', what });
  const important = liveUnseenReports(s).length + s.offers.length;
  return (
    <View style={[styles.topWrap, { top: insets.top + 6 }]} pointerEvents="box-none">
      <Glass gilt radius={R.lg} style={styles.top}>
        <Pressable onPress={() => st.select({ kind: 'nation', id: s.player })} style={styles.arms} accessibilityLabel="Your nation" hitSlop={4}>
          <Shield nation={s.player} size={30} />
        </Pressable>
        <Res icon="gold" label="Gold" value={fmt(n.gold)} sub={`${signed(bal, 1)}/mo`} tone={n.gold < 0 ? 'bad' : undefined} subTone={bal < 0 ? 'bad' : 'good'} onPress={() => open('gold')} />
        <Res icon="manpower" label="Levies" value={kmen(n.manpower)} onPress={() => open('manpower')} />
        <Res icon="stability" label="Order" value={signed(n.stability)} tone={n.stability < 0 ? 'bad' : undefined} onPress={() => open('stability')} />
        <Res icon="book" label="Science" value={fmt(scienceRate(s, s.player).total, 1)} sub={n.researching ? undefined : 'Pick one'} subTone={n.researching ? undefined : 'bad'} onPress={() => st.open({ kind: 'menu', tab: 'science' })} />
        <Res icon="threat" label="Threat" value={fmt(n.threat)} tone={n.threat >= 40 ? 'bad' : undefined} onPress={() => open('threat')} />
        <Pressable onPress={() => st.open({ kind: 'log' })} style={({ pressed }) => [styles.bell, pressed && { opacity: 0.6 }]} accessibilityLabel="Messages" hitSlop={6} testID="messages">
          <Icon name="bell" size={19} color={G.text} />
          {important ? <Badge n={important} style={{ position: 'absolute', top: -3, right: -5 }} /> : null}
        </Pressable>
      </Glass>
    </View>
  );
}

/** The realm's panels, as a phone's tab bar: each opens the realm menu on that page. */
function TabItem({ icon, label, onPress, badge, testID }: { icon: IconName; label: string; onPress: () => void; badge?: number; testID?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tabItem, pressed && { opacity: 0.6 }]} accessibilityLabel={label} testID={testID}>
      <View>
        <Icon name={icon} size={21} color={G.text} />
        {badge ? <Badge n={badge} style={{ position: 'absolute', top: -5, right: -10 }} /> : null}
      </View>
      <Text style={styles.tabLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function BottomBar() {
  const st = useStore();
  const s = st.state!;
  const insets = useSafeAreaInsets();
  const p = s.player;
  const missions = readyMissionCount(s, p);
  // Idle colonists with land left to settle, or a colony to grow, also call you to the realm.
  const idleColonists = idleColonistsOf(s, p);
  const pickAdvance = !s.nations[p].researching && availableAdvances(s, p).length ? 1 : 0;
  const menu = (tab: MenuTab) => st.open({ kind: 'menu', tab });
  const noFast = allowedSpeed(s, FAST) !== FAST;
  return (
    <View style={[styles.dock, { bottom: insets.bottom + 8 }]} pointerEvents="box-none">
      <Glass gilt radius={R.pill} style={styles.time}>
        <Pressable onPress={() => st.togglePause()} style={[styles.play, !st.paused && styles.playOn]} accessibilityLabel={st.paused ? 'Play' : 'Pause'} testID="playpause">
          <Icon name={st.paused ? 'play' : 'pause'} size={18} color={st.paused ? G.gold : '#1a1408'} />
        </Pressable>
        <View style={{ gap: 4 }}>
          <Text style={styles.date} numberOfLines={1}>
            {formatShortDate(s.day)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {SPEEDS.map((_, i) => (
              <Pressable key={i} onPress={() => st.setSpeed(i)} hitSlop={6} accessibilityLabel={`Speed ${SPEED_LABELS[i].replace('×', 'x')}`} style={[styles.speed, i <= st.speed && styles.speedOn, i === FAST && noFast && { opacity: 0.35 }]}>
                <Text style={[styles.speedText, i <= st.speed && { color: '#1a1408' }]}>{SPEED_LABELS[i]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Glass>
      <Glass gilt radius={R.pill} style={styles.tabs}>
        <TabItem icon="swords" label="Army" onPress={() => menu('military')} testID="dock-military" />
        <TabItem icon="treaty" label="Diplomacy" onPress={() => menu('diplomacy')} testID="dock-diplomacy" />
        <TabItem icon="book" label="Learning" onPress={() => menu('science')} badge={pickAdvance} testID="dock-science" />
        <TabItem icon="crown" label="Realm" onPress={() => menu(missions ? 'missions' : idleColonists ? 'colonies' : 'economy')} badge={missions + idleColonists} testID="menu" />
      </Glass>
    </View>
  );
}

const MODE_ICON: Record<MapMode, IconName> = {
  political: 'flag',
  terrain: 'map',
  development: 'coins',
  faith: 'church',
  diplomatic: 'treaty',
  threat: 'threat',
  science: 'book',
  goods: 'ship',
};

/** The map's lenses: map modes, what the current one shows, and the map's look. */
export function LensPanel({ onPick }: { onPick: () => void }) {
  const st = useStore();
  const cur = MAP_MODES.find(m => m.key === st.mapMode)!;
  const [help, setHelp] = useState(false);
  return (
    <Glass strong gilt radius={R.lg} style={styles.lensMenu}>
      <View style={styles.lensHead}>
        <Text style={styles.lensTitle}>Map lens</Text>
        <HelpButton open={help} onPress={() => setHelp(h => !h)} label={`About the ${cur.label} lens`} />
      </View>
      <View style={styles.lensGrid}>
        {MAP_MODES.map(m => {
          const on = m.key === st.mapMode;
          return (
            <Pressable
              key={m.key}
              testID={`mode-${m.key}`}
              onPress={() => {
                st.setMapMode(m.key);
                onPick();
              }}
              style={({ pressed }) => [styles.lensItem, on && styles.lensItemOn, pressed && { opacity: 0.7 }]}
            >
              <Icon name={MODE_ICON[m.key]} size={16} color={on ? G.gold : G.text2} />
              <Text style={[styles.lensItemText, on && { color: G.text }]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {help ? <HelpNote style={{ marginTop: 8 }}>{`${cur.label}: ${cur.help}`}</HelpNote> : null}
      <View style={styles.lookRow}>
        {MAP_STYLE_LIST.map(ms => (
          <Pressable key={ms.id} onPress={() => st.setMapStyle(ms.id)} style={[styles.lookItem, ms.id === st.mapStyle && styles.lookItemOn]} testID={`mapstyle-${ms.id}`}>
            <Text style={[styles.lookText, ms.id === st.mapStyle && { color: G.text }]}>{ms.label}</Text>
          </Pressable>
        ))}
      </View>
    </Glass>
  );
}

export const MODE_ICONS = MODE_ICON;

/** Banners that drop in under the top bar, like a phone's notifications. One that leads somewhere (an offer, a
 * battle) has a chevron and opens it when tapped; the rest let taps through to the map. */
export function Toasts() {
  const st = useStore();
  const insets = useSafeAreaInsets();
  const strip = useGoals().length > 0;
  if (!st.toasts.length) return null;
  const s = st.state;
  const atWar = !!s && Object.values(s.wars).some(w => w.attackers.includes(s.player) || w.defenders.includes(s.player));
  return (
    <View style={[styles.toasts, { top: insets.top + 6 + TOP_BAR_H + 8 + (strip ? GOAL_STRIP_H + 4 : 0), left: atWar ? 68 : 12 }]} pointerEvents="box-none">
      {st.toasts.map(t => {
        const body = (
          <Glass strong radius={R.pill} style={styles.toast} pointerEvents="none">
            <Icon name={t.tone === 'bad' ? 'info' : t.tone === 'good' ? 'check' : 'scroll'} size={15} color={t.tone === 'bad' ? G.bad : t.tone === 'good' ? G.good : G.gold} />
            <Text style={styles.toastText}>{t.text}</Text>
            {t.action ? <Icon name="chevron" size={14} color={G.gold} /> : null}
          </Glass>
        );
        const action = t.action;
        return action ? (
          <Pressable
            key={t.id}
            testID="toast-open"
            accessibilityRole="button"
            accessibilityLabel={`${t.text}. Open`}
            onPress={() => {
              st.dismissToast(t.id);
              action();
            }}
            style={({ pressed }) => [pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
          >
            {body}
          </Pressable>
        ) : (
          <View key={t.id} pointerEvents="none">
            {body}
          </View>
        );
      })}
    </View>
  );
}

/** Your wars, down the left edge under the top bar: each enemy's arms on fire, your leverage beneath. Tap one for the
 * war: how it stands, and peace. */
export function WarRail() {
  const st = useStore();
  const s = st.state!;
  const insets = useSafeAreaInsets();
  const wars = Object.values(s.wars).filter(w => w.attackers.includes(s.player) || w.defenders.includes(s.player));
  if (!wars.length) return null;
  return (
    <View style={[styles.warRail, { top: insets.top + 6 + TOP_BAR_H + 2 }]} pointerEvents="box-none">
      {wars.map((w, i) => {
        const ours = w.defenders.includes(s.player);
        const sc = warScore(s, w).total * (ours ? -1 : 1);
        const enemy = ours ? w.attackers[0] : w.defenders[0];
        return (
          <Pressable key={w.id} testID={`war-${w.id}`} onPress={() => store.open({ kind: 'peace', war: w.id })} style={({ pressed }) => [styles.war, pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }]} accessibilityLabel={`${w.name}: leverage ${signed(sc)}%. Tap for the war.`}>
            <BurningShield nation={enemy} size={28} seed={i + 1} />
            <View style={styles.warPill}>
              <Text style={[styles.warScore, { color: sc > 5 ? G.good : sc < -5 ? G.bad : G.text }]}>{signed(sc)}%</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  topWrap: { position: 'absolute', left: 8, right: 8, zIndex: 10 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: TOP_BAR_H, paddingLeft: 8, paddingRight: 12 },
  arms: { paddingRight: 2 },
  res: { alignItems: 'center', minWidth: 46 },
  resRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  resValue: { color: G.text, fontFamily: sans, fontSize: 14.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  resSub: { color: G.text3, fontFamily: sans, fontSize: 10, fontWeight: '600', marginTop: 1 },
  bell: { width: 30, height: 34, alignItems: 'center', justifyContent: 'center' },
  dock: { position: 'absolute', left: 8, right: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, zIndex: 10 },
  time: { flexDirection: 'row', alignItems: 'center', gap: 9, height: DOCK_H, paddingLeft: 8, paddingRight: 14 },
  play: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: G.gilt },
  playOn: { backgroundColor: G.gold, borderColor: G.goldBright },
  date: { color: G.text, fontFamily: display, fontSize: 13.5, letterSpacing: 0.3 },
  speed: { paddingHorizontal: 6, height: 19, borderRadius: R.pill, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)' },
  speedOn: { backgroundColor: G.gold },
  speedText: { color: G.text2, fontSize: 10.5, fontWeight: '800', fontFamily: sans },
  tabs: { flexDirection: 'row', alignItems: 'center', height: DOCK_H, paddingHorizontal: 6, flexShrink: 1 },
  tabItem: { alignItems: 'center', justifyContent: 'center', width: 52, height: DOCK_H, gap: 3 },
  tabLabel: { color: G.text2, fontFamily: sans, fontSize: 10, fontWeight: '600' },
  lensMenu: { width: 268, padding: 10 },
  lensHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingBottom: 6 },
  lensTitle: { fontFamily: display, fontSize: 13, color: G.gold, letterSpacing: 1.4, textTransform: 'uppercase' },
  lensGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  lensItem: { width: '48.8%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 10, borderRadius: R.md, backgroundColor: 'rgba(255,255,255,0.04)' },
  lensItemOn: { backgroundColor: 'rgba(214,178,110,0.16)', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: G.gilt },
  lensItemText: { color: G.text2, fontFamily: sans, fontSize: 14, fontWeight: '600' },
  lookRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: R.pill, padding: 3, marginTop: 8 },
  lookItem: { flex: 1, paddingVertical: 7, borderRadius: R.pill, alignItems: 'center' },
  lookItemOn: { backgroundColor: G.raised },
  lookText: { color: G.text2, fontFamily: sans, fontSize: 13, fontWeight: '600' },
  toasts: { position: 'absolute', right: 58, alignItems: 'center', gap: 6, zIndex: 30 }, // clear of the side rail
  toast: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 16, paddingVertical: 11, maxWidth: 440 },
  toastText: { color: G.text, fontFamily: sans, fontSize: 14, fontWeight: '500', flexShrink: 1 },
  warRail: { position: 'absolute', left: 4, gap: 2, zIndex: 25 },
  war: { alignItems: 'center' },
  warPill: { marginTop: -10, minWidth: 40, height: 18, paddingHorizontal: 6, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(13,16,21,0.92)', borderWidth: 1, borderColor: 'rgba(214,178,110,0.75)' },
  warScore: { fontFamily: sans, fontSize: 11.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
