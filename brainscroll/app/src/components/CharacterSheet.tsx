import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Emblem, Icon, type IconName } from '@/components/ui';
import { color, depth, fw, radius, space, subjectColor, type } from '@/theme/tokens';

/** One subject's standing: the levels cleared across its skills. */
export interface SubjectStat {
  subjectId: string;
  name: string;
  /** Sum of the levels cleared across the subject's skills. */
  levels: number;
  /** No skill is published in it yet. */
  soon: boolean;
}

export const SUBJECT_ICON: Record<string, IconName> = {
  'subject.history': 'history',
  'subject.science': 'science',
  'subject.geography': 'geography',
  'subject.money': 'money',
  'subject.arts': 'arts',
  'subject.world_systems': 'world',
};

const tint = (subjectId: string) => subjectColor[subjectId] ?? color.textMuted;

/** Share of the current 100 levels: each level cleared adds 1%, and 100 is a full bar. */
const barShare = (levels: number) => (levels === 0 ? 0 : (((levels - 1) % 100) + 1) / 100);

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};
const arc = (cx: number, cy: number, r: number, from: number, to: number) => {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${b.x} ${b.y}`;
};

/**
 * The character ring: the Knowledge Level at the center, circled by one arc per
 * subject that fills toward its first 100 levels (one skill mastered), each marked with
 * its icon. Decorative; the attribute rows carry the numbers for screen readers.
 */
export function SubjectRing({ stats, knowledge }: { stats: SubjectStat[]; knowledge: number }) {
  const size = 300;
  const c = size / 2;
  const r = 104;
  const span = 360 / stats.length;
  const gap = 7;
  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* The frame: a raised disc inside the ring, like a portrait mount. */}
        <Circle cx={c} cy={c} r={r - 22} fill={color.surface} stroke={color.border} strokeWidth={2} />
        <Circle cx={c} cy={c} r={r - 30} fill="none" stroke={color.border} strokeWidth={1} strokeDasharray="2 6" />
        {stats.map((s, i) => {
          const start = i * span - span / 2 + gap / 2;
          const end = start + span - gap;
          return (
            <Path key={`t${s.subjectId}`} d={arc(c, c, r, start, end)} stroke={s.soon ? color.surfaceRaised : `${tint(s.subjectId)}33`} strokeWidth={16} strokeLinecap="round" fill="none" />
          );
        })}
        {stats.map((s, i) => {
          const start = i * span - span / 2 + gap / 2;
          const end = start + span - gap;
          const fill = s.soon ? 0 : Math.min(1, s.levels / 100);
          if (fill <= 0) return null;
          return <Path key={`f${s.subjectId}`} d={arc(c, c, r, start, start + (end - start) * Math.max(fill, 0.04))} stroke={tint(s.subjectId)} strokeWidth={16} strokeLinecap="round" fill="none" />;
        })}
      </Svg>
      {stats.map((s, i) => {
        const p = polar(c, c, r + 34, i * span);
        return (
          <View key={s.subjectId} style={[styles.ringIcon, { left: p.x - 18, top: p.y - 18, borderColor: s.soon ? color.border : tint(s.subjectId) }]}>
            <Icon name={SUBJECT_ICON[s.subjectId] ?? 'book'} tint={s.soon ? color.textFaint : tint(s.subjectId)} size={18} />
            {!s.soon && (
              <View style={[styles.rankPip, { backgroundColor: tint(s.subjectId) }]}>
                <Text style={styles.rankPipText}>{s.levels}</Text>
              </View>
            )}
          </View>
        );
      })}
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Emblem value={knowledge} size="md" glowing caption="Knowledge" />
      </View>
    </View>
  );
}

/**
 * An attribute row, like an RPG stat: the subject's icon and name, its level
 * (the levels cleared across its skills; XP only feeds the Knowledge Level),
 * and a bar in its colour that grows one step per level, 1 to 100.
 */
export function AttributeRow({ stat }: { stat: SubjectStat }) {
  const c = tint(stat.subjectId);
  if (stat.soon) {
    return (
      <View style={[styles.row, { paddingVertical: space.xs }]} accessible accessibilityLabel={`${stat.name}: coming soon`}>
        <View style={[styles.rowIcon, styles.rowIconSmall, { backgroundColor: color.surfaceRaised }]}>
          <Icon name={SUBJECT_ICON[stat.subjectId] ?? 'book'} tint={color.textFaint} size={16} />
        </View>
        <Text style={[type.body, { color: color.textFaint, flex: 1 }]}>{stat.name}</Text>
        <Text style={[styles.rank, { color: color.textFaint }]}>Soon</Text>
      </View>
    );
  }
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${stat.name}: level ${stat.levels}`}>
      <View style={[styles.rowIcon, { backgroundColor: `${c}26` }]}>
        <Icon name={SUBJECT_ICON[stat.subjectId] ?? 'book'} tint={c} size={20} />
      </View>
      <View style={{ flex: 1, gap: space.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={[type.bodyStrong, { color: color.text }]}>{stat.name}</Text>
          <Text style={[styles.rank, { color: c }]}>Lv. {stat.levels}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${barShare(stat.levels) * 100}%`, backgroundColor: c }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  ringIcon: { position: 'absolute', width: 36, height: 36, borderRadius: 18, borderWidth: depth.border, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  rowIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  rowIconSmall: { width: 40, height: 30 },
  rankPip: { position: 'absolute', right: -8, bottom: -6, minWidth: 20, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: color.bg },
  rankPipText: { ...fw('900'), fontSize: 10, color: color.bgDeep },
  rank: { ...fw('800'), fontSize: 14 },
  track: { height: 12, borderRadius: 6, backgroundColor: color.surfaceRaised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6 },
});
