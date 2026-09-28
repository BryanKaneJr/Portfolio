import { subjectAttribute } from '@brainscroll/core';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Eyebrow, Icon, LevelArt, usePop } from '@/components/ui';
import { feedback, useReduceMotion } from '@/theme/feedback';
import { color, depth, fw, iconSize, radius, space, subjectColor, type } from '@/theme/tokens';

/** One subject on the World Map. */
export type Region = {
  subjectId: string;
  name: string;
  /** Levels cleared across the subject's skills (CURRENT_PRODUCT_DECISIONS.md §15). */
  levelsCleared: number;
  /** Names of its playable skills, shown under the plate. */
  skills: string[];
};

/** Each subject's landmark, floating in its tile. */
const LANDMARK: Record<string, { art: string }> = {
  'subject.history': { art: 'rome.colosseum' },
  'subject.science': { art: 'astronomy.saturn' },
  'subject.geography': { art: 'object.globe' },
  'subject.arts': { art: 'object.palette' },
  'subject.world_systems': { art: 'technology.gears' },
  'subject.mind': { art: 'animals.owl' },
};

const DISC = 84;

/**
 * The World Map (visual-direction.md "Home"): every subject as a tile in an
 * open grid, so it's plain you can start anywhere (owner direction: no road,
 * nothing reads as locked). Each tile floats its landmark inside a ring that
 * fills toward Lv. 100 in the subject's colour, with its name and level. The
 * subject you're playing flies a flag. Mastered subjects turn gold (★).
 */
export function WorldMap({ regions, hereId, onOpen }: { regions: Region[]; hereId?: string; onOpen: (subjectId: string) => void }) {
  return (
    <View style={{ gap: space.sm }}>
      <Eyebrow>Pick any subject</Eyebrow>
      <View style={styles.grid}>
        {regions.map((r, i) => (
          <SubjectTile key={r.subjectId} region={r} here={r.subjectId === hereId} phase={i} onOpen={onOpen} />
        ))}
      </View>
    </View>
  );
}

function SubjectTile({ region, here, phase, onOpen }: { region: Region; here: boolean; phase: number; onOpen: (subjectId: string) => void }) {
  const attr = subjectAttribute(region.levelsCleared);
  const mastered = attr.stars > 0;
  const tint = subjectColor[region.subjectId] ?? color.textMuted;
  const [taps, setTaps] = useState(0);
  const popStyle = usePop(taps);
  const landmark = LANDMARK[region.subjectId];
  const many = region.skills.length > 1;
  return (
    <Pressable
      accessibilityRole="button"
      // Everything the tile shows, in words: the flag and gold aren't left to colour.
      accessibilityLabel={`Open ${region.name}, level ${attr.level}${mastered ? `, ${attr.stars} mastery ${attr.stars === 1 ? 'star' : 'stars'}` : ''}${here ? ', playing now' : ''}`}
      onPress={() => {
        feedback('select');
        setTaps((n) => n + 1);
        onOpen(region.subjectId);
      }}
      style={({ pressed }) => [styles.tile, { borderColor: tint, backgroundColor: pressed ? color.surfacePressed : color.surface }]}>
      <Animated.View style={[{ alignItems: 'center', gap: space.xs }, popStyle]}>
        <View style={{ width: DISC, height: DISC, alignItems: 'center', justifyContent: 'center' }}>
          <LevelRing share={attr.share} tint={tint} />
          <Bob phase={phase}>
            <LevelArt art={landmark?.art} size={DISC - 26} />
          </Bob>
          {here && (
            <View style={[styles.flag, { backgroundColor: tint }]}>
              <Icon name="flag" tint={color.bgDeep} size={iconSize.xs} />
            </View>
          )}
        </View>
        <Text style={[styles.name, mastered && { color: color.mastery }]} numberOfLines={2}>
          {region.name}
          {mastered ? ` ${'★'.repeat(Math.min(attr.stars, 3))}` : ''}
        </Text>
        <Text style={[styles.level, { color: mastered ? color.mastery : tint }]}>
          Lv. {attr.level}
          {many ? <Text style={styles.count}>{`  ·  ${region.skills.length} skills`}</Text> : null}
        </Text>
        {here && <Text style={[styles.here, { color: tint }]}>Playing</Text>}
      </Animated.View>
    </Pressable>
  );
}

/** A ring around the landmark that fills toward Lv. 100 in the subject's colour. */
function LevelRing({ share, tint }: { share: number; tint: string }) {
  const r = DISC / 2 - 5;
  const circ = 2 * Math.PI * r;
  return (
    <Svg width={DISC} height={DISC} style={StyleSheet.absoluteFill}>
      <Circle cx={DISC / 2} cy={DISC / 2} r={r + 1} fill={color.bgDeep} />
      <Circle cx={DISC / 2} cy={DISC / 2} r={r} stroke={color.border} strokeWidth={6} fill="none" />
      {share > 0 && (
        <Circle
          cx={DISC / 2}
          cy={DISC / 2}
          r={r}
          stroke={tint}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${Math.max(share, 0.02) * circ} ${circ}`}
          transform={`rotate(-90 ${DISC / 2} ${DISC / 2})`}
        />
      )}
    </Svg>
  );
}

/** A gentle up-and-down float (still with reduce motion). */
function Bob({ phase, children, lift = 5 }: { phase: number; children: React.ReactNode; lift?: number }) {
  const reduce = useReduceMotion();
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 2100 + phase * 110, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 2100 + phase * 110, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const timer = setTimeout(() => loop.start(), phase * 240);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [t, reduce, phase]);
  return <Animated.View style={{ transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -lift] }) }] }}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.lg,
    borderWidth: depth.border,
    borderBottomWidth: depth.edge,
  },
  // Tighter than body so two-line subject names keep the tiles even.
  name: { ...type.bodyStrong, ...fw('800'), color: color.text, lineHeight: type.caption.lineHeight, textAlign: 'center' },
  level: { ...type.meta },
  count: { color: color.textMuted, ...fw('600') },
  here: { ...type.label },
  // A fixed badge pinned to the ring's corner.
  flag: { position: 'absolute', top: -space.xxs, right: 0, width: 24, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: depth.border, borderColor: color.bgDeep },
});
