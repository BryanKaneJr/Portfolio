import type { MascotSpot } from '@brainscroll/core';
import type { ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { liveRegion, useAnnounce } from '@/theme/feedback';
import { color, depth, layout, radius, space, type, fw } from '@/theme/tokens';
import { DrScroll } from './mascot';
import { SlideIn, useNudge, usePop } from './motion';
import { usePulse } from './skeleton';
import { Eyebrow } from './text';

/**
 * unanswered (`idle`) → `selected` → `checking` (the pick while CHECK is in
 * flight; the others go `locked`) → `correct`, or `eliminated` (a wrong pick,
 * crossed out) with the rest back to `idle` for the retry.
 */
export type AnswerState = 'idle' | 'selected' | 'checking' | 'correct' | 'eliminated' | 'locked';

/**
 * A large, tactile answer card (not a tiny radio). Tap to select; the lesson's
 * CHECK button grades it. After grading: mint for correct, a crossed-out quiet
 * card for a wrong pick (restrained coral mark, no red flood).
 *
 * State never rides on colour alone: the letter becomes ✓ or ✕, a wrong pick
 * is struck through, and screen readers hear "correct" or "crossed out" after the
 * answer along with the radio's checked and disabled states.
 */
export function AnswerOption({ label, state, onPress, letter }: { label: string; state: AnswerState; onPress: () => void; letter: string }) {
  const disabled = state !== 'idle' && state !== 'selected';
  const picked = state === 'selected' || state === 'checking' || state === 'correct';
  const pop = usePop(state === 'selected' || state === 'correct' ? state : null, { from: 0.96 });
  const nudge = useNudge(state === 'eliminated');
  // While the answer is being checked, the pick's letter breathes: the app is working, not frozen.
  const pulse = usePulse(state === 'checking');
  return (
    <Animated.View style={state === 'eliminated' ? nudge : pop}>
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={state === 'correct' ? `${label}, correct` : state === 'eliminated' ? `${label}, crossed out` : label}
      aria-checked={picked}
      aria-disabled={disabled}
      aria-busy={state === 'checking'}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.option, styles[state], pressed && { transform: [{ scale: 0.985 }] }]}>
      <Animated.View style={[styles.letter, (state === 'selected' || state === 'checking') && styles.letterSelected, state === 'correct' && styles.letterCorrect, { opacity: pulse }]}>
        {/* A fixed badge: its glyph scales a little with Dynamic Type, never out of the square. */}
        <Text maxFontSizeMultiplier={1.4} style={[styles.letterText, (state === 'selected' || state === 'checking') && { color: color.onBrand }, state === 'correct' && { color: color.onSuccess }]}>
          {state === 'correct' ? '✓' : state === 'eliminated' ? '✕' : letter.toUpperCase()}
        </Text>
      </Animated.View>
      <Text
        style={[
          styles.label,
          state === 'eliminated' && { color: color.textFaint, textDecorationLine: 'line-through' },
          state === 'locked' && { color: color.textMuted },
        ]}>
        {label}
      </Text>
    </Pressable>
    </Animated.View>
  );
}

/**
 * The in-context verdict, anchored above the bottom action (never a separate
 * screen). Success is mint and short; "reinforce" is teaching, not punishment.
 * `mascot` adds a small, quiet Dr. Scroll reaction beside it (decorative).
 */
export function FeedbackPanel({ tone, title, mascot, children }: { tone: 'success' | 'reinforce'; title: string; mascot?: MascotSpot; children?: ReactNode }) {
  const panel = <FeedbackBody tone={tone} title={title}>{children}</FeedbackBody>;
  if (!mascot) return <SlideIn from="below">{panel}</SlideIn>;
  return (
    <SlideIn from="below" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
      <DrScroll spot={mascot} size="xs" />
      <View style={{ flex: 1 }}>{panel}</View>
    </SlideIn>
  );
}

function FeedbackBody({ tone, title, children }: { tone: 'success' | 'reinforce'; title: string; children?: ReactNode }) {
  const success = tone === 'success';
  const pop = usePop(title, { from: 0.4, delay: 80 });
  // The verdict lands in the footer, away from focus (the button just pressed): say it.
  useAnnounce(title);
  return (
    <View style={styles.feedback} accessibilityLiveRegion={liveRegion}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {/* The title says it in words; the badge is its shape (✓ or ↻), hidden from screen readers. */}
        <Animated.View style={[styles.badge, pop, { backgroundColor: success ? color.success : color.dangerSoft, borderColor: success ? color.success : color.dangerLine }]} aria-hidden accessible={false} importantForAccessibility="no-hide-descendants">
          <Text maxFontSizeMultiplier={1.2} style={[styles.badgeGlyph, { color: success ? color.onSuccess : color.danger }]}>{success ? '✓' : '↻'}</Text>
        </Animated.View>
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

const BADGE = 30;

const styles = StyleSheet.create({
  option: {
    minHeight: layout.answerMinHeight,
    borderRadius: radius.md,
    borderWidth: depth.border,
    borderBottomWidth: depth.edge,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  idle: { borderColor: color.border, backgroundColor: color.surface },
  selected: { borderColor: color.brand, backgroundColor: color.brandSoft },
  checking: { borderColor: color.brand, backgroundColor: color.brandSoft },
  correct: { borderColor: color.success, backgroundColor: color.successSoft },
  eliminated: { borderColor: color.border, backgroundColor: 'transparent', borderBottomWidth: depth.border },
  locked: { borderColor: color.border, backgroundColor: 'transparent', borderBottomWidth: depth.border },
  // The letter and verdict badges are fixed squares, so their glyphs never shift the label.
  letter: { width: BADGE, height: BADGE, borderRadius: radius.sm, borderWidth: depth.border, borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center' },
  letterSelected: { borderColor: color.brand, backgroundColor: color.brand },
  letterCorrect: { borderColor: color.success, backgroundColor: color.success },
  letterText: { ...type.meta, color: color.textMuted },
  label: { ...type.choice, color: color.text, flexShrink: 1 },
  feedback: { gap: space.sm },
  badge: { width: BADGE, height: BADGE, borderRadius: radius.pill, borderWidth: depth.line, alignItems: 'center', justifyContent: 'center' },
  badgeGlyph: { ...type.bodyStrong, ...fw('900') },
  evidence: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: depth.line,
    borderColor: color.brandLine,
  },
});
