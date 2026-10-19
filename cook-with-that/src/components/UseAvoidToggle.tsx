import type { StyleProp, ViewStyle } from 'react-native';

import { useAppState } from '../state/AppState';
import { useColors } from '../theme/colors';
import { Segmented } from './ui';

/** "✓ Use | ⊘ Avoid": decides which list an ingredient tap goes to. */
export function UseAvoidToggle({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const { mode, setMode } = useAppState();
  return (
    <Segmented
      value={mode}
      onChange={setMode}
      style={style}
      options={[
        {
          value: 'use',
          label: 'Use',
          icon: 'check',
          color: c.herbText,
          accessibilityLabel: 'Use: tapped ingredients must be in the recipe',
        },
        {
          value: 'avoid',
          label: 'Avoid',
          icon: 'avoid',
          color: c.avoidText,
          accessibilityLabel: 'Avoid: hide recipes with tapped ingredients',
        },
      ]}
    />
  );
}
