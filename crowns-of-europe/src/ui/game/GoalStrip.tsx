/**
 * Under the top bar: the next few goals in reach (sim/goals.ts), one line each. A ready one is gold. Tap one to go
 * there: the missions, a region on the map, learning or the realm. Hidden while a sheet or a card is open.
 */
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAP_REGION } from '../../sim/content';
import { nextGoals, type Goal } from '../../sim/goals';
import { atWar } from '../../sim/queries';
import { store, useStore } from '../../state/store';
import { Glass } from '../components/Glass';
import { GOAL_STRIP_H, TOP_BAR_H } from '../layout';
import { G, R, sans } from '../theme';

/** The goals the strip shows now (none while a sheet or card is open): recomputed each day and after each command. */
export function useGoals(): Goal[] {
  const st = useStore();
  const s = st.state;
  const day = s?.day;
  const runs = st.runs;
  const goals = useMemo(() => (s ? nextGoals(s, s.player) : []), [s, day, runs]); // eslint-disable-line react-hooks/exhaustive-deps
  return st.selection || st.overlay ? [] : goals;
}

function go(g: Goal) {
  if ('region' in g.go) {
    const at = MAP_REGION[g.go.region]?.label;
    store.select({ kind: 'region', id: g.go.region });
    if (at) store.focusOn(at[0], at[1]);
  } else store.open({ kind: 'menu', tab: g.go.tab === 'realm' ? 'economy' : g.go.tab });
}

export function GoalStrip() {
  const st = useStore();
  const insets = useSafeAreaInsets();
  const goals = useGoals();
  const s = st.state;
  if (!s || !goals.length) return null;
  return (
    <View
      style={[styles.wrap, { top: insets.top + 6 + TOP_BAR_H + 4, left: atWar(s, s.player) ? 68 : 12 }]}
      pointerEvents="box-none"
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {goals.map((g, i) => (
          <Pressable
            key={g.key}
            onPress={() => go(g)}
            testID={`goal-${i}`}
            accessibilityRole="button"
            accessibilityLabel={g.text}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <Glass radius={R.pill} gilt={g.ready} style={[styles.chip, g.ready && styles.ready]}>
              <Text style={[styles.text, g.ready && { color: G.goldBright }]} numberOfLines={1}>
                {g.text}
              </Text>
            </Glass>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 58, height: GOAL_STRIP_H, zIndex: 10 },
  chip: { height: GOAL_STRIP_H - 2, paddingHorizontal: 11, justifyContent: 'center' },
  ready: { backgroundColor: 'rgba(214,178,110,0.22)' },
  text: { color: G.text, fontFamily: sans, fontSize: 12.5, fontWeight: '600' },
});
