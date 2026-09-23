import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { Body, BigNumber, Button, Card, Label, Row, Screen, Title } from '@/components/ui';
import { getLevel, getSkill, levelByNumber } from '@/content';
import { useProgress } from '@/progress/ProgressProvider';
import { motion } from '@/theme/tokens';

/** Level cleared. It animates the facts returned by completion and invents nothing. */
export default function LevelCompleteScreen() {
  const { lastSummary: s } = useProgress();
  const xp = useCountUp(s?.xpAwarded ?? 0);

  if (!s) return <Redirect href="/" />;
  const level = getLevel(s.levelId)!;
  const skill = getSkill(s.skillId);
  const next = levelByNumber(s.skillId, level.number + 1);
  const checkpoint = level.cards.find((c) => c.type === 'checkpoint');

  return (
    <Screen>
      <Label tone={s.masteryCleared ? 'mastery' : 'success'}>
        {s.alreadyCompleted ? 'Replay complete' : s.masteryCleared ? '★ Mastery cleared' : `Level ${level.number} cleared`}
      </Label>
      <BigNumber tone={s.masteryCleared ? 'mastery' : 'brand'}>+{xp} XP</BigNumber>
      <Title>
        {skill?.name} Lv. {s.alreadyCompleted ? s.skillLevel : `${s.skillLevelBefore} → ${s.skillLevel}`}
      </Title>
      <Body muted>
        {s.correct} / {s.total} correct{s.alreadyCompleted ? ' · replays earn no XP' : ''}
      </Body>

      {checkpoint?.type === 'checkpoint' && (
        <Card>
          <Label>You learned</Label>
          {checkpoint.learned.map((l) => (
            <Body key={l}>✓ {l}</Body>
          ))}
        </Card>
      )}

      {s.daily.dailyComplete ? (
        <Button label="Finish the day" onPress={() => router.replace('/daily-complete')} />
      ) : next && !s.alreadyCompleted ? (
        <Button
          label={`Next: Level ${next.number} · ${next.title}`}
          onPress={() => router.replace({ pathname: '/level/[id]', params: { id: next.id } })}
        />
      ) : null}
      <Row>
        <Body muted>
          Today: {s.daily.used} / {s.daily.cap ?? '∞'} new levels
        </Body>
      </Row>
      <Button variant="secondary" label="Home" onPress={() => router.dismissTo('/')} />
    </Screen>
  );
}

/** XP counts up quickly. Skipped when reduce-motion is on. */
function useCountUp(target: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce || target === 0) return setValue(target);
        const start = Date.now();
        const tick = () => {
          const t = Math.min((Date.now() - start) / (motion.celebrate * 0.7), 1);
          setValue(Math.round(target * t));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [target]);
  return value;
}
