import { isGoldArt, trophyInfo, type Trophy } from '@brainscroll/core';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { Caption, Icon, LevelArt, OutlinedNumber } from '@/components/ui';
import { TROPHY_ART } from '@/components/ui/trophyArt';
import { levelByNumber, trophyCatalog } from '@/content';
import { questDef } from '@/progress/useQuests';
import { color, depth, iconSize, radius, space } from '@/theme/tokens';

const GOLD = new Set(['mastery', 'subject']);
const GOLD_IDS = new Set(['trophy.master_of_all', 'trophy.jack_of_all_trades', 'trophy.mastered']);

/**
 * One trophy tile. A quest trophy shows its quest's emblem, a skill's mastery
 * its Level 100 art, and every other trophy its own image (TROPHY_ART, the
 * trophy icon until the file exists). Counted trophies share one image per
 * series with the count drawn in front. Mastery trophies get the gold edge
 * (gold only ever means mastery). Locked ones are dashed and dim.
 */
/** How a trophy is drawn: its quest's or skill's level art, its own image, or neither (the icon); gold for mastery. */
export function trophyVisual(trophy: Pick<Trophy, 'trophyId' | 'kind' | 'questId'>) {
  const info = trophyInfo(trophy.trophyId, trophyCatalog);
  const gold = GOLD.has(trophy.kind ?? info?.kind ?? '') || GOLD_IDS.has(trophy.trophyId) || isGoldArt(info?.art);
  const levelArt = trophy.questId ? questDef(trophy.questId)?.art : info?.skillId ? levelByNumber(info.skillId, 100)?.art : undefined;
  const image = !levelArt && info?.art ? TROPHY_ART[info.art] : undefined;
  return { info, gold, levelArt, image };
}

export function TrophyBadge({ trophy, trophyId, name, locked, size = 56 }: { trophy?: Trophy; trophyId?: string; name: string; locked?: boolean; size?: number }) {
  const id = trophy?.trophyId ?? trophyId;
  const { info, gold, levelArt, image } = id ? trophyVisual({ trophyId: id, kind: trophy?.kind ?? trophyInfo(id, trophyCatalog)?.kind ?? 'milestone', questId: trophy?.questId }) : { info: undefined, gold: false, levelArt: undefined, image: undefined };
  // The art fits the tile it lands in: `size` is the most it grows to, and a narrow
  // slot (four across, a small phone) shrinks it, with room left for the count below it.
  const [tile, setTile] = useState(0);
  const inner = tile - 2 * (depth.border + space.xs);
  const art = inner > 0 ? Math.min(size, Math.floor(inner * (info?.count ? COUNTED_FIT : ART_FIT))) : size;
  return (
    <View style={{ width: '100%', gap: space.xs }}>
      <View
        onLayout={(e) => setTile(Math.round(e.nativeEvent.layout.width))}
        // The full width of its slot, square. Not flex: in a column, growing
        // stretched it tall on native (and aspectRatio then made it that wide).
        style={{
          width: '100%',
          aspectRatio: 1,
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
        {/* Room under the art for the count that overlaps its lower edge, so the pair sits centred inside the tile. */}
        <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: info?.count ? Math.round(art * 0.3) : 0 }}>
          {levelArt ? (
            <LevelArt art={levelArt} size={art} />
          ) : image ? (
            <Image source={image} style={{ width: art, height: art }} resizeMode="contain" accessibilityIgnoresInvertColors />
          ) : (
            <Icon name={info?.kind === 'subject' ? 'star' : 'trophy'} tint={locked ? color.borderStrong : gold ? color.mastery : color.brandText} size={Math.min(iconSize.xl, art)} />
          )}
          {info?.count ? (
            // The series count over the lower edge of the shared image ("100" on the perfect-lesson trophy), like a badge.
            <View style={{ position: 'absolute', bottom: -Math.round(art * 0.32), left: -art, right: -art, alignItems: 'center' }}>
              <OutlinedNumber
                value={info.count.toLocaleString('en-US')}
                fontSize={Math.round(art * (info.count >= 1000 ? 0.34 : 0.42))}
                tone={locked ? 'locked' : gold ? 'gold' : info.art === 'streak' ? 'streak' : 'brand'}
              />
            </View>
          ) : null}
        </View>
      </View>
      {/* The name goes under the tile, not in it, so a two-line name never crowds the art. */}
      {name ? (
        <Caption center numberOfLines={2} tone={locked ? 'faint' : undefined}>
          {name}
        </Caption>
      ) : null}
    </View>
  );
}

/**
 * How much of the tile's inside the art may take: most of it on its own, less
 * with a count, which hangs a third of the art below it and, at "1,000", is
 * about 1.15 times as wide as the art.
 */
const ART_FIT = 0.9;
const COUNTED_FIT = 0.74;
