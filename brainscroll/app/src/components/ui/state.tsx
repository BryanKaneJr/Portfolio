import type { MascotSpot } from '@brainscroll/core';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, layout, space } from '@/theme/tokens';
import { Button } from './button';
import { DrScroll } from './mascot';
import { Card } from './surface';
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
 */
export function StateBlock({
  spot,
  eyebrow,
  eyebrowTone = 'muted',
  title,
  body,
  action,
  secondary,
  layout: shape = 'card',
  children,
}: {
  spot: MascotSpot;
  eyebrow?: string;
  eyebrowTone?: 'muted' | 'brand' | 'success' | 'danger';
  title: string;
  body?: string;
  action?: Action;
  secondary?: Action;
  layout?: 'card' | 'screen' | 'inline';
  children?: ReactNode;
}) {
  if (shape === 'inline')
    return (
      <Card variant="quiet" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
        <DrScroll spot={spot} size="xs" />
        <View style={{ flex: 1, gap: space.xs }} accessibilityLiveRegion="polite">
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
      <DrScroll spot={spot} size="md" style={{ alignSelf: 'center' }} />
      <View style={{ gap: space.sm }} accessibilityLiveRegion="polite">
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
      layout={shape}
      title={LOAD_ERROR.title}
      body={LOAD_ERROR.body}
      action={{ label: retrying ? 'Trying again' : LOAD_ERROR.retry, onPress: onRetry, loading: retrying }}
      secondary={onBack ? { label: 'Back', onPress: onBack } : undefined}
    />
  );
}

/** Home and a skill's map: the app couldn't reach the server, but nothing is lost. */
export function OfflineNotice() {
  return <StateBlock layout="inline" spot="error.load" eyebrow="Offline" title="Couldn’t reach BrainScroll." body="Your progress is safe. Check your connection and reopen the app." />;
}
