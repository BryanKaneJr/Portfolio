import { trophyInfo, type BrainpowerAwardKind, type DailyAllowance } from '@brainscroll/core';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useBrainpowerFlight } from '@/components/BrainpowerFlight';
import { BrainpowerIcon } from '@/components/BrainpowerIcon';
import { BRAINPOWER_WAYS } from '@/components/BrainpowerWays';
import { Body, Caption, Card, Eyebrow, Row, UiArt } from '@/components/ui';
import type { UiArtName } from '@/components/ui/uiArt';
import { trophyCatalog } from '@/content';
import { iconSize, space } from '@/theme/tokens';

const LINE: Record<BrainpowerAwardKind, string> = {
  streak: 'You showed up again',
  trophy: 'Trophy unlocked',
  chapter_review: 'Chapter review complete',
  perfect: 'Lucky Brainpower Drop',
};
const ART = Object.fromEntries(BRAINPOWER_WAYS.map((w) => [w.kind, w.art])) as Record<BrainpowerAwardKind, UiArtName>;

/** When the first spark leaves after the card arrives, and the gap between sparks (ms). */
const FIRST_SPARK = 450;
const SPARK_GAP = 420;

/**
 * The Brainpower an action earned: one line per +1 (streak, trophy, chapter
 * review, the perfect drop), then the balance. Anything earned at the cap
 * isn't kept, so it says "Brainpower Full" instead. Nothing on Unlimited.
 *
 * Inside a BrainpowerFlight, each +1 then flies from its line to the chip
 * top right, `at` ms after the screen opens (when this card arrives).
 */
export function BrainpowerEarned({ daily, at = 0 }: { daily: DailyAllowance; at?: number }) {
  const flight = useBrainpowerFlight();
  const earned = daily.brainpowerEarned ?? [];
  const granted = earned.filter((e) => e.granted === 1);
  const full = earned.some((e) => e.granted === 0);
  const rows = useRef<(View | null)[]>([]);
  const fullLine = useRef<View>(null);
  const key = earned.map((e) => e.key).join('|');

  useEffect(() => {
    if (!flight) return;
    // Each +1 from its own line, then one spark for anything that didn't fit.
    const launches: { from: () => View | null; granted: 0 | 1 }[] = [
      ...granted.map((_, i) => ({ from: () => rows.current[i] ?? null, granted: 1 as const })),
      ...(full ? [{ from: () => fullLine.current, granted: 0 as const }] : []),
    ];
    const timers = launches.map((l, i) =>
      setTimeout(() => {
        const view = l.from();
        if (!view) return flight.launch({ x: 0, y: 0 }, l.granted);
        view.measureInWindow((x, y, w, h) => flight.launch({ x: x + w - space.lg, y: y + h / 2 }, l.granted));
      }, at + FIRST_SPARK + i * SPARK_GAP),
    );
    return () => timers.forEach(clearTimeout);
    // Once per set of awards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, flight]);

  if (daily.unlimited || daily.brainpower === null) return null;
  if (earned.length === 0) return null;
  return (
    <Card variant="quiet" style={{ width: '100%', minWidth: 280, gap: space.sm }}>
      <Eyebrow tone="brand">Brainpower</Eyebrow>
      {granted.map((e, i) => {
        const trophy = e.kind === 'trophy' ? trophyInfo(e.key.slice('trophy:'.length), trophyCatalog)?.name : undefined;
        return (
          <View key={e.key} ref={(v) => { rows.current[i] = v; }} collapsable={false}>
            <Row gap={space.sm}>
              <UiArt name={ART[e.kind]} size={iconSize.lg} />
              <Body style={{ flex: 1 }}>{trophy ? `${LINE[e.kind]}: ${trophy}` : LINE[e.kind]}</Body>
              <Body>+1</Body>
            </Row>
          </View>
        );
      })}
      <View ref={fullLine} collapsable={false}>
        <Row gap={space.xxs}>
          <BrainpowerIcon size={iconSize.md} />
          <Caption>{full && daily.brainpower >= daily.brainpowerMax ? `Brainpower Full · ${daily.brainpower} / ${daily.brainpowerMax}` : `${daily.brainpower} / ${daily.brainpowerMax}`}</Caption>
        </Row>
      </View>
    </Card>
  );
}
