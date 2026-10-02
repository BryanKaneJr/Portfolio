import type { ComponentType } from 'react';

/** The web build doesn't report crashes (it's a development and test surface); see crash.ts. */
export function initCrashReporting(): void {}
export function withCrashReporting(Root: ComponentType): ComponentType {
  return Root;
}
export const scrubText = (s: string) => s;
