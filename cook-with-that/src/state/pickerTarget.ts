import type { ChipVariant } from '../components/Chip';
import { DEFAULT_STAPLE_IDS } from '../data/staples';
import { useAppState } from './AppState';

/** Which list an ingredient tap edits. */
export type PickerTarget = 'pick' | 'pantry' | 'staples';

export const isPickerTarget = (v: unknown): v is PickerTarget => v === 'pick' || v === 'pantry' || v === 'staples';

/**
 * Pick-mode suggestions skip generic basics (oil, flour, butter, spices) — choosing
 * them as a "Use" ingredient barely narrows anything. Fixed list, independent of the
 * pantry-only staples setting. They're still reachable via search and More options.
 */
const TOO_GENERIC_TO_SUGGEST: ReadonlySet<string> = new Set(DEFAULT_STAPLE_IDS);

export type PickerConfig = {
  variantFor: (id: string) => ChipVariant;
  onPick: (id: string) => void;
  hintFor: (id: string) => string;
  stateLabelFor: (id: string) => string;
  chipHintFor: (id: string) => string | undefined;
  /** Hidden from "Most common" suggestions. */
  excludeFromSuggestions: ReadonlySet<string>;
  placeholder: string;
  searchLabel: string;
};

/**
 * One place that defines how an ingredient chip looks and what a tap does for each
 * target, so the inline browser and the full "More options" screen always agree.
 */
export function usePickerConfig(target: PickerTarget): PickerConfig {
  const app = useAppState();

  if (target === 'pick') {
    const { search, mode } = app;
    const inUse = (id: string) => search.useIds.includes(id);
    const inAvoid = (id: string) => search.avoidIds.includes(id);
    return {
      variantFor: id => (inUse(id) ? 'use' : inAvoid(id) ? 'avoid' : 'neutral'),
      onPick: app.pick,
      hintFor: id =>
        (mode === 'use' ? inUse(id) : inAvoid(id))
          ? 'Removes it'
          : mode === 'use'
            ? 'Adds to Use list'
            : 'Adds to Avoid list',
      stateLabelFor: id => (inUse(id) ? ', in Use list' : inAvoid(id) ? ', in Avoid list' : ''),
      chipHintFor: () => undefined,
      excludeFromSuggestions: TOO_GENERIC_TO_SUGGEST,
      placeholder: 'Search ingredients...',
      searchLabel: `Search ingredients to ${mode}`,
    };
  }

  if (target === 'pantry') {
    const { pantry, staples } = app;
    const isStapleOnly = (id: string) => staples.has(id) && !pantry.includes(id);
    return {
      variantFor: id => (pantry.includes(id) || staples.has(id) ? 'use' : 'neutral'),
      onPick: id => (isStapleOnly(id) ? app.toggleStaple(id) : app.togglePantry(id)),
      hintFor: id =>
        isStapleOnly(id)
          ? 'Stops assuming you have this staple'
          : pantry.includes(id)
            ? 'Removes it from your pantry'
            : 'Adds it to your pantry',
      stateLabelFor: id => (isStapleOnly(id) ? ', kitchen staple' : pantry.includes(id) ? ', in pantry' : ''),
      chipHintFor: id => (isStapleOnly(id) ? 'staple' : undefined),
      excludeFromSuggestions: staples,
      placeholder: 'Search to add to pantry...',
      searchLabel: 'Search ingredients to add to your pantry',
    };
  }

  const set = new Set(app.stapleIds);
  return {
    variantFor: id => (set.has(id) ? 'use' : 'neutral'),
    onPick: app.toggleStaple,
    hintFor: id => (set.has(id) ? 'Stops assuming you have it' : 'Assumes you always have it'),
    stateLabelFor: id => (set.has(id) ? ', assumed staple' : ''),
    chipHintFor: () => undefined,
    excludeFromSuggestions: set,
    placeholder: 'Search to add a staple...',
    searchLabel: 'Search ingredients to add as a staple',
  };
}
