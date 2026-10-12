import { Tabs } from 'expo-router/tabs';

import { Icon } from '../../components/Icon';
import { useColors } from '../../theme/colors';
import type { IconName } from '../../theme/icons';

const TABS: { name: string; title: string; icon: IconName; selected: IconName }[] = [
  { name: 'index', title: 'Find', icon: 'search', selected: 'search' },
  { name: 'pantry', title: 'Pantry', icon: 'pantry', selected: 'pantryFill' },
  { name: 'plan', title: 'Plan', icon: 'calendar', selected: 'calendar' },
  { name: 'saved', title: 'Saved', icon: 'bookmark', selected: 'bookmarkFill' },
];

/** Web stand-in for the native tab bar in _layout.tsx (the web build is for previews and testing). */
export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.cardBorder, height: 60, paddingTop: 4 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      {TABS.map(tab => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, focused }) => (
              <Icon name={focused ? tab.selected : tab.icon} size={25} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
