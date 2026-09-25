import { Stack } from 'expo-router';
import { color } from '@/theme/tokens';

/**
 * Home is a small stack inside its tab: the World Map, then a subject's region
 * (when it has more than one skill), then a skill's map. The tab bar stays.
 */
export default function HomeStack() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }} />;
}
