import { router } from 'expo-router';
import { Body, Button, Card, Eyebrow } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';
import { space } from '@/theme/tokens';

/**
 * Profile's plan card: the learner's own way into Unlimited (an explicit ask,
 * so the paywall may open), or its status once it's on. Quiet by design:
 * Unlimited is a convenience, never a badge of accomplishment.
 */
export function UnlimitedCard() {
  const { entitlement, account } = useProgress();
  if (account?.status !== 'signed_in') return null;
  const open = () => router.push({ pathname: '/unlimited', params: { from: 'profile' } });
  return (
    <Card variant="quiet" style={{ gap: space.sm }}>
      <Eyebrow>Plan</Eyebrow>
      {entitlement.active ? (
        <>
          <Body>Unlimited: no daily limit on new levels.</Body>
          <Button variant="secondary" label="Unlimited details" onPress={open} />
        </>
      ) : (
        <>
          <Body>Free: 5 new levels a day, and review as much as you like.</Body>
          <Button variant="secondary" label="See Unlimited" onPress={open} />
        </>
      )}
    </Card>
  );
}
