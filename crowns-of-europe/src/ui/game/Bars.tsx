/** Thin top bar (resources, tap for why) and the thumb-zone bottom bar (time, menu, messages). */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { readyMissionCount } from '../../sim/missions';
import { charted, freeColonists } from '../../sim/colonies';
import { ledger } from '../../sim/economy';
import { warScore } from '../../sim/war';
import { formatShortDate } from '../../sim/util';
import { SPEEDS, store, useStore } from '../../state/store';
import { Flag } from '../components/Flag';
import { Icon, type IconName } from '../components/Icon';
import { IconBtn } from '../components/kit';
import { C, fmt, kmen, sans, serif, signed } from '../theme';
import { MAP_MODES } from '../map/colors';

/** One number in the top bar, with a caption naming it (or, for gold, the monthly balance). Tap for the breakdown. */
function Res({ icon, value, sub, onPress, tone, subTone, label }: { icon: IconName; value: string; sub?: string; onPress: () => void; tone?: 'bad'; subTone?: 'good' | 'bad'; label: string }) {
  return (
    <Pressable onPress={onPress} style={styles.res} accessibilityLabel={`${label}: ${value}`} hitSlop={4}>
      <View style={styles.resRow}>
        <Icon name={icon} size={14} color={C.gold} />
        <Text style={[styles.resValue, tone === 'bad' && { color: '#ff9b86' }]}>{value}</Text>
      </View>
      <Text style={[styles.resSub, subTone === 'good' && { color: '#a9d79a' }, subTone === 'bad' && { color: '#ff9b86' }]}>{sub ?? label}</Text>
    </Pressable>
  );
}

export function TopBar() {
  const st = useStore();
  const s = st.state!;
  const n = s.nations[s.player];
  const bal = ledger(s, s.player).balance;
  const open = (what: 'gold' | 'manpower' | 'stability' | 'prestige' | 'threat') => st.open({ kind: 'breakdown', what });
  return (
    <View style={styles.top}>
      <Pressable onPress={() => st.open({ kind: 'menu', tab: 'economy' })} style={{ paddingRight: 6 }} accessibilityLabel="Your nation">
        <Flag nation={s.player} size={30} />
      </Pressable>
      <Res icon="gold" label="Gold" value={fmt(n.gold)} sub={`${signed(bal, 1)} a month`} tone={n.gold < 0 ? 'bad' : undefined} subTone={bal < 0 ? 'bad' : 'good'} onPress={() => open('gold')} />
      <Res icon="manpower" label="Levies" value={kmen(n.manpower)} onPress={() => open('manpower')} />
      <Res icon="stability" label="Order" value={signed(n.stability)} tone={n.stability < 0 ? 'bad' : undefined} onPress={() => open('stability')} />
      <Res icon="prestige" label="Renown" value={fmt(n.prestige)} onPress={() => open('prestige')} />
      <Res icon="threat" label="Threat" value={fmt(n.threat)} tone={n.threat >= 40 ? 'bad' : undefined} onPress={() => open('threat')} />
    </View>
  );
}

export function BottomBar() {
  const st = useStore();
  const s = st.state!;
  const missions = readyMissionCount(s, s.player);
  // Idle colonists with land left to settle also call you to the Realm menu.
  const idleColonists = freeColonists(s, s.player) > 0 && Object.values(s.regions).some(r => !r.owner && !r.colony && charted(s, r.id)) ? freeColonists(s, s.player) : 0;
  const important = s.unseenReports.length + s.offers.length;
  return (
    <View style={styles.bottom}>
      <View style={styles.time}>
        <Pressable onPress={() => st.togglePause()} style={[styles.play, !st.paused && { backgroundColor: C.gold }]} accessibilityLabel={st.paused ? 'Play' : 'Pause'} testID="playpause">
          <Icon name={st.paused ? 'play' : 'pause'} size={20} color={st.paused ? C.chromeText : C.chrome} />
        </Pressable>
        <View>
          <Text style={styles.date}>{formatShortDate(s.day)}</Text>
          <View style={{ flexDirection: 'row', gap: 4, marginTop: 3 }}>
            {SPEEDS.map((_, i) => (
              <Pressable key={i} onPress={() => st.setSpeed(i)} hitSlop={6} accessibilityLabel={`Speed ${[1, 2, 4][i]}x`} style={[styles.speed, i <= st.speed && styles.speedOn]}>
                <Text style={[styles.speedText, i <= st.speed && { color: C.chrome }]}>{['1×', '2×', '4×'][i]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <Pressable onPress={() => st.open({ kind: 'menu', tab: missions ? 'missions' : idleColonists ? 'colonies' : 'military' })} style={styles.menuBtn} accessibilityLabel="Menu" testID="menu">
        <Icon name="crown" size={22} color={C.chrome} />
        <Text style={styles.menuText}>Realm</Text>
        {missions + idleColonists ? (
          <View style={styles.dot}>
            <Text style={styles.dotText}>{missions + idleColonists}</Text>
          </View>
        ) : null}
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconBtn name="bell" label="Messages" onPress={() => st.open({ kind: 'log' })} badge={important} />
      </View>
    </View>
  );
}

export function MapModeChip() {
  const st = useStore();
  const [open, setOpen] = useState(false);
  const cur = MAP_MODES.find(m => m.key === st.mapMode)!;
  return (
    <View style={styles.modeWrap} pointerEvents="box-none">
      <Pressable onPress={() => setOpen(o => !o)} style={styles.modeChip} accessibilityLabel="Map mode" testID="mapmode">
        <Icon name="layers" size={15} color={C.chromeText} />
        <Text style={styles.modeText}>{cur.label}</Text>
      </Pressable>
      {open ? (
        <View style={styles.modeList}>
          {MAP_MODES.map(m => (
            <Pressable
              key={m.key}
              onPress={() => {
                st.setMapMode(m.key);
                setOpen(false);
              }}
              style={[styles.modeItem, m.key === st.mapMode && { backgroundColor: C.chromeLine }]}
            >
              <Text style={styles.modeItemText}>{m.label}</Text>
              <Text style={styles.modeHelp}>{m.help}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function Toasts() {
  const st = useStore();
  if (!st.toasts.length) return null;
  return (
    <View style={styles.toasts} pointerEvents="none">
      {st.toasts.map(t => (
        <View key={t.id} style={[styles.toast, t.tone === 'bad' && { borderColor: '#e07a63' }, t.tone === 'good' && { borderColor: '#9bcf8a' }]}>
          <Text style={styles.toastText}>{t.text}</Text>
        </View>
      ))}
    </View>
  );
}

/** Your wars under the top bar: who is ahead, by how much leverage. Tap one to make peace. */
export function WarStrip() {
  const st = useStore();
  const s = st.state!;
  const wars = Object.values(s.wars).filter(w => w.attackers.includes(s.player) || w.defenders.includes(s.player));
  if (!wars.length) return null;
  return (
    <ScrollView horizontal style={styles.strip} contentContainerStyle={{ gap: 6, paddingHorizontal: 8 }} showsHorizontalScrollIndicator={false}>
      {wars.map(w => {
        const sc = warScore(s, w).total * (w.defenders.includes(s.player) ? -1 : 1);
        return (
          <Pressable key={w.id} onPress={() => store.open({ kind: 'peace', war: w.id })} style={styles.warChip} accessibilityLabel={`${w.name}: leverage ${signed(sc)}%. Tap to make peace.`}>
            <Icon name="swords" size={13} color="#ffd9c9" />
            <Text style={styles.warText} numberOfLines={1}>
              {w.name}
            </Text>
            <Text numberOfLines={1} style={[styles.warScore, { color: sc > 5 ? '#b6e3a3' : sc < -5 ? '#ffab96' : '#f3e6c8' }]}>
              {sc > 5 ? 'ahead' : sc < -5 ? 'behind' : 'even'} {signed(sc)}%
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.chrome, paddingHorizontal: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.chromeLine },
  res: { alignItems: 'center', paddingVertical: 1, minWidth: 50 },
  resRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  resValue: { color: C.chromeText, fontFamily: sans, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  resSub: { color: C.chromeMuted, fontFamily: sans, fontSize: 10, fontWeight: '600', marginTop: 0 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.chrome, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 6, borderTopWidth: 1, borderTopColor: C.chromeLine },
  time: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 130 },
  play: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.chrome2, borderWidth: 1.5, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  date: { color: C.chromeText, fontFamily: serif, fontSize: 15, fontWeight: '700' },
  speed: { paddingHorizontal: 6, height: 20, borderRadius: 4, backgroundColor: C.chrome2, justifyContent: 'center', borderWidth: 1, borderColor: C.chromeLine },
  speedOn: { backgroundColor: C.gold, borderColor: C.gold },
  speedText: { color: C.chromeMuted, fontSize: 11, fontWeight: '800', fontFamily: sans },
  menuBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.gold, height: 46, paddingHorizontal: 18, borderRadius: 23 },
  menuText: { color: C.chrome, fontFamily: serif, fontSize: 16, fontWeight: '700' },
  dot: { position: 'absolute', top: -4, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  dotText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  modeWrap: { position: 'absolute', right: 8, top: 8, alignItems: 'flex-end' },
  modeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(33,24,16,0.88)', paddingHorizontal: 10, height: 30, borderRadius: 15 },
  modeText: { color: C.chromeText, fontFamily: sans, fontSize: 12, fontWeight: '700' },
  modeList: { marginTop: 6, backgroundColor: 'rgba(33,24,16,0.96)', borderRadius: 10, padding: 4, width: 250 },
  modeItem: { padding: 8, borderRadius: 7 },
  modeItemText: { color: C.chromeText, fontFamily: sans, fontSize: 14, fontWeight: '700' },
  modeHelp: { color: C.chromeMuted, fontFamily: sans, fontSize: 11, marginTop: 2 },
  toasts: { position: 'absolute', top: 44, left: 12, right: 12, alignItems: 'center', gap: 6 },
  toast: { backgroundColor: 'rgba(33,24,16,0.94)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: C.chromeLine, maxWidth: 420 },
  toastText: { color: C.chromeText, fontFamily: sans, fontSize: 14, textAlign: 'center' },
  strip: { position: 'absolute', top: 8, left: 0, right: 110, maxHeight: 30 },
  warChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(110,30,20,0.92)', height: 28, borderRadius: 14, paddingHorizontal: 10, maxWidth: 260 },
  warText: { color: '#ffe9de', fontFamily: sans, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  warScore: { fontFamily: sans, fontSize: 12, fontWeight: '800', flexShrink: 0 },
});
