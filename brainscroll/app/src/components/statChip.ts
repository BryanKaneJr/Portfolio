import type { TextStyle, ViewStyle } from 'react-native';
import { depth, radius, space } from '@/theme/tokens';

/**
 * The World Map header's three stat chips (Knowledge Level, Brainpower,
 * streak) share one size: a symbol and a number in a pill. Owner, 2026-10-03:
 * 15% smaller than the first cut (32 px art, 24 pt number).
 */
export const STAT_CHIP_ICON = 27;
export const statChip: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: space.xxs, paddingLeft: space.xs, paddingRight: 10, paddingVertical: 1, borderRadius: radius.pill, borderWidth: depth.border };
export const statChipNumber: TextStyle = { fontSize: 20, letterSpacing: -0.3 };
