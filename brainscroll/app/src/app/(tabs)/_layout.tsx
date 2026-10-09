import { Tabs } from 'expo-router';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotion } from '@/theme/feedback';
import { color, depth, radius } from '@/theme/tokens';

/**
 * Illustrated tab icons (owner, 2026-10-01: colourful icons in the chrome,
 * using the art we have until a dedicated set exists), big and without words
 * (owner, 2026-10-09: "the icons are informative enough"). The active tab is
 * full colour in an outlined pill; the others sit dimmed, so where you are
 * reads at a glance.
 */
const TAB_ART = {
  home: require('../../../assets/images/ui/welcome.webp'),
  // A medal: your league (owner, 2026-10-01).
  league: require('../../../assets/images/ui/medal.webp'),
  practice: require('../../../assets/images/ui/review.webp'),
  // A handshake: your friends (owner, 2026-10-09; the How Money Works level art).
  social: require('../../../assets/images/art/money.handshake.webp'),
  profile: require('../../../assets/images/ui/profile.webp'),
} satisfies Record<string, ImageSourcePropType>;

function icon(art: ImageSourcePropType) {
  return function TabIcon({ focused }: { focused: boolean }) {
    // The tab's name is its accessibility label; the icon is decoration.
    return (
      <View style={[tabStyles.box, focused && tabStyles.active]} accessible={false} aria-hidden importantForAccessibility="no-hide-descendants">
        <Image source={art} style={[tabStyles.art, !focused && tabStyles.dim]} resizeMode="contain" />
      </View>
    );
  };
}

/** The tab icon's box: fixed, so the active outline is the same size on every tab. */
const TAB_BOX = { width: 64, height: 50 } as const;
/** Tab bar height above the home indicator: the box and breathing room (no labels). */
const TAB_BAR = 66;

const tabStyles = StyleSheet.create({
  box: { ...TAB_BOX, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: depth.border, borderColor: 'transparent' },
  active: { backgroundColor: color.brandSoft, borderColor: color.brandLine },
  art: { width: 40, height: 40 },
  // Dimmed, not grey: the art keeps its colour, just quieter than the active tab.
  dim: { opacity: 0.5 },
});

/**
 * Five destinations, left to right: Practice, Leagues, Home, Social and Profile (owner, 2026-10-01: Home in
 * the centre; 2026-10-09: Practice is Review with your skills, and Leagues holds the league, the week's quest
 * and the world leaderboard). Home stays the first screen and where Back lands. Learning launches from Home
 * or a skill, and the tab bar disappears inside lessons (they're stack screens).
 */
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  return (
    <Tabs
      initialRouteName="(home)"
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
        // A tab out of sight freezes until it's back in view (no re-renders on every progress change).
        freezeOnBlur: true,
        // Switching tabs slides the new one in a little; Reduce Motion switches instantly.
        animation: reduce ? 'none' : 'shift',
        tabBarActiveTintColor: color.brandText,
        tabBarInactiveTintColor: color.textMuted,
        tabBarStyle: { backgroundColor: color.bg, borderTopColor: color.border, height: TAB_BAR + insets.bottom, paddingTop: 0, borderTopWidth: depth.border },
        // The icon sits in the middle of the bar (the item's own top padding was for the label below it).
        tabBarItemStyle: { paddingVertical: 0, justifyContent: 'center' },
        tabBarIconStyle: TAB_BOX,
        // No words under the icons (owner, 2026-10-09). Each tab keeps its name for screen readers.
        tabBarShowLabel: false,
      }}>
      <Tabs.Screen name="practice" options={{ title: 'Practice', tabBarAccessibilityLabel: 'Practice', tabBarIcon: icon(TAB_ART.practice) }} />
      <Tabs.Screen name="league" options={{ title: 'Leagues', tabBarAccessibilityLabel: 'Leagues', tabBarIcon: icon(TAB_ART.league) }} />
      <Tabs.Screen name="(home)" options={{ title: 'Home', tabBarAccessibilityLabel: 'Home', tabBarIcon: icon(TAB_ART.home) }} />
      <Tabs.Screen name="social" options={{ title: 'Social', tabBarAccessibilityLabel: 'Social', tabBarIcon: icon(TAB_ART.social) }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarAccessibilityLabel: 'Profile', tabBarIcon: icon(TAB_ART.profile) }} />
    </Tabs>
  );
}
