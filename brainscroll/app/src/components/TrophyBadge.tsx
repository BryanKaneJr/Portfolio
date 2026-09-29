import { trophyInfo, type Trophy } from '@brainscroll/core';
import { Image, Text, View } from 'react-native';
import { Caption, Icon, LevelArt } from '@/components/ui';
import { TROPHY_ART } from '@/components/ui/trophyArt';
import { levelByNumber, trophyCatalog } from '@/content';
import { questDef } from '@/progress/useQuests';
import { color, depth, fw, iconSize, radius, space, type } from '@/theme/tokens';

const GOLD = new Set(['mastery', 'subject']);
const GOLD_IDS = new Set(['trophy.master_of_all', 'trophy.jack_of_all_trades', 'trophy.mastered']);

/**
 * One trophy tile. A quest trophy shows its quest's emblem, a skill's mastery
 * its Level 100 art, and every other trophy its own image (TROPHY_ART, the
 * trophy icon until the file exists). Counted trophies share one image per
 * series with the count drawn in front. Mastery trophies get the gold edge
 * (gold only ever means mastery). Locked ones are dashed and dim.
 */
export function TrophyBadge({ trophy, trophyId, name, locked, size = 56 }: { trophy?: Trophy; trophyId?: string; name: string; locked?: boolean; size?: number }) {
  const id = trophy?.trophyId ?? trophyId;
  const info = id ? trophyInfo(id, trophyCatalog) : undefined;
  const gold = !!id && (GOLD.has(trophy?.kind ?? info?.kind ?? '') || GOLD_IDS.has(id));
  const levelArt = trophy?.questId ? questDef(trophy.questId)?.art : info?.skillId ? levelByNumber(info.skillId, 100)?.art : undefined;
  const image = !levelArt && info?.art ? TROPHY_ART[info.art] : undefined;
  return (
    <View
      style={{
        flex: 1,
        aspectRatio: 1,
        gap: space.xs,
        borderRadius: radius.lg,
        borderWidth: depth.border,
        borderStyle: locked ? 'dashed' : 'solid',
        borderColor: locked ? color.border : gold ? color.mastery : color.brandLine,
        backgroundColor: locked ? 'transparent' : color.surface,
        alignItems: 'center',
        justifyContent: 'center',
        padding: space.xs,
        opacity: locked && image ? 0.45 : 1,
      }}>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        {levelArt ? (
          <LevelArt art={levelArt} size={size} />
        ) : image ? (
          <Image source={image} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />
        ) : (
          <Icon name={info?.kind === 'subject' ? 'star' : 'trophy'} tint={locked ? color.borderStrong : gold ? color.mastery : color.brandText} size={iconSize.xl} />
        )}
        {info?.count ? (
          // The series count, in front of the shared image ("100" on the perfect-lesson trophy).
          <View
            aria-hidden
            accessible={false}
            style={{ position: 'absolute', bottom: -space.xs, paddingHorizontal: space.xs, borderRadius: radius.pill, backgroundColor: locked ? color.surfaceRaised : gold ? color.mastery : color.brand }}>
            <Text style={[type.label, fw('900'), { color: locked ? color.textMuted : color.onBrand }]}>{info.count.toLocaleString('en-US')}</Text>
          </View>
        ) : null}
      </View>
      {name ? (
        <Caption center numberOfLines={2} tone={locked ? 'faint' : undefined}>
          {name}
        </Caption>
      ) : null}
    </View>
  );
}
