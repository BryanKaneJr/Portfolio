import { BRAINPOWER, DR_SCROLL_LINES } from '@brainscroll/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { track } from '@/analytics/track';
import { BrainpowerIcon } from '@/components/BrainpowerIcon';
import { Body, Button, Card, DrScrollSays, Eyebrow, H1, Icon, type IconName, LevelArt, ProgressBar, Row } from '@/components/ui';
import { levelByNumber, skills, subjects } from '@/content';
import { useProgress } from '@/progress/ProgressProvider';
import { color, depth, iconSize, layout, radius, space, type } from '@/theme/tokens';

/**
 * First run, right after signing in (the premise is on the sign-in screen):
 * Dr. Scroll says hello → pick a skill → the rules → Level 1, in well under a
 * minute. Only skills with
 * published levels can be picked; the rest say so honestly.
 */
export default function WelcomeScreen() {
  const { finishOnboarding, setActiveSkill } = useProgress();
  const [step, setStep] = useState(0);
  const playable = skills.filter((s) => levelByNumber(s.id, 1));
  // No default: the learner picks deliberately, and Continue waits for it.
  const [skillId, setSkillId] = useState<string | undefined>();
  const firstLevel = skillId ? levelByNumber(skillId, 1) : undefined;
  const { height } = useWindowDimensions();

  const start = () => {
    finishOnboarding();
    if (skillId) setActiveSkill(skillId);
    if (firstLevel) router.replace({ pathname: '/level/[id]', params: { id: firstLevel.id } });
    else router.replace('/');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.top}>
        <ProgressBar value={(step + 1) / STEPS} size="lesson" grow />
      </View>

      {/* Scrolls, so every skill stays reachable on short screens and at large text sizes.
          Keyed by step, so each step opens at its top (the skill list's scroll never carries over). */}
      <ScrollView key={step} style={{ flex: 1 }} contentContainerStyle={styles.body}>
        {step === 0 && (
          <DrScrollSays
            spot="onboarding.hello"
            layout="stack"
            lines={[DR_SCROLL_LINES.introHello, DR_SCROLL_LINES.introLessons]}
          />
        )}

        {step === 1 && (
          <>
            <Eyebrow>Pick your first skill</Eyebrow>
            <H1>What do you want to level first?</H1>
            {subjects.map((subject) => {
              const mine = playable.filter((s) => s.subjectId === subject.id);
              if (mine.length === 0) return null;
              return (
                <View key={subject.id} style={{ gap: space.sm }}>
                  <Text style={styles.subject}>{subject.name}</Text>
                  {mine.map((skill) => {
                    const selected = skill.id === skillId;
                    return (
                      <Card
                        key={skill.id}
                        role="radio"
                        state={selected ? 'selected' : undefined}
                        accessibilityLabel={`${subject.name}: ${skill.name}`}
                        onPress={() => setSkillId(skill.id)}
                        style={styles.choice}>
                        <LevelArt art={levelByNumber(skill.id, 1)?.art} size={40} />
                        <Text style={[styles.choiceTitle, { flex: 1 }]}>{skill.name}</Text>
                      </Card>
                    );
                  })}
                </View>
              );
            })}
          </>
        )}

        {step === 2 && (
          <>
            {/* The level they just picked, waiting: the button below starts it (not on small phones, where it would push the deal off screen). */}
            {height >= 720 && <LevelArt art={firstLevel?.art} size={144} style={{ alignSelf: 'center', marginBottom: space.sm }} />}
            <Eyebrow>The deal</Eyebrow>
            <Row gap={space.sm} style={{ alignItems: 'center' }}>
              <BrainpowerIcon size={56} />
              <H1 style={{ flex: 1 }}>{BRAINPOWER.DAILY_REFILL} Brainpower a day. Free, forever.</H1>
            </Row>
            <Card style={{ gap: space.lg }}>
              <DealRow icon="knowledge" text={`Each new level uses 1. You refill to ${BRAINPOWER.DAILY_REFILL} every day.`} />
              <DealRow icon="trophy" text="Earn more: keep your streak, win trophies, finish chapter reviews." />
              <DealRow icon="book" text="Review as much as you like." />
              <DealRow icon="check" text="Wrong answers cost nothing. You fix them and keep going." />
            </Card>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step < STEPS - 1 ? (
          <Button
            label={step === 0 ? DR_SCROLL_LINES.introReply : 'Continue'}
            onPress={() => { track('onboarding_step', { step }); setStep(step + 1); }}
            disabled={step === 1 && !skillId}
          />
        ) : (
          <>
            <Button label={firstLevel ? `Start ${firstLevel.title}` : 'Let’s go'} onPress={start} />
            <Button
              variant="secondary"
              label="See all subjects"
              onPress={() => {
                finishOnboarding();
                if (skillId) setActiveSkill(skillId);
                router.replace('/');
              }}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

/** One line of the deal, with its icon (decoration: the words carry it). */
function DealRow({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={styles.dealIcon} accessible={false} aria-hidden importantForAccessibility="no-hide-descendants">
        <Icon name={icon} tint={color.brandText} size={iconSize.md} />
      </View>
      <Body style={{ flex: 1 }}>{text}</Body>
    </View>
  );
}

const STEPS = 3;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  // The bar sits on the screen's own colour, above the scrolling steps, so nothing shows through it.
  top: { flexDirection: 'row', paddingHorizontal: layout.gutter, paddingTop: space.lg, paddingBottom: space.sm, backgroundColor: color.bg, zIndex: 1 },
  body: { paddingHorizontal: layout.gutter, paddingTop: space.xxxl, paddingBottom: space.xl, gap: space.lg, width: '100%', maxWidth: layout.readingWidth + 2 * layout.gutter, alignSelf: 'center' },
  subject: { ...type.label, color: color.textMuted, marginTop: space.xs },
  // Compact rows: 26 skills should scan in a few swipes, not a catalog.
  choice: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  choiceTitle: { ...type.choice, color: color.text },
  dealIcon: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: color.brandSoft, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: layout.gutter, paddingTop: space.md, paddingBottom: space.xl, borderTopWidth: depth.line, borderTopColor: color.border, gap: space.sm, width: '100%', maxWidth: layout.readingWidth + 2 * layout.gutter, alignSelf: 'center' },
});
