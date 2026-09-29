import { trophyInfo, type Trophy } from '@brainscroll/core';
import { View } from 'react-native';
import { Caption, Icon, LevelArt } from '@/components/ui';
import { levelByNumber, trophyCatalog } from '@/content';
import { questDef } from '@/progress/useQuests';
import { color, depth, iconSize, radius, space } from '@/theme/tokens';

/**
 * One trophy tile. A quest trophy shows its quest's emblem; a skill's mastery
 * trophy shows that skill's Level 100 art; a subject's mastery shows the star.
 * Mastery trophies get the gold edge (gold only ever means mastery). Locked
 * ones are dashed and dim.
 */
export function TrophyBadge({ trophy, name, locked }: { trophy?: Trophy; name: string; locked?: boolean }) {
  const info = trophy ? trophyInfo(trophy.trophyId, trophyCatalog) : undefined;
  const mastery = trophy?.kind === 'mastery' || trophy?.kind === 'subject';
  const art = trophy?.questId ? questDef(trophy.questId)?.art : info?.skillId ? levelByNumber(info.skillId, 100)?.art : undefined;
  return (
    <View
      style={{
        flex: 1,
        aspectRatio: 1,
        gap: space.xs,
        borderRadius: radius.lg,
        borderWidth: depth.border,
        borderStyle: locked ? 'dashed' : 'solid',
        borderColor: locked ? color.border : mastery ? color.mastery : color.brandLine,
        backgroundColor: locked ? 'transparent' : color.surface,
        alignItems: 'center',
        justifyContent: 'center',
        padding: space.xs,
      }}>
      {art ? (
        <LevelArt art={art} size={56} />
      ) : (
        <Icon name={trophy?.kind === 'subject' ? 'star' : 'trophy'} tint={locked ? color.borderStrong : mastery ? color.mastery : color.brandText} size={iconSize.xl} />
      )}
      <Caption center numberOfLines={2} tone={locked ? 'faint' : undefined}>
        {name}
      </Caption>
    </View>
  );
}
