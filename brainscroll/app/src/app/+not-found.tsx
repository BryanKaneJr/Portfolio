import { Link, Stack } from 'expo-router';
import { Body, Screen, Title } from '@/components/ui';
import { color } from '@/theme/tokens';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Screen>
        <Title>This level doesn't exist.</Title>
        <Link href="/" style={{ color: color.brand }}>
          <Body>Back to Home</Body>
        </Link>
      </Screen>
    </>
  );
}
