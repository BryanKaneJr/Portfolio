/**
 * The side rail under the top bar: two round glass buttons, the outliner (everything of yours that is moving, in one
 * list, as in a grand strategy game: tap a line to find that army, fleet, siege or colony) and the map lens. Each
 * opens its panel beside the rail; the rail stays clear of sheets, so both work while one is open.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { regionName } from '../../sim/content';
import { armiesOf, armyRegs, fleetsOf } from '../../sim/queries';
import { useStore } from '../../state/store';
import { Glass } from '../components/Glass';
import { Icon, type IconName } from '../components/Icon';
import { regionPoint } from '../map/geometry';
import { G, R, displaySemi, sans } from '../theme';
import { dockTop, sheetHeight } from '../layout';
import { LensPanel, MODE_ICONS, TOP_BAR_H } from './Bars';

function Item({ icon, title, sub, right, tone, onPress }: { icon: IconName; title: string; sub: string; right?: string; tone?: 'bad' | 'good'; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, pressed && { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
      <Icon name={icon} size={15} color={tone === 'bad' ? G.bad : G.gold} />
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.itemSub, tone === 'bad' && { color: G.bad }]} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      {right ? <Text style={styles.itemRight}>{right}</Text> : null}
    </Pressable>
  );
}

export function SideRail() {
  const st = useStore();
  const s = st.state!;
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState<'outliner' | 'lens' | null>(null);
  const p = s.player;
  const top = insets.top + 6 + TOP_BAR_H + 8;
  const go = (node: string, sel: Parameters<typeof st.select>[0]) => {
    const [x, y] = regionPoint(node);
    st.focusOn(x, y);
    st.select(sel);
  };
  const armies = armiesOf(s, p);
  const fleets = fleetsOf(s, p);
  const sieges = Object.values(s.regions).filter(r => r.siege?.by === p);
  const colonies = Object.values(s.regions).filter(r => r.colony?.by === p);
  const count = armies.length + fleets.length;

  const toggle = (k: 'outliner' | 'lens') => setOpen(o => (o === k ? null : k));
  return (
    <View style={[styles.wrap, { top }]} pointerEvents="box-none">
      <View style={styles.rail} pointerEvents="box-none">
        <Glass gilt radius={R.pill} style={styles.btn}>
          <Pressable onPress={() => toggle('outliner')} style={styles.btnPress} accessibilityLabel={open === 'outliner' ? 'Close the outliner' : 'Outliner: your armies, fleets, sieges and colonies'} testID="outliner">
            <Icon name={open === 'outliner' ? 'close' : 'menu'} size={18} color={G.text} />
            {open !== 'outliner' && count ? <Text style={styles.count}>{count}</Text> : null}
          </Pressable>
        </Glass>
        <Glass gilt radius={R.pill} style={styles.btn}>
          <Pressable onPress={() => toggle('lens')} style={styles.btnPress} accessibilityLabel="Map lens" testID="mapmode">
            <Icon name={open === 'lens' ? 'close' : MODE_ICONS[st.mapMode]} size={18} color={G.text} />
          </Pressable>
        </Glass>
      </View>
      {open === 'lens' ? (
        <View style={styles.beside}>
          <LensPanel onPick={() => setOpen(null)} />
        </View>
      ) : null}
      {open === 'outliner' ? (
        <Glass strong gilt radius={R.lg} style={[styles.panel, styles.beside, { maxHeight: Math.max(220, height - dockTop(insets.bottom) - sheetHeight(height) - top - 8) }]}>
          <ScrollView contentContainerStyle={{ paddingVertical: 6 }}>
            <Text style={styles.head}>Armies</Text>
            {armies.length ? (
              armies.map(a => {
                const where = a.battle ? 'In battle' : a.retreating ? `Retreating to ${regionName(a.path[a.path.length - 1] ?? a.node)}` : a.path.length ? `To ${regionName(a.path[a.path.length - 1])}` : `At ${regionName(a.node)}`;
                return <Item key={a.id} icon="swords" title={a.name} sub={where} right={`${armyRegs(a)}`} tone={a.battle || a.retreating ? 'bad' : undefined} onPress={() => go(a.node, { kind: 'army', id: a.id })} />;
              })
            ) : (
              <Text style={styles.none}>No armies</Text>
            )}
            <Text style={styles.head}>Fleets</Text>
            {fleets.length ? (
              fleets.map(f => (
                <Item key={f.id} icon="ship" title={f.name} sub={f.path.length ? `To ${regionName(f.path[f.path.length - 1])}` : regionName(f.sea)} right={`${f.ships.galley + f.ships.warship + f.ships.transport}`} onPress={() => go(f.sea, { kind: 'fleet', id: f.id })} />
              ))
            ) : (
              <Text style={styles.none}>No fleets</Text>
            )}
            {sieges.length ? <Text style={styles.head}>Sieges</Text> : null}
            {sieges.map(r => (
              <Item key={r.id} icon="siege" title={regionName(r.id)} sub="Under siege" right={`${Math.round((r.siege?.progress ?? 0) * 100)}%`} onPress={() => go(r.id, { kind: 'region', id: r.id })} />
            ))}
            {colonies.length ? <Text style={styles.head}>Colonies</Text> : null}
            {colonies.map(r => (
              <Item key={r.id} icon="flag" title={regionName(r.id)} sub="Being settled" right={`${Math.round(r.colony!.settlers)}`} onPress={() => go(r.id, { kind: 'region', id: r.id })} />
            ))}
          </ScrollView>
        </Glass>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 8, zIndex: 25 },
  rail: { gap: 8, alignItems: 'flex-end' },
  beside: { position: 'absolute', right: 52, top: 0 },
  btn: { height: 44, minWidth: 44 },
  btnPress: { height: 44, minWidth: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  count: { color: G.text2, fontFamily: sans, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  panel: { width: 252 },
  head: { fontFamily: displaySemi, fontSize: 11.5, color: G.gold, letterSpacing: 1.5, textTransform: 'uppercase', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8 },
  itemTitle: { color: G.text, fontFamily: sans, fontSize: 14, fontWeight: '600' },
  itemSub: { color: G.text3, fontFamily: sans, fontSize: 12, marginTop: 1 },
  itemRight: { color: G.text2, fontFamily: sans, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  none: { color: G.text3, fontFamily: sans, fontSize: 13, fontStyle: 'italic', paddingHorizontal: 14, paddingVertical: 4 },
});
