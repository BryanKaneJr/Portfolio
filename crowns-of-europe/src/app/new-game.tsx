/** Nation picker: majors by difficulty, then harder picks; options for difficulty and ironman. */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NATION, NATIONS, REGIONS, TRAITS } from '../sim/content';
import { newGame } from '../sim/state';
import type { GameSettings, NationDef } from '../sim/types';
import { store } from '../state/store';
import { saveGame } from '../state/storage';
import { Flag } from '../ui/components/Flag';
import { Icon } from '../ui/components/Icon';
import { Btn, Pill, Row, T } from '../ui/components/kit';
import { MiniMap } from '../ui/map/MiniMap';
import { C, sans, serif } from '../ui/theme';
import { modLines } from '../ui/describe';

const DIFF_LABEL = { easy: 'Easy', normal: 'Normal', hard: 'Hard', very_hard: 'Very hard' } as const;
const DIFF_COLOR = { easy: '#3d7a37', normal: '#2f5f8a', hard: '#a86b24', very_hard: '#a8382a' } as const;
const ORDER = ['easy', 'normal', 'hard', 'very_hard'] as const;

export default function NewGame() {
  const { width } = useWindowDimensions();
  const [pick, setPick] = useState<string>('POR');
  const [difficulty, setDifficulty] = useState<GameSettings['difficulty']>('normal');
  const [ironman, setIronman] = useState(false);
  const playable = useMemo(() => NATIONS.filter(n => n.playable).sort((a, b) => ORDER.indexOf(a.difficulty!) - ORDER.indexOf(b.difficulty!) || a.name.localeCompare(b.name)), []);
  const def = NATION[pick];
  const regions = REGIONS.filter(r => r.owner === pick);
  const dev = regions.reduce((t, r) => t + r.dev, 0);
  const trait = TRAITS.national[def.trait];

  const start = async () => {
    const s = newGame({ player: pick, difficulty, ironman, tutorial: pick === 'POR' || pick === 'CAS' });
    store.load(s);
    await saveGame('auto', s).catch(() => {});
    router.replace('/game');
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Row style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back} accessibilityLabel="Back">
          <Icon name="back" size={20} color={C.chromeText} />
        </Pressable>
        <Text style={styles.headTitle}>Choose your nation</Text>
        <View style={{ width: 36 }} />
      </Row>
      <View style={styles.preview}>
        <MiniMap width={width} height={170} focus={pick} />
        <View style={styles.previewBadge}>
          <Flag nation={pick} size={36} />
          <View>
            <Text style={styles.previewName}>{def.name}</Text>
            <Text style={styles.previewSub}>
              {regions.length} regions · development {dev}
            </Text>
          </View>
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 20 }}>
        <View style={styles.detail}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={styles.detailTitle}>{def.name}</Text>
            <Pill text={DIFF_LABEL[def.difficulty!]} color={DIFF_COLOR[def.difficulty!]} textColor="#fff" />
          </Row>
          <T v="small" style={{ marginTop: 4 }}>{def.desc}</T>
          <T v="small" style={{ marginTop: 6 }}>
            Ruler: {def.ruler.name} (skill {def.ruler.skill}){def.heir ? ` · heir ${def.heir.name}` : ''}
          </T>
          <T v="small" style={{ marginTop: 2 }}>
            {trait.name}: {modLines(trait.mods).map(m => m.text).join(', ')}
          </T>
          {pick === 'POR' || pick === 'CAS' ? <T v="tiny" style={{ marginTop: 6, color: C.green }}>Recommended for your first campaign.</T> : null}
        </View>

        {ORDER.map(d => {
          const list = playable.filter(n => n.difficulty === d);
          if (!list.length) return null;
          return (
            <View key={d} style={{ marginTop: 14 }}>
              <Text style={styles.group}>{DIFF_LABEL[d]}</Text>
              <View style={styles.grid}>
                {list.map(n => (
                  <NationCard key={n.id} n={n} on={n.id === pick} onPress={() => setPick(n.id)} />
                ))}
              </View>
            </View>
          );
        })}

        <Text style={[styles.group, { marginTop: 18 }]}>Options</Text>
        <View style={styles.detail}>
          <T v="small">AI strength</T>
          <Row gap={6} style={{ marginTop: 6 }}>
            {(['easy', 'normal', 'hard'] as const).map(x => (
              <Btn key={x} small style={{ flex: 1 }} tone={difficulty === x ? 'primary' : 'secondary'} label={x[0].toUpperCase() + x.slice(1)} onPress={() => setDifficulty(x)} />
            ))}
          </Row>
          <Row style={{ justifyContent: 'space-between', marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <T v="small">Ironman</T>
              <T v="tiny">One save that keeps itself up to date. No reloading.</T>
            </View>
            <Switch value={ironman} onValueChange={setIronman} trackColor={{ true: C.gold, false: C.parchmentLine }} />
          </Row>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Btn tone="gold" label={`Begin as ${def.name}`} sub="11 November 1444" icon="crown" onPress={start} testID="begin" />
      </View>
    </SafeAreaView>
  );
}

function NationCard({ n, on, onPress }: { n: NationDef; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.card, on && styles.cardOn]} testID={`nation-${n.id}`}>
      <Flag nation={n.id} size={30} />
      <Text style={styles.cardName} numberOfLines={1}>
        {n.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.parchment },
  head: { backgroundColor: C.chrome, height: 52, paddingHorizontal: 10, justifyContent: 'space-between' },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.chrome2, alignItems: 'center', justifyContent: 'center' },
  headTitle: { color: C.chromeText, fontFamily: serif, fontSize: 19, fontWeight: '700' },
  preview: { height: 170, backgroundColor: C.sea },
  previewBadge: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(33,24,16,0.85)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  previewName: { color: C.chromeText, fontFamily: serif, fontSize: 17, fontWeight: '700' },
  previewSub: { color: C.chromeMuted, fontFamily: sans, fontSize: 12 },
  detail: { backgroundColor: C.parchment2, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.parchmentLine },
  detailTitle: { fontFamily: serif, fontSize: 21, fontWeight: '700', color: C.ink },
  group: { fontFamily: sans, fontSize: 12, fontWeight: '800', color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { width: '31.5%', alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: C.parchment2, borderWidth: 2, borderColor: 'transparent' },
  cardOn: { borderColor: C.gold, backgroundColor: '#f6e7bf' },
  cardName: { fontFamily: sans, fontSize: 13, fontWeight: '700', color: C.ink, paddingHorizontal: 4 },
  footer: { padding: 12, borderTopWidth: 1, borderTopColor: C.parchmentLine },
});
