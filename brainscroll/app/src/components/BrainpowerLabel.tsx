import type { DailyAllowance } from '@brainscroll/core';
import { BrainpowerIcon } from '@/components/BrainpowerIcon';
import { Caption, Row } from '@/components/ui';
import { brainState, todayLabel } from '@/progress/todayLabel';
import { color, iconSize, space } from '@/theme/tokens';

/** The brain and "7 / 10 Brainpower" on one line (skill maps, Level Complete). */
export function BrainpowerLabel({ today }: { today: DailyAllowance }) {
  return (
    <Row gap={space.xxs}>
      <BrainpowerIcon size={iconSize.md} state={brainState(today)} />
      <Caption style={{ color: color.textMuted }}>{todayLabel(today)}</Caption>
    </Row>
  );
}
