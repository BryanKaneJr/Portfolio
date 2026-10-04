import { Tabs } from 'expo-router';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotion } from '@/theme/feedback';
import { color, depth, fw, radius, space } from '@/theme/tokens';

/**
 * Illustrated tab icons (owner, 2026-10-01: colourful icons in the chrome,
 * using the UI art we have until a dedicated set exists). The active tab is
 * full colour in an outlined pill; the others sit dimmed, so where you are
 * reads at a glance.
 */
const TAB_ART = {
  home: require('../../../assets/images/ui/welcome.webp'),
  // A star: what mastering a skill earns (owner, 2026-10-01: the up arrow was too plain).
  skills: require('../../../assets/images/ui/mastery-star.webp'),
  // A medal: your league (owner, 2026-10-01).
  social: require('../../../assets/images/ui/medal.webp'),
  review: require('../../../assets/images/ui/review.webp'),
  profile: require('../../../assets/images/ui/profile.webp'),
} satisfies Record<string, ImageSourcePropType>;

function icon(art: ImageSourcePropType) {
  return function TabIcon({ focused }: { focused: boolean }) {
    // The tab's label names it; the icon is decoration.
    return (
      <View style={[tabStyles.box, focused && tabStyles.active]} accessible={false} aria-hidden importantForAccessibility="no-hide-descendants">
        <Image source={art} style={[tabStyles.art, !focused && tabStyles.dim]} resizeMode="contain" />
      </View>
    );
  };
}

/** The tab icon's box: fixed, so the active outline is the same size on every tab. */
const TAB_BOX = { width: 52, height: 36 } as const;
/**
 * Tab bar height above the home indicator: the box, its label and breathing
 * room, with space for the label to grow to its 1.3× cap at large text sizes
 * (at 72 a grown label lost its bottom).
 */
const TAB_BAR = 78;

const tabStyles = StyleSheet.create({
  box: { ...TAB_BOX, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: depth.border, borderColor: 'transparent' },
  active: { backgroundColor: color.brandSoft, borderColor: color.brandLine },
  art: { width: 30, height: 30 },
  // Dimmed, not grey: the art keeps its colour, just quieter than the active tab.
  dim: { opacity: 0.5 },
});

// No letter spacing: on iOS it makes a one-line label measure short, so "Skills" showed as "Skil…".
const tabLabel = { marginTop: space.xs, fontSize: 11, lineHeight: 14, ...fw('700'), textAlign: 'center' } as const;

/**
 * Five destinations, left to right: Skills, Review, Home, Social and Profile (owner, 2026-10-01: Home in the
 * centre). Home stays the first screen and where Back lands. Learning launches from Home or a skill, and the
 * tab bar disappears inside lessons (they're stack screens).
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
        tabBarStyle: { backgroundColor: color.bg, borderTopColor: color.border, height: TAB_BAR + insets.bottom, paddingTop: space.sm, borderTopWidth: depth.border },
        tabBarIconStyle: TAB_BOX,
        // Tab labels are the one place below the type scale: the platform's own tab-label size, in sentence case.
        // They grow with the OS text size up to 1.3×, which still fits the fixed bar; iOS's own
        // tab bars do the same (a long press shows the Large Content Viewer).
        tabBarLabel: ({ color: tint, children }) => (
          // Shrinks a little rather than cutting the word short, at large text sizes too.
          <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[tabLabel, { color: tint, minWidth: TAB_BOX.width + space.lg }]}>
            {children}
          </Text>
        ),
      }}>
      <Tabs.Screen name="skills" options={{ title: 'Skills', tabBarIcon: icon(TAB_ART.skills) }} />
      <Tabs.Screen name="review" options={{ title: 'Review', tabBarIcon: icon(TAB_ART.review) }} />
      <Tabs.Screen name="(home)" options={{ title: 'Home', tabBarIcon: icon(TAB_ART.home) }} />
      <Tabs.Screen name="social" options={{ title: 'Social', tabBarIcon: icon(TAB_ART.social) }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon(TAB_ART.profile) }} />
    </Tabs>
  );
}
