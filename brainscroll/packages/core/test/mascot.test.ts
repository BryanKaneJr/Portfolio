import { describe, expect, it } from 'vitest';
import { EM_DASH } from '../src/editorial';
import { cardPicturePose, DR_SCROLL_LINES, DR_SCROLL_TIPS, MASCOT_LINE_MAX, MASCOT_POSES, MASCOT_SPOTS, QUIET_MASCOT_POSES, SKILL_GUIDE_POSE } from '../src/mascot';

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

  it('every skill guide wears a real, non-lesson costume', () => {
    for (const [skill, pose] of Object.entries(SKILL_GUIDE_POSE)) {
      expect(MASCOT_POSES, skill).toContain(pose);
      expect(QUIET_MASCOT_POSES as readonly string[], skill).not.toContain(pose);
    }
  });

  it("as a card's picture, takes turns between the skill's costume, its subject's prop and calm poses", () => {
    const astronomy = [0, 1, 2, 3, 4, 5, 6].map((i) => cardPicturePose('skill.science.astronomy', 4, i));
    expect(astronomy).toContain('telescope');
    expect(astronomy).toContain('science');
    for (let i = 1; i < astronomy.length; i++) expect(astronomy[i]).not.toBe(astronomy[i - 1]);
    // A skill with no costume, in a subject with no prop: calm poses only.
    for (let i = 0; i < 10; i++) expect(QUIET_MASCOT_POSES as readonly string[]).toContain(cardPicturePose('skill.mind.logic', 1, i));
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => cardPicturePose('skill.world_systems.government', 1, i))).toContain('world-systems');
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
