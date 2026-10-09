import { MASTERY_BAND_SIZE } from '@brainscroll/core';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Body, Caption, Card, Emblem, Icon, ProgressBar, Row, Stars } from '@/components/ui';
import { subjectName } from '@/content';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { subjectTint } from '@/theme/subjectTheme';
import { color, depth, iconSize, layout, space } from '@/theme/tokens';

/**
 * The skills you're leveling, on Practice (owner, 2026-10-09: the Skills tab
 * folded in, since Home already opens every skill): one compact list, highest
 * level first, each row its level, subject, stars and the road to the next ★.
 * The one you're playing shows even at Lv. 0. Starting something new is Home's.
 */
export function SkillList() {
  const { activeSkillId } = useProgress();
  const { skills: all } = useProgressView();
  const skills = all
    .filter((s) => s.id === activeSkillId || s.view.level > 0)
    .sort((a, b) => b.view.level - a.view.level || a.name.localeCompare(b.name));
  if (skills.length === 0) return null;
  return (
    <Card variant="plain" style={{ paddingVertical: space.xs, paddingHorizontal: 0, gap: 0 }}>
      {skills.map((s, i) => {
        const toStar = MASTERY_BAND_SIZE - (s.view.level % MASTERY_BAND_SIZE);
        const tint = subjectTint(s.subjectId);
        return (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityLabel={`Open ${s.name}, level ${s.view.level}${s.view.stars ? `, ${s.view.stars} mastery ${s.view.stars === 1 ? 'star' : 'stars'}` : ''}, ${toStar} ${toStar === 1 ? 'level' : 'levels'} to the next mastery star`}
            // Opening a map doesn't change Home's "Up next": only playing does (useCurrentSkill).
            onPress={() => router.navigate({ pathname: '/skill/[id]', params: { id: s.id } })}
            style={({ pressed }) => [styles.row, i > 0 && styles.divided, pressed && { backgroundColor: color.surfaceRaised }]}>
            <Emblem value={s.view.level} size="sm" tone={s.view.stars > 0 ? 'mastery' : 'brand'} tint={tint} />
            <View style={{ flex: 1, gap: space.xxs }}>
              <Row gap={space.xs}>
                <Body style={{ flexShrink: 1 }} numberOfLines={1}>
                  {s.name}
                </Body>
                <Stars count={s.view.stars} size={14} />
              </Row>
              <Caption numberOfLines={1}>{subjectName(s.subjectId)}</Caption>
              <ProgressBar value={s.view.bandProgress} size="sm" tone="mastery" fill={s.view.stars > 0 ? undefined : tint.base} label={`${toStar} levels to the next mastery star`} />
            </View>
            <Icon name="forward" tint={color.textMuted} size={iconSize.md} />
          </Pressable>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, minHeight: layout.minTouch },
  divided: { borderTopWidth: depth.line, borderTopColor: color.border },
});
