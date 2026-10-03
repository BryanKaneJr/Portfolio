import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrainpowerIcon } from '@/components/BrainpowerIcon';
import { BrainpowerWays } from '@/components/BrainpowerWays';
import { Body, Button, Caption, Card, Eyebrow, IconButton, OutlinedNumber, Row, StatTile, Title } from '@/components/ui';
import { useProgressView } from '@/progress/ProgressProvider';
import { color, layout, space } from '@/theme/tokens';


/**
 * Brainpower, opened from the brain on the World Map: the balance big on
 * the brain, what it's for, when it refills and how to earn more. Built like
 * the streak screen. One meaning: Brainpower lets you learn something new.
 */
export default function BrainpowerScreen() {
  const { today } = useProgressView();
  const close = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  const unlimited = today.unlimited || today.brainpower === null;
  const n = today.brainpower ?? 0;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bgDeep }}>
      <Row style={{ paddingHorizontal: layout.gutter, paddingTop: space.sm }}>
        <IconButton label="Close" icon="close" onPress={close} />
      </Row>
      <ScrollView contentContainerStyle={{ padding: layout.gutter, gap: space.xl, alignItems: 'center' }}>
        <Eyebrow tone="brand">Brainpower</Eyebrow>
        {/* The balance sits on the brain, like the streak's count on its flame. */}
        <View style={{ alignItems: 'center', marginBottom: space.xxl }} accessible accessibilityLabel={unlimited ? 'Unlimited Brainpower' : `${n} of ${today.brainpowerMax} Brainpower`}>
          <BrainpowerIcon size={168} state={unlimited ? 'unlimited' : n > 0 ? 'lit' : 'empty'} />
          <View style={{ position: 'absolute', bottom: -48, left: -80, right: -80, alignItems: 'center' }}>
            <OutlinedNumber value={unlimited ? '∞' : String(n)} fontSize={80} tone={unlimited ? 'gold' : 'brand'} />
          </View>
        </View>
        <Title style={{ color: unlimited ? color.mastery : color.brandText }}>{unlimited ? 'Unlimited' : `of ${today.brainpowerMax} Brainpower`}</Title>
        <Body muted center>
          {unlimited
            ? 'Learn as many new levels as you like.'
            : n > 0
              ? `Each new level uses 1. Reviews, replays and wrong answers never do.`
              : 'You’re out for now. Earn more below, or come back tomorrow.'}
        </Body>
        {!unlimited && (
          <>
            <Row gap={space.sm} style={{ alignSelf: 'stretch' }}>
              <StatTile label="Daily refill" value={`${today.brainpowerRefill}`} tone="brand" />
              <StatTile label="Most you can hold" value={`${today.brainpowerMax}`} />
            </Row>
            <Card variant="quiet" style={{ alignSelf: 'stretch', gap: space.md }}>
              <Eyebrow tone="brand">Earn more</Eyebrow>
              <BrainpowerWays />
              <Caption>
                {n >= today.brainpowerMax
                  ? 'Brainpower Full. Spend some to earn more.'
                  : `Each day you refill to ${today.brainpowerRefill}, and anything above that is kept.`}
              </Caption>
            </Card>
          </>
        )}
      </ScrollView>
      {!unlimited && n === 0 && (
        <View style={{ padding: layout.gutter }}>
          <Button variant="secondary" label="See Unlimited" onPress={() => router.push({ pathname: '/unlimited', params: { from: 'brainpower' } })} />
        </View>
      )}
    </SafeAreaView>
  );
}
