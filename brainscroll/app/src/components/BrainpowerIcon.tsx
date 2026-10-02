import { UiArt } from '@/components/ui';

/**
 * Brainpower's brain (docs/images-brainpower.md): lit while there's some to
 * spend, resting grey at 0, and the gold brain on Unlimited, shown with ∞.
 * The gold brain is the one exception to gold-for-mastery (owner,
 * 2026-10-02). Decorative: whatever shows it also says the number in words.
 */
export function BrainpowerIcon({ size, state = 'lit' }: { size: number; state?: 'lit' | 'empty' | 'unlimited' }) {
  return <UiArt name={state === 'empty' ? 'brainpower-empty' : state === 'unlimited' ? 'brainpower-unlimited' : 'brainpower'} size={size} />;
}
