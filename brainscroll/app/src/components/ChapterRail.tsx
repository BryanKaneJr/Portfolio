import { MASTERY_BAND_SIZE } from '@brainscroll/core';
import { View } from 'react-native';
import { color, radius, space } from '@/theme/tokens';

/**
 * The current 10-level chapter: done nodes violet, the next one blue and
 * taller, the rest quiet. Filled or empty (not just the hue) says done, and
 * screen readers hear one line: "3 of 10 levels cleared, next Level 4".
 */
export function ChapterRail({ start, level, next }: { start: number; level: number; next: number }) {
  const cleared = Math.max(0, Math.min(10, level - start + 1));
  const nextInChapter = next >= start && next < start + 10;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${cleared} of 10 levels cleared${nextInChapter ? `, next Level ${next}` : ''}`}
      aria-valuemin={0}
      aria-valuemax={10}
      aria-valuenow={cleared}
      style={{ flexDirection: 'row', gap: space.xs, alignItems: 'center' }}>
      {Array.from({ length: 10 }, (_, i) => {
        const n = start + i;
        const done = n <= level;
        const current = n === next;
        const mastery = n % MASTERY_BAND_SIZE === 0;
        return (
          <View
            key={n}
            style={{
              flex: 1,
              // The next level's pip stands a little taller than the rest.
              height: current ? space.md : space.sm,
              borderRadius: radius.pill,
              backgroundColor: done ? (mastery ? color.mastery : color.brand) : current ? color.info : color.surfaceRaised,
            }}
          />
        );
      })}
    </View>
  );
}
