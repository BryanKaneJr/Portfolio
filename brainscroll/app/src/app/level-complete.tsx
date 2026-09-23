import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import { Body, BigNumber, Button, Card, Label, Row, Screen, Title } from '@/components/ui';
import { getConcept, getLevel, getSkill, levelByNumber } from '@/content';
import { useProgress } from '@/progress/ProgressProvider';
import { motion } from '@/theme/tokens';

/**
 * Level Complete. It animates the facts returned by completion and invents
 * nothing. XP reflects first-attempt accuracy; every question was resolved to
 * get here, so this is always a completion, never a "fail".
 */
export default function LevelCompleteScreen() {
  const { lastSummary: s } = useProgress();
  const xp = useCountUp(s?.xpAwarded ?? 0);
  const perfect = !!s && !s.alreadyCompleted && s.outcome === 'perfect';
  const pop = usePop(perfect);

  if (!s) return <Redirect href="/" />;
  const level = getLevel(s.levelId);
  if (!level) return <Redirect href="/" />;
  const skill = getSkill(s.skillId);
  const next = levelByNumber(s.skillId, level.number + 1);
  const checkpoint = level.cards.find((c) => c.type === 'checkpoint');

  return (
    <Screen>
      <Label tone={s.masteryCleared ? 'mastery' : 'success'}>
        {s.alreadyCompleted ? 'Replay complete' : s.masteryCleared ? '★ Mastery cleared' : `Level ${level.number} complete`}
      </Label>
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <BigNumber tone={s.masteryCleared ? 'mastery' : 'brand'}>+{xp} XP</BigNumber>
      </Animated.View>
      <Title>
        {skill?.name} Lv. {s.alreadyCompleted ? s.skillLevel : `${s.skillLevelBefore} → ${s.skillLevel}`}
      </Title>
      <Body muted>
        {s.alreadyCompleted ? 'Replays earn no XP' : `First try: ${s.firstAttemptCorrect} / ${s.total}`}
      </Body>

      {perfect && (
        <Card accent>
          <Label tone="success">Perfect Recall</Label>
          <Body>Every question right on the first try.</Body>
        </Card>
      )}

      {!s.alreadyCompleted && s.reinforcedConceptIds.length > 0 && (
        <Card>
          <Label>Reinforced</Label>
          <Body muted>We’ll bring these back sooner in Review:</Body>
          {s.reinforcedConceptIds.map((id) => (
            <Body key={id}>• {getConcept(id)?.title ?? id}</Body>
          ))}
        </Card>
      )}

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

/** A small scale pop for Perfect Recall. Skipped when reduce-motion is on. */
function usePop(active: boolean): Animated.Value {
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled || reduce) return;
        scale.setValue(0.85);
        Animated.spring(scale, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }).start();
      });
    return () => {
      cancelled = true;
    };
  }, [active, scale]);
  return scale;
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
