import { drScrollSaying, LEARNING_STRUCTURE, MASTERY_BAND_SIZE, skillProgressView, XP, type CompletionOutcome, type DrScrollMoment } from '@brainscroll/core';
import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { Image, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Display,
  DrScrollSays,
  Emblem,
  Eyebrow,
  Icon,
  masteryBadge,
  Numeral,
  Pop,
  ProgressBar,
  Reveal,
  Row,
  Stars,
  Title,
  TROPHY_ART,
  useCountUp,
  UiArt,
} from '@/components/ui';
import { chapterFor, getConcept, getSkill, levelByNumber, levelMeta } from '@/content';
import { BrainpowerEarned } from '@/components/BrainpowerEarned';
import { ReminderPrompt } from '@/components/ReminderSettings';
import { TrophyEarned } from '@/components/TrophyEarned';
import { TROPHY_ART as TROPHY_ARTS } from '@/components/ui/trophyArt';
import { useProgress } from '@/progress/ProgressProvider';
import { todayLabel } from '@/progress/todayLabel';
import { useNewTrophies } from '@/progress/useNewTrophies';
import { completionEvent, feedback } from '@/theme/feedback';
import { subjectTint } from '@/theme/subjectTheme';
import { color, iconSize, layout, space } from '@/theme/tokens';

/**
 * Level Complete: the payoff, where the RPG layer comes forward. It animates
 * only the facts returned by completion and invents nothing. XP reflects
 * first-attempt accuracy; every question was resolved to get here, so this is
 * always a completion, never a "fail". Gold appears only for a mastery star.
 *
 * Order of emphasis: outcome → XP → "my skill just got stronger" (level up and
 * progress toward the next ★) → one line of detail → the next step.
 *
 * Three scopes, revealed in turn and each labelled, so no number arrives
 * unexplained (UX review P5): this level (XP), this skill (its level, then
 * Mastery as the long-term goal), and across BrainScroll (Knowledge level and
 * today's Brainpower).
 *
 * A chapter's last level adds the proof moment: its recap lines under "10
 * levels ago, could you have explained this?". Evidence of what the learner
 * now knows, not another test, so there's no score beside it. On a chapter's
 * last level the knowledge comes first (roadmap §14): the lines reveal one at
 * a time, "You know this now." lands with the checkpoint's haptic and sound,
 * and only then does the XP arrive. The knowledge is the reward; XP supports it.
 *
 * Screen readers get the same story in the same order (eyebrow, the recap
 * lines, "You know this now.", then the outcome and XP): nothing is hidden
 * while it waits to reveal, the trophy is decoration, and counting numbers
 * are read at their settled values. With Reduce Motion every reveal, pop and
 * count-up simply appears; with sound and haptics off, the words carry it.
 */
export default function LevelCompleteScreen() {
  const { lastSummary: s, streakMoment } = useProgress();
  const insets = useSafeAreaInsets();
  // Small phones (iPhone SE): a tighter column, so the next step stays close.
  const short = useWindowDimensions().height < 720;
  const level = s ? levelMeta(s.levelId) : undefined;
  const proof = s && level && !s.alreadyCompleted && level.number % 10 === 0 ? chapterFor(s.skillId, level.number)?.learned : undefined;
  // When the recap leads, everything else waits for "You know this now."
  const knowAt = proof ? PROOF_START + proof.length * PROOF_STEP : 0;
  const t0 = proof ? knowAt + 450 : 0;
  const xp = useCountUp(s?.xpAwarded ?? 0, { delay: 250 + t0 });
  const levelShown = useCountUp(s?.skillLevel ?? 0, { from: s?.skillLevelBefore ?? 0, delay: 900 + t0, duration: 400 });

  const eventKey = s ? `${s.levelId}:${s.skillLevel}:${s.alreadyCompleted}` : '';
  const newTrophies = useNewTrophies(s && !s.alreadyCompleted ? s.levelId : undefined);
  useEffect(() => {
    if (!s || !level) return;
    const event = s.alreadyCompleted
      ? 'select'
      : completionEvent({ mastery: s.masteryCleared, milestone: level.type === 'milestone', checkpoint: !!proof, leveledUp: s.skillLevel > s.skillLevelBefore });
    const timer = setTimeout(() => feedback(event), proof ? knowAt : 250);
    return () => clearTimeout(timer);
    // One acknowledgment per completion summary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventKey]);

  if (!s) return <Redirect href="/" />;
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
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: layout.gutter, paddingVertical: short ? space.lg : space.xl, justifyContent: 'center' }}>
        <View style={{ width: '100%', maxWidth: layout.readingWidth, alignSelf: 'center', gap: short ? space.lg : space.xl, alignItems: 'center' }}>
          {!s.alreadyCompleted && level.number % 10 === 0 && (
            <Pop delay={100}>
              {mastery ? (
                <Image source={masteryBadge(s.skillId) ?? TROPHY_ART} style={styles.badge} resizeMode="contain" accessible accessibilityRole="image" accessibilityLabel={`${skill?.name ?? 'Skill'} mastery badge`} />
              ) : (
                // Decoration: the eyebrow below says "Checkpoint N complete" in words.
                // The owner's chapter art (the halfway art for Level 50), as on the Trophies shelf.
                <Image
                  source={TROPHY_ARTS[level.number % MASTERY_BAND_SIZE === 50 ? 'halfway' : 'chapters'] ?? TROPHY_ART}
                  style={short ? styles.trophyShort : styles.trophy}
                  resizeMode="contain"
                  accessible={false}
                  aria-hidden
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              )}
            </Pop>
          )}
          <Eyebrow tone={mastery ? 'mastery' : 'success'}>
            {s.alreadyCompleted ? 'Replay complete' : mastery ? '★ Mastery star earned' : `${label} ${level.number} complete`}
          </Eyebrow>

          {proof && (
            <Reveal delay={PROOF_START - 250}>
              {/* Unlabelled on purpose: its title, lines and "You know this now." read one by one, in order. */}
              <Card style={{ width: '100%', minWidth: 300, padding: space.xl, gap: space.md }}>
                <Title>{level.number === 10 ? '10 levels ago' : `Before Level ${level.number - 9}`}, could you have explained this?</Title>
                {proof.map((line, i) => (
                  <Reveal key={line} delay={PROOF_START + i * PROOF_STEP}>
                    <Row gap={space.sm} style={{ alignItems: 'flex-start' }}>
                      <Icon name="check" tint={color.success} size={iconSize.md} />
                      <Body style={{ flex: 1 }}>{line}</Body>
                    </Row>
                  </Reveal>
                ))}
                <Reveal delay={knowAt}>
                  <Title style={{ color: color.success }}>You know this now.</Title>
                </Reveal>
              </Card>
            </Reveal>
          )}

          <View style={{ alignItems: 'center', gap: space.sm }}>
            <Reveal delay={t0}>
              <Display center tone={mastery ? 'mastery' : 'text'}>
                {headline}
              </Display>
            </Reveal>
            <Pop delay={150 + t0}>
              <Numeral size="hero" tone={mastery ? 'mastery' : 'brand'} accessibilityLabel={`plus ${s.xpAwarded} XP`}>
                +{xp} XP
              </Numeral>
            </Pop>
            <Reveal delay={t0}>
              <Caption center>
                {s.alreadyCompleted ? 'Replays earn no XP' : `First try: ${s.firstAttemptCorrect} / ${s.total}`}
              </Caption>
            </Reveal>
            {s.perfectStreak > 0 && (
              <Pop delay={400 + t0}>
                <PerfectStreak streak={s.perfectStreak} percent={s.perfectStreakPercent} bonus={s.perfectStreakBonusXp} />
              </Pop>
            )}
            {streakMoment !== undefined && !s.alreadyCompleted && (
              <Pop delay={450 + t0}>
                <Chip tone="streak">
                  <UiArt name="streak-flame" size={18} />
                  <Caption style={{ color: color.streak }}>{streakMoment === 1 ? 'Streak started' : `Day ${streakMoment} streak`}</Caption>
                </Chip>
              </Pop>
            )}
          </View>

          {newTrophies.length > 0 && (
            // Stretched to the width of the skill card below.
            <View style={{ alignSelf: 'stretch' }}>
              <Pop delay={550 + t0}>
                <TrophyEarned trophies={newTrophies} at={550 + t0} />
              </Pop>
            </View>
          )}

          {s.daily.brainpowerEarned.length > 0 && (
            <View style={{ alignSelf: 'stretch' }}>
              <Pop delay={580 + t0}>
                <BrainpowerEarned daily={s.daily} />
              </Pop>
            </View>
          )}

          <Reveal delay={600 + t0}>
            <Card
              variant={mastery ? 'mastery' : leveledUp ? 'reward' : 'plain'}
              // A level-up glows in the skill's subject colour; a mastery stays gold.
              style={{ width: '100%', minWidth: 300, padding: space.xl, gap: space.lg, ...(leveledUp && !mastery ? { borderColor: subjectTint(skill?.subjectId).base, shadowColor: subjectTint(skill?.subjectId).base } : null) }}>
              <Row gap={space.lg}>
                <Emblem value={levelShown} tone={mastery ? 'mastery' : 'brand'} glowing={leveledUp} tint={subjectTint(skill?.subjectId)} />
                <View style={{ flex: 1, gap: space.xs }}>
                  <Eyebrow tone={mastery ? 'mastery' : 'muted'} style={leveledUp && !mastery ? { color: subjectTint(skill?.subjectId).text } : undefined}>{leveledUp ? 'Level up' : 'Skill'}</Eyebrow>
                  <Title>{skill?.name}</Title>
                  {/* Its own unbreakable line, so "0 → 1" never splits (UX review P1). */}
                  {/* Shrinks rather than truncates at large text sizes: the numbers are the point. */}
                  <Title
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    accessibilityLabel={s.alreadyCompleted ? `Level ${s.skillLevel}` : `Level ${s.skillLevelBefore} to ${s.skillLevel}`}
                    style={{ color: mastery ? color.mastery : subjectTint(skill?.subjectId).text }}>
                    {`Lv.\u00a0${s.alreadyCompleted ? s.skillLevel : `${s.skillLevelBefore}\u00a0→\u00a0${s.skillLevel}`}`}
                  </Title>
                  <Stars count={view.stars} />
                </View>
              </Row>
              <View style={styles.divider} />
              <View style={{ gap: space.xs }}>
                <Eyebrow tone={mastery ? 'mastery' : 'muted'}>{mastery ? 'Mastery' : 'Long-term goal'}</Eyebrow>
                <ProgressBar value={intoBand / MASTERY_BAND_SIZE} tone="mastery" fill={mastery ? undefined : subjectTint(skill?.subjectId).base} />
                <Caption>
                  {mastery
                    ? `Levels ${level.number - MASTERY_BAND_SIZE + 1}–${level.number} completed and resolved. Levels ${level.number + 1}–${level.number + MASTERY_BAND_SIZE} are open. ★ Mastery ${roman(band)}.`
                    : `${intoBand} / ${MASTERY_BAND_SIZE} levels toward ★ Mastery ${roman(nextStar)}`}
                </Caption>
                {skill?.masteryPromise && s.skillLevel < 100 && <Caption>At Lv. 100: {skill.masteryPromise}</Caption>}
              </View>
            </Card>
          </Reveal>

          <Reveal delay={900 + t0}>
            <View style={{ alignItems: 'center', gap: space.lg }}>
              {!proof && (
                <DrScrollSays
                  spot={mastery ? 'level-complete.mastery' : leveledUp ? 'level-complete.level-up' : 'level-complete.cleared'}
                  lines={[drScrollSaying(s.alreadyCompleted ? 'levelReplay' : mastery ? 'levelMastery' : DR_SCROLL_OUTCOME[s.outcome], s.skillId, level?.number ?? 0)]}
                  size="md"
                  style={{ width: '100%', minWidth: 300 }}
                />
              )}
              {/* Once, after the first level: would they like reminders? */}
              {!s.alreadyCompleted && <ReminderPrompt />}
              <View style={{ alignItems: 'center', gap: space.xs }}>
                <Eyebrow>Across BrainScroll</Eyebrow>
                <Row style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Chip tone="brand" icon="knowledge">
                    <Caption tone="text">Knowledge Lv. {s.knowledgeLevel}</Caption>
                  </Chip>
                  <Chip>
                    <Caption>{todayLabel(s.daily)}</Caption>
                  </Chip>
                </Row>
              </View>
              {!s.alreadyCompleted && s.reinforcedConceptIds.length > 0 && (
                <Caption center>
                  {s.reinforcedConceptIds.length <= 3
                    ? `Back sooner in Review: ${s.reinforcedConceptIds.map((id) => getConcept(id)?.title ?? id).join(', ')}`
                    : `${s.reinforcedConceptIds.length} concepts back sooner in Review`}
                </Caption>
              )}
            </View>
          </Reveal>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: layout.gutter, paddingBottom: Math.max(insets.bottom, space.lg), gap: space.sm, width: '100%', maxWidth: layout.readingWidth + 2 * layout.gutter, alignSelf: 'center' }}>
        {s.daily.dailyComplete ? (
          <Button label="Continue" onPress={() => router.replace('/daily-complete')} />
        ) : next && !s.alreadyCompleted ? (
          <Button
            variant={mastery ? 'mastery' : 'primary'}
            label={`Next: Level ${next.number}`}
            onPress={() => router.replace({ pathname: '/level/[id]', params: { id: next.id } })}
          />
        ) : null}
        <Button variant="ghost" label="Back to the map" onPress={() => router.dismissTo({ pathname: '/skill/[id]', params: { id: s.skillId } })} />
      </View>
    </SafeAreaView>
  );
}

/** The proof moment's pacing: first line, then one line every step (ms). */
const PROOF_START = 500;
const PROOF_STEP = 320;

const DR_SCROLL_OUTCOME: Record<CompletionOutcome, DrScrollMoment> = {
  perfect: 'levelPerfect',
  strong: 'levelStrong',
  reinforced: 'levelReinforced',
  heavily_reinforced: 'levelHeavilyReinforced',
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

const styles = StyleSheet.create({
  // A chapter's 10th level is a checkpoint: clearing it wins the path's trophy.
  trophy: { width: 128, height: 128 },
  trophyShort: { width: 104, height: 104 },
  // Level 100·k: the skill's own gold badge (gold means mastery only).
  badge: { width: 144, height: 144 },
  divider: { height: 1, backgroundColor: color.border },
});

/** "×1.2" from a bonus percent. */
const times = (percent: number) => `×${((100 + percent) / 100).toFixed(1)}`;

/**
 * The perfect streak (XP.PERFECT_STREAK_*): perfect levels in a row pay more.
 * The first perfect level says what the next one pays; later ones show the
 * multiplier that just paid out. A miss ends it quietly: nothing here says it
 * broke.
 */
function PerfectStreak({ streak, percent, bonus }: { streak: number; percent: number; bonus: number }) {
  const next = Math.min(streak * XP.PERFECT_STREAK_STEP_PERCENT, XP.PERFECT_STREAK_MAX_PERCENT);
  const label = streak === 1 ? `Perfect! Next perfect level: ${times(next)} XP` : `Perfect streak ${streak} · ${times(percent)} · +${bonus} XP`;
  return (
    <View accessible accessibilityLabel={label} style={{ alignItems: 'center', gap: space.xxs }}>
      <Chip tone="brand" icon="xp">
        <Caption tone="text">{streak === 1 ? 'Perfect!' : `Perfect streak ${times(percent)}`}</Caption>
      </Chip>
      <Caption center>{streak === 1 ? `Get the next level perfect for ${times(next)} XP` : next > percent ? `+${bonus} XP. Next perfect level: ${times(next)}` : `+${bonus} XP, the most it pays`}</Caption>
    </View>
  );
}

