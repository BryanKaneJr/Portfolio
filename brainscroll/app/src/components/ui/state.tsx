import type { MascotSpot } from '@brainscroll/core';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { liveRegion, useAnnounce } from '@/theme/feedback';
import { color, layout, space } from '@/theme/tokens';
import { Button } from './button';
import { DrScroll } from './mascot';
import { Card } from './surface';
import type { UiArtName } from './uiArt';
import { UiArt } from './uiArtView';
import { Body, Eyebrow, H2, Title } from './text';

/** The network-failure words, used wherever something couldn't load. Progress lives on the server, so it is never at risk. */
export const LOAD_ERROR = {
  title: 'Couldn’t load this one.',
  body: 'Your progress is safe. Try again.',
  retry: 'Try again',
} as const;

type Action = { label: string; onPress: () => void; loading?: boolean };

/**
 * One block for every dead state (empty, error, locked, not found), so each
 * still reads as BrainScroll: Dr. Scroll in the spot's pose, a short title,
 * one line, and at most two actions.
 *
 *   - `layout="card"` (default) sits inside a tab screen as a card.
 *   - `layout="screen"` fills a stack screen (a level, a review session).
 *   - `layout="inline"` is a compact notice beside a small Dr. Scroll, for a
 *     problem on a screen that otherwise works (e.g. offline on Home).
 *
 * A block that replaces content without moving focus (a failed load, an
 * inline problem) is spoken as it appears: `announce`, on by default for
 * `inline` and always on for `LoadError`.
 */
export function StateBlock({
  spot,
  art,
  eyebrow,
  eyebrowTone = 'muted',
  title,
  body,
  action,
  secondary,
  layout: shape = 'card',
  announce,
  children,
}: {
  spot: MascotSpot;
  /** One of the owner's UI illustrations in place of Dr. Scroll, for plain states (offline, errors, caught up). */
  art?: UiArtName;
  eyebrow?: string;
  eyebrowTone?: 'muted' | 'brand' | 'success' | 'danger';
  title: string;
  body?: string;
  action?: Action;
  secondary?: Action;
  layout?: 'card' | 'screen' | 'inline';
  /** Speak the title and line when the block appears. */
  announce?: boolean;
  children?: ReactNode;
}) {
  const speak = announce ?? shape === 'inline';
  useAnnounce(speak ? [title, body].filter(Boolean).join(' ') : null);
  const live = speak ? liveRegion : undefined;
  if (shape === 'inline')
    return (
      <Card variant="quiet" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
        {art ? <UiArt name={art} size={40} /> : <DrScroll spot={spot} size="xs" />}
        <View style={{ flex: 1, gap: space.xs }} accessibilityLiveRegion={live}>
          {eyebrow && <Eyebrow tone={eyebrowTone}>{eyebrow}</Eyebrow>}
          <Title>{title}</Title>
          {body && <Body muted>{body}</Body>}
          {children}
          {action && <Button compact variant="secondary" label={action.label} loading={action.loading} onPress={action.onPress} style={{ alignSelf: 'flex-start', marginTop: space.xs }} />}
        </View>
      </Card>
    );

  const content = (
    <>
      {art ? <UiArt name={art} size={112} style={{ alignSelf: 'center' }} /> : <DrScroll spot={spot} size="md" style={{ alignSelf: 'center' }} />}
      <View style={{ gap: space.sm }} accessibilityLiveRegion={live}>
        {eyebrow && <Eyebrow tone={eyebrowTone} center>{eyebrow}</Eyebrow>}
        <H2 center>{title}</H2>
        {body && (
          <Body muted center>
            {body}
          </Body>
        )}
      </View>
      {children}
      {(action || secondary) && (
        <View style={{ gap: space.sm }}>
          {action && <Button label={action.label} loading={action.loading} onPress={action.onPress} />}
          {secondary && <Button variant={action ? 'ghost' : 'secondary'} label={secondary.label} onPress={secondary.onPress} />}
        </View>
      )}
    </>
  );

  if (shape === 'screen')
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color.bg, paddingHorizontal: layout.gutter, justifyContent: 'center' }}>
        <View style={{ width: '100%', maxWidth: layout.readingWidth, alignSelf: 'center', gap: space.lg }}>{content}</View>
      </SafeAreaView>
    );
  return <Card style={{ padding: space.xl, gap: space.lg }}>{content}</Card>;
}

/** "Couldn't load this one. Your progress is safe. Try again." with a retry, and optionally a way back. */
export function LoadError({ onRetry, retrying, onBack, layout: shape = 'card' }: { onRetry: () => void; retrying?: boolean; onBack?: () => void; layout?: 'card' | 'screen' | 'inline' }) {
  return (
    <StateBlock
      spot="error.load"
      art="error-plug"
      layout={shape}
      announce
      title={LOAD_ERROR.title}
      body={LOAD_ERROR.body}
      action={{ label: retrying ? 'Trying again' : LOAD_ERROR.retry, onPress: onRetry, loading: retrying }}
      secondary={onBack ? { label: 'Back', onPress: onBack } : undefined}
    />
  );
}

/**
 * Signed in, but the server couldn't be reached to load progress. Shown in
 * place of a tab's content (the tab bar stays), with a retry; the app also
 * retries by itself when it comes back to the foreground or back online.
 */
export function OfflineState({ onRetry, retrying }: { onRetry: () => void; retrying?: boolean }) {
  return (
    <StateBlock
      layout="screen"
      spot="error.load"
      art="offline"
      announce
      eyebrow="Offline"
      title="Couldn’t reach BrainScroll."
      body="Your progress is safe on your account. Check your connection, then try again."
      action={{ label: retrying ? 'Trying again' : 'Try again', onPress: onRetry, loading: retrying }}
    />
  );
}
