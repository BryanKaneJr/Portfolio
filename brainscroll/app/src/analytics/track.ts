import { sanitizeEvent, type AnalyticsEvent, type AnalyticsEventName } from '@brainscroll/core';
import { AppState } from 'react-native';
import { load, save } from '@/progress/storage';

/**
 * Tiny batching tracker. Events are sanitized against the core catalog (typed,
 * flat, no PII, no durations), queued on-device (so an app kill or page reload
 * doesn't lose them), and sent through the progress backend in batches:
 * remote builds call log_events, the development harness drops them.
 * Events are only sent under a signed-in account (ProgressProvider holds them while signed out).
 * EXPO_PUBLIC_ANALYTICS=off turns it off entirely. See docs/analytics.md.
 */
type Sender = (events: AnalyticsEvent[]) => Promise<void>;

const ENABLED = process.env.EXPO_PUBLIC_ANALYTICS !== 'off';
const QUEUE_KEY = 'brainscroll.analytics.queue.v1';
const BATCH = 50;
const MAX_QUEUE = 200;
const FLUSH_MS = 2_000;

let queue: AnalyticsEvent[] = [];
let sender: Sender | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

function setQueue(next: AnalyticsEvent[]) {
  queue = next.slice(-MAX_QUEUE);
  void save(QUEUE_KEY, queue);
}

/** Forgets anything queued (after account deletion, so nothing from that account is sent under the next one). */
export function clearAnalytics() {
  setQueue([]);
}

/** Called once the backend is ready; restores anything queued before a restart. */
export async function configureAnalytics(send: Sender | null) {
  sender = send;
  const stored = (await load<AnalyticsEvent[]>(QUEUE_KEY)) ?? [];
  if (stored.length) setQueue([...stored.filter((e) => !queue.some((q) => q.at === e.at && q.name === e.name)), ...queue]);
  if (sender && queue.length) schedule(0);
}

export function track(name: AnalyticsEventName, props: Record<string, unknown> = {}) {
  if (!ENABLED) return;
  const event = sanitizeEvent(name, props);
  if (!event) return;
  setQueue([...queue, event]);
  schedule(queue.length >= BATCH ? 0 : FLUSH_MS);
}

// A fixed cadence, not a debounce: a steady stream of events still gets sent.
function schedule(ms: number) {
  if (timer && ms > 0) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, ms);
}

export async function flush() {
  if (!sender || flushing || queue.length === 0) return;
  flushing = true;
  const batch = queue.slice(0, BATCH);
  try {
    await sender(batch);
    setQueue(queue.filter((e) => !batch.includes(e)));
  } catch {
    // Keep them for the next try; the queue is capped, so this can't grow forever.
  } finally {
    flushing = false;
    if (queue.length) schedule(FLUSH_MS);
  }
}

// Send what we have when the app goes to the background.
AppState.addEventListener?.('change', (s) => {
  if (s !== 'active') void flush();
});
