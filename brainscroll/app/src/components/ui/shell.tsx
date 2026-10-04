import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, useWindowDimensions, View, type TextInputProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, depth, layout, radius, space, type } from '@/theme/tokens';
import { IconButton } from './button';
import { SlideIn } from './motion';
import { ProgressBar } from './progress';
import { Eyebrow, H1 } from './text';

/** Tab screens: safe area, gutters, generous vertical rhythm, centered on wide screens. */
export function Screen({ children, tone = 'default', scrollRef, header, topColor, onScroll }: {
  children: ReactNode;
  tone?: 'default' | 'reward';
  scrollRef?: Ref<ScrollView>;
  /** Pinned above the scrolling content, so it's always in view. */
  header?: ReactNode;
  /**
   * For a screen whose content opens on a band of colour (Profile's header):
   * the same colour fills the status bar and island area above it, and what
   * a pull-down reveals, so the band reaches the very top of the phone.
   */
  topColor?: string;
  /** How far the content has scrolled, a few times a second (the skill map draws chapters as they come near). */
  onScroll?: (y: number) => void;
}) {
  const bg = tone === 'reward' ? color.bgDeep : color.bg;
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: topColor ?? bg }]} edges={['top']}>
      {header && (
        <View style={styles.pinned}>
          <View style={[styles.column, { gap: space.md }]}>{header}</View>
        </View>
      )}
      <ScrollView
        ref={scrollRef}
        style={topColor ? { backgroundColor: bg } : undefined}
        contentContainerStyle={styles.scroll}
        onScroll={onScroll ? (e) => onScroll(e.nativeEvent.contentOffset.y) : undefined}
        scrollEventThrottle={onScroll ? 100 : undefined}>
        {topColor && <View pointerEvents="none" style={[styles.overscroll, { backgroundColor: topColor }]} />}
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
 *
 * Keyboard focus (web) never falls out of the lesson: when the focused control
 * goes away (CHECK becomes Continue, Continue brings the next card), focus
 * moves to the footer's action, or to the first choice when the action is
 * waiting for one (useKeepFocus).
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
  barFill,
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
  /** The skill's subject colour for the progress bar (theme/subjectTheme.ts); violet without one. */
  barFill?: string;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { onFocus, contentRef, footerRef } = useKeepFocus();
  const tint =
    footerTone === 'success'
      ? { backgroundColor: color.successTint, borderTopColor: color.successLine }
      : footerTone === 'reinforce'
        ? { backgroundColor: color.dangerTint, borderTopColor: color.dangerLine }
        : null;
  return (
    <SafeAreaView style={styles.screen} edges={['top']} {...onFocus}>
      <View style={styles.topBar}>
        <IconButton label={closeLabel} icon="close" onPress={onClose} />
        <ProgressBar value={progress} size="lesson" label="Lesson progress" grow fill={barFill} />
        {right ?? <View style={{ width: layout.minTouch }} />}
      </View>
      <ScrollView ref={scrollRef} key={contentKey} contentContainerStyle={styles.lessonScroll}>
        <View style={styles.column} ref={contentRef}>
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
        <View style={[styles.column, { gap: space.md }]} ref={footerRef}>
          {footer}
        </View>
      </View>
    </SafeAreaView>
  );
}

/** Web: where focus goes when the focused control disappears or is disabled under it (see LessonShell). */
function useKeepFocus() {
  const last = useRef<HTMLElement | null>(null);
  const contentRef = useRef<View>(null);
  const footerRef = useRef<View>(null);
  const web = Platform.OS === 'web' && typeof document !== 'undefined';
  useEffect(() => {
    if (!web) return;
    const was = last.current;
    if (!was || document.activeElement !== document.body) return;
    const usable = (el: HTMLElement) => el.isConnected && el.getAttribute('aria-disabled') !== 'true' && !el.hasAttribute('disabled');
    // Still there and usable: the learner moved focus away on purpose.
    if (usable(was)) return;
    const first = (root: unknown, selector: string) =>
      Array.from((root as HTMLElement | null)?.querySelectorAll?.<HTMLElement>(selector) ?? []).find(usable);
    const target = first(footerRef.current, '[role="button"],button') ?? first(contentRef.current, '[role="radio"],[role="button"],button');
    if (target) {
      target.focus();
      last.current = target;
    }
  });
  const onFocus = web ? ({ onFocus: (e: { target: unknown }) => (last.current = e.target as HTMLElement) } as object) : {};
  return { onFocus, contentRef, footerRef };
}

export function Field({ label, ...props }: { label: string } & Pick<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'keyboardType' | 'autoComplete' | 'textContentType' | 'maxLength' | 'autoFocus' | 'multiline'>) {
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
  // Above the content, seen only when it's pulled down past the top.
  overscroll: { position: 'absolute', left: 0, right: 0, top: -1000, height: 1000 },
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
