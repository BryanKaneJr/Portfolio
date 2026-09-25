import { knowledgeLevel } from '@brainscroll/core';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Caption, Emblem, Icon, type IconName } from '@/components/ui';
import { color, depth, fw, radius, space, subjectColor, type } from '@/theme/tokens';

/** One subject's standing: its rank and the skill levels behind it. */
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

/** Progress from the current rank to the next, on the same curve as the rank itself. */
function toNextRank(levels: number) {
  const rank = knowledgeLevel(levels);
  const from = Math.ceil(((rank - 1) * (rank - 1)) / 4);
  const to = Math.ceil((rank * rank) / 4);
  return { rank, share: to > from ? (levels - from) / (to - from) : 0 };
}

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
 * subject that fills with its rank (a full arc is rank 21, one skill mastered), each marked with
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
          const fill = s.soon ? 0 : Math.min(1, (knowledgeLevel(s.levels) - 1) / 20);
          if (fill <= 0) return null;
          return <Path key={`f${s.subjectId}`} d={arc(c, c, r, start, start + (end - start) * Math.max(fill, 0.04))} stroke={tint(s.subjectId)} strokeWidth={16} strokeLinecap="round" fill="none" />;
        })}
      </Svg>
      {stats.map((s, i) => {
        const p = polar(c, c, r + 34, i * span);
        return (
          <View key={s.subjectId} style={[styles.ringIcon, { left: p.x - 18, top: p.y - 18, borderColor: s.soon ? color.border : tint(s.subjectId) }]}>
            <Icon name={SUBJECT_ICON[s.subjectId] ?? 'book'} tint={s.soon ? color.textFaint : tint(s.subjectId)} size={18} />
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
 * An attribute row, like an RPG stat: the subject's icon and name, a notched
 * bar in its colour filling toward the next rank, and the rank itself.
 */
export function AttributeRow({ stat, detail }: { stat: SubjectStat; detail?: string }) {
  const { rank, share } = toNextRank(stat.levels);
  const notches = 10;
  const filled = stat.soon ? 0 : Math.round(share * notches);
  const c = tint(stat.subjectId);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={stat.soon ? `${stat.name}: coming soon` : `${stat.name}: rank ${rank}, ${Math.round(share * 100)}% of the way to rank ${rank + 1}`}>
      <View style={[styles.rowIcon, { backgroundColor: stat.soon ? color.surfaceRaised : `${c}26` }]}>
        <Icon name={SUBJECT_ICON[stat.subjectId] ?? 'book'} tint={stat.soon ? color.textFaint : c} size={20} />
      </View>
      <View style={{ flex: 1, gap: space.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={[type.bodyStrong, { color: stat.soon ? color.textFaint : color.text }]}>{stat.name}</Text>
          <Text style={[styles.rank, { color: stat.soon ? color.textFaint : c }]}>{stat.soon ? 'Soon' : `Rank ${rank}`}</Text>
        </View>
        <View style={styles.notches}>
          {Array.from({ length: notches }, (_, i) => (
            <View key={i} style={[styles.notch, { backgroundColor: i < filled ? c : color.surfaceRaised }]} />
          ))}
        </View>
        {detail && <Caption>{detail}</Caption>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  ringIcon: { position: 'absolute', width: 36, height: 36, borderRadius: 18, borderWidth: depth.border, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  rowIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  rank: { ...fw('800'), fontSize: 14 },
  notches: { flexDirection: 'row', gap: 3 },
  notch: { flex: 1, height: 10, borderRadius: 2, transform: [{ skewX: '-12deg' }] },
});
