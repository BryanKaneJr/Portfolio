import { UiArt } from '@/components/ui';

/**
 * Brainpower's brain (docs/images-brainpower.md): lit while there's some to
 * spend, resting grey at 0. Unlimited shows the lit brain for now: its own art
 * came out gold, and gold is for mastery only (design system), so
 * `brainpower-unlimited` waits for the owner's call.
 * Decorative: whatever shows it also says the number in words.
 */
export function BrainpowerIcon({ size, state = 'lit' }: { size: number; state?: 'lit' | 'empty' | 'unlimited' }) {
  return <UiArt name={state === 'empty' ? 'brainpower-empty' : 'brainpower'} size={size} />;
}
