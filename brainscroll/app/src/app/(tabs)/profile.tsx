import { Body, BigNumber, Button, Card, Label, Row, Screen, Title } from '@/components/ui';
import { subjectName } from '@/content';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';

/** Character sheet: the shape of your knowledge, not just total XP. */
export default function ProfileScreen() {
  const { resetAll } = useProgress();
  const v = useProgressView();
  return (
    <Screen>
      <Label tone="brand">Profile</Label>
      <Row>
        <Title>Knowledge Level</Title>
        <BigNumber>{v.knowledgeLevel}</BigNumber>
      </Row>
      <Body muted>{v.totalXp} XP earned</Body>
      {v.skills.map((s) => (
        <Card key={s.id}>
          <Label>{subjectName(s.subjectId)}</Label>
          <Row>
            <Title>
              {s.name} Lv. {s.view.level}
            </Title>
            {s.view.stars > 0 && <Label tone="mastery">{'★'.repeat(s.view.stars)}</Label>}
          </Row>
          <Body muted>{s.xp} XP</Body>
        </Card>
      ))}
      <Card>
        <Label>Titles</Label>
        <Body muted>Earned from transparent requirements. None yet.</Body>
      </Card>
      {__DEV__ && <Button variant="secondary" label="Reset progress (dev)" onPress={() => void resetAll()} />}
    </Screen>
  );
}
