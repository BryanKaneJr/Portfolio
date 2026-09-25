import { DR_SCROLL_LINES, LEARNING_STRUCTURE, MASTERY_BAND_SIZE, skillProgressView, type CompletionOutcome } from '@brainscroll/core';
import { Redirect, router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  Caption,
  Card,
  Chip,
  Display,
  DrScrollSays,
  Emblem,
  Eyebrow,
  Numeral,
  Pop,
  ProgressBar,
  Reveal,
  Row,
  Stars,
  Title,
  useCountUp,
} from '@/components/ui';
import { getConcept, getLevel, getSkill, levelByNumber } from '@/content';
import { useProgress } from '@/progress/ProgressProvider';
import { color, layout, space } from '@/theme/tokens';

/**
 * Level Complete: the payoff, where the RPG layer comes forward. It animates
 * only the facts returned by completion and invents nothing. XP reflects
 * first-attempt accuracy; every question was resolved to get here, so this is
 * always a completion, never a "fail". Gold appears only for a mastery star.
 *
 * Order of emphasis: outcome → XP → "my skill just got stronger" (level up and
 * progress toward the next ★) → one line of detail → the next step.
 */
export default function LevelCompleteScreen() {
  const { lastSummary: s } = useProgress();
  const insets = useSafeAreaInsets();
  const xp = useCountUp(s?.xpAwarded ?? 0, { delay: 250 });
  const levelShown = useCountUp(s?.skillLevel ?? 0, { from: s?.skillLevelBefore ?? 0, delay: 900, duration: 400 });

  if (!s) return <Redirect href="/" />;
  const level = getLevel(s.levelId);
  if (!level) return <Redirect href="/" />;
  const skill = getSkill(s.skillId);
  const next = levelByNumber(s.skillId, level.number + 1);
  const label = LEARNING_STRUCTURE[level.type].label;
  const mastery = s.masteryCleared;
  const leveledUp = !s.alreadyCompleted && s.skillLevel > s.skillLevelBefore;
  const view = skillProgressView(s.skillLevel);
  const intoBand = s.skillLevel % MASTERY_BAND_SIZE === 0 && s.skillLevel > 0 ? MASTERY_BAND_SIZE : s.skillLevel % MASTERY_BAND_SIZE;
  const nextStar = Math.floor(s.skillLevel / MASTERY_BAND_SIZE) + (intoBand === MASTERY_BAND_SIZE ? 0 : 1);
  const band = level.number / MASTERY_BAND_SIZE;

  const headline = s.alreadyCompleted ? 'Replay complete' : mastery ? 'Mastery achieved' : OUTCOME[s.outcome];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bgDeep }} edges={['top']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: layout.gutter, paddingVertical: space.xl, justifyContent: 'center' }}>
        <View style={{ width: '100%', maxWidth: layout.readingWidth, alignSelf: 'center', gap: space.xl, alignItems: 'center' }}>
          <Eyebrow tone={mastery ? 'mastery' : 'success'}>
            {s.alreadyCompleted ? 'Replay complete' : mastery ? '★ Mastery star earned' : `${label} ${level.number} complete`}
          </Eyebrow>

          <View style={{ alignItems: 'center', gap: space.sm }}>
            <Reveal>
              <Display center tone={mastery ? 'mastery' : 'text'}>
                {headline}
              </Display>
            </Reveal>
            <Pop delay={150}>
              <Numeral size="hero" tone={mastery ? 'mastery' : 'brand'}>
                +{xp} XP
              </Numeral>
            </Pop>
            <Caption center>
              {s.alreadyCompleted ? 'Replays earn no XP' : `First try: ${s.firstAttemptCorrect} / ${s.total}`}
            </Caption>
          </View>

          <Reveal delay={600}>
            <Card variant={mastery ? 'mastery' : leveledUp ? 'reward' : 'plain'} style={{ width: '100%', minWidth: 300, padding: space.xl, gap: space.lg }}>
              <Row gap={space.lg}>
                <Emblem value={levelShown} tone={mastery ? 'mastery' : 'brand'} glowing={leveledUp} />
                <View style={{ flex: 1, gap: space.xs }}>
                  <Eyebrow tone={mastery ? 'mastery' : leveledUp ? 'brand' : 'muted'}>{leveledUp ? 'Level up' : 'Skill'}</Eyebrow>
                  <Title>
                    {skill?.name} Lv. {s.alreadyCompleted ? s.skillLevel : `${s.skillLevelBefore} → ${s.skillLevel}`}
                  </Title>
                  <Stars count={view.stars} />
                </View>
              </Row>
              <View style={{ gap: space.xs }}>
                <ProgressBar value={intoBand / MASTERY_BAND_SIZE} tone={mastery ? 'mastery' : 'brand'} />
                <Caption>
                  {mastery
                    ? `Levels ${level.number - MASTERY_BAND_SIZE + 1}–${level.number} completed and resolved. Levels ${level.number + 1}–${level.number + MASTERY_BAND_SIZE} are open. ★ Mastery ${roman(band)}.`
                    : `${intoBand} / ${MASTERY_BAND_SIZE} toward ★ Mastery ${roman(nextStar)}`}
                </Caption>
              </View>
            </Card>
          </Reveal>

          <Reveal delay={900}>
            <View style={{ alignItems: 'center', gap: space.lg }}>
              <DrScrollSays
                spot={mastery ? 'level-complete.mastery' : leveledUp ? 'level-complete.level-up' : 'level-complete.cleared'}
                lines={[s.alreadyCompleted ? DR_SCROLL_LINES.levelReplay : mastery ? DR_SCROLL_LINES.levelMastery : DR_SCROLL_OUTCOME[s.outcome]]}
                size="md"
                style={{ width: '100%', minWidth: 300 }}
              />
              <Row>
                <Chip tone="brand" icon="knowledge">
                  <Caption tone="text">Knowledge Lv. {s.knowledgeLevel}</Caption>
                </Chip>
                <Chip icon="today">
                  <Caption>
                    Today {s.daily.used} / {s.daily.cap ?? '∞'}
                  </Caption>
                </Chip>
              </Row>
              {!s.alreadyCompleted && s.reinforcedConceptIds.length > 0 && (
                <Caption center>
                  {s.reinforcedConceptIds.length <= 3
                    ? `Reinforced: ${s.reinforcedConceptIds.map((id) => getConcept(id)?.title ?? id).join(', ')}. We’ll bring these back sooner in Review.`
                    : `${s.reinforcedConceptIds.length} concepts reinforced. We’ll bring them back sooner in Review.`}
                </Caption>
              )}
            </View>
          </Reveal>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: layout.gutter, paddingBottom: Math.max(insets.bottom, space.lg), gap: space.sm, width: '100%', maxWidth: layout.readingWidth + 2 * layout.gutter, alignSelf: 'center' }}>
        {next && !s.alreadyCompleted && !s.daily.dailyComplete && <Caption center>Up next: {next.title}</Caption>}
        {s.daily.dailyComplete ? (
          <Button label="Finish the day" onPress={() => router.replace('/daily-complete')} />
        ) : next && !s.alreadyCompleted ? (
          <Button
            variant={mastery ? 'mastery' : 'primary'}
            label={`Next: Level ${next.number}`}
            onPress={() => router.replace({ pathname: '/level/[id]', params: { id: next.id } })}
          />
        ) : null}
        <Button variant="ghost" label="Home" onPress={() => router.dismissTo('/')} />
      </View>
    </SafeAreaView>
  );
}

const DR_SCROLL_OUTCOME: Record<CompletionOutcome, string> = {
  perfect: DR_SCROLL_LINES.levelPerfect,
  strong: DR_SCROLL_LINES.levelStrong,
  reinforced: DR_SCROLL_LINES.levelReinforced,
  heavily_reinforced: DR_SCROLL_LINES.levelHeavilyReinforced,
};

const OUTCOME: Record<CompletionOutcome, string> = {
  perfect: 'Perfect Recall',
  strong: 'Strong recall',
  reinforced: 'Knowledge reinforced',
  heavily_reinforced: 'Level cleared',
};

function roman(n: number): string {
  const map: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, r] of map)
    while (n >= v) {
      out += r;
      n -= v;
    }
  return out || 'I';
}
