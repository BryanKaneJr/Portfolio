import { subjectAttribute } from '@brainscroll/core';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Emblem, Icon, type IconName } from '@/components/ui';
import { color, depth, fw, iconSize, layout, radius, space, subjectColor, type } from '@/theme/tokens';

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
  'subject.arts': 'arts',
  'subject.world_systems': 'world',
  'subject.mind': 'mind',
};

const tint = (subjectId: string) => subjectColor[subjectId] ?? color.textMuted;


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
 * The character ring: your avatar at the center (owner, 2026-10-01: "their
 * avatar should be in the center of their brain") with the Knowledge Level in
 * a rank pip at its lower right, like each subject icon's, circled by one arc per subject that fills toward its next
 * 100 levels (a ★), each marked with its icon. The avatar art is its own
 * circle, so nothing frames it. Without one, the Knowledge Level sits in a
 * mount at the center. Screen readers hear it as one image, "Knowledge level
 * N"; the attribute rows below carry each subject's number.
 */
const RING_STROKE = 16;

export function SubjectRing({ stats, knowledge, center }: { stats: SubjectStat[]; knowledge: number; center?: ReactNode }) {
  const size = 300;
  const c = size / 2;
  const r = 104;
  const span = 360 / stats.length;
  // Round caps reach past each arc's ends by half the stroke, so the gap is
  // measured from the stroke: both caps plus 8 px of clear track between.
  const gap = ((RING_STROKE + 8) / r) * (180 / Math.PI);
  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }} accessible accessibilityRole="image" accessibilityLabel={`Knowledge level ${knowledge}`}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* Without an avatar: a raised disc inside the ring, like a portrait mount. */}
        {!center && <Circle cx={c} cy={c} r={r - 22} fill={color.surface} stroke={color.border} strokeWidth={2} />}
        {!center && <Circle cx={c} cy={c} r={r - 30} fill="none" stroke={color.border} strokeWidth={1} strokeDasharray="2 6" />}
        {stats.map((s, i) => {
          const start = i * span - span / 2 + gap / 2;
          const end = start + span - gap;
          return (
            <Path key={`t${s.subjectId}`} d={arc(c, c, r, start, end)} stroke={s.soon ? color.surfaceRaised : `${tint(s.subjectId)}33`} strokeWidth={RING_STROKE} strokeLinecap="round" fill="none" />
          );
        })}
        {stats.map((s, i) => {
          const start = i * span - span / 2 + gap / 2;
          const end = start + span - gap;
          const fill = s.soon ? 0 : subjectAttribute(s.levels).share;
          if (fill <= 0) return null;
          return <Path key={`f${s.subjectId}`} d={arc(c, c, r, start, start + (end - start) * Math.max(fill, 0.04))} stroke={tint(s.subjectId)} strokeWidth={RING_STROKE} strokeLinecap="round" fill="none" />;
        })}
      </Svg>
      {stats.map((s, i) => {
        const p = polar(c, c, r + 34, i * span);
        return (
          <View key={s.subjectId} style={[styles.ringIcon, { left: p.x - 18, top: p.y - 18, borderColor: s.soon ? color.border : tint(s.subjectId) }]}>
            <Icon name={SUBJECT_ICON[s.subjectId] ?? 'book'} tint={s.soon ? color.textFaint : tint(s.subjectId)} size={iconSize.md} />
            {!s.soon && (
              <View style={[styles.rankPip, { backgroundColor: tint(s.subjectId) }]}>
                {/* Fixed 18 px pip: its numeral may grow only a little. */}
                <Text maxFontSizeMultiplier={1.2} style={styles.rankPipText}>
                  {subjectAttribute(s.levels).level}
                </Text>
              </View>
            )}
          </View>
        );
      })}
      {center ? (
        <>
          <View style={[StyleSheet.absoluteFill, styles.center]}>{center}</View>
          {/* The Knowledge Level as the avatar's own rank pip: the subject icons' pips, scaled up. */}
          <View style={[styles.knowledgePip, { left: c + 38, top: c + 40 }]}>
            <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.knowledgePipText}>
              {knowledge}
            </Text>
          </View>
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Emblem value={knowledge} size="md" glowing caption="Knowledge" />
        </View>
      )}
    </View>
  );
}

/**
 * An attribute row, like an RPG stat: the subject's icon and name, its level
 * (the levels cleared across its skills; XP only feeds the Knowledge Level),
 * and a bar in its colour that grows one step per level, 1 to 100. Clearing
 * 100 masters the subject: its name and level turn gold with a ★ after the
 * name, and the level starts again from 1 (`subjectAttribute`).
 */
export function AttributeRow({ stat }: { stat: SubjectStat }) {
  const a = subjectAttribute(stat.levels);
  const gold = a.stars > 0;
  const c = tint(stat.subjectId);
  if (stat.soon) {
    return (
      <View style={[styles.row, { paddingVertical: space.xs }]} accessible accessibilityLabel={`${stat.name}: coming soon`}>
        <View style={[styles.rowIcon, styles.rowIconSmall, { backgroundColor: color.surfaceRaised }]}>
          <Icon name={SUBJECT_ICON[stat.subjectId] ?? 'book'} tint={color.textFaint} size={iconSize.sm} />
        </View>
        {/* Muted, not faint: words on a card need 4.5:1 (textFaint is 3.9:1 on surface). */}
        <Text style={[type.body, { color: color.textMuted, flex: 1 }]}>{stat.name}</Text>
        <Text style={[styles.rank, { color: color.textMuted }]}>Soon</Text>
      </View>
    );
  }
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${stat.name}: level ${a.level}${a.stars ? `, mastered ${a.stars === 1 ? 'once' : `${a.stars} times`}` : ''}`}>
      <View style={[styles.rowIcon, { backgroundColor: `${c}26` }]}>
        <Icon name={SUBJECT_ICON[stat.subjectId] ?? 'book'} tint={c} size={iconSize.md} />
      </View>
      <View style={{ flex: 1, gap: space.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={[type.bodyStrong, { color: gold ? color.mastery : color.text }]}>
            {stat.name}
            {gold ? ` ${'★'.repeat(Math.min(a.stars, 5))}` : ''}
          </Text>
          <Text style={[styles.rank, { color: gold ? color.mastery : c }]}>Lv. {a.level}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${a.share * 100}%`, backgroundColor: c }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  knowledgePip: { position: 'absolute', minWidth: 44, height: 36, paddingHorizontal: space.sm, borderRadius: radius.pill, backgroundColor: color.brand, borderWidth: 3, borderColor: color.bg, alignItems: 'center', justifyContent: 'center' },
  knowledgePipText: { ...fw('900'), fontSize: 18, color: color.onBrand },
  // The ring's icon discs and rank pips are fixed badges placed on the ring's geometry.
  ringIcon: { position: 'absolute', width: 36, height: 36, borderRadius: radius.pill, borderWidth: depth.border, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  rowIcon: { width: layout.iconPlate, height: layout.iconPlate, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  rowIconSmall: { width: layout.iconPlate, height: 30 },
  rankPip: { position: 'absolute', right: -space.sm, bottom: -6, minWidth: 20, height: 18, borderRadius: radius.pill, paddingHorizontal: space.xs, alignItems: 'center', justifyContent: 'center', borderWidth: depth.border, borderColor: color.bg },
  // Fits the 18 px pip; the one text below the type scale on this screen.
  rankPipText: { ...fw('900'), fontSize: 10, color: color.bgDeep },
  rank: { ...type.caption, ...fw('800') },
  track: { height: space.md, borderRadius: radius.pill, backgroundColor: color.surfaceRaised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
