import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LevelPath } from '@/components/LevelPath';
import { Emblem, Eyebrow, IconButton, Row, Stars, Title } from '@/components/ui';
import { chaptersFor, getLevel, subjectName } from '@/content';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { useStartLevel } from '@/progress/useStartLevel';
import { color, layout, space } from '@/theme/tokens';

/**
 * One skill's whole tree: every chapter as a level path, scrolled to the one
 * you're in. Opening it makes this the skill Home follows.
 */
export default function SkillScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useProgress();
  const v = useProgressView();
  const startLevel = useStartLevel();
  const scroll = useRef<ScrollView>(null);
  const [currentY, setCurrentY] = useState<number | null>(null);
  const skill = v.skills.find((s) => s.id === id);
  const { setActiveSkill } = p;

  useEffect(() => {
    if (skill) setActiveSkill(skill.id);
  }, [skill, setActiveSkill]);
  useEffect(() => {
    if (currentY !== null && currentY > 0) scroll.current?.scrollTo({ y: currentY - space.lg, animated: false });
  }, [currentY]);

  if (!skill) return <Redirect href="/skills" />;
  const nextId = p.nextLevelId(skill.id);
  const next = nextId ? getLevel(nextId) : undefined;
  const focus = next?.number ?? Math.max(skill.view.level, 1);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Row style={styles.top}>
        <IconButton label="Back" icon="back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/skills'))} />
        <Emblem value={skill.view.level} size="sm" />
        <View style={{ flex: 1, gap: space.xxs }}>
          <Eyebrow>{subjectName(skill.subjectId)}</Eyebrow>
          <Title>
            {skill.name} · Lv. {skill.view.level}
          </Title>
        </View>
        <Stars count={skill.view.stars} />
      </Row>
      <ScrollView ref={scroll} contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          {chaptersFor(skill.id).map((c) => {
            const here = focus >= c.levels[0] && focus <= c.levels[1];
            return (
              <View key={c.number} onLayout={here ? (e) => setCurrentY(e.nativeEvent.layout.y) : undefined}>
                <LevelPath
                  skillId={skill.id}
                  chapter={c}
                  level={skill.view.level}
                  nextNumber={next?.number}
                  resuming={!!(nextId && v.sessions[nextId])}
                  dailyComplete={v.today.dailyComplete}
                  mascot={here}
                  teaser={false}
                  onOpen={startLevel}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  top: { gap: space.md, paddingHorizontal: space.sm, paddingRight: layout.gutter, paddingVertical: space.sm, borderBottomWidth: 2, borderBottomColor: color.border },
  scroll: { paddingHorizontal: layout.gutter, paddingTop: space.xl, paddingBottom: space.xxxl },
  column: { width: '100%', maxWidth: layout.readingWidth, alignSelf: 'center', gap: space.xxxl },
});
