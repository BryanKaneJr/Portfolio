/** How to play, and short first-time hints from your chancellor. */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadPrefs, savePrefs } from '../../state/storage';
import { attackChance, canGrow, charted, coloniesOf, colonialCrown, freeColonists, newWorldRegions } from '../../sim/colonies';
import { availableAdvances } from '../../sim/science';
import { store, useStore } from '../../state/store';
import { Glass } from '../components/Glass';
import { Icon } from '../components/Icon';
import { Section, T } from '../components/kit';
import { C, G, R, sans, serif } from '../theme';
import { DOCK_H } from './Bars';
import { dockTop, sheetHeight } from '../layout';
import { Panel } from './Panels';

const TOPICS: { title: string; body: string }[] = [
  { title: 'Time', body: 'The game runs in real time. Tap the round button to play or pause and pick 1×, 2× or 4× speed. It pauses itself for events, wars declared on you, an ally under attack calling you to arms, and ultimatums; other offers and your battles drop in as notices instead (tap one, or find it under the bell). Change what pauses in Settings.' },
  { title: 'Armies', body: 'Tap your army (soldiers under your banner), then tap a region to march there. The number beside it is regiments of 1,000 men. Armies and fleets show once you zoom in far enough to read the regions’ names; zoomed out, the map shows the realms. Recruit in any region you own: infantry is cheap and sturdy, cavalry hits hard on open ground, artillery (once you know Bombards) wins long battles and sieges. You see only the armies and fleets you would know about: yours, your friends’, your enemies’ in a war, and any in your land.' },
  { title: 'Battles', body: 'Battles start when enemies share a region (enemies marching past each other on the same road meet and fight) and last several days, so you can send reinforcements. Each day both sides roll a die; damage is the roll times your front line. A general has one to five stars, each adding 10% to everything their army does (damage, steadiness, march and siege speed). Rough terrain and rivers hurt the army that marched in, but not when both sides were already standing there (a pitched battle). A side at zero morale retreats; cut off with nowhere to go, it scatters. Beat an army with five times its numbers and it is annihilated.' },
  { title: 'Supply', body: 'Each region feeds only so many regiments (see the army sheet). Above that, you lose men every month, worse in winter in the north and east. One great army of 40 regiments or two of 20? That’s the choice.' },
  { title: 'Sieges', body: 'Stand in an enemy region to take it: open regions fall in 15 days, and a colony across the ocean, its settlers holding out in their stockades, in 60. Forts take months and need 3 regiments per fort level. Enemy forts block your march past them.' },
  { title: 'War and peace', body: 'Declare war from a nation’s sheet. You need a reason (a claim, a holy war, a rival) or you lose order and gain Threat. Battles, occupied land, blockades and holding your war goal give you leverage; spend it in the peace deal on regions, gold or vassals (a big realm’s capital costs double). Losing? Offer your own peace: any of your regions, or gold. Land near them, claimed, wanted or held by them, or the war goal is worth its full price to them; land far away, half. They accept when it covers their leverage. At 99% leverage an enemy sends an ultimatum, never asking more than its leverage: make peace within a month or push it below 99%, or its terms are imposed. A crown that goes to war for one region on its border fights a limited war: if it wins, it takes only that region (and gold). A peace brings a 10-year truce, and a truce binds: neither side may join a war against the other. A battle at the walls only pauses a siege.' },
  { title: 'Threat and coalitions', body: 'Taking land raises your Threat, most with your neighbours and those of other faiths. When three or more fear you, they form a coalition that joins any war you start against a member. Threat fades slowly.' },
  { title: 'Money', body: 'Gold comes from taxes (higher in prosperous regions) and trade centres. Spend it on troops, prosperity, forts, integrating new land, science and order. Run out and you borrow; too much debt means bankruptcy. Gold that events ask for or give grows with your realm’s prosperity; each choice shows the sum.' },
  { title: 'New land', body: 'Conquered regions give half their taxes and levies until they are integrated (after 20 years, or pay to integrate them now). Different faith and recent conquest raise unrest; above 7, rebels may rise.' },
  { title: 'Diplomacy', body: 'Every nation has an opinion of you; tap it to see why. Ally against common threats, marry dynasties (a chance to inherit), declare rivals, demand vassalage from weak friends. Allies always come to defend you (refusing breaks the alliance), but join your attacks only if they live nearby and want something from the enemy: land, or a rival brought low. The same holds for you: refuse an ally under attack, or leave its call unanswered until it lapses, and the alliance breaks.' },
  { title: 'Science', body: 'Your scholars earn science every month. It comes mostly from how prosperous your richest regions are (not how much land you rule), from trade centres and universities, and is faster in learned lands like Italy and the West. Big realms pay more for each advance, so a small, rich crown can keep up with an empire. Spend science in the Science tab on three tracks of four advances: War (artillery, then stronger troops), Sea (the African coast, the New World, galleons) and Statecraft (more science, money and order). Funding your scholars (a switch) and universities buy science with gold. An advance taken long before its time costs more.' },
  { title: 'Policies', body: 'Policies are lasting choices of how you rule. You start with one slot and gain another for every three advances; some policies need an advance first.' },
  { title: 'Missions', body: 'Your nation’s missions (in the Realm menu) are concrete goals with rewards: claims for the next war, gold, renown and lasting bonuses.' },
  { title: 'Colonies and the New World', body: 'The African coast from Arguin to the Gold Coast is uncolonized: ivory, gold and fish for whoever settles it (you need Caravels and a colonist). Across the Atlantic lie uncharted lands: a crown with an ocean coast that knows Ocean Navigation can fund an expedition west (Colonies tab), and by 1500 everyone knows the way. A Christian crown on the ocean gets a colonist when it learns Ocean Navigation and a second with Galleons and 30 prosperity at home; policies, events and missions add more. Each colonist settles one colony at a time, and a colony becomes a region of yours at 1,000 settlers. The Colonies tab lists where to settle. Where natives live, choose: trade with them (settlers lose 15% of their pace, but the natives keep the peace unless fierce and join a richer colony) or take the land (slower the more of them there are, and they may attack). A trading colony can take the land later, never the reverse. Paid guards or any regiment of yours keep settlers safe from natives. In a war, enemy troops raid colonies being settled unless your troops are there, and a founded colony holds out 60 days. With no land left, send a colonist to grow one of your colonies: +1 prosperity per 500 settlers, up to 8. Every overseas region has an export (silver, sugar, furs...) that pays you each month. The Aztecs, Maya, K’iche’ and Haudenosaunee defend their own lands: conquer them in a holy war.' },
  { title: 'Ships and the ocean', body: 'An army boards from a coast when your transports are in that sea, and the fleet then carries it as far as it needs to go, across the ocean if you like. Crossing the open Atlantic takes weeks. A stronger enemy fleet bars the way.' },
  { title: 'Map modes', body: 'The lens button on the right switches the map: political, terrain, prosperity, faith, diplomatic (how others see you), threat, science and exports.' },
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
  { word: 'Colonist', means: 'Each one settles one colony overseas at a time, or grows one of your colonies there.' },
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
    text: 'Welcome, Your Majesty. Tap play to start time. To march, tap your army (the soldier in your colour), then a region. The ? buttons explain anything you wonder about.',
    when: () => true,
  },
  {
    id: 'army',
    text: 'Tap any region to march there.',
    when: () => store.selection?.kind === 'army' && store.state?.armies[store.selection.id]?.owner === store.state?.player,
  },
  {
    id: 'science',
    text: 'Your scholars are idle: pick an advance under Learning.',
    when: () => !!store.state && !store.state.nations[store.state.player].researching && availableAdvances(store.state, store.state.player).length > 0,
  },
  {
    id: 'war',
    text: 'At war: win battles and take their land for leverage. Tap their burning arms on the left to make peace.',
    when: () => !!store.state && Object.values(store.state.wars).some(w => w.attackers.includes(store.state!.player) || w.defenders.includes(store.state!.player)),
  },
  {
    id: 'newworld',
    text: 'A New World has been found! See where to settle under Realm, Colonies, or tap a pale region across the Atlantic.',
    when: () => !!store.state?.discovery && colonialCrown(store.state, store.state.player),
  },
  {
    id: 'natives',
    text: 'Natives may attack your settlers. Guard the colony from its sheet, or station a regiment there.',
    when: () => !!store.state && coloniesOf(store.state, store.state.player).some(r => attackChance(store.state!, r) > 0),
  },
  {
    id: 'grow',
    text: 'Your colonists are idle and no land is left to settle. Tap a colony of yours across the ocean and grow it.',
    when: () => {
      const s = store.state;
      if (!s || freeColonists(s, s.player) <= 0 || Object.values(s.regions).some(r => !r.owner && !r.colony && charted(s, r.id))) return false;
      return newWorldRegions(s, s.player).some(r => !canGrow(s, s.player, r.id));
    },
  },
  {
    id: 'mission',
    text: 'A mission is ready: collect it under Realm, Missions.',
    when: () => !!store.state && Object.keys(store.state.nations[store.state.player].flags).some(f => f.startsWith('_mready_')),
  },
];

/** First-time tips, one at a time: above the dock, or just above an open sheet (clear of every control). */
export function Hints({ sheet }: { sheet?: 'compact' | 'half' }) {
  const { height } = useWindowDimensions();
  const st = useStore();
  const insets = useSafeAreaInsets();
  const [seen, setSeen] = useState<string[] | null>(null);
  useEffect(() => {
    loadPrefs().then(p => setSeen(p.hintsSeen));
  }, []);
  if (!seen || st.overlay || st.state?.pendingEvents.length) return null;
  const hint = HINTS.find(h => !seen.includes(h.id) && h.when());
  if (!hint) return null;
  const dismiss = async () => {
    const next = [...seen, hint.id];
    setSeen(next);
    const p = await loadPrefs();
    await savePrefs({ ...p, hintsSeen: next }).catch(() => {});
  };
  return (
    <View style={[styles.hintWrap, { bottom: sheet ? dockTop(insets.bottom) + sheetHeight(height, sheet === 'compact') + 8 : insets.bottom + 8 + DOCK_H + 12 }]} pointerEvents="box-none">
      {/* Only "Got it" takes a tap: the rest lets taps through to the map beneath (the tip may cover where it says to tap). */}
      <Glass strong gilt radius={R.lg} style={styles.hint} pointerEvents="box-none">
        <View style={styles.hintIcon} pointerEvents="none">
          <Icon name="scroll" size={18} color={G.gold} />
        </View>
        <View style={{ flex: 1 }} pointerEvents="none">
          <Text style={styles.hintTitle}>Your chancellor advises</Text>
          <Text style={styles.hintText}>{hint.text}</Text>
        </View>
        <Pressable onPress={dismiss} hitSlop={10} style={({ pressed }) => [styles.hintBtn, pressed && { opacity: 0.7 }]} accessibilityLabel="Got it" testID="hint-ok">
          <Text style={styles.hintBtnText}>Got it</Text>
        </Pressable>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  hintWrap: { position: 'absolute', left: 8, right: 8, zIndex: 12 },
  hint: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14 },
  hintIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(214,178,110,0.14)', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: G.gilt },
  hintTitle: { fontFamily: serif, fontSize: 13, color: G.gold, letterSpacing: 0.8 },
  hintText: { fontFamily: sans, fontSize: 13.5, color: G.text, marginTop: 3, lineHeight: 18 },
  hintBtn: { backgroundColor: G.gold, paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill },
  hintBtnText: { color: '#1a1408', fontFamily: sans, fontWeight: '700', fontSize: 13 },
  word: { fontWeight: '800', color: C.ink },
});
