import { REPORT_CATEGORIES, REPORT_MESSAGE_MAX, type ContentReportInput, type ReportCategory } from '@brainscroll/core';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { track } from '@/analytics/track';
import { Body, Button, Card, Eyebrow, Field, Icon, Notice, Row } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';
import { color, iconSize, space } from '@/theme/tokens';

/**
 * "Report a problem" for the card or question on screen. Reports reach the
 * content team through report_content (validated, deduped, rate-limited).
 * Nothing about the report changes the learner's progress.
 *
 * It's a modal: screen readers stay inside it (the level hides itself behind
 * it), the categories are a radio group with a check on the pick, and
 * "sent" or "couldn't send" is spoken as it appears.
 */
export function ReportSheet({ target, onClose }: { target: Omit<ContentReportInput, 'category' | 'message'>; onClose: () => void }) {
  const p = useProgress();
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'editing' | 'sending' | 'sent' | 'failed'>('editing');

  useEffect(() => track('report_opened', { object_type: target.objectType }), [target.objectType]);

  const send = async () => {
    if (!category) return;
    setState('sending');
    try {
      await p.reportContent({ ...target, category, message: message.trim() || undefined });
      setState('sent');
    } catch {
      setState('failed');
    }
  };

  return (
    <View style={styles.overlay} accessibilityViewIsModal aria-modal>
      {/* A sheet, a little narrower than the reading column. */}
      <Card variant="raised" style={{ width: '100%', maxWidth: 520, alignSelf: 'center', gap: space.md }}>
        <Eyebrow tone="brand">Report a problem</Eyebrow>
        {state === 'sent' ? (
          <>
            <Row gap={space.sm} style={{ alignItems: 'flex-start' }}>
              <Icon name="check" tint={color.success} size={iconSize.md} />
              <View style={{ flex: 1 }}>
                <Notice tone="text">Thanks. We’ll check it and fix it if it’s wrong.</Notice>
              </View>
            </Row>
            <Button label="Back to the level" onPress={onClose} />
          </>
        ) : (
          <>
            <Body muted>What’s wrong with this {target.objectType === 'question' ? 'question' : 'card'}?</Body>
            <View accessibilityRole="radiogroup" style={{ gap: space.md }}>
              {REPORT_CATEGORIES.map((c) => (
                <Button key={c.id} compact variant={category === c.id ? 'primary' : 'secondary'} selected={category === c.id} label={c.label} onPress={() => setCategory(c.id)} />
              ))}
            </View>
            <Field label="Details (optional)" value={message} onChangeText={setMessage} placeholder="What should it say?" maxLength={REPORT_MESSAGE_MAX} />
            {state === 'failed' && <Notice>Couldn’t send that. Check your connection and try again.</Notice>}
            <Button label={state === 'sending' ? 'Sending' : state === 'failed' ? 'Try again' : 'Send report'} loading={state === 'sending'} disabled={!category} onPress={() => void send()} />
            <Button variant="secondary" label="Cancel" onPress={onClose} />
          </>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: color.scrim, justifyContent: 'flex-end', padding: space.lg },
});
