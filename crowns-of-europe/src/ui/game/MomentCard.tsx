/**
 * The card for the great turns the player caused or leads (a peace, a mission, an achievement, a crown, a union):
 * the weightiest in full, any others of the same moment one line each under "Also".
 */
import { StyleSheet, Text, View } from 'react-native';
import { MAP_REGION, regionName } from '../../sim/content';
import type { Moment, MomentKind } from '../../sim/types';
import { formatDate } from '../../sim/util';
import { useStore } from '../../state/store';
import { Engraving, type IconName } from '../components/Icon';
import { Shield } from '../components/Flag';
import { Btn, Row } from '../components/kit';
import { G, book, sans, serif } from '../theme';
import { CardShell } from './Cards';

const RANK: MomentKind[] = ['crown', 'peace', 'union', 'mission', 'achievement'];
const rank = (m: Moment) => (RANK.includes(m.kind) ? RANK.indexOf(m.kind) : RANK.length);

const PICTURE: Record<MomentKind, IconName> = {
  crown: 'crown',
  peace: 'treaty',
  union: 'marriage',
  mission: 'target',
  achievement: 'prestige',
  ruler: 'crown',
  capital: 'castle',
  fortress: 'siege',
  rebels: 'rebels',
  invaded: 'swords',
  headline: 'scroll',
};

/** One region that changed hands, under the arms of whoever holds it now. */
function Land({ id, gained }: { id: string; gained: boolean }) {
  const st = useStore();
  const owner = st.state!.regions[id]?.owner;
  return (
    <Row gap={8} style={{ marginTop: 6 }}>
      {owner ? <Shield nation={owner} size={22} /> : null}
      <Text style={[styles.land, { color: gained ? G.good : G.bad }]}>
        {gained ? '▲' : '▼'} {regionName(id)}
      </Text>
    </Row>
  );
}

export function MomentCard({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const st = useStore();
  const s = st.state!;
  const list = ids.map(id => s.moments?.find(m => m.id === id)).filter((m): m is Moment => !!m);
  const sorted = [...list].sort((a, b) => rank(a) - rank(b) || a.day - b.day);
  const top = sorted[0];
  if (!top) {
    return (
      <CardShell>
        <View testID="moment-card">
          <Text style={styles.title}>That has already passed.</Text>
          <Btn style={{ marginTop: 14 }} label="Continue" onPress={onClose} testID="moment-close" />
        </View>
      </CardShell>
    );
  }
  const place = top.node ?? top.gained?.[0] ?? top.lost?.[0];
  const at = place ? MAP_REGION[place]?.label : undefined;
  return (
    <CardShell head={<Engraving name={PICTURE[top.kind]} width={460} height={128} />}>
      <View testID="moment-card">
        <Text style={[styles.title, { textAlign: 'center' }]}>{top.title}</Text>
        <Text style={[styles.date, { textAlign: 'center' }]}>{formatDate(top.day)}</Text>
        {top.lines?.length ? (
          <View style={{ marginTop: 10, gap: 4 }}>
            {top.lines.map((l, i) => (
              <Text key={i} style={styles.line}>
                {l}
              </Text>
            ))}
          </View>
        ) : null}
        {top.gained?.map(r => (
          <Land key={r} id={r} gained />
        ))}
        {top.lost?.map(r => (
          <Land key={r} id={r} gained={false} />
        ))}
        {sorted.length > 1 ? (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.also}>Also</Text>
            {sorted.slice(1).map(m => (
              <Text key={m.id} style={styles.other} numberOfLines={1}>
                • {m.title}
              </Text>
            ))}
          </View>
        ) : null}
        <Row style={{ marginTop: 16 }}>
          {at ? (
            <Btn
              style={{ flex: 1 }}
              tone="secondary"
              label="Show on map"
              onPress={() => {
                onClose();
                st.focusOn(at[0], at[1]);
              }}
            />
          ) : null}
          <Btn style={{ flex: 1 }} label="Continue" onPress={onClose} testID="moment-close" />
        </Row>
      </View>
    </CardShell>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: serif, fontSize: 22, color: G.text, letterSpacing: 0.5 },
  date: { fontFamily: sans, fontSize: 12, color: G.text3, marginTop: 3, letterSpacing: 0.4 },
  line: { fontFamily: book, fontSize: 16, lineHeight: 23, color: '#e6dfcf' },
  land: { fontFamily: sans, fontSize: 14, fontWeight: '600' },
  also: {
    fontFamily: sans,
    fontSize: 11,
    fontWeight: '700',
    color: G.gold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  other: { fontFamily: sans, fontSize: 14, color: G.text2, marginTop: 2 },
});
