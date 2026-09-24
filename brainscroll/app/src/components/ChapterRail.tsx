import { MASTERY_BAND_SIZE } from '@brainscroll/core';
import { View } from 'react-native';
import { Row } from '@/components/ui';
import { color, space } from '@/theme/tokens';

/** The current 10-level chapter: done nodes violet, the next one blue, the rest quiet. */
export function ChapterRail({ start, level, next }: { start: number; level: number; next: number }) {
  return (
    <Row gap={space.xs}>
      {Array.from({ length: 10 }, (_, i) => {
        const n = start + i;
        const done = n <= level;
        const current = n === next;
        const mastery = n % MASTERY_BAND_SIZE === 0;
        return (
          <View
            key={n}
            accessibilityLabel={`Level ${n}${done ? ', cleared' : current ? ', next' : ''}`}
            style={{
              flex: 1,
              height: current ? 12 : 8,
              borderRadius: 999,
              backgroundColor: done ? (mastery ? color.mastery : color.brand) : current ? color.info : color.surfaceRaised,
            }}
          />
        );
      })}
    </Row>
  );
}
