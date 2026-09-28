import { Tabs } from 'expo-router';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, depth, fw, iconSize, radius, space } from '@/theme/tokens';

type IconName = SymbolViewProps['name'];

/** The active tab sits in a violet-outlined box, so where you are reads at a glance. */
function icon(name: IconName) {
  return function TabIcon({ color: tint, focused }: { color: ColorValue; focused: boolean }) {
    return (
      <View style={[tabStyles.box, focused && tabStyles.active]}>
        <SymbolView name={name} tintColor={tint} size={iconSize.lg} />
      </View>
    );
  };
}

/** The tab icon's box: fixed, so the active outline is the same size on every tab. */
const TAB_BOX = { width: 52, height: 36 } as const;
/** Tab bar height above the home indicator: the box, its label and breathing room. */
const TAB_BAR = 72;

const tabStyles = StyleSheet.create({
  box: { ...TAB_BOX, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: depth.border, borderColor: 'transparent' },
  active: { backgroundColor: color.brandSoft, borderColor: color.brandLine },
});

/**
 * Four destinations for V1 (visual direction §3). Learning launches from Home or
 * a skill, and the tab bar disappears inside lessons (they're stack screens).
 */
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.brandText,
        tabBarInactiveTintColor: color.textMuted,
        tabBarStyle: { backgroundColor: color.bg, borderTopColor: color.border, height: TAB_BAR + insets.bottom, paddingTop: space.sm, borderTopWidth: depth.border },
        tabBarIconStyle: TAB_BOX,
        // Tab labels are the one place below the type scale: the platform's own tab-label size, in sentence case.
        tabBarLabelStyle: { marginTop: space.xs, fontSize: 11, ...fw('700'), letterSpacing: 0.4 },
      }}>
      <Tabs.Screen name="(home)" options={{ title: 'Home', tabBarIcon: icon({ ios: 'house.fill', android: 'home', web: 'home' }) }} />
      <Tabs.Screen name="skills" options={{ title: 'Skills', tabBarIcon: icon({ ios: 'square.stack.3d.up.fill', android: 'layers', web: 'layers' }) }} />
      <Tabs.Screen name="review" options={{ title: 'Review', tabBarIcon: icon({ ios: 'arrow.triangle.2.circlepath', android: 'refresh', web: 'refresh' }) }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon({ ios: 'person.crop.circle.fill', android: 'person', web: 'person' }) }} />
    </Tabs>
  );
}
