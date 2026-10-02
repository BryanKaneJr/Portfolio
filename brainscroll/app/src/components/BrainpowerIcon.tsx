import { Text } from 'react-native';

/**
 * Brainpower's icon. The 🧠 emoji until the owner's art lands: add
 * `app/assets/images/ui/brainpower.webp` to UI_ART and return
 * `<UiArt name="brainpower" size={size} />` here (docs/images-chrome.md).
 * Decorative: whatever shows it also says the number in words.
 */
export function BrainpowerIcon({ size }: { size: number }) {
  return (
    <Text accessible={false} aria-hidden style={{ fontSize: size * 0.8, lineHeight: size, width: size, textAlign: 'center' }}>
      🧠
    </Text>
  );
}
