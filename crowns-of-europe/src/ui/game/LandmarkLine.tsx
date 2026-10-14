/** A region's landmark on its sheet: the gold pictogram, the name, its one bonus, and its history behind a "?". */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';
import { LANDMARK_AT, nationName } from '../../sim/content';
import { useStore } from '../../state/store';
import { LANDMARK_ART } from '../components/landmarkArt';
import { HelpButton, HelpNote } from '../components/kit';
import { modsText } from '../describe';
import { landmarkPaths } from '../map/landmarks';
import { G, R, display, sans } from '../theme';

const PIC = 28;

export function LandmarkLine({ id }: { id: string }) {
  const st = useStore();
  const [open, setOpen] = useState(false);
  const lm = LANDMARK_AT[id];
  const r = st.state?.regions[id];
  if (!lm || !r) return null;
  const art = LANDMARK_ART[lm.kind] ?? [];
  const occupied = r.controller !== r.owner;
  // Someone else's: the bonus is its owner's, so say whose (and that others like them, not you, the better).
  const bonus = !r.owner || r.owner === st.state!.player ? modsText(lm.mods) : `For ${nationName(r.owner)}: ${modsText(lm.mods).replace(' of you', ' of them')}`;
  return (
    <View style={{ marginBottom: 8 }} testID="landmark">
      <View style={styles.row}>
        <View style={styles.pic}>
          <Svg width={PIC} height={PIC} viewBox="0 0 24 24">
            {landmarkPaths(art, 0.9)}
          </Svg>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {lm.name}
          </Text>
          <Text style={[styles.bonus, occupied && { color: G.text3 }]}>{bonus}</Text>
          {occupied ? <Text style={[styles.bonus, { color: G.bad }]}>Lost while occupied</Text> : null}
        </View>
        <HelpButton open={open} onPress={() => setOpen(o => !o)} label={`About ${lm.name}`} />
      </View>
      {open ? <HelpNote style={{ marginTop: 6 }}>{`${lm.text} It goes to whoever holds the region.`}</HelpNote> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: G.group,
    borderRadius: R.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  pic: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: G.raised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: G.gilt,
  },
  name: { fontFamily: display, fontSize: 15, color: G.text, letterSpacing: 0.3 },
  bonus: { fontFamily: sans, fontSize: 13, color: G.good, marginTop: 1 },
});
