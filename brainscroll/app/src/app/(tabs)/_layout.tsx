import { Tabs } from 'expo-router';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, depth, fw, radius, space } from '@/theme/tokens';

type IconName = SymbolViewProps['name'];

/** The active tab sits in a violet-outlined box, so where you are reads at a glance. */
function icon(name: IconName) {
  return function TabIcon({ color: tint, focused }: { color: ColorValue; focused: boolean }) {
    return (
      <View style={[tabStyles.box, focused && tabStyles.active]}>
        <SymbolView name={name} tintColor={tint} size={26} />
      </View>
    );
  };
}

const tabStyles = StyleSheet.create({
  box: { width: 52, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: depth.border, borderColor: 'transparent' },
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
        tabBarStyle: { backgroundColor: color.bg, borderTopColor: color.border, height: 72 + insets.bottom, paddingTop: space.sm, borderTopWidth: depth.border },
        tabBarIconStyle: { width: 52, height: 36 },
        tabBarLabelStyle: { marginTop: space.xs,  fontSize: 11, ...fw('700'), letterSpacing: 0.4 },
      }}>
      <Tabs.Screen name="(home)" options={{ title: 'Home', tabBarIcon: icon({ ios: 'house.fill', android: 'home', web: 'home' }) }} />
      <Tabs.Screen name="skills" options={{ title: 'Skills', tabBarIcon: icon({ ios: 'square.stack.3d.up.fill', android: 'layers', web: 'layers' }) }} />
      <Tabs.Screen name="review" options={{ title: 'Review', tabBarIcon: icon({ ios: 'arrow.triangle.2.circlepath', android: 'refresh', web: 'refresh' }) }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon({ ios: 'person.crop.circle.fill', android: 'person', web: 'person' }) }} />
    </Tabs>
  );
}
