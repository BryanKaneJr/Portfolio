import type { MascotSpot } from '@brainscroll/core';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, layout, radius, space, type, fw } from '@/theme/tokens';
import { DrScroll } from './mascot';
import { Eyebrow } from './text';

export type AnswerState = 'idle' | 'selected' | 'correct' | 'eliminated' | 'locked';

/**
 * A large, tactile answer card (not a tiny radio). Tap to select; the lesson's
 * CHECK button grades it. After grading: mint for correct, a crossed-out quiet
 * card for a wrong pick (restrained coral mark, no red flood).
 */
export function AnswerOption({ label, state, onPress, letter }: { label: string; state: AnswerState; onPress: () => void; letter: string }) {
  const disabled = state === 'correct' || state === 'eliminated' || state === 'locked';
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected: state === 'selected' || state === 'correct', disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.option, styles[state], pressed && { transform: [{ scale: 0.985 }] }]}>
      <View style={[styles.letter, state === 'selected' && styles.letterSelected, state === 'correct' && styles.letterCorrect]}>
        <Text style={[styles.letterText, (state === 'selected' || state === 'correct') && { color: color.text }]}>
          {state === 'correct' ? '✓' : state === 'eliminated' ? '✕' : letter.toUpperCase()}
        </Text>
      </View>
      <Text
        style={[
          styles.label,
          state === 'eliminated' && { color: color.textFaint, textDecorationLine: 'line-through' },
          state === 'locked' && { color: color.textMuted },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The in-context verdict, anchored above the bottom action (never a separate
 * screen). Success is mint and short; "reinforce" is teaching, not punishment.
 * `mascot` adds a small, quiet Dr. Scroll reaction beside it (decorative).
 */
export function FeedbackPanel({ tone, title, mascot, children }: { tone: 'success' | 'reinforce'; title: string; mascot?: MascotSpot; children?: ReactNode }) {
  const panel = <FeedbackBody tone={tone} title={title}>{children}</FeedbackBody>;
  if (!mascot) return panel;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
      <DrScroll spot={mascot} size="xs" />
      <View style={{ flex: 1 }}>{panel}</View>
    </View>
  );
}

function FeedbackBody({ tone, title, children }: { tone: 'success' | 'reinforce'; title: string; children?: ReactNode }) {
  const success = tone === 'success';
  return (
    <View style={styles.feedback} accessibilityLiveRegion="polite">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={[styles.badge, { backgroundColor: success ? color.success : color.dangerSoft, borderColor: success ? color.success : color.dangerLine }]}>
          <Text style={[styles.badgeGlyph, { color: success ? color.bgDeep : color.danger }]}>{success ? '✓' : '↻'}</Text>
        </View>
        <Text style={[type.title, { color: success ? color.success : color.danger }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

/**
 * "Take another look": the canonical teaching card(s) that contain the answer,
 * shown right under the question after a miss. Violet, calm, skimmable.
 */
export function EvidenceBlock({ children }: { children: ReactNode }) {
  return (
    <View style={styles.evidence}>
      <Eyebrow tone="brand">Take another look</Eyebrow>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    minHeight: layout.answerMinHeight,
    borderRadius: radius.md,
    borderWidth: 2,
    borderBottomWidth: 4,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  idle: { borderColor: color.border, backgroundColor: color.surface },
  selected: { borderColor: color.brand, backgroundColor: color.brandSoft },
  correct: { borderColor: color.success, backgroundColor: color.successSoft },
  eliminated: { borderColor: color.border, backgroundColor: 'transparent', borderBottomWidth: 2 },
  locked: { borderColor: color.border, backgroundColor: 'transparent', borderBottomWidth: 2 },
  letter: { width: 30, height: 30, borderRadius: radius.sm, borderWidth: 1.5, borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center' },
  letterSelected: { borderColor: color.brand, backgroundColor: color.brand },
  letterCorrect: { borderColor: color.success, backgroundColor: color.success },
  letterText: { color: color.textMuted, fontSize: 13, ...fw('800') },
  label: { ...type.bodyStrong, fontSize: 17, lineHeight: 24, color: color.text, flexShrink: 1 },
  feedback: { gap: space.sm },
  badge: { width: 30, height: 30, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badgeGlyph: { fontSize: 16, ...fw('900') },
  evidence: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.brandLine,
  },
});
