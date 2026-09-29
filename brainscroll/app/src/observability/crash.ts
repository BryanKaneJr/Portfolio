import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';

/**
 * Crash reporting (roadmap launch checklist, "Reliability"). Off until
 * EXPO_PUBLIC_SENTRY_DSN is set; then Sentry gets crashes and unhandled errors
 * only, with nothing personal: no user, no IP, no request data, no screenshots,
 * no session or performance tracking (we never measure time spent), and any
 * email address or phone number in a message is scrubbed before sending.
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || undefined;

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const PHONE = /\+?\d[\d\s().-]{6,}\d/g;
export const scrubText = (s: string) => s.replace(EMAIL, '[email]').replace(PHONE, '[number]');

export function initCrashReporting(): void {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableAutoSessionTracking: false,
    tracesSampleRate: 0,
    // Console lines and network URLs can carry identifiers; navigation and UI breadcrumbs stay.
    beforeBreadcrumb: (b) => (b.category === 'console' || b.category === 'fetch' || b.category === 'xhr' ? null : b),
    beforeSend(event) {
      delete event.user;
      delete event.request;
      delete event.server_name;
      if (event.message) event.message = scrubText(event.message);
      for (const ex of event.exception?.values ?? []) if (ex.value) ex.value = scrubText(ex.value);
      return event;
    },
  });
}

/** Wraps the root component so render crashes are caught and reported (a no-op without a DSN). */
export function withCrashReporting(Root: ComponentType): ComponentType {
  return DSN ? Sentry.wrap(Root as ComponentType<Record<string, unknown>>) as ComponentType : Root;
}
