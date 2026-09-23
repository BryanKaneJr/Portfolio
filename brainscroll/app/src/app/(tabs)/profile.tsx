import { Body, BigNumber, Card, Label, Row, Screen, Title } from '@/components/ui';
import { useDemoProgress } from '@/demo/progress';

/** Character sheet: the shape of your knowledge, not just total XP. */
export default function ProfileScreen() {
  const p = useDemoProgress();
  return (
    <Screen>
      <Label tone="brand">Profile</Label>
      <Row>
        <Title>Knowledge Level</Title>
        <BigNumber>{p.knowledgeLevel}</BigNumber>
      </Row>
      {p.skills.map((s) => (
        <Card key={s.id}>
          <Label>{s.subject}</Label>
          <Row>
            <Title>
              {s.name} Lv. {s.view.level}
            </Title>
            {s.view.stars > 0 && <Label tone="mastery">{'★'.repeat(s.view.stars)}</Label>}
          </Row>
        </Card>
      ))}
      <Card>
        <Label>Titles</Label>
        <Body muted>Earned from transparent requirements. None yet.</Body>
      </Card>
    </Screen>
  );
}
