import type { Question } from '@brainscroll/core';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { H2, type AnswerState } from '@/components/ui';
import { usePop } from '@/components/ui/motion';
import { color, depth, radius, space, type } from '@/theme/tokens';

type Mcq = Extract<Question, { kind: 'mcq' }>;

/**
 * Fill in the blank (owner, 2026-10-03): the prompt is a sentence with a gap,
 * the options sit below as chips, and the one chosen leaves the bank and pops
 * into the gap. The gap is as wide as the longest option, so every answer fits
 * and the width gives nothing away. Graded like any multiple choice: tap a
 * chip, CHECK. Tap the chip in the gap (or its outline in the bank) to take it
 * back.
 *
 * Screen readers hear the whole sentence, with "blank" or the chosen answer in
 * the gap, and the chips are the same radio group as a normal question.
 */
export function FillBlankQuestion({
  question,
  before,
  after,
  stateOf,
  onSelect,
}: {
  question: Mcq;
  before: string;
  after: string;
  stateOf: (optionId: string) => AnswerState;
  onSelect: (optionId: string) => void;
}) {
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({});
  const [rowWidth, setRowWidth] = useState(0);
  const measured = Object.values(sizes);
  const gapWidth = Math.min(Math.max(80, ...measured.map((s) => s.w)), rowWidth || Infinity);
  const gapHeight = Math.max(40, ...measured.map((s) => s.h));

  // In the gap: the right answer once found, else the current pick (a wrong pick goes back, crossed out).
  const filled = question.options.find((o) => stateOf(o.id) === 'correct') ?? question.options.find((o) => ['selected', 'checking'].includes(stateOf(o.id)));
  const filledState = filled ? stateOf(filled.id) : undefined;
  const canTakeBack = filledState === 'selected';
  const pop = usePop(filled?.id ?? null, { from: 0.6 });

  // Words wrap one by one around the gap; punctuation right after it ("_____.") stays with it.
  const words = (t: string) => t.split(/\s+/).filter(Boolean);
  const beforeWords = words(before);
  const afterWords = words(after);
  const stuck = after && !/^\s/.test(after) ? afterWords.shift() : undefined;
  const spoken = `${before}${filled ? filled.label : 'blank'}${after}`.trim();

  return (
    <View style={{ gap: space.xl }}>
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={spoken}
        onLayout={(e: LayoutChangeEvent) => setRowWidth(e.nativeEvent.layout.width)}
        style={styles.sentence}>
        {beforeWords.map((w, i) => (
          <H2 key={`b${i}`}>{w}</H2>
        ))}
        <View style={styles.stuck}>
          <View style={[styles.gap, { width: gapWidth, height: gapHeight }]}>
            {filled && (
              <Animated.View style={pop}>
                <Chip label={filled.label} state={filledState!} width={gapWidth} onPress={canTakeBack ? () => onSelect('') : undefined} />
              </Animated.View>
            )}
          </View>
          {stuck ? <H2>{stuck}</H2> : null}
        </View>
        {afterWords.map((w, i) => (
          <H2 key={`a${i}`}>{w}</H2>
        ))}
      </View>

      <View style={styles.bank} accessibilityRole="radiogroup">
        {question.options.map((o) => {
          const state = stateOf(o.id);
          const inGap = o.id === filled?.id;
          return (
            <Pressable
              key={o.id}
              accessibilityRole="radio"
              accessibilityLabel={inGap ? `${o.label}, in the blank` : state === 'eliminated' ? `${o.label}, crossed out` : o.label}
              aria-checked={inGap}
              aria-disabled={!inGap && state !== 'idle'}
              disabled={inGap ? !canTakeBack : state !== 'idle'}
              onPress={() => onSelect(inGap ? '' : o.id)}>
              <Chip label={o.label} state={inGap ? 'ghost' : state} />
            </Pressable>
          );
        })}
      </View>

      {/* Every option measured off-screen at chip size, so the gap fits the longest before anything is picked. */}
      <View style={styles.measure} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {question.options.map((o) => (
          <View
            key={o.id}
            style={{ alignSelf: 'flex-start' }}
            onLayout={(e: LayoutChangeEvent) => {
              const { width: w, height: h } = e.nativeEvent.layout;
              setSizes((s) => (s[o.id]?.w === w && s[o.id]?.h === h ? s : { ...s, [o.id]: { w, h } }));
            }}>
            <Chip label={o.label} state="idle" />
          </View>
        ))}
      </View>
    </View>
  );
}

type ChipState = AnswerState | 'ghost';

/** One answer chip. A `ghost` is the outline left in the bank while its answer sits in the gap. */
function Chip({ label, state, width, onPress }: { label: string; state: ChipState; width?: number; onPress?: () => void }) {
  const chip = (
    <View style={[styles.chip, chipStyle[state], width ? { width } : null]}>
      <Text
        style={[
          styles.label,
          state === 'ghost' && { opacity: 0 },
          state === 'eliminated' && { color: color.textFaint, textDecorationLine: 'line-through' },
          state === 'locked' && { color: color.textMuted },
        ]}>
        {label}
      </Text>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { transform: [{ scale: 0.97 }] }}>
      {chip}
    </Pressable>
  ) : (
    chip
  );
}

const styles = StyleSheet.create({
  sentence: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: space.xs },
  stuck: { flexDirection: 'row', alignItems: 'center', columnGap: 2 },
  gap: { borderBottomWidth: depth.edge, borderColor: color.borderStrong, borderRadius: radius.sm, justifyContent: 'center' },
  bank: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  measure: { position: 'absolute', opacity: 0, left: 0, top: 0, right: 0 },
  chip: {
    borderRadius: radius.md,
    borderWidth: depth.border,
    borderBottomWidth: depth.edge,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...type.choice, color: color.text, textAlign: 'center' },
});

const chipStyle: Record<ChipState, object> = {
  idle: { borderColor: color.border, backgroundColor: color.surface },
  selected: { borderColor: color.brand, backgroundColor: color.brandSoft },
  checking: { borderColor: color.brand, backgroundColor: color.brandSoft },
  correct: { borderColor: color.success, backgroundColor: color.successSoft },
  eliminated: { borderColor: color.border, backgroundColor: 'transparent', borderBottomWidth: depth.border },
  locked: { borderColor: color.border, backgroundColor: 'transparent', borderBottomWidth: depth.border },
  ghost: { borderColor: color.border, backgroundColor: 'transparent', borderStyle: 'dashed', borderBottomWidth: depth.border },
};
