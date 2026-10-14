/** Nation picker: the great powers in a strip, then every nation by area; options for difficulty and ironman. */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CROWNS, NATION, NATIONS, REGIONS, SCENARIO, TRAITS } from '../sim/content';
import { newGame } from '../sim/state';
import type { GameSettings, NationDef } from '../sim/types';
import { store } from '../state/store';
import { saveGame } from '../state/storage';
import { Shield } from '../ui/components/Flag';
import { Glass } from '../ui/components/Glass';
import { Icon } from '../ui/components/Icon';
import { Btn, Pill, Row, T } from '../ui/components/kit';
import { MiniMap } from '../ui/map/MiniMap';
import { C, G, R, sans, serif } from '../ui/theme';
import { GiltRule } from '../ui/game/Panels';
import { modLines } from '../ui/describe';

const DIFF_LABEL = { easy: 'Easy', normal: 'Normal', hard: 'Hard', very_hard: 'Very hard' } as const;
const DIFF_COLOR = { easy: G.good, normal: G.info, hard: G.warn, very_hard: G.bad } as const;
const ORDER = ['easy', 'normal', 'hard', 'very_hard'] as const;
/** Where the picker lists each nation (its `area`), in the order shown. */
const AREA_LABEL: Record<string, string> = {
  british_isles: 'British Isles',
  france: 'France and the Low Countries',
  iberia: 'Iberia',
  italy: 'Italy',
  empire: 'The Empire',
  north: 'Scandinavia and the Baltic',
  east: 'Poland and the East',
  balkans: 'The Balkans and Anatolia',
  middle_east: 'The Middle East',
  africa: 'North and West Africa',
  new_world: 'The New World',
};
const byDifficulty = (a: NationDef, b: NationDef) => ORDER.indexOf(a.difficulty!) - ORDER.indexOf(b.difficulty!) || a.name.localeCompare(b.name);
const GREAT_POWERS = NATIONS.filter(n => n.playable).sort(byDifficulty);
const BY_AREA = Object.keys(AREA_LABEL).map(area => ({ area, list: NATIONS.filter(n => n.area === area).sort(byDifficulty) }));

/** One line on how the nation starts, where it matters: someone's subject, or a New World people. */
function standing(id: string): string | null {
  if (NATION[id].native) return 'New World people: no science or treaties; Europeans arrive around 1500.';
  const sub = SCENARIO.subjects.find(x => x.subject === id);
  if (!sub) return null;
  return `${sub.type === 'union' ? 'Junior partner of' : 'Vassal of'} ${NATION[sub.overlord].name}.`;
}

/** The greater crowns a nation can proclaim, and those they lead on to. */
function crownsLine(id: string): string {
  const first = CROWNS.filter(c => c.formers.includes(id));
  if (!first.length) return 'No greater crown.';
  const seen = new Set(first.map(c => c.id));
  const later: typeof CROWNS = [];
  for (let i = 0; i < CROWNS.length; i++) {
    const next = CROWNS.filter(c => !seen.has(c.id) && c.formers.some(f => seen.has(f)));
    if (!next.length) break;
    for (const c of next) seen.add(c.id);
    later.push(...next);
  }
  return `Can proclaim: ${first.map(c => c.name).join(', ')}${later.length ? `, then ${later.map(c => c.name).join(', ')}` : ''}.`;
}

export default function NewGame() {
  const { width } = useWindowDimensions();
  const [pick, setPick] = useState<string>('POR');
  const [difficulty, setDifficulty] = useState<GameSettings['difficulty']>('normal');
  const [ironman, setIronman] = useState(false);
  const def = NATION[pick];
  const regions = REGIONS.filter(r => r.owner === pick);
  const dev = regions.reduce((t, r) => t + r.dev, 0);
  const trait = TRAITS.national[def.trait];
  const stand = useMemo(() => standing(pick), [pick]);
  const crowns = useMemo(() => crownsLine(pick), [pick]);

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
          <Icon name="back" size={18} color={G.text2} />
        </Pressable>
        <Text style={styles.headTitle}>Choose your nation</Text>
        <View style={{ width: 32 }} />
      </Row>
      <GiltRule />
      <View style={styles.preview}>
        <MiniMap width={width - 24} height={180} focus={pick} charted={!!def.native} />
        <Glass gilt radius={R.md} style={styles.previewBadge}>
          <Shield nation={pick} size={30} />
          <View>
            <Text style={styles.previewName}>{def.name}</Text>
            <Text style={styles.previewSub}>
              {regions.length} {regions.length === 1 ? 'region' : 'regions'} · prosperity {dev} · <Text style={{ color: DIFF_COLOR[def.difficulty!] }}>{DIFF_LABEL[def.difficulty!]}</Text>
            </Text>
          </View>
        </Glass>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 20 }}>
        <View style={styles.detail}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={styles.detailTitle}>{def.name}</Text>
            <Pill text={DIFF_LABEL[def.difficulty!]} color="rgba(255,255,255,0.07)" textColor={DIFF_COLOR[def.difficulty!]} />
          </Row>
          <T v="small" style={{ marginTop: 4 }}>{def.desc}</T>
          <T v="small" style={{ marginTop: 6 }}>
            Ruler: {def.ruler.name} (skill {def.ruler.skill}){def.heir ? ` · heir ${def.heir.name}` : ''}
          </T>
          <T v="small" style={{ marginTop: 2 }}>
            {trait.name}: {modLines(trait.mods).map(m => m.text).join(', ')}
          </T>
          {stand ? <T v="small" style={{ marginTop: 2, color: G.warn }}>{stand}</T> : null}
          <T v="small" style={{ marginTop: 2 }}>{crowns}</T>
          {pick === 'POR' || pick === 'CAS' ? <T v="tiny" style={{ marginTop: 6, color: C.green }}>Recommended for your first campaign.</T> : null}
        </View>

        <Text style={[styles.group, { marginTop: 14 }]}>Great powers</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {GREAT_POWERS.map(n => (
            <NationCard key={n.id} n={n} on={n.id === pick} onPress={() => setPick(n.id)} strip />
          ))}
        </ScrollView>

        {BY_AREA.map(({ area, list }) => (
          <View key={area} style={{ marginTop: 14 }}>
            <Text style={styles.group}>{AREA_LABEL[area]}</Text>
            <View style={styles.grid}>
              {list.map(n => (
                <NationCard key={n.id} n={n} on={n.id === pick} onPress={() => setPick(n.id)} />
              ))}
            </View>
          </View>
        ))}

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
            <Switch value={ironman} onValueChange={setIronman} trackColor={{ true: G.gold, false: G.raised }} thumbColor="#f4f1ea" />
          </Row>
        </View>
      </ScrollView>
      <Glass radius={0} shadow={false} style={styles.footer}>
        <Btn tone="gold" label={`Begin as ${def.name}`} sub="11 November 1444" icon="crown" onPress={start} testID="begin" />
      </Glass>
    </SafeAreaView>
  );
}

function NationCard({ n, on, onPress, strip }: { n: NationDef; on: boolean; onPress: () => void; strip?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, strip && styles.cardStrip, on && styles.cardOn, pressed && { opacity: 0.8 }]} testID={`nation-${n.id}`}>
      <View style={[styles.dot, { backgroundColor: DIFF_COLOR[n.difficulty!] }]} />
      <Shield nation={n.id} size={26} rim={on ? G.goldBright : 'rgba(214,178,110,0.6)'} />
      <Text style={styles.cardName} numberOfLines={1}>
        {n.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg },
  head: { height: 54, paddingHorizontal: 14, justifyContent: 'space-between' },
  back: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.09)', alignItems: 'center', justifyContent: 'center' },
  headTitle: { color: G.text, fontFamily: serif, fontSize: 19, letterSpacing: 1 },
  preview: { height: 180, marginHorizontal: 12, marginTop: 6, borderRadius: R.lg, overflow: 'hidden', backgroundColor: C.sea, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: G.gilt },
  previewBadge: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  previewName: { color: G.text, fontFamily: serif, fontSize: 17, letterSpacing: 0.4 },
  previewSub: { color: G.text2, fontFamily: sans, fontSize: 12, marginTop: 1 },
  detail: { backgroundColor: G.group, borderRadius: R.lg, padding: 14 },
  detailTitle: { fontFamily: serif, fontSize: 21, color: G.text, letterSpacing: 0.4 },
  group: { fontFamily: serif, fontSize: 12.5, color: G.gold, textTransform: 'uppercase', letterSpacing: 1.6, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { width: '31.5%', alignItems: 'center', gap: 6, paddingVertical: 9, borderRadius: R.md, backgroundColor: G.group, borderWidth: 1, borderColor: 'transparent' },
  cardStrip: { width: 104 },
  dot: { position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: 4 },
  cardOn: { borderColor: G.gilt, backgroundColor: 'rgba(214,178,110,0.14)' },
  cardName: { fontFamily: sans, fontSize: 13, fontWeight: '600', color: G.text, paddingHorizontal: 4 },
  footer: { padding: 12, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: G.line },
});
