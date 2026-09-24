import { describe, expect, it } from 'vitest';
import { EM_DASH } from '../src/editorial';
import { DR_SCROLL_LINES, MASCOT_LINE_MAX, MASCOT_POSES, QUIET_MASCOT_POSES } from '../src/mascot';

describe('Dr. Scroll', () => {
  it('has unique poses', () => {
    expect(new Set(MASCOT_POSES).size).toBe(MASCOT_POSES.length);
  });

  it('only uses calm poses in lessons', () => {
    for (const p of QUIET_MASCOT_POSES) expect(MASCOT_POSES).toContain(p);
    for (const loud of ['celebrate', 'clapping', 'mastery'] as const) expect(QUIET_MASCOT_POSES).not.toContain(loud);
  });

  it('keeps every line short and free of em dashes', () => {
    for (const line of Object.values(DR_SCROLL_LINES)) {
      expect(line.length).toBeLessThanOrEqual(MASCOT_LINE_MAX);
      expect(line).not.toContain(EM_DASH);
    }
  });
});
