import type { Card } from '@brainscroll/core';
import { StyleSheet, Text, View } from 'react-native';
import { Eyebrow, H2, Reading, Title } from '@/components/ui';
import { color, radius, space, type, fw } from '@/theme/tokens';

/**
 * Renders any non-question card as a calm, readable page: a strong heading,
 * short paragraphs at reading size, and at most one highlighted key figure.
 * `compact` is the smaller rendering used as evidence under a missed question
 * ("Take another look"), where it must be skimmable at a glance.
 */
export function LearningCard({ card, compact }: { card: Card; compact?: boolean }) {
  const Heading = compact ? Title : H2;
  const Para = compact ? CompactReading : Reading;
  switch (card.type) {
    case 'text':
      return (
        <View style={styles.block}>
          {card.role === 'hook' && !compact ? <Text style={styles.hook}>{card.headline}</Text> : <Heading>{card.headline}</Heading>}
          {card.body && <Para>{card.body}</Para>}
          {card.callout && <KeyFigure text={card.callout} compact={compact} />}
        </View>
      );
    case 'fact':
      return (
        <View style={styles.block}>
          {/* Fun facts are Dr. Scroll's territory: his bow-tie plum. */}
          {!compact && <Eyebrow tone="plum">Did you know</Eyebrow>}
          <Text style={compact ? styles.factCompact : styles.fact}>{card.fact}</Text>
          {card.context && <Para>{card.context}</Para>}
        </View>
      );
    case 'timeline':
      return (
        <View style={styles.block}>
          <Heading>{card.headline}</Heading>
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
        </View>
      );
    case 'comparison':
      return (
        <View style={styles.block}>
          <Heading>{card.headline}</Heading>
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
        </View>
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
        <View style={styles.block}>
          <Eyebrow tone="success">What you learned</Eyebrow>
          <Heading>{card.headline}</Heading>
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
        </View>
      );
    default:
      return null;
  }
}

/** A single highlighted figure or takeaway ("≈ 8 minutes 20 seconds"). */
function KeyFigure({ text, compact }: { text: string; compact?: boolean }) {
  return (
    <View style={styles.keyFigure}>
      <Text style={[compact ? type.bodyStrong : styles.keyFigureText]}>{text}</Text>
    </View>
  );
}

function CompactReading({ children }: { children: React.ReactNode }) {
  return <Text style={[type.body, { color: color.textReading }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  hook: { ...type.h1, color: color.text },
  fact: { ...type.h2, color: color.text },
  factCompact: { ...type.title, color: color.text },
  keyFigure: { backgroundColor: color.brandSoft, borderRadius: radius.md, paddingVertical: space.md, paddingHorizontal: space.lg, borderLeftWidth: 3, borderLeftColor: color.brand },
  keyFigureText: { color: color.text, fontSize: 18, ...fw('700'), lineHeight: 25 },
  timeline: { marginTop: space.xs },
  timelineRow: { flexDirection: 'row', gap: space.md },
  rail: { width: 14, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: radius.pill, backgroundColor: color.brand, marginTop: 5 },
  line: { flex: 1, width: 2, backgroundColor: color.border, marginTop: space.xs },
  when: { ...type.label, color: color.brand },
  compareItem: { backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.lg, gap: space.xs },
  compareLabel: { color: color.text, fontSize: 18, ...fw('700'), marginBottom: space.xxs },
  comparePoint: { ...type.body, color: color.textReading },
  image: { aspectRatio: 16 / 9, borderRadius: radius.lg, backgroundColor: color.surface, borderWidth: 1, borderColor: color.border },
  caption: { ...type.caption, color: color.textMuted },
  learnedRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  check: { width: 24, height: 24, borderRadius: radius.pill, backgroundColor: color.successSoft, borderWidth: 1, borderColor: color.successLine, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkGlyph: { color: color.success, fontSize: 13, ...fw('900') },
});
