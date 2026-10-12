import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useColors } from '../../theme/colors';

/**
 * The tab bar (owner, 2026-10-12): Find · Pantry · Plan · Saved. Native on iPhone (Liquid Glass on iOS 26) and
 * Android; the web build uses _layout.web.tsx. Detail screens (results, a recipe, the editor) push over the tabs from
 * the root stack.
 */
export default function TabsLayout() {
  const c = useColors();
  return (
    <NativeTabs tintColor={c.accent} labelStyle={{ color: c.textMuted }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        <NativeTabs.Trigger.Label>Find</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="pantry">
        <NativeTabs.Trigger.Icon sf={{ default: 'refrigerator', selected: 'refrigerator.fill' }} md="kitchen" />
        <NativeTabs.Trigger.Label>Pantry</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="plan">
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        <NativeTabs.Trigger.Label>Plan</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="saved">
        <NativeTabs.Trigger.Icon sf={{ default: 'bookmark', selected: 'bookmark.fill' }} md="bookmark" />
        <NativeTabs.Trigger.Label>Saved</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
