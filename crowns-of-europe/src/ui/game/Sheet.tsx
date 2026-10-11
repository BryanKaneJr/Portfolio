/** Bottom sheet that slides up over the map: half height by default, tap the handle for (almost) full. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { C, sans, serif } from '../theme';
import { Icon } from '../components/Icon';

export function Sheet({ title, subtitle, left, onClose, children, footer }: { title: string; subtitle?: string; left?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const { height } = useWindowDimensions();
  const [full, setFull] = useState(false);
  const slide = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    slide.setValue(1);
    Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: true }).start();
  }, [title]);
  const maxH = full ? height * 0.78 : height * 0.42;
  return (
    <Animated.View style={[styles.sheet, { maxHeight: maxH, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 300] }) }] }]}>
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
        <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel="Close">
          <Icon name="close" size={20} color={C.inkSoft} />
        </Pressable>
      </View>
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 14 }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.parchment,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: C.parchmentLine,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
  },
  handleWrap: { alignItems: 'center', paddingTop: 7, paddingBottom: 3 },
  handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: C.parchmentLine },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 8 },
  title: { fontFamily: serif, fontSize: 20, fontWeight: '700', color: C.ink },
  subtitle: { fontFamily: sans, fontSize: 12, color: C.muted, marginTop: 1 },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: C.parchment2 },
  footer: { paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.parchmentLine },
});
