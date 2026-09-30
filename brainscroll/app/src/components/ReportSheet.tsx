import { REPORT_MESSAGE_MAX, type ContentReportInput } from '@brainscroll/core';
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
 * One step (owner, 2026-09-30): the learner says what's wrong in their own
 * words; there are no categories to pick. It's sent as category "other"
 * (the admin's queue still accepts the finer categories). It's a modal:
 * screen readers stay inside it (the level hides itself behind it), and
 * "sent" or "couldn't send" is spoken as it appears.
 */
export function ReportSheet({ target, onClose }: { target: Omit<ContentReportInput, 'category' | 'message'>; onClose: () => void }) {
  const p = useProgress();
  const [message, setMessage] = useState('');
  const text = message.trim();
  const [state, setState] = useState<'editing' | 'sending' | 'sent' | 'failed'>('editing');

  useEffect(() => track('report_opened', { object_type: target.objectType }), [target.objectType]);

  const send = async () => {
    if (!text) return;
    setState('sending');
    try {
      await p.reportContent({ ...target, category: 'other', message: text });
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
            <Body muted>Problem with this lesson? Tell us what’s wrong and we’ll look at this {target.objectType === 'question' ? 'question' : 'card'}.</Body>
            <Field label="What’s wrong?" value={message} onChangeText={setMessage} placeholder="A wrong fact, a typo, a confusing question…" maxLength={REPORT_MESSAGE_MAX} multiline />
            {state === 'failed' && <Notice>Couldn’t send that. Check your connection and try again.</Notice>}
            <Button label={state === 'sending' ? 'Sending' : state === 'failed' ? 'Try again' : 'Send report'} loading={state === 'sending'} disabled={!text} onPress={() => void send()} />
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
