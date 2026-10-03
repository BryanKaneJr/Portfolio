import { STREAK_TROPHY_TIERS, trophyInfo } from '@brainscroll/core';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrophyBadge } from '@/components/TrophyBadge';
import { Body, Button, Caption, Eyebrow, Gleams, IconButton, OutlinedNumber, Row, StatTile, Title, UiArt } from '@/components/ui';
import { trophyCatalog } from '@/content';
import { useProgressView } from '@/progress/ProgressProvider';
import { color, layout, space } from '@/theme/tokens';

/**
 * The learning streak, opened from the flame on the World Map (or Profile):
 * the current run big on the flame, the longest, the streak trophies, and a
 * way to share it. Quiet by design (docs/specs/CURRENT_PRODUCT_DECISIONS.md
 * §19): it says whether today counts yet, never what could be lost.
 */
export default function StreakScreen() {
  const { streak } = useProgressView();
  const close = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  const tiers = STREAK_TROPHY_TIERS.map((n) => ({ n, id: `trophy.streak_${n}`, earned: streak.longest >= n }));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bgDeep }}>
      <Row style={{ paddingHorizontal: layout.gutter, paddingTop: space.sm }}>
        <IconButton label="Close" icon="close" onPress={close} />
      </Row>
      <ScrollView contentContainerStyle={{ padding: layout.gutter, gap: space.xl, alignItems: 'center' }}>
        <Eyebrow style={{ color: color.streak }}>Learning streak</Eyebrow>
        {/* The day count sits on the flame, like the streak trophies. */}
        <View style={{ alignItems: 'center', marginBottom: space.xxl }} accessible accessibilityLabel={`${streak.current}-day learning streak`}>
          <UiArt name={streak.today || streak.current === 0 ? 'streak-flame' : 'streak-ember'} size={168} />
          {/* A lit flame twinkles; an ember waiting for today stays still. */}
          <Gleams count={4} size={18} tint={color.streak} active={streak.today} />
          <View style={{ position: 'absolute', bottom: -48, left: -80, right: -80, alignItems: 'center' }}>
            <OutlinedNumber value={streak.current.toLocaleString('en-US')} fontSize={80} tone="streak" />
          </View>
        </View>
        <Title style={{ color: color.streak }}>day streak</Title>
        <Body muted center>
          {streak.current === 0
            ? 'Clear a level or answer a review to start one.'
            : streak.today
              ? 'Today counts. Any new level or review keeps it going.'
              : 'Today isn’t counted yet. Any new level or review counts.'}
        </Body>
        <Row gap={space.sm} style={{ alignSelf: 'stretch' }}>
          <StatTile label="Current" value={`${streak.current} ${streak.current === 1 ? 'day' : 'days'}`} tone="streak" art="streak-flame" />
          <StatTile label="Longest" value={`${streak.longest} ${streak.longest === 1 ? 'day' : 'days'}`} art="streak-flame" />
        </Row>
        <View style={{ alignSelf: 'stretch', gap: space.sm }}>
          <Eyebrow>Streak trophies</Eyebrow>
          {[tiers.slice(0, 3), tiers.slice(3)].map((row, i) => (
            <Row key={i} gap={space.sm}>
              {row.map((t) => {
                const name = trophyInfo(t.id, trophyCatalog)?.name ?? '';
                return t.earned ? (
                  <Pressable
                    key={t.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${name}. Share`}
                    onPress={() => router.push({ pathname: '/share/[id]', params: { id: t.id } })}
                    style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.7 }]}>
                    <TrophyBadge trophyId={t.id} name={name} />
                  </Pressable>
                ) : (
                  <View key={t.id} style={{ flex: 1 }}>
                    <TrophyBadge trophyId={t.id} name={name} locked />
                  </View>
                );
              })}
            </Row>
          ))}
          <Caption>Earned by your longest streak, so they’re yours for good.</Caption>
        </View>
      </ScrollView>
      {streak.current > 0 && (
        <View style={{ padding: layout.gutter }}>
          <Button label="Share your streak" onPress={() => router.push({ pathname: '/share/[id]', params: { id: 'streak' } })} />
        </View>
      )}
    </SafeAreaView>
  );
}
