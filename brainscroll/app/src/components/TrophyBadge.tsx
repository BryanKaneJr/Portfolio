import type { Trophy } from '@brainscroll/core';
import { View } from 'react-native';
import { Caption, Icon, LevelArt } from '@/components/ui';
import { questDef } from '@/progress/useQuests';
import { color, depth, iconSize, radius, space } from '@/theme/tokens';

/** One trophy tile: a quest trophy shows its quest's emblem, a milestone its trophy mark. Locked ones are dashed and dim. */
export function TrophyBadge({ trophy, name, locked }: { trophy?: Trophy; name: string; locked?: boolean }) {
  const art = trophy?.questId ? questDef(trophy.questId)?.art : undefined;
  return (
    <View
      style={{
        flex: 1,
        aspectRatio: 1,
        gap: space.xs,
        borderRadius: radius.lg,
        borderWidth: depth.border,
        borderStyle: locked ? 'dashed' : 'solid',
        borderColor: locked ? color.border : color.brandLine,
        backgroundColor: locked ? 'transparent' : color.surface,
        alignItems: 'center',
        justifyContent: 'center',
        padding: space.xs,
      }}>
      {art ? <LevelArt art={art} size={56} /> : <Icon name="trophy" tint={locked ? color.borderStrong : color.brandText} size={iconSize.xl} />}
      <Caption center numberOfLines={2} tone={locked ? 'faint' : undefined}>
        {name}
      </Caption>
    </View>
  );
}
