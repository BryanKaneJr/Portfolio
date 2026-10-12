/**
 * An enemy's arms on fire: the mark of a war. Their shield sits on a dark gilt-rimmed disc with flames rising behind
 * it (drawn for this game), flickering unless the phone asks for reduced motion. Drawn on a 60 × 72 box in which the
 * shield is 30 wide; `size` is the shield's width on screen.
 */
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { Shield } from './Flag';

const OUTER = 'M14 70C5 62 2 50 7 39C8 46 11 49 14 49C11 38 15 27 22 21C21 28 23 33 26 34C25 23 29 11 36 3C36 13 39 20 43 24C43 17 46 12 51 9C49 18 52 26 54 31C57 28 58 24 58 20C64 31 63 46 58 56C61 61 59 66 56 70Z';
const INNER = 'M18 70C12 63 11 55 14 48C15 52 17 54 19 54C18 46 21 39 26 34C26 39 28 42 30 43C30 35 33 27 38 21C38 28 40 33 43 36C44 31 46 28 49 26C48 33 50 39 51 43C53 41 54 38 54 35C57 44 56 55 53 62C54 65 53 68 51 70Z';
const BOX_W = 60;
const BOX_H = 72;

/** Flames alone, filling a 60 × 72 box scaled to `scale`. `seed` staggers the flicker so neighbours don't pulse in step. */
export const Flames = memo(function Flames({ scale, seed = 0 }: { scale: number; seed?: number }) {
  const t = useSharedValue(0);
  const u = useSharedValue(0);
  const still = useReducedMotion();
  useEffect(() => {
    if (still) return;
    const ease = Easing.inOut(Easing.sin);
    t.set(withDelay((seed * 137) % 400, withRepeat(withTiming(1, { duration: 760 + ((seed * 89) % 240), easing: ease }), -1, true)));
    u.set(withDelay((seed * 211) % 300, withRepeat(withTiming(1, { duration: 540 + ((seed * 53) % 180), easing: ease }), -1, true)));
    return () => {
      cancelAnimation(t);
      cancelAnimation(u);
    };
  }, [still, seed, t, u]);
  const outer = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.93 + t.get() * 0.11 }, { scaleX: 1.03 - t.get() * 0.05 }] }));
  const inner = useAnimatedStyle(() => ({ transform: [{ scaleY: 1.05 - u.get() * 0.14 }, { translateX: (u.get() - 0.5) * 1.6 * scale }], opacity: 0.82 + u.get() * 0.18 }));
  const w = BOX_W * scale;
  const h = BOX_H * scale;
  const id = `fl${seed}`;
  return (
    <>
      <Animated.View style={[styles.layer, { width: w, height: h }, outer]} pointerEvents="none">
        <Svg width={w} height={h} viewBox={`0 0 ${BOX_W} ${BOX_H}`}>
          <Defs>
            <LinearGradient id={`${id}o`} x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor="#7a1006" />
              <Stop offset="0.45" stopColor="#d2380f" />
              <Stop offset="1" stopColor="#ff8a1c" stopOpacity={0.95} />
            </LinearGradient>
          </Defs>
          <Path d={OUTER} fill={`url(#${id}o)`} />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, { width: w, height: h }, inner]} pointerEvents="none">
        <Svg width={w} height={h} viewBox={`0 0 ${BOX_W} ${BOX_H}`}>
          <Defs>
            <LinearGradient id={`${id}i`} x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor="#ff6a12" />
              <Stop offset="0.6" stopColor="#ffb52e" />
              <Stop offset="1" stopColor="#ffe9a0" />
            </LinearGradient>
          </Defs>
          <Path d={INNER} fill={`url(#${id}i)`} />
        </Svg>
      </Animated.View>
    </>
  );
});

/** A nation's shield on fire. The box is twice the shield's width and 2.4 times it tall. */
export function BurningShield({ nation, size = 26, seed = 0 }: { nation: string; size?: number; seed?: number }) {
  return <Medallion nation={nation} size={size} seed={seed} fire />;
}

/** The same disc and shield without the fire, in a gold glow: your own side, facing a burning one. */
export function ShieldMedallion({ nation, size = 26 }: { nation: string; size?: number }) {
  return <Medallion nation={nation} size={size} seed={0} fire={false} />;
}

function Medallion({ nation, size, seed, fire }: { nation: string; size: number; seed: number; fire: boolean }) {
  const k = size / 30;
  const w = BOX_W * k;
  const h = BOX_H * k;
  const id = `bs${seed}${fire ? 'f' : 'g'}`;
  return (
    <View style={{ width: w, height: h }} pointerEvents="none">
      <Svg width={w} height={h} viewBox={`0 0 ${BOX_W} ${BOX_H}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`${id}g`} cx="0.5" cy="0.62" r="0.55">
            <Stop offset="0" stopColor={fire ? '#ff7a1a' : '#ecd08f'} stopOpacity={fire ? 0.7 : 0.35} />
            <Stop offset="1" stopColor={fire ? '#ff4a00' : '#d6b26e'} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={30} cy={46} rx={33} ry={30} fill={`url(#${id}g)`} />
      </Svg>
      {fire ? <Flames scale={k} seed={seed} /> : null}
      <Svg width={w} height={h} viewBox={`0 0 ${BOX_W} ${BOX_H}`} style={StyleSheet.absoluteFill}>
        <Circle cx={30} cy={47} r={23} fill="rgba(13,16,21,0.92)" />
        <Circle cx={30} cy={47} r={23} fill="none" stroke="#d6b26e" strokeOpacity={0.8} strokeWidth={1.4} />
      </Svg>
      <View style={[styles.shield, { left: 15 * k, top: 29 * k }]}>
        <Shield nation={nation} size={size} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, top: 0, transformOrigin: '50% 100%' },
  shield: { position: 'absolute' },
});
