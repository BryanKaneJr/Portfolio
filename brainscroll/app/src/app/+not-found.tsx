import { Link, Stack } from 'expo-router';
import { Body, DrScroll, Screen, Title } from '@/components/ui';
import { color } from '@/theme/tokens';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Screen>
        <DrScroll spot="not-found" size="md" />
        <Title>This level doesn’t exist.</Title>
        <Link href="/" style={{ color: color.brandText }}>
          <Body>Back to Home</Body>
        </Link>
      </Screen>
    </>
  );
}
