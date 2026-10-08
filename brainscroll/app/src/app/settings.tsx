import { router } from 'expo-router';
import { View } from 'react-native';
import { AccountCard } from '@/components/AccountCard';
import { BlockedSettings } from '@/components/BlockedSettings';
import { DeleteAccount } from '@/components/DeleteAccount';
import { FeedbackSettings } from '@/components/FeedbackSettings';
import { PreviewTools } from '@/components/PreviewTools';
import { PrivacySettings } from '@/components/PrivacySettings';
import { ReminderSettings } from '@/components/ReminderSettings';
import { UnlimitedCard } from '@/components/UnlimitedCard';
import { Button, Eyebrow, IconButton, Row, Screen, Title } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';
import { space } from '@/theme/tokens';

/**
 * Settings (owner, 2026-09-30): everything that isn't about what you know
 * lives here, one tap from the bottom of Profile, so Profile stays a
 * character sheet. Plan, sound and haptics, the daily reminder, Private
 * profile, the people you've blocked (to unblock), the account (sign out) and, last, deleting it.
 * The app preview adds its shortcuts on top (components/PreviewTools.tsx).
 */
export default function SettingsScreen() {
  const { resetAll } = useProgress();
  const header = (
    <Row gap={space.sm}>
      <IconButton label="Back" icon="back" onPress={() => (router.canGoBack() ? router.back() : router.navigate('/profile'))} />
      <View style={{ flex: 1, gap: space.xxs }}>
        <Eyebrow>Your account</Eyebrow>
        <Title>Settings</Title>
      </View>
    </Row>
  );
  return (
    <Screen header={header}>
      <PreviewTools />
      <UnlimitedCard />
      <FeedbackSettings />
      <ReminderSettings />
      <PrivacySettings />
      <BlockedSettings />
      <AccountCard />
      <DeleteAccount />
      {__DEV__ && <Button variant="ghost" label="Reset progress (dev)" onPress={() => void resetAll()} />}
    </Screen>
  );
}
