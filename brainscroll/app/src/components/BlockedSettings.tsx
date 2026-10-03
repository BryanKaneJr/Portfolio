import type { BlockedLearner } from '@brainscroll/core';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Avatar } from '@/components/social';
import { Body, Button, Caption, Card, Eyebrow, Notice, Row } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';
import { space } from '@/theme/tokens';

/**
 * Settings: the learners you've blocked, each with Unblock (CURRENT_PRODUCT_DECISIONS
 * §22). Unblocking only stops hiding you from each other; it doesn't make you
 * friends again. Blocking happens on someone's profile.
 */
export function BlockedSettings() {
  const p = useProgress();
  const { social } = p;
  const ready = p.ready && p.account?.status === 'signed_in' && !p.offline;
  const [blocked, setBlocked] = useState<BlockedLearner[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null);
  const load = useCallback(() => {
    if (!ready) return;
    social.blocked().then(setBlocked, () => setBlocked(null));
  }, [ready, social]);
  useEffect(load, [load]);
  if (!blocked) return null;

  const unblock = async (b: BlockedLearner) => {
    setBusy(b.id);
    setNotice(null);
    try {
      await social.unblockUser(b.id);
      setBlocked((list) => list?.filter((x) => x.id !== b.id) ?? null);
      setNotice({ text: `Unblocked @${b.username}. You can see each other in Social again.`, failed: false });
    } catch {
      setNotice({ text: 'That didn’t work. Try again.', failed: true });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card style={{ gap: space.md }}>
      <Eyebrow>Blocked</Eyebrow>
      {blocked.length === 0 ? (
        <Caption>You haven’t blocked anyone. If you do, you can unblock them here.</Caption>
      ) : (
        blocked.map((b) => (
          <Row key={b.id} gap={space.md}>
            <Avatar username={b.username} avatar={b.avatar} size={32} />
            <View style={{ flex: 1 }}>
              <Body numberOfLines={1}>{`@${b.username}`}</Body>
            </View>
            <Button compact variant="secondary" label="Unblock" loading={busy === b.id} disabled={!!busy && busy !== b.id} onPress={() => void unblock(b)} />
          </Row>
        ))
      )}
      {notice && <Notice tone={notice.failed ? 'danger' : 'text'}>{notice.text}</Notice>}
    </Card>
  );
}
