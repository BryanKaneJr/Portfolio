import { Stack } from 'expo-router';
import { useReduceMotion } from '@/theme/feedback';
import { color } from '@/theme/tokens';

/**
 * Home is a small stack inside its tab: the World Map, then a subject's region
 * (when it has more than one skill), then a skill's map. The tab bar stays.
 */
export default function HomeStack() {
  // Map to region to skill slides in; with Reduce Motion it fades.
  const reduce = useReduceMotion();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg }, animation: reduce ? 'fade' : 'default', freezeOnBlur: true }} />;
}
