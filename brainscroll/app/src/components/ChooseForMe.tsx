import { chooseForMe, type Choice } from '@brainscroll/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { track } from '@/analytics/track';
import { Button, Caption, Card, Eyebrow, LevelArt, Reveal, Row, Title } from '@/components/ui';
import { getSkill, levelMeta } from '@/content';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { useCurrentSkill } from '@/progress/useCurrentSkill';
import { space } from '@/theme/tokens';

/**
 * "Choose for me" on the World Map, for when you don't know what to learn
 * next. It offers one skill (never the one you're on, usually one you haven't
 * started, from another subject) with its next level; "Pick again" moves on,
 * and Start drops you straight into that level. Rules: `chooseForMe` (core).
 */
export function ChooseForMe() {
  const p = useProgress();
  const v = useProgressView();
  const current = useCurrentSkill();
  // A round of offers belongs to the current skill: once that changes (say,
  // after starting the pick), the next round starts fresh.
  const [round, setRound] = useState<{ base?: string; offered: string[]; choice?: Choice }>({ offered: [] });
  const { offered, choice } = round.base === current?.id ? round : { offered: [] as string[], choice: undefined };

  const candidates = v.skills.map((s) => ({ id: s.id, subjectId: s.subjectId, level: s.view.level, hasNext: !!p.nextLevelId(s.id) }));
  const pick = (seen: string[]) => {
    const c = chooseForMe(candidates, { currentSkillId: current?.id, offered: seen });
    setRound({ base: current?.id, offered: c ? [...seen, c.skillId] : seen, choice: c });
  };

  // Only when there's somewhere else to go and a new level can be started today.
  const available = chooseForMe(candidates, { currentSkillId: current?.id, random: () => 0 });
  if (v.today.dailyComplete || !available || available.skillId === current?.id) return null;

  if (!choice) return <Button variant="secondary" label="Choose for me" onPress={() => pick([])} />;

  const skill = v.skills.find((s) => s.id === choice.skillId);
  const nextId = p.nextLevelId(choice.skillId);
  const next = nextId ? levelMeta(nextId) : undefined;
  if (!skill || !next) return null;
  const promise = getSkill(skill.id)?.masteryPromise;

  return (
    <Reveal key={skill.id}>
      <Card style={{ gap: space.md }} accessibilityLabel={`Chosen for you: ${skill.name}`}>
        <Row gap={space.md}>
          <LevelArt art={next.art} size={64} />
          <View style={{ flex: 1, gap: space.xxs }}>
            <Eyebrow tone="brand">{choice.kind === 'new' ? 'Chosen for you · new' : `Chosen for you · back to Lv. ${skill.view.level}`}</Eyebrow>
            <Title>{skill.name}</Title>
            <Caption>
              Level {next.number}, {next.title}
            </Caption>
          </View>
        </Row>
        {promise && <Caption>At Lv. 100: {promise}</Caption>}
        <Row gap={space.sm}>
          <View style={{ flex: 1 }}>
            <Button
              label={`Start Level ${next.number}`}
              onPress={() => {
                track('choose_for_me_started', { skill_id: skill.id, kind: choice.kind, picks: offered.length });
                p.setActiveSkill(skill.id);
                router.push({ pathname: '/level/[id]', params: { id: next.id } });
              }}
            />
          </View>
          <Button variant="ghost" label="Pick again" onPress={() => pick(offered)} />
        </Row>
      </Card>
    </Reveal>
  );
}
