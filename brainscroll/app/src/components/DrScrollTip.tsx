import { DR_SCROLL_TIP_DISMISS, DR_SCROLL_TIPS, type DrScrollTipId } from '@brainscroll/core';
import { useEffect, useState } from 'react';
import { DrScrollSays } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';
import { space } from '@/theme/tokens';

/**
 * A one-time Dr. Scroll tip. If this account hadn't seen it when the component
 * mounted, it appears once `when` is true and is marked seen right away (so it
 * never comes back, even if ignored). It hides when dismissed or when its
 * moment passes. Give it a `key` per card so the next card starts fresh.
 */
export function DrScrollTip({ tip, when = true }: { tip: DrScrollTipId; when?: boolean }) {
  const { seenTips, markTipSeen } = useProgress();
  const [seenBefore] = useState(() => seenTips.includes(tip));
  const [dismissed, setDismissed] = useState(false);
  const visible = !seenBefore && when && !dismissed;

  useEffect(() => {
    if (visible) markTipSeen(tip);
  }, [visible, tip, markTipSeen]);

  if (!visible) return null;
  const { pose, line } = DR_SCROLL_TIPS[tip];
  return <DrScrollSays pose={pose} lines={[line]} action={{ label: DR_SCROLL_TIP_DISMISS, onPress: () => setDismissed(true) }} style={{ marginBottom: space.lg }} />;
}
