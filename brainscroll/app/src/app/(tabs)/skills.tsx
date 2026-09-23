import { Pressable, View } from 'react-native';
import { Body, Card, Label, ProgressBar, Row, Screen, Title } from '@/components/ui';
import { levelsForSkill, subjectName } from '@/content';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { useStartLevel } from '@/progress/useStartLevel';
import { color, radius } from '@/theme/tokens';

/**
 * Skill trees: 100 levels without 100 tiny dots. Show the active 10-level
 * chapter at full size and a compact rail for 1–100 progress.
 */
export default function SkillsScreen() {
  const p = useProgress();
  const { skills } = useProgressView();
  const startLevel = useStartLevel();

  return (
    <Screen>
      <Title>Skills</Title>
      {skills.map((s) => {
        const chapterStart = (s.view.band - 1) * 100 + (s.view.chapter - 1) * 10 + 1;
        const published = levelsForSkill(s.id).length;
        const nextId = p.nextLevelId(s.id);
        return (
          <Pressable key={s.id} accessibilityRole="button" disabled={!nextId} onPress={() => nextId && startLevel(nextId)}>
            <Card>
              <Label>{subjectName(s.subjectId)}</Label>
              <Title>
                {s.name} · Lv. {s.view.level} / {s.view.band * 100}
              </Title>
              <Body muted>
                Chapter {s.view.chapter} · Levels {chapterStart}–{chapterStart + 9}
              </Body>
              <Row style={{ justifyContent: 'space-between' }}>
                {Array.from({ length: 10 }, (_, i) => {
                  const n = chapterStart + i;
                  const state = n <= s.view.level ? 'done' : n === s.view.nextLevel ? 'current' : 'locked';
                  return <ChapterNode key={n} state={state} />;
                })}
              </Row>
              <ProgressBar value={s.view.bandProgress} />
              <Body muted>
                {published} levels published · 100 · Mastery ★ unlocks 101–200
              </Body>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}

function ChapterNode({ state }: { state: 'done' | 'current' | 'locked' }) {
  const bg = { done: color.brand, current: color.info, locked: color.surfaceRaised }[state];
  const size = state === 'current' ? 22 : 16;
  return <View style={{ width: size, height: size, borderRadius: radius.pill, backgroundColor: bg }} />;
}
