import { BRAINPOWER, type DailyAllowance } from '@brainscroll/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, View } from 'react-native';
import { BrainpowerIcon } from '@/components/BrainpowerIcon';
import { Caption, Numeral, spring, UiArt } from '@/components/ui';
import { feedback, useReduceMotion } from '@/theme/feedback';
import { color, depth, iconSize, radius, space } from '@/theme/tokens';

/**
 * The +1 moment on a reward screen: each Brainpower earned lifts off its line
 * as a spark, arcs up to a Brainpower chip pinned top right, and the count
 * ticks up with a small pulse and tick. At 10 the spark still lands, but the
 * number stays and the chip says "Full". With reduce motion there is no
 * spark: the count simply changes when each line arrives.
 *
 * The chip starts at the balance before this action's awards (the result's
 * balance minus what was granted), so it ends on the server's number.
 * Decorative: the lines themselves say every +1 in words.
 */
type Point = { x: number; y: number };
interface Flight {
  /** Fly one award from `from` (window coordinates) to the chip. */
  launch(from: Point, granted: 0 | 1): void;
}
const FlightContext = createContext<Flight | null>(null);

/** Nothing earned: for a result that carries no daily status (a repeat, an older server). */
export const NO_DAILY: DailyAllowance = { cap: null, used: 0, remaining: null, dailyComplete: false, brainpower: null, brainpowerMax: BRAINPOWER.MAX, brainpowerRefill: BRAINPOWER.DAILY_REFILL, brainpowerEarned: [] };
export const useBrainpowerFlight = () => useContext(FlightContext);

const SPARK = 30;
const FLY_MS = 800;

export function BrainpowerFlight({ daily, children }: { daily: DailyAllowance; children: ReactNode }) {
  const reduce = useReduceMotion();
  const earned = daily.brainpowerEarned ?? [];
  const show = !daily.unlimited && daily.brainpower !== null && earned.length > 0;
  const end = daily.brainpower ?? 0;
  const [count, setCount] = useState(() => end - earned.filter((e) => e.granted === 1).length);
  const [full, setFull] = useState(false);
  const [sparks, setSparks] = useState<{ id: number; from: Point; to: Point; granted: 0 | 1 }[]>([]);
  const layer = useRef<View>(null);
  const chip = useRef<View>(null);
  const [pulse] = useState(() => new Animated.Value(1));
  const nextId = useRef(0);

  const land = useCallback(
    (granted: 0 | 1) => {
      if (granted) setCount((n) => Math.min(n + 1, end));
      else setFull(true);
      feedback('chooseTick');
      if (reduce) return;
      pulse.setValue(1.25);
      Animated.spring(pulse, { toValue: 1, ...spring.pop, useNativeDriver: true }).start();
    },
    [end, pulse, reduce],
  );

  const flight = useMemo<Flight>(
    () => ({
      launch(from, granted) {
        if (reduce || !layer.current || !chip.current) return land(granted);
        // Both in window coordinates, then made relative to the layer the sparks draw in.
        layer.current.measureInWindow((lx, ly) =>
          chip.current?.measureInWindow((cx, cy, cw, ch) => {
            const id = nextId.current++;
            setSparks((s) => [...s, { id, granted, from: { x: from.x - lx, y: from.y - ly }, to: { x: cx - lx + iconSize.xl / 2 + space.xs, y: cy - ly + ch / 2 } }]);
          }),
        );
      },
    }),
    [land, reduce],
  );

  return (
    <FlightContext.Provider value={show ? flight : null}>
      <View ref={layer} style={{ flex: 1 }} collapsable={false}>
        {children}
        {show && (
          <Animated.View
            ref={chip}
            collapsable={false}
            accessible={false}
            aria-hidden
            importantForAccessibility="no-hide-descendants"
            style={{
              position: 'absolute',
              top: space.sm,
              right: space.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.xxs,
              paddingLeft: space.xs,
              paddingRight: space.md,
              paddingVertical: space.xxs,
              borderRadius: radius.pill,
              borderWidth: depth.border,
              backgroundColor: color.brandSoft,
              borderColor: color.brandLine,
              transform: [{ scale: pulse }],
            }}>
            <BrainpowerIcon size={iconSize.xl} />
            <Numeral style={{ color: color.brandText }}>{count}</Numeral>
            {full && <Caption style={{ color: color.brandText }}>Full</Caption>}
          </Animated.View>
        )}
        {sparks.map((s) => (
          <Spark key={s.id} from={s.from} to={s.to} onLand={() => { land(s.granted); setSparks((all) => all.filter((x) => x.id !== s.id)); }} />
        ))}
      </View>
    </FlightContext.Provider>
  );
}

/** The +1 spark (`brainpower-spark`) on an arc from `from` to `to`. */
function Spark({ from, to, onLand }: { from: Point; to: Point; onLand: () => void }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: FLY_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(({ finished }) => finished && onLand());
    // Once per spark.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Rises above both ends, so it arcs up and over to the chip.
  const peak = Math.min(from.y, to.y) - 80;
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [from.x - SPARK / 2, to.x - SPARK / 2] });
  const translateY = t.interpolate({ inputRange: [0, 0.45, 1], outputRange: [from.y - SPARK / 2, peak, to.y - SPARK / 2] });
  const scale = t.interpolate({ inputRange: [0, 0.2, 0.85, 1], outputRange: [0.4, 1.2, 1, 0.5] });
  return (
    <Animated.View pointerEvents="none" aria-hidden style={{ position: 'absolute', left: 0, top: 0, width: SPARK, height: SPARK, transform: [{ translateX }, { translateY }, { scale }] }}>
      <UiArt name="brainpower-spark" size={SPARK} />
    </Animated.View>
  );
}
