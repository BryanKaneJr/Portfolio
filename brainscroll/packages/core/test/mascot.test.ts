import { describe, expect, it } from 'vitest';
import { EM_DASH } from '../src/editorial';
import { DR_SCROLL_LINES, DR_SCROLL_TIPS, MASCOT_LINE_MAX, MASCOT_POSES, MASCOT_SPOTS, QUIET_MASCOT_POSES } from '../src/mascot';

describe('Dr. Scroll', () => {
  it('has unique poses', () => {
    expect(new Set(MASCOT_POSES).size).toBe(MASCOT_POSES.length);
  });

  it('only uses calm poses in lessons', () => {
    for (const p of QUIET_MASCOT_POSES) expect(MASCOT_POSES).toContain(p);
    for (const loud of ['celebrate', 'clapping', 'mastery']) expect(QUIET_MASCOT_POSES as readonly string[]).not.toContain(loud);
  });

  it('tips use calm poses, because they appear inside lessons and review', () => {
    for (const tip of Object.values(DR_SCROLL_TIPS)) expect(QUIET_MASCOT_POSES as readonly string[]).toContain(tip.pose);
  });

  it('every spot uses a real pose, and lesson spots use calm ones', () => {
    for (const [id, spot] of Object.entries(MASCOT_SPOTS)) {
      expect(MASCOT_POSES, id).toContain(spot.pose);
      if ('lesson' in spot && spot.lesson) expect(QUIET_MASCOT_POSES as readonly string[], id).toContain(spot.pose);
    }
  });

  it('each tip has a spot with the same pose', () => {
    for (const [id, tip] of Object.entries(DR_SCROLL_TIPS)) expect(MASCOT_SPOTS[`tip.${id}` as keyof typeof MASCOT_SPOTS]?.pose).toBe(tip.pose);
  });

  it('keeps every line short and free of em dashes', () => {
    for (const line of [...Object.values(DR_SCROLL_LINES), ...Object.values(DR_SCROLL_TIPS).map((t) => t.line)]) {
      expect(line.length).toBeLessThanOrEqual(MASCOT_LINE_MAX);
      expect(line).not.toContain(EM_DASH);
    }
  });
});
