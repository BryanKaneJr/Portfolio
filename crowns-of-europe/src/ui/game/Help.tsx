/** How to play, and short first-time hints from your chancellor. */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { loadPrefs, savePrefs } from '../../state/storage';
import { store, useStore } from '../../state/store';
import { Icon } from '../components/Icon';
import { Section, T } from '../components/kit';
import { C, sans, serif } from '../theme';
import { Panel } from './Panels';

const TOPICS: { title: string; body: string }[] = [
  { title: 'Time', body: 'The game runs in real time. Tap the round button to play or pause and pick 1×, 2× or 4× speed. It pauses itself for events, wars declared on you and offers (change this in Settings).' },
  { title: 'Armies', body: 'Tap your army (the numbered chip in your colour), then tap a region to march there. The number is regiments of 1,000 men. Recruit in any region you own: infantry is cheap and sturdy, cavalry hits hard on open ground, artillery (from 1500) wins long battles and sieges.' },
  { title: 'Battles', body: 'Battles start when enemies share a region and last several days, so you can send reinforcements. Each day both sides roll a die plus their general’s skill; damage is the roll times your front line. Rough terrain hurts the attacker. A side at zero morale retreats. Beat an army with five times its numbers and it is annihilated.' },
  { title: 'Supply', body: 'Each region feeds only so many regiments (see the army sheet). Above that, you lose men every month, worse in winter in the north and east. One 40-regiment doomstack or two of 20? That’s the choice.' },
  { title: 'Sieges', body: 'Stand in an enemy region to take it: open regions fall in 15 days, forts take months and need 3 regiments per fort level. Enemy forts block your march past them.' },
  { title: 'War and peace', body: 'Declare war from a nation’s sheet. You need a reason (a claim, a holy war, a rival) or you lose stability and gain Threat. War score comes from battles, occupation, blockades and your war goal. Spend it in the peace deal on regions, gold or vassals. A peace brings a 10-year truce.' },
  { title: 'Threat and coalitions', body: 'Taking land raises your Threat, most with your neighbours and those of other faiths. When three or more fear you, they form a coalition that joins any war you start against a member. Threat fades slowly.' },
  { title: 'Money', body: 'Gold comes from taxes (development) and trade centres. Spend it on troops, development, forts, coring new land, the next era, and stability. Run out and you borrow; too much debt means bankruptcy.' },
  { title: 'New land', body: 'Conquered regions give half their taxes and manpower until they become cores (after 20 years, or pay to core them now). Different faith and recent conquest raise unrest; above 7, rebels may rise.' },
  { title: 'Diplomacy', body: 'Every nation has an opinion of you; tap it to see why. Ally against common threats, marry dynasties (a chance to inherit), declare rivals, demand vassalage from weak friends. Allies are called to your wars; refusing a defensive call breaks the alliance.' },
  { title: 'Eras and policies', body: 'Four eras: Late Medieval, Renaissance (1500), Wars of Religion (1575), Absolutism (1650). When one begins you pay gold to adopt it for better troops and a new policy slot.' },
  { title: 'Missions', body: 'Your nation’s missions (in the Realm menu) are concrete goals with rewards: claims for the next war, gold, prestige and lasting bonuses.' },
  { title: 'The New World', body: 'Across the Atlantic lie uncharted lands. From 1470 a crown with an ocean coast can fund an expedition west (Colonies tab); by 1500 everyone knows the way. Then send colonists to the pale, uncolonized regions: a colony grows until it has 1,000 settlers and becomes a region of yours. Natives slow it down and may attack it; any of your regiments standing there keeps the settlers safe. Every New World region trades in a good (silver, sugar, furs...) that pays you each month. The Aztecs, Maya, K’iche’ and Haudenosaunee defend their own lands: conquer them in a holy war.' },
  { title: 'Ships and the ocean', body: 'An army boards from a coast when your transports are in that sea, and the fleet then carries it as far as it needs to go, across the ocean if you like. Crossing the open Atlantic takes weeks. A stronger enemy fleet bars the way.' },
  { title: 'Map modes', body: 'The chip at the top right switches the map: political, terrain, development, faith, diplomatic (how others see you), threat and trade goods.' },
];

export function HelpPanel() {
  const st = useStore();
  return (
    <Panel title="How to play" onClose={() => st.close()}>
      {TOPICS.map(t => (
        <Section key={t.title} title={t.title}>
          <T v="small">{t.body}</T>
        </Section>
      ))}
    </Panel>
  );
}

// ---------------------------------------------------------------- first-time hints

interface Hint {
  id: string;
  text: string;
  when: () => boolean;
}

const HINTS: Hint[] = [
  {
    id: 'start',
    text: 'Welcome, Your Majesty. Tap the play button to start time. Tap your army (the chip in your colour) and then a region to march. The Realm menu holds missions, diplomacy and the treasury.',
    when: () => true,
  },
  {
    id: 'army',
    text: 'Army selected. Tap any region to march there; the dashed line shows the route. Watch the supply limit: too many regiments in one region starve.',
    when: () => store.selection?.kind === 'army' && store.state?.armies[store.selection.id]?.owner === store.state?.player,
  },
  {
    id: 'war',
    text: 'You are at war. Occupy enemy regions and win battles to raise your war score (the red chip at the top). Tap it to negotiate peace when you’re ahead.',
    when: () => !!store.state && Object.values(store.state.wars).some(w => w.attackers.includes(store.state!.player) || w.defenders.includes(store.state!.player)),
  },
  {
    id: 'newworld',
    text: 'A New World has been found! Open the Colonies tab in the Realm menu to see your colonists, then tap a pale, uncolonized region across the Atlantic and choose Start a colony.',
    when: () => !!store.state?.discovery,
  },
  {
    id: 'mission',
    text: 'A mission is ready. Open the Realm menu (the gold button) and tap Complete to collect the reward.',
    when: () => !!store.state && Object.keys(store.state.nations[store.state.player].flags).some(f => f.startsWith('_mready_')),
  },
];

export function Hints() {
  const st = useStore();
  const [seen, setSeen] = useState<string[] | null>(null);
  useEffect(() => {
    loadPrefs().then(p => setSeen(p.hintsSeen));
  }, []);
  if (!seen || st.overlay || st.state?.pendingEvents.length || st.state?.offers.length) return null;
  const hint = HINTS.find(h => !seen.includes(h.id) && h.when());
  if (!hint) return null;
  const dismiss = async () => {
    const next = [...seen, hint.id];
    setSeen(next);
    const p = await loadPrefs();
    await savePrefs({ ...p, hintsSeen: next }).catch(() => {});
  };
  return (
    <View style={styles.hint}>
      <Icon name="scroll" size={22} color={C.goldDark} />
      <View style={{ flex: 1 }}>
        <Text style={styles.hintTitle}>Your chancellor advises</Text>
        <Text style={styles.hintText}>{hint.text}</Text>
      </View>
      <Pressable onPress={dismiss} hitSlop={10} style={styles.hintBtn} accessibilityLabel="Got it" testID="hint-ok">
        <Text style={styles.hintBtnText}>Got it</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { position: 'absolute', left: 10, right: 10, bottom: 10, flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: C.parchment, borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: C.goldDark, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  hintTitle: { fontFamily: serif, fontSize: 14, fontWeight: '700', color: C.ink },
  hintText: { fontFamily: sans, fontSize: 13, color: C.inkSoft, marginTop: 2, lineHeight: 18 },
  hintBtn: { backgroundColor: C.chrome2, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  hintBtnText: { color: C.chromeText, fontFamily: sans, fontWeight: '700', fontSize: 13 },
});
