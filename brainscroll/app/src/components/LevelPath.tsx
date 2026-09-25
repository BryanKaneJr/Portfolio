import { MASTERY_BAND_SIZE } from '@brainscroll/core';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { DrScroll, Eyebrow, H2, Icon, usePop, type IconName } from '@/components/ui';
import { chapterFor, levelByNumber } from '@/content';
import { haptic, useReduceMotion } from '@/theme/feedback';
import { color, depth, space, type } from '@/theme/tokens';

type NodeState = 'done' | 'current' | 'locked';

/** How far each node sits from the center line, so the trail winds. */
const SWAY = [0, 48, 76, 48, 0, -48, -76, -48, 0, 48];
const NODE = 72;
const CURRENT = 84;

/**
 * Home's centerpiece: the current chapter as a winding trail of round, raised
 * level nodes. Cleared levels are solid violet with a check, the next level is
 * bigger with a "Start" bubble, later levels are locked. Every 10th level (the
 * checkpoint) is a trophy, gold on a mastery level. Dr. Scroll reads along
 * beside the trail.
 */
export function LevelPath({
  skillId,
  level,
  nextNumber,
  resuming,
  dailyComplete,
  justCleared,
  onOpen,
}: {
  skillId: string;
  /** Highest level cleared. */
  level: number;
  /** The next level to play, if any is published. */
  nextNumber?: number;
  resuming: boolean;
  dailyComplete: boolean;
  /** The level just cleared, whose node pops when Home comes back into view. */
  justCleared?: number;
  onOpen: (levelId: string) => void;
}) {
  const focus = nextNumber ?? Math.max(level, 1);
  const chapter = chapterFor(skillId, focus);
  const first = chapter?.levels[0] ?? Math.floor((focus - 1) / 10) * 10 + 1;
  const last = chapter?.levels[1] ?? first + 9;
  const numbers = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const nextChapter = chapterFor(skillId, last + 1);

  return (
    <View style={{ gap: space.xl }}>
      <View style={styles.banner}>
        <Eyebrow style={{ color: 'rgba(255,255,255,0.8)' }}>
          Chapter {chapter?.number ?? Math.ceil(first / 10)} · Levels {first}–{last}
        </Eyebrow>
        {chapter && <H2 style={{ color: '#FFFFFF' }}>{chapter.title}</H2>}
      </View>

      <View style={styles.trail}>
        {numbers.map((n, i) => {
          const lv = levelByNumber(skillId, n);
          const state: NodeState = n <= level ? 'done' : n === nextNumber ? 'current' : 'locked';
          const x = SWAY[i % SWAY.length]!;
          return (
            <View key={n} style={[styles.slot, { transform: [{ translateX: x }] }]}>
              {state === 'current' && lv && (
                <StartBubble label={dailyComplete ? 'Done for today' : resuming ? 'Resume' : 'Start'} title={lv.title} />
              )}
              <PathNode
                n={n}
                state={state}
                checkpoint={n % 10 === 0}
                mastery={n % MASTERY_BAND_SIZE === 0}
                celebrate={state === 'done' && n === justCleared}
                title={lv?.title}
                accessibilityLabel={
                  state === 'current' ? (dailyComplete ? 'Daily knowledge complete' : `${resuming ? 'Resume' : 'Start'} Level ${n}`) : undefined
                }
                onPress={
                  lv && state !== 'locked'
                    ? () => {
                        haptic.select();
                        onOpen(lv.id);
                      }
                    : undefined
                }
              />
            </View>
          );
        })}
        {/* He stands on the open side of the curve, beside levels 3–4. */}
        <DrScroll spot="home.path" size="md" style={styles.mascot} />
      </View>

      {nextChapter && (
        <View style={styles.nextChapter}>
          <Icon name="lock" tint={color.textFaint} size={18} />
          <Text style={[type.bodyStrong, { color: color.textMuted, flexShrink: 1 }]}>
            Next: Chapter {nextChapter.number} · {nextChapter.title}
          </Text>
        </View>
      )}
    </View>
  );
}

function PathNode({ n, state, checkpoint, mastery, celebrate, title, accessibilityLabel, onPress }: {
  n: number;
  celebrate?: boolean;
  state: NodeState;
  checkpoint: boolean;
  mastery: boolean;
  title?: string;
  accessibilityLabel?: string;
  onPress?: () => void;
}) {
  const size = state === 'current' ? CURRENT : NODE;
  const gold = mastery && state === 'done';
  const fill = state === 'locked' ? color.surfaceRaised : gold ? color.mastery : color.brand;
  const edge = state === 'locked' ? color.border : gold ? color.masteryEdge : color.brandEdge;
  const iconName: IconName = checkpoint ? 'trophy' : state === 'done' ? 'check' : state === 'current' ? 'star' : 'lock';
  const tint = state === 'locked' ? color.textFaint : gold ? '#1A1305' : '#FFFFFF';
  const pop = usePop(celebrate, { from: 0.5, delay: 250 });
  const label = accessibilityLabel ?? `Level ${n}${title ? `: ${title}` : ''}${state === 'done' ? ', cleared' : state === 'locked' ? ', locked' : ''}`;
  return (
    <Animated.View style={[state === 'current' ? styles.ring : undefined, pop]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !onPress }}
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [
          styles.node,
          { width: size, height: size - 6, borderRadius: size / 2, backgroundColor: fill, borderBottomColor: edge },
          pressed ? { borderBottomWidth: 0, transform: [{ translateY: 6 }] } : { borderBottomWidth: 6 },
        ]}>
        <Icon name={iconName} tint={tint} size={state === 'current' ? 36 : 30} />
      </Pressable>
    </Animated.View>
  );
}

/** The bouncing "Start" callout above the next level, with its title. */
function StartBubble({ label, title }: { label: string; title: string }) {
  const reduce = useReduceMotion();
  const [bob] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob, reduce]);
  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.bubble, { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }]}>
      <Text style={[type.label, { color: color.brand, textAlign: 'center' }]}>{label}</Text>
      <Text numberOfLines={2} style={[type.bodyStrong, { color: color.text, textAlign: 'center' }]}>
        {title}
      </Text>
      <View style={styles.bubbleTail} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: color.brand,
    borderBottomWidth: depth.edge,
    borderBottomColor: color.brandEdge,
    borderRadius: 18,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    gap: space.xs,
  },
  trail: { alignItems: 'center', gap: space.lg, paddingBottom: space.sm },
  slot: { alignItems: 'center', gap: space.sm },
  node: { alignItems: 'center', justifyContent: 'center' },
  ring: { padding: 6, borderRadius: 999, borderWidth: 4, borderColor: color.brandLine },
  bubble: {
    backgroundColor: color.surface,
    borderWidth: depth.border,
    borderColor: color.border,
    borderBottomWidth: depth.edge,
    borderRadius: 16,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    maxWidth: 220,
    marginBottom: space.xs,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -9,
    alignSelf: 'center',
    width: 14,
    height: 14,
    backgroundColor: color.surface,
    borderRightWidth: depth.border,
    borderBottomWidth: depth.border,
    borderColor: color.border,
    transform: [{ rotate: '45deg' }],
  },
  mascot: { position: 'absolute', top: 3 * (NODE + space.lg) - 10, left: '4%' },
  nextChapter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.lg,
    borderTopWidth: depth.border,
    borderColor: color.border,
  },
});
