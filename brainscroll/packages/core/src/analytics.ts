/**
 * Client analytics catalog: the few learning/product-health signals the server
 * can't see for itself. Everything else (first attempts, completions, review
 * recall, the daily cap, account status) is derived server-side from records
 * that already exist (see the 20260929 migration's admin_* functions).
 *
 * Rules (docs/analytics.md):
 *   - Measure learning and product health, never time spent: no durations,
 *     session lengths, scroll depth or "engagement minutes".
 *   - No personal data: no emails, phone numbers, names or free text in props. Props are flat
 *     and typed, and anything not declared here is dropped before sending.
 *   - This list mirrors public.analytics_event_names; the server rejects
 *     unknown names. scripts/test checks the two stay in sync.
 */
type PropType = 'string' | 'number' | 'boolean';

export const ANALYTICS_EVENTS = {
  app_open: { backend: 'string' },
  onboarding_step: { step: 'number' },
  level_exit: { level_id: 'string', card_index: 'number', card_count: 'number' },
  daily_complete_seen: { used: 'number', cap: 'number' },
  sign_in_started: { method: 'string' },
  sign_in_completed: { method: 'string' },
  report_opened: { object_type: 'string' },
  paywall_viewed: { from: 'string' },
  purchase_started: { plan: 'string' },
  subscription_started: { plan: 'string' },
  purchase_restored: { found: 'boolean' },
  choose_for_me_started: { skill_id: 'string', kind: 'string', picks: 'number' },
} as const satisfies Record<string, Record<string, PropType>>;

export type AnalyticsEventName = keyof typeof ANALYTICS_EVENTS;
export type AnalyticsProps = Record<string, string | number | boolean>;
export interface AnalyticsEvent {
  name: AnalyticsEventName;
  props: AnalyticsProps;
  /** Client time (ISO). The server also stamps its own time. */
  at: string;
}

const MAX_STRING = 100;
const LOOKS_LIKE_EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
/** Seven or more digits, allowing phone punctuation: a phone number, never a level id. */
const LOOKS_LIKE_PHONE = /\+?\d(?:[\s().-]*\d){6,}/;

/**
 * Keeps only declared props of the declared type. Strings are capped and
 * anything that looks like an email or phone number is dropped. Returns null for unknown events.
 */
export function sanitizeEvent(name: string, props: Record<string, unknown> = {}, at: Date = new Date()): AnalyticsEvent | null {
  const spec = (ANALYTICS_EVENTS as Record<string, Record<string, PropType>>)[name];
  if (!spec) return null;
  const clean: AnalyticsProps = {};
  for (const [key, type] of Object.entries(spec)) {
    const v = props[key];
    if (typeof v !== type) continue;
    if (type === 'number' && !Number.isFinite(v)) continue;
    if (type === 'string') {
      const s = (v as string).slice(0, MAX_STRING);
      if (LOOKS_LIKE_EMAIL.test(s) || LOOKS_LIKE_PHONE.test(s)) continue;
      clean[key] = s;
    } else clean[key] = v as number | boolean;
  }
  return { name: name as AnalyticsEventName, props: clean, at: at.toISOString() };
}

/** Content report categories (public.report_category) with player-facing labels. */
export const REPORT_CATEGORIES = [
  { id: 'factual', label: 'Something here is wrong' },
  { id: 'confusing_question', label: 'The question is confusing' },
  { id: 'typo', label: 'Typo or grammar' },
  { id: 'media', label: 'Image or media problem' },
  { id: 'other', label: 'Something else' },
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number]['id'];
export const REPORT_MESSAGE_MAX = 1000;

export interface ContentReportInput {
  levelId: string;
  revision: number;
  objectType: 'level' | 'card' | 'question' | 'asset';
  objectId: string;
  category: ReportCategory;
  message?: string;
}
