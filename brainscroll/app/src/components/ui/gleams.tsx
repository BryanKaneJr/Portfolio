import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useReduceMotion } from '@/theme/feedback';
import { color } from '@/theme/tokens';
import { ease } from './motion';

/**
 * Little gleams that twinkle in and out around something that matters: the
 * next level's callout, this week's quest, a trophy just earned (owner,
 * 2026-10-03: "little simple super easy animations" that make the app feel
 * alive). Each one fades and grows in, turns a little, fades out, then
 * comes back somewhere else along the edges a moment later, so they never
 * blink in step.
 *
 * Purely decoration: it fills its parent (render it last, inside a parent
 * that is the area to sparkle), ignores touches and is hidden from screen
 * readers. Nothing renders with Reduce Motion. Never on lesson screens:
 * learning mode stays quiet.
 */
export function Gleams({ count = 4, tint = color.text, size = 14, active = true }: { count?: number; tint?: string; size?: number; active?: boolean }) {
  const reduce = useReduceMotion();
  if (reduce || !active) return null;
  return (
    <View pointerEvents="none" accessible={false} aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }, (_, i) => (
        <Gleam key={i} index={i} tint={tint} size={size} />
      ))}
    </View>
  );
}

/** How long one twinkle lasts, and the rest between two (ms). */
const TWINKLE = 1500;
const REST_MIN = 600;
const REST_SPREAD = 1400;

function Gleam({ index, tint, size }: { index: number; tint: string; size: number }) {
  const [t] = useState(() => new Animated.Value(0));
  const [spot, setSpot] = useState(() => edgeSpot(index));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    const twinkle = () => {
      t.setValue(0);
      Animated.timing(t, { toValue: 1, duration: TWINKLE, easing: ease.breathe, useNativeDriver: true }).start(({ finished }) => {
        if (!alive || !finished) return;
        // Out of sight now: move somewhere new along the edges, then rest.
        setSpot(edgeSpot(index));
        timer = setTimeout(twinkle, REST_MIN + Math.random() * REST_SPREAD);
      });
    };
    // Staggered, so the first ones don't all arrive together.
    timer = setTimeout(twinkle, index * 550 + Math.random() * 400);
    return () => {
      alive = false;
      clearTimeout(timer);
      t.stopAnimation();
    };
  }, [t, index]);
  const s = size * spot.scale;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: `${spot.x}%`,
        top: `${spot.y}%`,
        width: s,
        height: s,
        marginLeft: -s / 2,
        marginTop: -s / 2,
        opacity: t.interpolate({ inputRange: [0, 0.45, 0.55, 1], outputRange: [0, 0.95, 0.95, 0] }),
        transform: [
          { scale: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 1, 0.35] }) },
          { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-20deg', '25deg'] }) },
        ],
      }}>
      <Svg width={s} height={s} viewBox="0 0 20 20">
        {/* A four-point star: long arms, a pinched middle. */}
        <Path d="M10 0 C10.9 6.2 13.8 9.1 20 10 C13.8 10.9 10.9 13.8 10 20 C9.1 13.8 6.2 10.9 0 10 C6.2 9.1 9.1 6.2 10 0 Z" fill={tint} />
      </Svg>
    </Animated.View>
  );
}

/**
 * A spot near the edge of the area, as percentages: the gleams take turns
 * on each side (gleam i favours side i % 4), so they spread around rather than
 * bunching up. Some are a little smaller, for depth.
 */
function edgeSpot(index: number): { x: number; y: number; scale: number } {
  const side = Math.random() < 0.5 ? index % 4 : (index + 1 + Math.floor(Math.random() * 3)) % 4;
  const along = 8 + Math.random() * 84;
  const off = Math.random() * 10;
  const scale = 0.7 + Math.random() * 0.4;
  switch (side) {
    case 0:
      return { x: along, y: 2 + off, scale };
    case 1:
      return { x: 98 - off, y: along, scale };
    case 2:
      return { x: along, y: 98 - off, scale };
    default:
      return { x: 2 + off, y: along, scale };
  }
}
