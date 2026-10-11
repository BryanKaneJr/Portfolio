/** How to play, and short first-time hints from your chancellor. */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { loadPrefs, savePrefs } from '../../state/storage';
import { availableAdvances } from '../../sim/science';
import { store, useStore } from '../../state/store';
import { Icon } from '../components/Icon';
import { Section, T } from '../components/kit';
import { C, sans, serif } from '../theme';
import { Panel } from './Panels';

const TOPICS: { title: string; body: string }[] = [
  { title: 'Time', body: 'The game runs in real time. Tap the round button to play or pause and pick 1×, 2× or 4× speed. It pauses itself for events, wars declared on you and offers (change this in Settings).' },
  { title: 'Armies', body: 'Tap your army (the numbered chip in your colour), then tap a region to march there. The number is regiments of 1,000 men. Recruit in any region you own: infantry is cheap and sturdy, cavalry hits hard on open ground, artillery (once you know Bombards) wins long battles and sieges. Zoomed out, the map shows only the armies that concern you (yours, your allies’, your enemies’ and any in your land); zoom in to see every army.' },
  { title: 'Battles', body: 'Battles start when enemies share a region and last several days, so you can send reinforcements. Each day both sides roll a die plus their general’s skill; damage is the roll times your front line. Rough terrain hurts the attacker. A side at zero morale retreats. Beat an army with five times its numbers and it is annihilated.' },
  { title: 'Supply', body: 'Each region feeds only so many regiments (see the army sheet). Above that, you lose men every month, worse in winter in the north and east. One great army of 40 regiments or two of 20? That’s the choice.' },
  { title: 'Sieges', body: 'Stand in an enemy region to take it: open regions fall in 15 days, forts take months and need 3 regiments per fort level. Enemy forts block your march past them.' },
  { title: 'War and peace', body: 'Declare war from a nation’s sheet. You need a reason (a claim, a holy war, a rival) or you lose order and gain Threat. Battles, occupied land, blockades and holding your war goal give you leverage; spend it in the peace deal on regions, gold or vassals. A peace brings a 10-year truce.' },
  { title: 'Threat and coalitions', body: 'Taking land raises your Threat, most with your neighbours and those of other faiths. When three or more fear you, they form a coalition that joins any war you start against a member. Threat fades slowly.' },
  { title: 'Money', body: 'Gold comes from taxes (higher in prosperous regions) and trade centres. Spend it on troops, prosperity, forts, integrating new land, science and order. Run out and you borrow; too much debt means bankruptcy.' },
  { title: 'New land', body: 'Conquered regions give half their taxes and levies until they are integrated (after 20 years, or pay to integrate them now). Different faith and recent conquest raise unrest; above 7, rebels may rise.' },
  { title: 'Diplomacy', body: 'Every nation has an opinion of you; tap it to see why. Ally against common threats, marry dynasties (a chance to inherit), declare rivals, demand vassalage from weak friends. Allies are called to your wars; refusing a defensive call breaks the alliance.' },
  { title: 'Science', body: 'Your scholars earn science every month. It comes mostly from how prosperous your richest regions are (not how much land you rule), from trade centres and universities, and is faster in learned lands like Italy and the West. Big realms pay more for each advance, so a small, rich crown can keep up with an empire. Spend science in the Science tab on three tracks of four advances: War (artillery, then stronger troops), Sea (the African coast, the New World, galleons) and Statecraft (more science, money and order). Funding your scholars (a switch) and universities buy science with gold. An advance taken long before its time costs more.' },
  { title: 'Policies', body: 'Policies are lasting choices of how you rule. You start with one slot and gain another for every three advances; some policies need an advance first.' },
  { title: 'Missions', body: 'Your nation’s missions (in the Realm menu) are concrete goals with rewards: claims for the next war, gold, renown and lasting bonuses.' },
  { title: 'Colonies and the New World', body: 'The African coast from Arguin to the Gold Coast is uncolonized: ivory, gold and fish for whoever settles it (you need Caravels). Across the Atlantic lie uncharted lands. A crown with an ocean coast that knows Ocean Navigation can fund an expedition west (Colonies tab); by 1500 everyone has heard of the New World, but settling it still needs Ocean Navigation. Then send colonists to the pale, uncolonized regions: each colonist settles one colony at a time, and a colony grows until it has 1,000 settlers and becomes a region of yours. Natives slow it down and may attack it; any of your regiments standing there keeps the settlers safe. Inland colonies grow slower, and the more land you hold across the ocean, the thinner your settlers spread. Every overseas region has an export (silver, sugar, furs...) that pays you each month. The Aztecs, Maya, K’iche’ and Haudenosaunee defend their own lands: conquer them in a holy war.' },
  { title: 'Ships and the ocean', body: 'An army boards from a coast when your transports are in that sea, and the fleet then carries it as far as it needs to go, across the ocean if you like. Crossing the open Atlantic takes weeks. A stronger enemy fleet bars the way.' },
  { title: 'Map modes', body: 'The chip at the top right switches the map: political, terrain, prosperity, faith, diplomatic (how others see you), threat, science and exports.' },
];

/** The game's own words for its numbers, so nothing on screen needs a wiki. */
export const GLOSSARY: { word: string; means: string }[] = [
  { word: 'Prosperity', means: 'How rich a region is, from 1 to 10. More prosperity means more taxes, levies and supply. Pay gold to raise it.' },
  { word: 'Levies', means: 'Men your realm can call up. Raising a regiment takes 1,000; losses are refilled from here.' },
  { word: 'Order', means: 'How settled your realm is, from −3 to +3. Each point is 5% more taxes and less unrest.' },
  { word: 'Renown', means: 'Your crown’s good name, won in battles, wars and missions. Others like you more and your Threat fades faster.' },
  { word: 'Threat', means: 'How much other crowns fear your conquests. Neighbours and other faiths feel it most.' },
  { word: 'Coalition', means: 'Three or more crowns that fear you, banded together: they all join any war you start on one of them.' },
  { word: 'Leverage', means: 'How far ahead you are in a war, from −100% to +100%. Spend it on the terms of the peace.' },
  { word: 'Claim', means: 'Your right to a region: a reason for war, and cheaper to take in the peace.' },
  { word: 'Integrated', means: 'Land that is fully part of your realm: full taxes and levies. Conquests take 20 years, or gold.' },
  { word: 'War exhaustion', means: 'Grows as a war drags on and men die. It slows your levies and raises unrest; peace lets it fade.' },
  { word: 'Policy', means: 'A lasting choice of how you rule, with its own bonuses. One slot, and one more for every three advances.' },
  { word: 'Mission', means: 'A goal your nation wants to reach, with a reward when you do.' },
  { word: 'Colonist', means: 'Each one can settle one colony at a time overseas.' },
  { word: 'Export', means: 'What an overseas region sends home: gold every month, on top of its taxes.' },
  { word: 'Science', means: 'What your scholars earn each month and spend on advances.' },
  { word: 'Advance', means: 'A step forward in war, at sea or in statecraft: it unlocks things (artillery, colonies, galleons) or makes you stronger.' },
  { word: 'Age', means: 'How modern your troops are, from Late Medieval to Absolutism. The war advances raise it.' },
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
      <Section title="Words used in this game">
        {GLOSSARY.map(g => (
          <T key={g.word} v="small" style={{ marginBottom: 6 }}>
            <Text style={styles.word}>{g.word}: </Text>
            {g.means}
          </T>
        ))}
      </Section>
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
    id: 'science',
    text: 'Your scholars have nothing to study. Open the Realm menu, go to Science and pick an advance: artillery, colonies and stronger troops all come from science.',
    when: () => !!store.state && !store.state.nations[store.state.player].researching && availableAdvances(store.state, store.state.player).length > 0,
  },
  {
    id: 'war',
    text: 'You are at war. Occupy enemy regions and win battles to gain leverage (the red chip at the top). Tap it to make peace when you’re ahead.',
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
  word: { fontWeight: '800', color: C.ink },
});
