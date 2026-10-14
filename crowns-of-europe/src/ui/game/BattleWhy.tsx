/** Under a battle report: why it went as it did, in up to three lines from the player's side (describe.ts battleWhy). */
import { StyleSheet, Text, View } from 'react-native';
import type { BattleReport } from '../../sim/types';
import { battleWhy } from '../describe';
import { G, sans } from '../theme';

export function BattleWhy({ report }: { report: BattleReport }) {
  const lines = battleWhy(report);
  if (!lines.length) return null;
  return (
    <View style={{ marginTop: 10 }} testID="battle-why">
      <Text style={styles.head}>Why</Text>
      {lines.map((l, i) => (
        <Text key={i} style={styles.line}>
          • {l}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    fontFamily: sans,
    fontSize: 11,
    fontWeight: '700',
    color: G.gold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  line: { fontFamily: sans, fontSize: 13, color: G.text2, marginTop: 2 },
});
