import { encodeArrangement, shuffledLabels, type Question } from '@brainscroll/core';
import { useMemo, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Icon } from '@/components/ui';
import type { AttemptView } from '@/progress/ProgressProvider';
import { feedback } from '@/theme/feedback';
import { color, depth, fw, radius, space, type } from '@/theme/tokens';

/**
 * Match and order questions (owner, 2026-10-03). Like multiple choice, the
 * learner arranges, then taps CHECK; only the first check counts, and after a
 * miss the wrong positions are marked (never what belongs there) and the
 * source cards appear below until it's right.
 *
 * Each reports its answer through `onSelect` as the string the server grades
 * (core encodeArrangement), or '' while it isn't complete.
 */
type OrderQ = Extract<Question, { kind: 'order' }>;
type MatchQ = Extract<Question, { kind: 'match' }>;

/** The last attempt's wrong positions, while the arrangement is still the one that was checked. */
function markedWrong(attempts: AttemptView[], answer: string): Set<number> {
  const last = attempts.at(-1);
  return last && !last.correct && last.optionId === answer ? new Set(last.wrong ?? []) : new Set();
}

// ─── Order ──────────────────────────────────────────────────────────────────

/**
 * Put in order: drag a tile by its handle, or tap two tiles to swap them
 * (owner: "drag with tap as backup"). Screen readers swipe up or down on a
 * tile to move it. The two ends are named above and below the list.
 */
export function OrderQuestion({ question: q, attempts, busy, onSelect }: { question: OrderQ; attempts: AttemptView[]; busy: boolean; onSelect: (answer: string) => void }) {
  const [arr, setArr] = useState(() => (q.shuffled ? [...q.items] : shuffledLabels(q.id, q.items)));
  const [picked, setPicked] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const resolved = attempts.some((a) => a.correct);
  const locked = resolved || busy;
  const answer = encodeArrangement(arr);
  const wrong = markedWrong(attempts, answer);
  // One row's height plus the gap: how far a tile moves per place.
  const [rowH, setRowH] = useState(0);
  const [dy] = useState(() => new Animated.Value(0));

  // The screen acknowledges each change (onSelect); in-between taps tick here.
  const commit = (next: string[]) => {
    setArr(next);
    onSelect(encodeArrangement(next));
  };
  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...arr];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it!);
    commit(next);
  };
  const tap = (i: number) => {
    if (locked) return;
    if (picked === null) {
      feedback('select');
      return setPicked(i);
    }
    if (picked !== i) {
      const next = [...arr];
      [next[picked], next[i]] = [next[i]!, next[picked]!];
      commit(next);
    }
    setPicked(null);
  };

  // One responder per handle; refs keep it reading the current arrangement.
  const responders = useMemo(
    () =>
      q.items.map((_, i) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => !locked,
          onMoveShouldSetPanResponder: () => !locked,
          // Once a drag starts, the lesson's scroll view mustn't take it over.
          onPanResponderTerminationRequest: () => false,
          onPanResponderGrant: () => {
            setPicked(null);
            dy.setValue(0);
            setDrag({ from: i, to: i });
          },
          onPanResponderMove: (_e, g) => {
            dy.setValue(g.dy);
            const h = rowH || 1;
            const to = Math.max(0, Math.min(arr.length - 1, i + Math.round(g.dy / h)));
            setDrag((d) => (d && d.to !== to ? { ...d, to } : d));
          },
          onPanResponderRelease: (_e, g) => {
            const h = rowH || 1;
            const to = Math.max(0, Math.min(arr.length - 1, i + Math.round(g.dy / h)));
            setDrag(null);
            dy.setValue(0);
            if (to !== i) {
              const next = [...arr];
              const [it] = next.splice(i, 1);
              next.splice(to, 0, it!);
              setArr(next);
              onSelect(encodeArrangement(next));
            }
          },
          onPanResponderTerminate: () => {
            setDrag(null);
            dy.setValue(0);
          },
        }),
      ),
    // Rebuilt when what they read changes; none of it changes mid-drag (the order is only committed on release).
    [q.items, arr, locked, rowH, onSelect, dy],
  );

  // While dragging, the tiles between the start and the target step aside.
  const shift = (k: number) => {
    if (!drag || k === drag.from) return 0;
    const h = rowH;
    if (drag.from < drag.to && k > drag.from && k <= drag.to) return -h;
    if (drag.from > drag.to && k < drag.from && k >= drag.to) return h;
    return 0;
  };

  return (
    <View testID="order-question" style={{ gap: space.sm }}>
      <End label={q.first} />
      <View style={{ gap: ROW_GAP }}>
        {arr.map((label, i) => {
          const dragging = drag?.from === i;
          const state = resolved ? 'correct' : wrong.has(i) ? 'wrong' : picked === i || dragging ? 'picked' : 'idle';
          return (
            <Animated.View
              key={`${i}:${label}`}
              onLayout={i === 0 ? (e: LayoutChangeEvent) => setRowH(e.nativeEvent.layout.height + ROW_GAP) : undefined}
              style={[{ zIndex: dragging ? 2 : 1 }, { transform: [{ translateY: dragging ? dy : shift(i) }] }]}>
              <Pressable
                testID="order-tile"
                accessibilityRole="adjustable"
                accessibilityLabel={`${label}, ${i + 1} of ${arr.length}${state === 'wrong' ? ', in the wrong place' : state === 'correct' ? ', correct' : ''}`}
                accessibilityHint={locked ? undefined : 'Swipe up or down to move it. Or tap it, then tap another to swap.'}
                accessibilityActions={locked ? [] : [{ name: 'increment' }, { name: 'decrement' }]}
                onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'increment' ? move(i, Math.min(i + 1, arr.length - 1)) : move(i, Math.max(i - 1, 0)))}
                disabled={locked}
                onPress={() => tap(i)}
                style={({ pressed }) => [styles.tile, styles[state], pressed && !locked && { transform: [{ scale: 0.985 }] }]}>
                <View style={[styles.badge, state === 'correct' && styles.badgeCorrect, state === 'picked' && styles.badgePicked]}>
                  <Text maxFontSizeMultiplier={1.4} style={[styles.badgeText, (state === 'correct' || state === 'picked') && { color: color.onBrand }]}>
                    {state === 'correct' ? '✓' : String(i + 1)}
                  </Text>
                </View>
                <Text style={[styles.label, state === 'wrong' && { color: color.danger }]}>{label}</Text>
                {!locked && (
                  // The drag handle: grab it and slide.
                  <View {...responders[i]!.panHandlers} hitSlop={8} style={styles.handle} aria-hidden accessible={false}>
                    <Icon name="grip" tint={color.textMuted} size={22} />
                  </View>
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
      <End label={q.last} />
    </View>
  );
}

function End({ label }: { label: string }) {
  return (
    <Text maxFontSizeMultiplier={1.4} style={[type.label, { color: color.textMuted, textAlign: 'center' }]}>
      {label}
    </Text>
  );
}

// ─── Match ──────────────────────────────────────────────────────────────────

/**
 * Match: tap an item on the left, then its partner on the right (either
 * order works). A pair shows the same number on both sides; tap either half
 * to undo it. CHECK comes alive once every item is paired.
 */
export function MatchQuestion({ question: q, attempts, busy, onSelect }: { question: MatchQ; attempts: AttemptView[]; busy: boolean; onSelect: (answer: string) => void }) {
  const lefts = q.pairs.map((p) => p.left);
  const [rights] = useState(() => {
    const r = q.pairs.map((p) => p.right);
    return q.shuffled ? r : shuffledLabels(q.id, r);
  });
  const [assign, setAssign] = useState<(number | null)[]>(() => lefts.map(() => null));
  const [left, setLeft] = useState<number | null>(null);
  const [right, setRight] = useState<number | null>(null);
  const resolved = attempts.some((a) => a.correct);
  const locked = resolved || busy;
  const complete = assign.every((a) => a !== null);
  const answer = complete ? encodeArrangement(assign.map((j) => rights[j!]!)) : '';
  const wrong = markedWrong(attempts, answer);

  const report = (next: (number | null)[]) => {
    setAssign(next);
    onSelect(next.every((a) => a !== null) ? encodeArrangement(next.map((j) => rights[j!]!)) : '');
  };
  const pair = (i: number, j: number) => {
    const next = assign.map((a) => (a === j ? null : a));
    next[i] = j;
    setLeft(null);
    setRight(null);
    report(next);
  };
  const tapLeft = (i: number) => {
    if (locked) return;
    if (assign[i] !== null) {
      const next = [...assign];
      next[i] = null;
      return report(next);
    }
    if (right !== null) return pair(i, right);
    feedback('select');
    setLeft(left === i ? null : i);
  };
  const tapRight = (j: number) => {
    if (locked) return;
    const owner = assign.indexOf(j);
    if (owner >= 0) {
      const next = [...assign];
      next[owner] = null;
      return report(next);
    }
    if (left !== null) return pair(left, j);
    feedback('select');
    setRight(right === j ? null : j);
  };

  return (
    <View testID="match-question" style={{ flexDirection: 'row', gap: space.md }}>
      <View style={{ flex: 1, gap: space.sm }}>
        {lefts.map((label, i) => {
          const n = assign[i] !== null ? i + 1 : undefined;
          const state = resolved ? 'correct' : wrong.has(i) ? 'wrong' : left === i ? 'picked' : n ? 'paired' : 'idle';
          return (
            <MatchTile
              key={`l${i}`}
              side="left"
              label={label}
              n={n}
              state={state}
              locked={locked}
              a11y={`${label}${n ? `, matched with ${rights[assign[i]!]}` : ''}${state === 'wrong' ? ', not a match' : ''}`}
              onPress={() => tapLeft(i)}
            />
          );
        })}
      </View>
      <View style={{ flex: 1, gap: space.sm }}>
        {rights.map((label, j) => {
          const owner = assign.indexOf(j);
          const n = owner >= 0 ? owner + 1 : undefined;
          const state = resolved ? 'correct' : owner >= 0 && wrong.has(owner) ? 'wrong' : right === j ? 'picked' : n ? 'paired' : 'idle';
          return (
            <MatchTile
              key={`r${j}`}
              side="right"
              label={label}
              n={n}
              state={state}
              locked={locked}
              a11y={`${label}${owner >= 0 ? `, matched with ${lefts[owner]}` : ''}${state === 'wrong' ? ', not a match' : ''}`}
              onPress={() => tapRight(j)}
            />
          );
        })}
      </View>
    </View>
  );
}

function MatchTile({ side, label, n, state, locked, a11y, onPress }: { side: 'left' | 'right'; label: string; n?: number; state: 'idle' | 'picked' | 'paired' | 'wrong' | 'correct'; locked: boolean; a11y: string; onPress: () => void }) {
  return (
    <Pressable
      testID={`match-${side}`}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      aria-selected={state === 'picked'}
      disabled={locked}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, styles.matchTile, styles[state === 'paired' ? 'picked' : state], pressed && !locked && { transform: [{ scale: 0.97 }] }]}>
      <Text style={[styles.label, styles.matchLabel, state === 'wrong' && { color: color.danger }]}>{label}</Text>
      {n !== undefined && (
        <View style={[styles.pairBadge, state === 'correct' && styles.badgeCorrect]} aria-hidden accessible={false}>
          <Text maxFontSizeMultiplier={1.2} style={styles.pairText}>
            {state === 'correct' ? '✓' : String(n)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const ROW_GAP = space.sm;
const BADGE = 32;

const styles = StyleSheet.create({
  tile: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: depth.border,
    borderBottomWidth: depth.edge,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  matchTile: { justifyContent: 'center', paddingHorizontal: space.sm },
  idle: { borderColor: color.border, backgroundColor: color.surface },
  picked: { borderColor: color.brand, backgroundColor: color.brandSoft },
  paired: { borderColor: color.brand, backgroundColor: color.brandSoft },
  wrong: { borderColor: color.dangerLine, backgroundColor: color.dangerSoft },
  correct: { borderColor: color.success, backgroundColor: color.successSoft },
  badge: { width: BADGE, height: BADGE, borderRadius: radius.sm, borderWidth: depth.border, borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center' },
  badgePicked: { borderColor: color.brand, backgroundColor: color.brand },
  badgeCorrect: { borderColor: color.success, backgroundColor: color.success },
  badgeText: { ...type.meta, color: color.textMuted },
  label: { ...type.choice, color: color.text, flex: 1 },
  matchLabel: { textAlign: 'center' },
  handle: { paddingHorizontal: space.xs, paddingVertical: space.sm },
  pairBadge: { position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: radius.pill, backgroundColor: color.brand, alignItems: 'center', justifyContent: 'center' },
  pairText: { ...type.meta, ...fw('900'), color: color.onBrand, fontSize: 12 },
});
