import { trophyInfo, type BrainpowerAwardKind, type DailyAllowance } from '@brainscroll/core';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useBrainpowerFlight } from '@/components/BrainpowerFlight';
import { BrainpowerIcon } from '@/components/BrainpowerIcon';
import { BRAINPOWER_WAYS } from '@/components/BrainpowerWays';
import { Body, Caption, Card, Eyebrow, Gleams, Row, Title, UiArt } from '@/components/ui';
import { feedback } from '@/theme/feedback';
import type { UiArtName } from '@/components/ui/uiArt';
import { trophyCatalog } from '@/content';
import { color, depth, iconSize, radius, space } from '@/theme/tokens';

const LINE: Record<BrainpowerAwardKind, string> = {
  streak: 'You showed up again',
  trophy: 'Trophy unlocked',
  chapter_review: 'Chapter review complete',
  perfect: 'Lucky Brainpower Drop',
  quest_step: 'Quest goal reached',
  quest: 'Quest complete',
  chest: 'Map chest opened',
};
const ART = { ...Object.fromEntries(BRAINPOWER_WAYS.map((w) => [w.kind, w.art])), quest_step: 'medal', chest: 'medal' } as unknown as Record<BrainpowerAwardKind, UiArtName>;

/** When the first spark leaves after the card arrives, and the gap between sparks (ms). */
const FIRST_SPARK = 450;
const SPARK_GAP = 520;

/**
 * The Brainpower an action earned: one line per +1 (streak, trophy, chapter
 * review, the perfect drop), then the balance. Anything earned at the cap
 * isn't kept, so it says "Brainpower Full" instead. Nothing on Unlimited.
 *
 * Inside a BrainpowerFlight, each +1 then flies from its line to the chip
 * top right, `at` ms after the screen opens (when this card arrives).
 *
 * `trophiesShown`: a trophy card on the same screen carries its own +1
 * (owner, 2026-10-04: "we're literally stating they got the trophy twice"),
 * so trophy lines are left out here; with nothing else, no card at all.
 */
/** Whether BrainpowerEarned shows anything, so a screen can leave out its slot (and the space around it). */
export function brainpowerCardShows(daily: DailyAllowance, trophiesShown = false): boolean {
  if (daily.unlimited || daily.brainpower === null) return false;
  const earned = daily.brainpowerEarned ?? [];
  return earned.some((e) => e.granted === 0) || earned.some((e) => e.granted === 1 && !(trophiesShown && e.kind === 'trophy'));
}

export function BrainpowerEarned({ daily, at = 0, trophiesShown = false }: { daily: DailyAllowance; at?: number; trophiesShown?: boolean }) {
  const flight = useBrainpowerFlight();
  const earned = daily.brainpowerEarned ?? [];
  const shown = earned.filter((e) => e.granted === 1 && !(trophiesShown && e.kind === 'trophy'));
  // The lucky drop waits for a tap ("Extra Brainpower!", owner 2026-10-04). The server has already
  // added it, so leaving the screen without tapping loses nothing; only its spark waits.
  const lucky = shown.find((e) => e.kind === 'perfect');
  const granted = shown.filter((e) => e !== lucky);
  const [claimed, setClaimed] = useState(false);
  const luckyRef = useRef<View>(null);
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
  if (earned.length === 0 || (shown.length === 0 && !full)) return null;
  const claim = () => {
    if (claimed) return;
    setClaimed(true);
    feedback('unlock');
    const v = luckyRef.current;
    if (!flight) return;
    if (!v) return flight.launch({ x: 0, y: 0 }, 1);
    v.measureInWindow((x, y, w, h) => flight.launch({ x: x + w - space.xl, y: y + h / 2 }, 1));
  };
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
      {lucky && (
        <View ref={luckyRef} collapsable={false}>
          {claimed ? (
            <Row gap={space.sm}>
              <UiArt name="lucky-drop" size={iconSize.lg} />
              <Body style={{ flex: 1 }}>{LINE.perfect}</Body>
              <Body>+1</Body>
            </Row>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Extra Brainpower! A lucky drop for a perfect level. Collect plus 1"
              onPress={claim}
              style={({ pressed }) => [
                { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: depth.border, borderBottomWidth: depth.edge, borderColor: color.brand, backgroundColor: color.brandSoft },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}>
              <UiArt name="lucky-drop" size={iconSize.xl + 8} />
              <View style={{ flex: 1, gap: space.xxs }}>
                <Title>Extra Brainpower!</Title>
                <Caption>A lucky drop for a perfect level. Tap to collect.</Caption>
              </View>
              <Body style={{ color: color.brandText }}>+1</Body>
              <Gleams count={4} tint={color.brandText} />
            </Pressable>
          )}
        </View>
      )}
      <View ref={fullLine} collapsable={false}>
        {/* The balance lives in the chip up top (owner, 2026-10-04); only "full" is worth a line here. */}
        {full && daily.brainpower >= daily.brainpowerMax && (
          <Row gap={space.xxs}>
            <BrainpowerIcon size={iconSize.md} />
            <Caption>Brainpower Full</Caption>
          </Row>
        )}
      </View>
    </Card>
  );
}
