import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Caption, Card, Eyebrow, Notice } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';
import { useCurrentSkill } from '@/progress/useCurrentSkill';
import { space } from '@/theme/tokens';

const STOPPED: Record<string, string> = {
  DAILY_COMPLETE: 'Out of Brainpower for today, so play stopped there. It refills tomorrow.',
  NO_MORE_LEVELS: 'That skill has no more levels to play.',
};

/**
 * The app preview only (docs/app-preview.md; never in a real build): shortcuts
 * for reviewing rewards without playing every level. Clearing to a chest plays
 * the real rules with every answer right, so the chest opens from the map as
 * it would for a learner.
 */
export function PreviewTools() {
  const { preview } = useProgress();
  const skill = useCurrentSkill();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!preview || !skill) return null;
  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await fn());
    } catch {
      setMessage('That didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const toChest = () =>
    run(async () => {
      const r = await preview.clearToChest(skill.id);
      if ('stopped' in r) return STOPPED[r.stopped] ?? 'Play stopped before the chest.';
      router.push({ pathname: '/skill/[id]', params: { id: skill.id } });
      return null;
    });
  const looks = () =>
    run(async () => {
      await preview.ownEveryLook();
      return 'Every glow, name style and title is yours. Try them in Edit profile.';
    });
  return (
    <Card style={{ gap: space.md }}>
      <Eyebrow>Preview only</Eyebrow>
      <Caption>Shortcuts for trying rewards. They only exist in the preview, never in the app.</Caption>
      <Button variant="secondary" label={`Clear ${skill.name} to its next chest`} disabled={busy} onPress={() => void toChest()} />
      <Button variant="secondary" label="Own every look" disabled={busy} onPress={() => void looks()} />
      {message && <Notice tone="text">{message}</Notice>}
    </Card>
  );
}
