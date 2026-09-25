import { useState, type ReactNode, type Ref } from 'react';
import { ScrollView, StyleSheet, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, layout, radius, space, type } from '@/theme/tokens';
import { IconButton } from './button';
import { SlideIn } from './motion';
import { ProgressBar } from './progress';
import { Eyebrow, H1 } from './text';

/** Tab screens: safe area, gutters, generous vertical rhythm, centered on wide screens. */
export function Screen({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'reward' }) {
  return (
    <SafeAreaView style={[styles.screen, tone === 'reward' && { backgroundColor: color.bgDeep }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Tab-screen title block: an optional eyebrow, a heading, and one optional right-side element. */
export function ScreenHeader({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1, gap: space.xs }}>
        {eyebrow && <Eyebrow tone="brand">{eyebrow}</Eyebrow>}
        <H1>{title}</H1>
      </View>
      {right}
    </View>
  );
}

/**
 * The lesson shell used by levels and review. Learning mode is quiet:
 *   top:    close, a prominent progress bar, one small context line, one quiet utility
 *   middle: the content at reading width, nothing else competing
 *   bottom: ONE obvious action, anchored in thumb reach; feedback slides in here
 */
export function LessonShell({
  progress,
  eyebrow,
  onClose,
  closeLabel,
  right,
  children,
  footer,
  footerTone,
  scrollRef,
  contentKey,
}: {
  progress: number;
  eyebrow?: string;
  onClose: () => void;
  closeLabel: string;
  right?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  footerTone?: 'success' | 'reinforce';
  scrollRef?: Ref<ScrollView>;
  contentKey?: string;
}) {
  const insets = useSafeAreaInsets();
  const tint =
    footerTone === 'success'
      ? { backgroundColor: '#12251F', borderTopColor: color.successLine }
      : footerTone === 'reinforce'
        ? { backgroundColor: '#241A22', borderTopColor: color.dangerLine }
        : null;
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.topBar}>
        <IconButton label={closeLabel} icon="close" onPress={onClose} />
        <ProgressBar value={progress} size="lesson" />
        {right ?? <View style={{ width: layout.minTouch }} />}
      </View>
      <ScrollView ref={scrollRef} key={contentKey} contentContainerStyle={styles.lessonScroll}>
        <View style={styles.column}>
          <SlideIn style={{ gap: space.lg }}>
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
            {children}
          </SlideIn>
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.lg) }, tint]}>
        <View style={[styles.column, { gap: space.md }]}>{footer}</View>
      </View>
    </SafeAreaView>
  );
}

export function Field({ label, ...props }: { label: string; style?: ViewStyle } & Pick<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'keyboardType' | 'autoComplete' | 'textContentType' | 'maxLength' | 'autoFocus'>) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      <Eyebrow>{label}</Eyebrow>
      <TextInput
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={color.textFaint}
        style={[styles.field, focused && styles.fieldFocused]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  scroll: { paddingHorizontal: layout.gutter, paddingTop: space.lg, paddingBottom: space.xxxl },
  column: { width: '100%', maxWidth: layout.readingWidth, alignSelf: 'center', gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, marginBottom: space.xs },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, height: layout.topBarHeight },
  lessonScroll: { paddingHorizontal: layout.gutter, paddingTop: space.xl, paddingBottom: space.xxl },
  footer: { paddingHorizontal: layout.gutter, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: color.border, backgroundColor: color.bg },
  field: {
    minHeight: layout.minTouch,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceRaised,
    color: color.text,
    paddingHorizontal: space.md,
    ...type.body,
    // The focus border replaces the browser's default outline on web.
    outlineWidth: 0,
  },
  fieldFocused: { borderColor: color.brand, borderWidth: 2, paddingHorizontal: space.md - 1 },
});
