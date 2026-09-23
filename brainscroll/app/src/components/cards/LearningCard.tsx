import type { Card } from '@brainscroll/core';
import { StyleSheet, Text, View } from 'react-native';
import { Body, Label, Title } from '@/components/ui';
import { color, radius, space } from '@/theme/tokens';

/**
 * Renders any non-question card. Used in the level scroll and, compactly, as
 * the evidence shown under a missed question ("Take another look").
 */
export function LearningCard({ card }: { card: Card }) {
  switch (card.type) {
    case 'text':
      return (
        <View style={styles.block}>
          <Label tone={card.role === 'hook' ? 'brand' : 'muted'}>{ROLE_LABEL[card.role]}</Label>
          <Text style={card.role === 'hook' ? styles.hook : styles.headline}>{card.headline}</Text>
          {card.body && <Body>{card.body}</Body>}
          {card.callout && (
            <View style={styles.callout}>
              <Text style={styles.calloutText}>{card.callout}</Text>
            </View>
          )}
        </View>
      );
    case 'fact':
      return (
        <View style={styles.block}>
          <Label tone="brand">Fact</Label>
          <Text style={styles.fact}>{card.fact}</Text>
          {card.context && <Body muted>{card.context}</Body>}
        </View>
      );
    case 'timeline':
      return (
        <View style={styles.block}>
          <Label>Timeline</Label>
          <Title>{card.headline}</Title>
          <View style={{ gap: space.md, marginTop: space.sm }}>
            {card.events.map((e, i) => (
              <View key={i} style={styles.timelineRow}>
                <View style={styles.timelineDot} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.timelineWhen}>{e.when}</Text>
                  <Body>{e.label}</Body>
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    case 'comparison':
      return (
        <View style={styles.block}>
          <Label>Compare</Label>
          <Title>{card.headline}</Title>
          <View style={{ gap: space.md, marginTop: space.sm }}>
            {card.items.map((item) => (
              <View key={item.label} style={styles.compareItem}>
                <Text style={styles.compareLabel}>{item.label}</Text>
                {item.points.map((p) => (
                  <Body key={p}>• {p}</Body>
                ))}
              </View>
            ))}
          </View>
        </View>
      );
    case 'image':
      // Assets ship in a later stage; show caption rather than a broken image.
      return (
        <View style={styles.block}>
          <View style={styles.imagePlaceholder} accessibilityLabel={card.caption ?? 'Image'} />
          {card.caption && <Body muted>{card.caption}</Body>}
        </View>
      );
    case 'checkpoint':
      return (
        <View style={styles.block}>
          <Label tone="success">Checkpoint</Label>
          <Title>{card.headline}</Title>
          <View style={{ gap: space.sm, marginTop: space.sm }}>
            {card.learned.map((l) => (
              <Body key={l}>✓ {l}</Body>
            ))}
          </View>
        </View>
      );
    default:
      return null;
  }
}


const ROLE_LABEL = { hook: 'Level start', explain: 'Explain', connect: 'Connect' } as const;

const styles = StyleSheet.create({
  block: { gap: space.md },
  hook: { color: color.text, fontSize: 28, fontWeight: '800', lineHeight: 35 },
  headline: { color: color.text, fontSize: 22, fontWeight: '700', lineHeight: 29 },
  fact: { color: color.text, fontSize: 26, fontWeight: '800', lineHeight: 33 },
  callout: { borderLeftWidth: 3, borderLeftColor: color.brand, paddingLeft: space.md, paddingVertical: space.xs },
  calloutText: { color: color.text, fontSize: 15, fontWeight: '600' },
  timelineRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  timelineDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: color.info, marginTop: 6 },
  timelineWhen: { color: color.info, fontSize: 13, fontWeight: '700' },
  compareItem: { backgroundColor: color.surfaceRaised, borderRadius: radius.md, padding: space.md, gap: space.xs },
  compareLabel: { color: color.text, fontSize: 17, fontWeight: '700', marginBottom: space.xs },
  imagePlaceholder: { aspectRatio: 16 / 9, borderRadius: radius.md, backgroundColor: color.surfaceRaised },
});
