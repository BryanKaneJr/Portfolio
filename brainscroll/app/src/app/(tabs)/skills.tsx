import { MASTERY_BAND_SIZE } from '@brainscroll/core';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Body, Caption, Card, Chip, Emblem, Eyebrow, Icon, LevelArt, OfflineState, ProgressBar, Row, Screen, ScreenHeader, Stars, Title } from '@/components/ui';
import { levelByNumber, subjectName, subjects } from '@/content';
import { SUBJECT_ICON } from '@/components/CharacterSheet';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { subjectTint } from '@/theme/subjectTheme';
import { color, depth, iconSize, layout, radius, space } from '@/theme/tokens';

/**
 * Skills you are leveling, not a course catalog: one compact list, highest
 * level first, each row its level, subject, stars and the road to the next ★
 * (the skill map has the chapter detail). Never 100 equal dots.
 */
export default function SkillsScreen() {
  const p = useProgress();
  const { setActiveSkill, activeSkillId } = p;
  const { skills: all } = useProgressView();
  // Skills in progress (and the one you're playing, even at Lv. 0), highest level first; then untouched ones.
  const rank = (s: (typeof all)[number]) => (s.id === activeSkillId || s.view.level > 0 ? 0 : 1);
  const sorted = [...all].sort((a, b) => rank(a) - rank(b) || b.view.level - a.view.level || a.name.localeCompare(b.name));
  // Full cards for the skills you're leveling; untouched ones are a compact list by subject,
  // so 26 trees don't turn the tab into a catalog.
  const skills = sorted.filter((s) => rank(s) === 0);
  const fresh = sorted.filter((s) => rank(s) === 1);
  const open = (id: string) => {
    setActiveSkill(id);
    router.navigate({ pathname: '/skill/[id]', params: { id } });
  };
  const upcoming = subjects.filter((s) => !all.some((k) => k.subjectId === s.id));

  if (p.offline) return <OfflineState onRetry={() => void p.reconnect()} retrying={p.reconnecting} />;
  return (
    <Screen>
      <ScreenHeader eyebrow="Your brain" title="Skills" />
      {skills.length > 0 && (
        // One compact list, highest level first (owner, 2026-09-30): a glance at where you stand.
        <Card variant="plain" style={{ paddingVertical: space.xs, paddingHorizontal: 0, gap: 0 }}>
          {skills.map((s, i) => {
            const toStar = MASTERY_BAND_SIZE - (s.view.level % MASTERY_BAND_SIZE);
            const tint = subjectTint(s.subjectId);
            return (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${s.name}, level ${s.view.level}${s.view.stars ? `, ${s.view.stars} mastery ${s.view.stars === 1 ? 'star' : 'stars'}` : ''}, ${toStar} ${toStar === 1 ? 'level' : 'levels'} to the next mastery star`}
                onPress={() => open(s.id)}
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
      )}

      {fresh.length > 0 && (
        <View style={{ gap: space.md }}>
          <Title>{skills.length ? 'Start something new' : 'Pick a skill'}</Title>
          {subjects
            .filter((sub) => fresh.some((k) => k.subjectId === sub.id))
            .map((sub) => (
              <View key={sub.id} style={{ gap: space.sm }}>
                <Eyebrow>{sub.name}</Eyebrow>
                {fresh
                  .filter((k) => k.subjectId === sub.id)
                  .map((k) => (
                    <Card key={k.id} variant="plain" accessibilityLabel={`Open ${k.name}, not started`} onPress={() => open(k.id)} style={{ paddingVertical: space.md, paddingHorizontal: space.lg }}>
                      <Row gap={space.md}>
                        <LevelArt art={levelByNumber(k.id, 1)?.art} size={40} />
                        <Body style={{ flex: 1 }}>{k.name}</Body>
                        <Icon name="forward" tint={color.textMuted} size={iconSize.md} />
                      </Row>
                    </Card>
                  ))}
              </View>
            ))}
        </View>
      )}

      {upcoming.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Eyebrow>Coming soon</Eyebrow>
          {upcoming.map((s) => (
            <Row key={s.id} gap={space.md} style={{ paddingVertical: space.sm }}>
              <View style={{ width: layout.iconPlate, height: layout.iconPlate, borderRadius: radius.md, backgroundColor: color.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={SUBJECT_ICON[s.id] ?? 'book'} tint={color.textMuted} size={iconSize.lg} />
              </View>
              <Body muted style={{ flex: 1 }}>
                {s.name}
              </Body>
              <Chip>
                <Caption>Soon</Caption>
              </Chip>
            </Row>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, minHeight: layout.minTouch },
  divided: { borderTopWidth: depth.line, borderTopColor: color.border },
});
