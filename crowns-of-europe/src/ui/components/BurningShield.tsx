/**
 * An enemy's arms on fire: the mark of a war. Their shield stands in a fire (the flames from game-icons.net, filled
 * from ember red to yellow and fading out at the base) that flickers unless the phone asks for reduced motion. Your
 * own side's arms stand the same way in a gold glow. Drawn on a 72 × 74 box in which the shield is 34 wide; `size` is
 * the shield's width on screen.
 */
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { displayOf } from '../../sim/content';
import { SHIELD, Shield } from './Flag';
import { GLYPHS } from './gameIcons';

const BOX_W = 72;
const BOX_H = 74;
const SHIELD_W = 34; // the shield's width in the box
const SHIELD_X = (BOX_W - SHIELD_W) / 2;
const SHIELD_Y = 28;

/** One layer of fire filling the box, flickering about its base. */
function FireLayer({ k, seed, id, core }: { k: number; seed: number; id: string; core?: boolean }) {
  const t = useSharedValue(0);
  const still = useReducedMotion();
  useEffect(() => {
    if (still) return;
    const ms = (core ? 520 : 780) + ((seed * 89) % 220);
    t.set(withDelay((seed * 137) % 400, withRepeat(withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }), -1, true)));
    return () => cancelAnimation(t);
  }, [still, seed, core, t]);
  const anim = useAnimatedStyle(() =>
    core ? { transform: [{ scaleY: 1.04 - t.get() * 0.12 }, { translateX: (t.get() - 0.5) * 1.4 * k }], opacity: 0.75 + t.get() * 0.25 } : { transform: [{ scaleY: 0.95 + t.get() * 0.09 }, { scaleX: 1.02 - t.get() * 0.04 }] },
  );
  const w = BOX_W * k;
  const h = BOX_H * k;
  // The hot core is the same fire, smaller, standing on the same base.
  const s = core ? 0.68 : 1;
  const fire = `translate(${(BOX_W - 72 * s) / 2} ${BOX_H - 2 - 72 * s}) scale(${(72 * s) / 512})`;
  return (
    <Animated.View style={[styles.layer, { width: w, height: h }, anim]} pointerEvents="none">
      <Svg width={w} height={h} viewBox={`0 0 ${BOX_W} ${BOX_H}`}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={core ? '#ff7a12' : '#a61c0a'} stopOpacity={0} />
            <Stop offset="0.16" stopColor={core ? '#ff8a1c' : '#b3200b'} stopOpacity={1} />
            <Stop offset="0.55" stopColor={core ? '#ffb43a' : '#f26a12'} />
            <Stop offset="1" stopColor={core ? '#fff1b8' : '#ffd36b'} />
          </LinearGradient>
        </Defs>
        <G transform={fire}>
          <Path d={GLYPHS.fire.d} fill={`url(#${id})`} />
        </G>
      </Svg>
    </Animated.View>
  );
}

function Arms({ nation, size, seed, fire }: { nation: string; size: number; seed: number; fire: boolean }) {
  const k = size / SHIELD_W;
  const w = BOX_W * k;
  const h = BOX_H * k;
  const id = `arms${seed}${fire ? 'f' : 'g'}`;
  return (
    <View style={{ width: w, height: h }} pointerEvents="none">
      <Svg width={w} height={h} viewBox={`0 0 ${BOX_W} ${BOX_H}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`${id}g`} cx="0.5" cy="0.6" r="0.55">
            <Stop offset="0" stopColor={fire ? '#ff7a1a' : '#ecd08f'} stopOpacity={fire ? 0.6 : 0.4} />
            <Stop offset="1" stopColor={fire ? '#ff4a00' : '#d6b26e'} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={BOX_W / 2} cy={46} rx={34} ry={29} fill={`url(#${id}g)`} />
      </Svg>
      {fire ? (
        <>
          <FireLayer k={k} seed={seed} id={`${id}o`} />
          <FireLayer k={k} seed={seed + 3} id={`${id}i`} core />
        </>
      ) : null}
      <Svg width={w} height={h} viewBox={`0 0 ${BOX_W} ${BOX_H}`} style={StyleSheet.absoluteFill}>
        <G transform={`translate(${SHIELD_X} ${SHIELD_Y + 1.6}) scale(${SHIELD_W / 30})`}>
          <Path d={SHIELD} fill="#000" opacity={0.4} />
        </G>
      </Svg>
      <View style={[styles.shield, { left: SHIELD_X * k, top: SHIELD_Y * k }]}>
        <Shield nation={nation} size={size} />
      </View>
    </View>
  );
}

/** A nation's arms in a fire: an enemy at war with you. `seed` staggers the flicker so neighbours don't pulse in step. */
export function BurningShield({ nation, size = 26, seed = 0 }: { nation: string; size?: number; seed?: number }) {
  return <ArmsMemo nation={nation} size={size} seed={seed} fire look={displayOf(nation).look} />;
}

/** The same, in a gold glow instead of a fire: your own side, facing a burning one. */
export function ShieldMedallion({ nation, size = 26 }: { nation: string; size?: number }) {
  return <ArmsMemo nation={nation} size={size} seed={0} fire={false} look={displayOf(nation).look} />;
}

/** Redrawn only when the realm, the size or its arms (`look`: a proclaimed crown's id) change. */
const ArmsMemo = memo(function ArmsMemo({ nation, size, seed, fire }: { nation: string; size: number; seed: number; fire: boolean; look: string }) {
  return <Arms nation={nation} size={size} seed={seed} fire={fire} />;
});

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, top: 0, transformOrigin: '50% 96%' },
  shield: { position: 'absolute' },
});
