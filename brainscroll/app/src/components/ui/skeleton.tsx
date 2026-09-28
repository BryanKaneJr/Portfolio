import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, View, type DimensionValue, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReduceMotion } from '@/theme/feedback';
import { color, depth, layout, motion, radius, space, type } from '@/theme/tokens';
import { DrScrollLoading } from './mascot';

/**
 * Branded loading: quiet placeholders shaped like the content that is coming,
 * so a load never reads as a blank screen or a platform spinner. They breathe
 * slowly (still with reduce motion) and are skipped by screen readers; the
 * wrapper announces "Loading" once.
 */

/** A slow breathing opacity, shared by skeletons and a busy answer. Still with reduce motion. */
export function usePulse(active = true) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!active || reduce) return v.setValue(1);
    const half = { duration: motion.celebrate, easing: Easing.inOut(Easing.sin), useNativeDriver: true };
    const loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 0.45, ...half }), Animated.timing(v, { toValue: 1, ...half })]));
    loop.start();
    return () => loop.stop();
  }, [active, reduce, v]);
  return v;
}

/** One placeholder block. Text lines default to body height; pass `circle` for avatars and emblems. */
export function Skeleton({ width = '100%', height = type.body.lineHeight, circle, r = radius.sm, style }: { width?: DimensionValue; height?: number; circle?: boolean; r?: number; style?: ViewStyle }) {
  const pulse = usePulse();
  return <Animated.View style={[{ width: circle ? height : width, height, borderRadius: circle ? radius.pill : r, backgroundColor: color.surfaceRaised, opacity: pulse }, style]} />;
}

/** A few lines of text; the last one is shorter, like a real paragraph. */
export function SkeletonLines({ lines = 3, height = type.body.lineHeight, last = '60%' }: { lines?: number; height?: number; last?: DimensionValue }) {
  return (
    <View style={{ gap: space.sm }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={height - space.xs} width={i === lines - 1 && lines > 1 ? last : '100%'} />
      ))}
    </View>
  );
}

/**
 * A card-shaped placeholder: optional art on the left, a title and lines, and
 * an optional action bar where the card's button will be.
 */
export function SkeletonCard({ art, lines = 2, action, style }: { art?: number; lines?: number; action?: boolean; style?: ViewStyle }) {
  return (
    <View style={[cardStyle, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        {art ? <Skeleton width={art} height={art} r={radius.lg} /> : null}
        <View style={{ flex: 1, gap: space.sm }}>
          <Skeleton width="40%" height={type.label.fontSize} />
          <Skeleton width="75%" height={type.title.lineHeight} />
          {lines > 0 && <SkeletonLines lines={lines} height={type.caption.lineHeight} />}
        </View>
      </View>
      {action && <Skeleton height={layout.buttonHeight} r={radius.md} />}
    </View>
  );
}

/** Wraps placeholders so assistive tech hears one "Loading" instead of empty shapes. */
export function Loading({ label = 'Loading', children, style }: { label?: string; children: ReactNode; style?: ViewStyle }) {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }} style={[{ gap: space.lg }, style]}>
      {children}
    </View>
  );
}

/**
 * A lesson (level or review) on its way: the quiet shell's top bar, a heading
 * and paragraphs, and the footer's action. If it takes a while, Dr. Scroll
 * checks his watch underneath, so a slow network still reads as BrainScroll.
 */
export function LessonSkeleton({ label = 'Loading the lesson' }: { label?: string }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={['top', 'bottom']}>
      <Loading label={label} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, height: layout.topBarHeight }}>
          <View style={{ width: layout.minTouch }} />
          <Skeleton height={space.lg} r={radius.pill} style={{ flex: 1 }} />
          <View style={{ width: layout.minTouch }} />
        </View>
        <View style={{ flex: 1, paddingHorizontal: layout.gutter, paddingTop: space.xl }}>
          <View style={{ width: '100%', maxWidth: layout.readingWidth, alignSelf: 'center', gap: space.lg }}>
            <Skeleton width="45%" height={type.caption.lineHeight} />
            <Skeleton width="85%" height={type.h1.lineHeight} />
            <SkeletonLines lines={4} height={type.reading.lineHeight} />
            <SkeletonLines lines={3} height={type.reading.lineHeight} last="40%" />
            <DrScrollLoading delay={1500} label="Still loading. Hang on." />
          </View>
        </View>
        <View style={{ paddingHorizontal: layout.gutter, paddingVertical: space.lg, borderTopWidth: depth.line, borderTopColor: color.border }}>
          <View style={{ width: '100%', maxWidth: layout.readingWidth, alignSelf: 'center' }}>
            <Skeleton height={layout.buttonHeight} r={radius.md} />
          </View>
        </View>
      </Loading>
    </SafeAreaView>
  );
}

const cardStyle: ViewStyle = {
  borderRadius: radius.lg,
  padding: space.lg,
  gap: space.md,
  borderWidth: depth.border,
  borderBottomWidth: depth.edge,
  borderColor: color.border,
  backgroundColor: color.surface,
};
