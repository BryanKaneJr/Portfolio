import type { Card } from '@brainscroll/core';
import { StyleSheet, Text, View } from 'react-native';
import { Eyebrow, H2, Reading, Title } from '@/components/ui';
import { color, radius, space, type, fw } from '@/theme/tokens';

/**
 * Renders any non-question card as a calm, readable page, always in the same
 * order so a learner never re-learns how to scan (UX review P3): an optional
 * small label, the heading, the body, then an optional "Key idea" box, always
 * labelled and always last. The level's hook keeps its larger opening heading.
 * `compact` is the smaller rendering used as evidence under a missed question
 * ("Take another look"), where it must be skimmable at a glance.
 */
export function LearningCard({ card, compact }: { card: Card; compact?: boolean }) {
  const Para = compact ? CompactReading : Reading;
  switch (card.type) {
    case 'text':
      return (
        <CardFrame heading={card.headline} hook={card.role === 'hook'} compact={compact} keyIdea={card.callout}>
          {card.body && <Para>{card.body}</Para>}
        </CardFrame>
      );
    case 'fact':
      // Fun facts are Dr. Scroll's territory: his bow-tie plum label.
      return (
        <CardFrame label={<Eyebrow tone="plum">Did you know</Eyebrow>} heading={card.fact} compact={compact}>
          {card.context && <Para>{card.context}</Para>}
        </CardFrame>
      );
    case 'timeline':
      return (
        <CardFrame heading={card.headline} compact={compact}>
          <View style={styles.timeline}>
            {card.events.map((e, i) => (
              <View key={i} style={styles.timelineRow}>
                <View style={styles.rail}>
                  <View style={styles.dot} />
                  {i < card.events.length - 1 && <View style={styles.line} />}
                </View>
                <View style={{ flex: 1, gap: space.xxs, paddingBottom: space.lg }}>
                  <Text style={styles.when}>{e.when}</Text>
                  <Para>{e.label}</Para>
                </View>
              </View>
            ))}
          </View>
        </CardFrame>
      );
    case 'comparison':
      return (
        <CardFrame heading={card.headline} compact={compact}>
          <View style={{ gap: space.sm }}>
            {card.items.map((item) => (
              <View key={item.label} style={styles.compareItem}>
                <Text style={styles.compareLabel}>{item.label}</Text>
                {item.points.map((p) => (
                  <Text key={p} style={styles.comparePoint}>
                    {p}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </CardFrame>
      );
    case 'image':
      // Assets ship in a later stage: a quiet frame with the caption, never a broken image.
      return (
        <View style={styles.block}>
          <View style={styles.image} accessibilityLabel={card.caption ?? 'Illustration'} />
          {card.caption && <Text style={styles.caption}>{card.caption}</Text>}
        </View>
      );
    case 'checkpoint':
      return (
        <CardFrame label={<Eyebrow tone="success">What you learned</Eyebrow>} heading={card.headline} compact={compact}>
          <View style={{ gap: space.md, marginTop: space.xs }}>
            {card.learned.map((l) => (
              <View key={l} style={styles.learnedRow}>
                <View style={styles.check}>
                  <Text style={styles.checkGlyph}>✓</Text>
                </View>
                <Text style={[type.reading, { color: color.textReading, flex: 1 }]}>{l}</Text>
              </View>
            ))}
          </View>
        </CardFrame>
      );
    default:
      return null;
  }
}

/** The one card grammar: label, heading, body, then the key idea. */
function CardFrame({
  label,
  heading,
  hook,
  compact,
  keyIdea,
  children,
}: {
  label?: React.ReactNode;
  heading: string;
  hook?: boolean;
  compact?: boolean;
  keyIdea?: string;
  children?: React.ReactNode;
}) {
  const Heading = compact ? Title : H2;
  return (
    <View style={styles.block}>
      {!compact && label}
      {hook && !compact ? <Text style={styles.hook}>{heading}</Text> : <Heading>{heading}</Heading>}
      {children}
      {keyIdea && <KeyIdea text={keyIdea} compact={compact} />}
    </View>
  );
}

/** The highlighted takeaway ("≈ 8 minutes 20 seconds"), always labelled the same way. */
function KeyIdea({ text, compact }: { text: string; compact?: boolean }) {
  return (
    <View style={styles.keyIdea}>
      {!compact && <Eyebrow tone="brand">Key idea</Eyebrow>}
      <Text style={[compact ? type.bodyStrong : styles.keyIdeaText]}>{text}</Text>
    </View>
  );
}

function CompactReading({ children }: { children: React.ReactNode }) {
  return <Text style={[type.body, { color: color.textReading }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  hook: { ...type.h1, color: color.text },
  keyIdea: { gap: space.xs, backgroundColor: color.brandSoft, borderRadius: radius.md, paddingVertical: space.md, paddingHorizontal: space.lg, borderLeftWidth: 3, borderLeftColor: color.brand },
  keyIdeaText: { color: color.text, fontSize: 18, ...fw('700'), lineHeight: 25 },
  timeline: { marginTop: space.xs },
  timelineRow: { flexDirection: 'row', gap: space.md },
  rail: { width: 14, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: radius.pill, backgroundColor: color.brand, marginTop: 5 },
  line: { flex: 1, width: 2, backgroundColor: color.border, marginTop: space.xs },
  when: { ...type.label, color: color.brandText },
  compareItem: { backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.lg, gap: space.xs },
  compareLabel: { color: color.text, fontSize: 18, ...fw('700'), marginBottom: space.xxs },
  comparePoint: { ...type.body, color: color.textReading },
  image: { aspectRatio: 16 / 9, borderRadius: radius.lg, backgroundColor: color.surface, borderWidth: 1, borderColor: color.border },
  caption: { ...type.caption, color: color.textMuted },
  learnedRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  check: { width: 24, height: 24, borderRadius: radius.pill, backgroundColor: color.successSoft, borderWidth: 1, borderColor: color.successLine, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkGlyph: { color: color.success, fontSize: 13, ...fw('900') },
});
