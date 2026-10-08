import type { TextStyle } from 'react-native';

export const type: Record<'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'small' | 'label', TextStyle> = {
  display: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontSize: 16, fontWeight: '600' },
  small: { fontSize: 14, lineHeight: 19 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
};
