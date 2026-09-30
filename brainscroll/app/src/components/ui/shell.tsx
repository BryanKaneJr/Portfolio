import { useState, type ReactNode, type Ref } from 'react';
import { ScrollView, StyleSheet, TextInput, useWindowDimensions, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, depth, layout, radius, space, type } from '@/theme/tokens';
import { IconButton } from './button';
import { SlideIn } from './motion';
import { ProgressBar } from './progress';
import { Eyebrow, H1 } from './text';

/** Tab screens: safe area, gutters, generous vertical rhythm, centered on wide screens. */
export function Screen({ children, tone = 'default', scrollRef, header }: {
  children: ReactNode;
  tone?: 'default' | 'reward';
  scrollRef?: Ref<ScrollView>;
  /** Pinned above the scrolling content, so it's always in view. */
  header?: ReactNode;
}) {
  return (
    <SafeAreaView style={[styles.screen, tone === 'reward' && { backgroundColor: color.bgDeep }]} edges={['top']}>
      {header && (
        <View style={styles.pinned}>
          <View style={[styles.column, { gap: space.md }]}>{header}</View>
        </View>
      )}
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
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
 *
 * `feedback` (the verdict, an error) sits above the action and scrolls on its
 * own once it passes about 40% of the screen, so at the largest text sizes a
 * long explanation can never push the action off the bottom.
 */
export function LessonShell({
  progress,
  eyebrow,
  onClose,
  closeLabel,
  right,
  children,
  feedback,
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
  /** The verdict and any error, above the action. */
  feedback?: ReactNode;
  /** The action (one button). */
  footer: ReactNode;
  footerTone?: 'success' | 'reinforce';
  scrollRef?: Ref<ScrollView>;
  contentKey?: string;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const tint =
    footerTone === 'success'
      ? { backgroundColor: color.successTint, borderTopColor: color.successLine }
      : footerTone === 'reinforce'
        ? { backgroundColor: color.dangerTint, borderTopColor: color.dangerLine }
        : null;
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.topBar}>
        <IconButton label={closeLabel} icon="close" onPress={onClose} />
        <ProgressBar value={progress} size="lesson" label="Lesson progress" grow />
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
        {feedback ? (
          <ScrollView style={{ flexGrow: 0, maxHeight: height * 0.4 }} contentContainerStyle={{ paddingBottom: space.md }}>
            <View style={[styles.column, { gap: space.md }]}>{feedback}</View>
          </ScrollView>
        ) : null}
        <View style={[styles.column, { gap: space.md }]}>{footer}</View>
      </View>
    </SafeAreaView>
  );
}

export function Field({ label, ...props }: { label: string; style?: ViewStyle } & Pick<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'keyboardType' | 'autoComplete' | 'textContentType' | 'maxLength' | 'autoFocus' | 'multiline'>) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      <Eyebrow>{label}</Eyebrow>
      <TextInput
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
        // Single-line fields hold codes and addresses; a multiline one is prose.
        autoCapitalize={props.multiline ? 'sentences' : 'none'}
        autoCorrect={!!props.multiline}
        // Muted, not faint: a placeholder is text too (5.2:1 on the field).
        placeholderTextColor={color.textMuted}
        style={[styles.field, props.multiline && styles.fieldMultiline, focused && styles.fieldFocused]}
        textAlignVertical={props.multiline ? 'top' : undefined}
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
  pinned: { paddingHorizontal: layout.gutter, paddingTop: space.lg, paddingBottom: space.md, backgroundColor: color.bg, zIndex: 1 },
  footer: { paddingHorizontal: layout.gutter, paddingTop: space.lg, borderTopWidth: depth.line, borderTopColor: color.border, backgroundColor: color.bg },
  field: {
    minHeight: layout.minTouch,
    borderRadius: radius.md,
    borderWidth: depth.line,
    borderColor: color.border,
    backgroundColor: color.surfaceRaised,
    color: color.text,
    paddingHorizontal: space.md,
    ...type.body,
    // The focus border replaces the browser's default outline on web.
    outlineWidth: 0,
  },
  fieldMultiline: { minHeight: 112, paddingTop: space.sm, paddingBottom: space.sm },
  // The thicker focus border eats into the padding, so the text doesn't shift.
  fieldFocused: { borderColor: color.brand, borderWidth: depth.border, paddingHorizontal: space.md - (depth.border - depth.line) },
});
