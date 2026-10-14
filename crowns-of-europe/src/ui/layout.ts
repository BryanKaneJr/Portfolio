/**
 * Where the floating controls sit on the game screen, shared by the controls themselves and the map (which keeps
 * whatever you select in the clear space between them).
 */
export const TOP_BAR_H = 54;
export const DOCK_H = 60;
/** The goal strip under the top bar (GoalStrip.tsx), when it shows. */
export const GOAL_STRIP_H = 28;

/** The top of the dock, measured from the bottom of the screen: sheets rest on it. */
export const dockTop = (insetBottom: number) => insetBottom + 8 + DOCK_H + 8;

/** How tall a sheet opens. Armies and fleets open compact, so the map around them stays free to tap. */
export const sheetHeight = (screenH: number, compact?: boolean) => (compact ? Math.max(220, screenH * 0.3) : Math.max(260, screenH * 0.42));

/** The strip of map not covered by the top bar, the dock or an open sheet (screen points from the top). */
export function freeBand(screenH: number, insets: { top: number; bottom: number }, sheet: 'none' | 'compact' | 'half', strip = false): { top: number; bottom: number } {
  const top = insets.top + 6 + TOP_BAR_H + 8 + (strip ? GOAL_STRIP_H + 4 : 0);
  const bottom = screenH - dockTop(insets.bottom) - (sheet === 'none' ? 0 : sheetHeight(screenH, sheet === 'compact'));
  return { top, bottom };
}
