/** A region's landmark on its sheet: the owner's painting of it, the name, its one bonus, and its history behind a "?". */
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LANDMARK_AT, nationName } from '../../sim/content';
import { useStore } from '../../state/store';
import { HelpButton, HelpNote } from '../components/kit';
import { modsText } from '../describe';
import { LANDMARK_ART } from '../map/landmarkArt';
import { G, R, display, sans } from '../theme';

/** The painting's well (points, square): the picture fits inside it by its own proportions, standing on its floor. */
const PIC = 64;

export function LandmarkLine({ id }: { id: string }) {
  const st = useStore();
  const [open, setOpen] = useState(false);
  const lm = LANDMARK_AT[id];
  const r = st.state?.regions[id];
  if (!lm || !r) return null;
  const art = LANDMARK_ART[lm.id];
  const occupied = r.controller !== r.owner;
  // Someone else's: the bonus is its owner's, so say whose (and that others like them, not you, the better).
  const bonus = !r.owner || r.owner === st.state!.player ? modsText(lm.mods) : `For ${nationName(r.owner)}: ${modsText(lm.mods).replace(' of you', ' of them')}`;
  return (
    <View style={{ marginBottom: 8 }} testID="landmark">
      <View style={styles.row}>
        <View style={styles.pic}>
          {art ? <Image source={art.src} style={fit(art.w, art.h)} accessibilityIgnoresInvertColors /> : null}
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

/** The picture's size in its well: as big as fits, keeping its proportions. */
const fit = (w: number, h: number) => (w >= h ? { width: PIC, height: (PIC * h) / w } : { width: (PIC * w) / h, height: PIC });

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
  pic: { width: PIC, height: PIC, alignItems: 'center', justifyContent: 'flex-end' },
  name: { fontFamily: display, fontSize: 15, color: G.text, letterSpacing: 0.3 },
  bonus: { fontFamily: sans, fontSize: 13, color: G.good, marginTop: 1 },
});
