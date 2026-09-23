import { View } from 'react-native';
import { Body, Card, Label, ProgressBar, Row, Screen, Title } from '@/components/ui';
import { useDemoProgress } from '@/demo/progress';
import { color, radius } from '@/theme/tokens';

/**
 * Skill trees: 100 levels without 100 tiny dots. Show the active 10-level
 * chapter at full size and a compact rail for 1–100 progress.
 */
export default function SkillsScreen() {
  const { skills } = useDemoProgress();
  return (
    <Screen>
      <Title>Skills</Title>
      {skills.map((s) => {
        const chapterStart = (s.view.band - 1) * 100 + (s.view.chapter - 1) * 10 + 1;
        return (
          <Card key={s.id}>
            <Label>{s.subject}</Label>
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
            <Body muted>100 · Mastery ★ unlocks Levels 101–200</Body>
          </Card>
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
