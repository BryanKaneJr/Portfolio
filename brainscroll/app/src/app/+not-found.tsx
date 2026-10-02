import { router, Stack } from 'expo-router';
import { Screen, StateBlock } from '@/components/ui';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Screen>
        <StateBlock spot="not-found" title="This page doesn’t exist." body="The link may be old. Your progress is safe." secondary={{ label: 'Back to Home', onPress: () => router.replace('/') }} />
      </Screen>
    </>
  );
}
