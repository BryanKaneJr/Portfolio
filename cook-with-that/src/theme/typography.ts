import type { TextStyle } from 'react-native';

/** iOS text styles in the system font (SF Pro on iPhone). */
export const type: Record<'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'small' | 'label', TextStyle> = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.4 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.2 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  small: { fontSize: 14, lineHeight: 19 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500', letterSpacing: 0.2, textTransform: 'uppercase' },
};
