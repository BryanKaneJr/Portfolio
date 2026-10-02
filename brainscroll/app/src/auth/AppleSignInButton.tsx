import { SIGN_IN_METHOD_LABEL } from '@brainscroll/core';
import * as AppleAuthentication from 'expo-apple-authentication';
import { layout, radius } from '@/theme/tokens';

/**
 * Apple requires its own button on iOS (Human Interface Guidelines). Android
 * and web use a plain button (`AppleSignInButton.android.tsx`, `.web.tsx`).
 */
export function AppleSignInButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
      cornerRadius={radius.md}
      style={{ height: layout.buttonHeight, opacity: disabled ? 0.5 : 1 }}
      onPress={() => {
        if (!disabled) onPress();
      }}
      accessibilityLabel={SIGN_IN_METHOD_LABEL.apple}
      accessibilityState={{ disabled: !!disabled }}
    />
  );
}
