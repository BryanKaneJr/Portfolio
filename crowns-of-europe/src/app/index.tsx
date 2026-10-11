/** Title screen: continue, new campaign, load, achievements. */
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ACHIEVEMENTS, NATION } from '../sim/content';
import { store } from '../state/store';
import { deleteSave, latestSave, listSaves, loadAchievements, loadGame, type SaveMeta } from '../state/storage';
import { MiniMap } from '../ui/map/MiniMap';
import { Flag } from '../ui/components/Flag';
import { Icon } from '../ui/components/Icon';
import { Btn, T } from '../ui/components/kit';
import { C, sans, serif } from '../ui/theme';

export default function Title() {
  const { width, height } = useWindowDimensions();
  const [latest, setLatest] = useState<SaveMeta | null>(null);
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [ach, setAch] = useState<string[]>([]);
  const [view, setView] = useState<'main' | 'load' | 'achievements'>('main');

  useFocusEffect(
    useCallback(() => {
      latestSave().then(setLatest);
      listSaves().then(setSaves);
      loadAchievements().then(setAch);
    }, []),
  );

  const open = async (m: SaveMeta) => {
    const s = await loadGame(m.slot);
    if (!s) {
      store.toast('That save could not be loaded.', 'bad');
      return;
    }
    store.load(s);
    router.push('/game');
  };

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <MiniMap width={width} height={height} dim={0.62} />
      </View>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.crest}>
            <Icon name="crown" size={44} color={C.gold} />
          </View>
          <Text style={styles.title}>Crowns of Europe</Text>
          <Text style={styles.tag}>Grand strategy in your pocket · 1444–1750</Text>

          {view === 'main' ? (
            <View style={styles.menu}>
              {latest ? (
                <Pressable onPress={() => open(latest)} style={styles.continue} testID="continue">
                  <Flag nation={latest.nation} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contTitle}>Continue</Text>
                    <Text style={styles.contSub}>
                      {latest.nationName} · {latest.date}
                    </Text>
                  </View>
                  <Icon name="play" size={22} color={C.chrome} />
                </Pressable>
              ) : null}
              <Btn tone="gold" label="New campaign" icon="flag" onPress={() => router.push('/new-game')} testID="new-campaign" />
              <Btn label="Load a save" icon="scroll" disabled={!saves.length} onPress={() => setView('load')} />
              <Btn label={`Achievements (${ach.length}/${ACHIEVEMENTS.length})`} icon="star" onPress={() => setView('achievements')} />
            </View>
          ) : null}

          {view === 'load' ? (
            <View style={styles.menu}>
              {saves
                .sort((a, b) => b.savedAt - a.savedAt)
                .map(m => (
                  <View key={m.slot} style={styles.save}>
                    <Pressable onPress={() => open(m)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <Flag nation={m.nation} size={34} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.saveTitle}>
                          {m.nationName}
                          {m.ironman ? ' · Ironman' : ''}
                        </Text>
                        <Text style={styles.saveSub}>
                          {m.slot === 'auto' ? 'Autosave' : `Slot ${m.slot}`} · {m.date}
                        </Text>
                      </View>
                    </Pressable>
                    <Pressable
                      hitSlop={10}
                      onPress={async () => {
                        await deleteSave(m.slot).catch(() => {});
                        setSaves(await listSaves());
                        setLatest(await latestSave());
                      }}
                      accessibilityLabel="Delete save"
                    >
                      <Icon name="close" size={18} color={C.chromeMuted} />
                    </Pressable>
                  </View>
                ))}
              <Btn tone="secondary" label="Back" onPress={() => setView('main')} />
            </View>
          ) : null}

          {view === 'achievements' ? (
            <View style={styles.menu}>
              {ACHIEVEMENTS.map(a => {
                const got = ach.includes(a.id);
                return (
                  <View key={a.id} style={[styles.save, !got && { opacity: 0.6 }]}>
                    <Icon name="star" size={22} color={got ? C.gold : C.chromeMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.saveTitle}>{a.title}</Text>
                      <Text style={styles.saveSub}>
                        {a.desc}
                        {a.nations ? ` (${a.nations.map(n => NATION[n]?.name ?? n).join(', ')})` : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
              {!ACHIEVEMENTS.length ? <T style={{ color: C.chromeText }}>No achievements defined.</T> : null}
              <Btn tone="secondary" label="Back" onPress={() => setView('main')} />
            </View>
          ) : null}

          <Text style={styles.foot}>Pay once, play offline. No ads, no purchases.</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.chrome },
  content: { padding: 20, alignItems: 'center', minHeight: '100%', justifyContent: 'center' },
  crest: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: C.gold, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(33,24,16,0.7)', marginBottom: 12 },
  title: { fontFamily: serif, fontSize: 38, fontWeight: '700', color: C.chromeText, textAlign: 'center', letterSpacing: 0.5 },
  tag: { fontFamily: sans, fontSize: 14, color: C.chromeMuted, marginTop: 6, textAlign: 'center' },
  menu: { width: '100%', maxWidth: 380, gap: 10, marginTop: 30 },
  continue: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.parchment, borderRadius: 12, padding: 12, borderWidth: 2, borderColor: C.gold },
  contTitle: { fontFamily: serif, fontSize: 20, fontWeight: '700', color: C.ink },
  contSub: { fontFamily: sans, fontSize: 13, color: C.inkSoft },
  save: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(33,24,16,0.85)', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.chromeLine },
  saveTitle: { fontFamily: sans, fontSize: 15, fontWeight: '700', color: C.chromeText },
  saveSub: { fontFamily: sans, fontSize: 12, color: C.chromeMuted, marginTop: 2 },
  foot: { fontFamily: sans, fontSize: 12, color: C.chromeMuted, marginTop: 28, textAlign: 'center' },
});
