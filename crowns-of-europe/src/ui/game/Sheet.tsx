/**
 * The bottom sheet, the way a phone does it: a glass panel inset from the screen's edges with a grab handle. It
 * opens at half height (armies and fleets lower still, so the map around them stays free to tap); drag it up (or
 * tap the handle) for nearly full, drag it down to shrink it or let it go. It rests just above the dock, so time
 * can be started and stopped while it is open.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glass } from '../components/Glass';
import { Icon } from '../components/Icon';
import { HelpButton, HelpNote } from '../components/kit';
import { G, R, display, sans } from '../theme';
import { dockTop, sheetHeight } from '../layout';

const SPRING = { damping: 22, stiffness: 240, mass: 0.8 };

export function Sheet({ title, subtitle, left, onClose, children, footer, compact, help }: { title: string; subtitle?: string; left?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; compact?: boolean; help?: ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [full, setFull] = useState(false);
  const drag = useSharedValue(0); // how far the finger has pulled the sheet (down is positive)
  const enter = useSharedValue(1); // 1 below the screen, 0 in place
  useEffect(() => {
    enter.set(1);
    enter.set(withTiming(0, { duration: 220 }));
  }, [title, enter]);
  const above = dockTop(insets.bottom);
  const maxH = full ? height - insets.top - 16 - above : sheetHeight(height, compact);

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onUpdate(e => {
      // Pulling up past the top meets resistance; pulling down follows the finger.
      drag.set(e.translationY < 0 ? -Math.sqrt(-e.translationY) * 3 : e.translationY);
    })
    .onEnd(e => {
      const dy = e.translationY;
      const vy = e.velocityY;
      if (dy < -30 || vy < -500) runOnJS(setFull)(true);
      else if (dy > 70 || vy > 700) {
        if (full) runOnJS(setFull)(false);
        else {
          runOnJS(onClose)();
          return;
        }
      }
      drag.set(withSpring(0, SPRING));
    });

  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: drag.get() + enter.get() * 360 }] }));

  return (
    <Animated.View style={[styles.wrap, { bottom: above }, anim]}>
      <Glass strong gilt radius={R.xl} style={{ maxHeight: maxH }}>
        <GestureDetector gesture={pan}>
          <View>
            <Pressable onPress={() => setFull(f => !f)} style={styles.handleWrap} accessibilityLabel={full ? 'Collapse' : 'Expand'}>
              <View style={styles.handle} />
            </Pressable>
            <View style={styles.header}>
              {left}
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              {help ? <HelpButton open={helpOpen} onPress={() => setHelpOpen(o => !o)} label={`About ${title}`} /> : null}
              <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]} accessibilityLabel="Close">
                <Icon name="close" size={15} color={G.text2} />
              </Pressable>
            </View>
          </View>
        </GestureDetector>
        <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
          {helpOpen ? <HelpNote style={{ marginBottom: 6 }}>{help}</HelpNote> : null}
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 8, right: 8, zIndex: 20 },
  handleWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  handle: { width: 38, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.28)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 10 },
  title: { fontFamily: display, fontSize: 21, color: G.text, letterSpacing: 0.4 },
  subtitle: { fontFamily: sans, fontSize: 13, color: G.text2, marginTop: 2 },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.09)' },
  footer: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: G.line },
});
