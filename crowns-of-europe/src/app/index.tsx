/** Title screen: the known world under a dark veil, the arms of the game in gilt, and glass buttons. */
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ACHIEVEMENTS, CROWN, NATION, bindDisplay } from '../sim/content';
import { store } from '../state/store';
import { deleteSave, isAutoSlot, latestSave, listSaves, loadAchievements, loadGame, saveIsOld, type SaveMeta } from '../state/storage';
import { MiniMap } from '../ui/map/MiniMap';
import { Shield } from '../ui/components/Flag';
import { Glass } from '../ui/components/Glass';
import { Icon } from '../ui/components/Icon';
import { Btn, T } from '../ui/components/kit';
import { C, G, R, sans, serif } from '../ui/theme';
import { GiltRule } from '../ui/game/Panels';

/** The arms of the crown a save's realm had proclaimed, if any. */
const crownFlag = (m: SaveMeta) => (m.crown ? CROWN[m.crown]?.flag : undefined);

export default function Title() {
  const { width, height } = useWindowDimensions();
  const [latest, setLatest] = useState<SaveMeta | null>(null);
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [ach, setAch] = useState<string[]>([]);
  const [view, setView] = useState<'main' | 'load' | 'achievements'>('main');
  // Why a save would not open. Toasts belong to the game screen, so the title says it here.
  const [notice, setNotice] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      // Back on the title (also by the back button, which skips the store's unload): realms show as in 1444.
      bindDisplay(null);
      latestSave().then(setLatest);
      listSaves().then(setSaves);
      loadAchievements().then(setAch);
    }, []),
  );

  const open = async (m: SaveMeta) => {
    setNotice(null);
    const s = await loadGame(m.slot);
    if (!s) {
      setNotice((await saveIsOld(m.slot)) ? 'That save is from before Italy was redrawn and can no longer be loaded.' : 'That save could not be loaded.');
      return;
    }
    store.load(s);
    router.push('/game');
  };

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <MiniMap width={width} height={height} dim={0.55} />
      </View>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <Glass gilt radius={48} style={styles.crest}>
            <Icon name="crown" size={44} color={G.gold} />
          </Glass>
          <Text style={styles.title}>Crowns of Europe</Text>
          <GiltRule style={{ maxWidth: 280, marginTop: 10 }} />
          <Text style={styles.tag}>Grand strategy in your pocket · 1444–1750</Text>
          {notice ? (
            <Text style={styles.notice} testID="title-notice">
              {notice}
            </Text>
          ) : null}

          {view === 'main' ? (
            <View style={styles.menu}>
              {latest ? (
                <Pressable onPress={() => open(latest)} testID="continue">
                  <Glass gilt radius={R.lg} style={styles.continue}>
                    <Shield nation={latest.nation} size={38} flagDef={crownFlag(latest)} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contTitle}>Continue</Text>
                      <Text style={styles.contSub}>
                        {latest.nationName} · {latest.date}
                      </Text>
                    </View>
                    <View style={styles.contPlay}>
                      <Icon name="play" size={18} color="#1a1408" />
                    </View>
                  </Glass>
                </Pressable>
              ) : null}
              <Btn tone="gold" label="New campaign" icon="flag" onPress={() => router.push('/new-game')} testID="new-campaign" />
              <Btn tone="secondary" label="Load a save" icon="scroll" disabled={!saves.length} onPress={() => setView('load')} />
              <Btn tone="secondary" label={`Achievements (${ach.length}/${ACHIEVEMENTS.length})`} icon="star" onPress={() => setView('achievements')} />
            </View>
          ) : null}

          {view === 'load' ? (
            <View style={styles.menu}>
              {saves
                .sort((a, b) => b.savedAt - a.savedAt)
                .map(m => (
                  <View key={m.slot} style={styles.save}>
                    <Pressable onPress={() => open(m)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <Shield nation={m.nation} size={30} flagDef={crownFlag(m)} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.saveTitle}>
                          {m.nationName}
                          {m.ironman ? ' · Ironman' : ''}
                        </Text>
                        <Text style={styles.saveSub}>
                          {isAutoSlot(m.slot) ? 'Autosave' : `Slot ${m.slot}`} · {m.date}
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
  root: { flex: 1, backgroundColor: G.bg },
  content: { padding: 20, alignItems: 'center', minHeight: '100%', justifyContent: 'center' },
  crest: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontFamily: serif, fontSize: 36, color: G.text, textAlign: 'center', letterSpacing: 1.5 },
  tag: { fontFamily: sans, fontSize: 14, color: G.text2, marginTop: 8, textAlign: 'center', letterSpacing: 0.3 },
  menu: { width: '100%', maxWidth: 380, gap: 10, marginTop: 34 },
  notice: { fontFamily: sans, fontSize: 13, lineHeight: 18, color: G.bad, textAlign: 'center', marginTop: 14, maxWidth: 320 },
  continue: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  contTitle: { fontFamily: serif, fontSize: 19, color: G.text, letterSpacing: 0.5 },
  contSub: { fontFamily: sans, fontSize: 13, color: G.text2, marginTop: 2 },
  contPlay: { width: 38, height: 38, borderRadius: 19, backgroundColor: G.gold, alignItems: 'center', justifyContent: 'center' },
  save: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(18,22,29,0.82)', borderRadius: R.md, padding: 12, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: G.line },
  saveTitle: { fontFamily: sans, fontSize: 15, fontWeight: '700', color: G.text },
  saveSub: { fontFamily: sans, fontSize: 12.5, color: G.text2, marginTop: 2 },
  foot: { fontFamily: sans, fontSize: 12, color: G.text3, marginTop: 30, textAlign: 'center' },
});
