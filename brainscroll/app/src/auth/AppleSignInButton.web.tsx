import { SIGN_IN_METHOD_LABEL } from '@brainscroll/core';
import { Button } from '@/components/ui';

/** Web: a normal button that starts the Apple OAuth redirect. */
export function AppleSignInButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return <Button variant="secondary" label={SIGN_IN_METHOD_LABEL.apple} onPress={onPress} disabled={disabled} />;
}
