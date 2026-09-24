import { REPORT_CATEGORIES, REPORT_MESSAGE_MAX, type ContentReportInput, type ReportCategory } from '@brainscroll/core';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { track } from '@/analytics/track';
import { Body, Button, Card, Field, Label } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';
import { space } from '@/theme/tokens';

/**
 * "Report a problem" for the card or question on screen. Reports reach the
 * content team through report_content (validated, deduped, rate-limited).
 * Nothing about the report changes the learner's progress.
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
    <View style={styles.overlay}>
      <Card>
        <Label tone="brand">Report a problem</Label>
        {state === 'sent' ? (
          <>
            <Body>Thanks. We’ll check it and fix it if it’s wrong.</Body>
            <Button label="Back to the level" onPress={onClose} />
          </>
        ) : (
          <>
            <Body muted>What’s wrong with this {target.objectType === 'question' ? 'question' : 'card'}?</Body>
            {REPORT_CATEGORIES.map((c) => (
              <Button key={c.id} variant={category === c.id ? 'primary' : 'secondary'} label={c.label} onPress={() => setCategory(c.id)} />
            ))}
            <Field label="Details (optional)" value={message} onChangeText={setMessage} placeholder="What should it say?" maxLength={REPORT_MESSAGE_MAX} />
            {state === 'failed' && <Body muted>Couldn’t send that. Check your connection and try again.</Body>}
            <Button label={state === 'sending' ? 'Sending…' : 'Send report'} disabled={!category || state === 'sending'} onPress={() => void send()} />
            <Button variant="secondary" label="Cancel" onPress={onClose} />
          </>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: space.lg },
});
