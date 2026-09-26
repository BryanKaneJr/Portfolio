import { DAILY_FREE_NEW_LEVELS, DR_SCROLL_LINES, FIRST_DAY_NEW_LEVELS } from '@brainscroll/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { track } from '@/analytics/track';
import { Body, Button, DrScrollSays, Eyebrow, H1, LevelArt, ProgressBar } from '@/components/ui';
import { levelByNumber, skills, subjects } from '@/content';
import { useProgress } from '@/progress/ProgressProvider';
import { color, layout, radius, space, type } from '@/theme/tokens';

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

  const start = () => {
    finishOnboarding();
    if (skillId) setActiveSkill(skillId);
    if (firstLevel) router.replace({ pathname: '/level/[id]', params: { id: firstLevel.id } });
    else router.replace('/');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.top}>
        <ProgressBar value={(step + 1) / STEPS} size="lesson" />
      </View>

      {/* Scrolls, so every skill stays reachable on short screens and at large text sizes. */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
        {step === 0 && (
          <DrScrollSays
            spot="onboarding.hello"
            layout="stack"
            lines={[DR_SCROLL_LINES.introHello, DR_SCROLL_LINES.introLessons, DR_SCROLL_LINES.introPromise]}
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
                      <Pressable
                        key={skill.id}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${subject.name}: ${skill.name}`}
                        onPress={() => setSkillId(skill.id)}
                        style={[styles.choice, selected && styles.choiceSelected]}>
                        <LevelArt art={levelByNumber(skill.id, 1)?.art} size={52} />
                        <Text style={[styles.choiceTitle, { flex: 1 }]}>{skill.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </>
        )}

        {step === 2 && (
          <>
            <Eyebrow>The deal</Eyebrow>
            <H1>{DAILY_FREE_NEW_LEVELS} new levels a day. Free, forever.</H1>
            {FIRST_DAY_NEW_LEVELS > DAILY_FREE_NEW_LEVELS && (
              <Body>Your first day is a bonus: {FIRST_DAY_NEW_LEVELS}.</Body>
            )}
            <Body>Review is unlimited. Wrong answers cost nothing. Progress never resets.</Body>
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
              label="See the world map"
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

const STEPS = 3;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  top: { flexDirection: 'row', paddingHorizontal: layout.gutter, paddingTop: space.lg },
  body: { paddingHorizontal: layout.gutter, paddingTop: space.xxxl, paddingBottom: space.xl, gap: space.lg, width: '100%', maxWidth: layout.readingWidth + 2 * layout.gutter, alignSelf: 'center' },
  subject: { ...type.label, color: color.textMuted, marginTop: space.xs },
  choice: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 2, borderBottomWidth: 4, borderColor: color.border, backgroundColor: color.surface, borderRadius: radius.md, padding: space.lg, minHeight: layout.answerMinHeight },
  choiceSelected: { borderColor: color.brand, backgroundColor: color.brandSoft },
  choiceTitle: { ...type.bodyStrong, fontSize: 17, color: color.text },
  footer: { paddingHorizontal: layout.gutter, paddingTop: space.md, paddingBottom: space.xl, borderTopWidth: 1, borderTopColor: color.border, gap: space.sm, width: '100%', maxWidth: layout.readingWidth + 2 * layout.gutter, alignSelf: 'center' },
});
