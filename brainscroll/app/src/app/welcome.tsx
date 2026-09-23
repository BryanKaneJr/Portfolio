import { DAILY_FREE_NEW_LEVELS, VOICE } from '@brainscroll/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Button, Label, ProgressBar } from '@/components/ui';
import { levelByNumber, skills, subjects } from '@/content';
import { useProgress } from '@/progress/ProgressProvider';
import { color, radius, space } from '@/theme/tokens';

/**
 * First run: premise → pick a skill → the rules → Level 1, in about a minute.
 * Only skills with published levels can be picked; the rest say so honestly.
 */
export default function WelcomeScreen() {
  const { finishOnboarding } = useProgress();
  const [step, setStep] = useState(0);
  const playable = skills.filter((s) => levelByNumber(s.id, 1));
  const [skillId, setSkillId] = useState(playable[0]?.id);
  const firstLevel = skillId ? levelByNumber(skillId, 1) : undefined;

  const start = () => {
    finishOnboarding();
    if (firstLevel) router.replace({ pathname: '/level/[id]', params: { id: firstLevel.id } });
    else router.replace('/');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.top}>
        <ProgressBar value={(step + 1) / 3} />
      </View>

      <View style={styles.body}>
        {step === 0 && (
          <>
            <Label tone="brand">BrainScroll</Label>
            <Text style={styles.display}>{VOICE.tagline}</Text>
            <Body>
              Every level is a short, finished lesson in a real curriculum. Level up skills from 1 to 100 like an RPG
              character, except the stats are things you actually know.
            </Body>
          </>
        )}

        {step === 1 && (
          <>
            <Label>Pick your first skill</Label>
            <Text style={styles.headline}>What do you want to level first?</Text>
            <View style={{ gap: space.sm }}>
              {subjects.map((subject) => {
                const skill = playable.find((s) => s.subjectId === subject.id);
                const selected = skill?.id === skillId;
                return (
                  <Pressable
                    key={subject.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, disabled: !skill }}
                    disabled={!skill}
                    onPress={() => skill && setSkillId(skill.id)}
                    style={[styles.choice, selected && styles.choiceSelected, !skill && { opacity: 0.45 }]}>
                    <Text style={styles.choiceTitle}>{skill ? `${subject.name} · ${skill.name}` : subject.name}</Text>
                    <Text style={styles.choiceMeta}>{skill ? 'Available now' : 'Coming soon'}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Label>The deal</Label>
            <Text style={styles.headline}>{DAILY_FREE_NEW_LEVELS} new levels a day. Free, forever.</Text>
            <Body>After that, we'll tell you you're done. Seriously. Go outside.</Body>
            <Body>Review is unlimited, wrong answers never cost you anything, and progress never resets.</Body>
            <Body muted>{VOICE.fairness}</Body>
          </>
        )}
      </View>

      <View style={styles.footer}>
        {step < 2 ? (
          <Button label="Continue" onPress={() => setStep(step + 1)} disabled={step === 1 && !skillId} />
        ) : (
          <>
            <Button label={firstLevel ? `Start ${firstLevel.title}` : 'Let’s go'} onPress={start} />
            <Button
              variant="secondary"
              label="Look around first"
              onPress={() => {
                finishOnboarding();
                router.replace('/');
              }}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  top: { paddingHorizontal: space.lg, paddingTop: space.md },
  body: { flex: 1, padding: space.lg, paddingTop: space.xxl, gap: space.lg },
  display: { color: color.text, fontSize: 36, fontWeight: '800', lineHeight: 42 },
  headline: { color: color.text, fontSize: 26, fontWeight: '800', lineHeight: 32 },
  choice: { borderWidth: 2, borderColor: color.border, backgroundColor: color.surface, borderRadius: radius.md, padding: space.lg, gap: 2 },
  choiceSelected: { borderColor: color.brand },
  choiceTitle: { color: color.text, fontSize: 16, fontWeight: '700' },
  choiceMeta: { color: color.textMuted, fontSize: 13 },
  footer: { padding: space.lg, gap: space.sm },
});
