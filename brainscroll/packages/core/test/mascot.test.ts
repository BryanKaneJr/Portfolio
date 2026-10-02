import { describe, expect, it } from 'vitest';
import { EM_DASH } from '../src/editorial';
import { cardPicturePose, CARD_PICTURE_POSES, SKILL_ACTION_POSES, DR_SCROLL_SAYINGS, drScrollSaying, MIN_SAYINGS_PER_MOMENT, DR_SCROLL_LINES, DR_SCROLL_TIPS, MASCOT_LINE_MAX, MASCOT_POSES, MASCOT_SPOTS, QUIET_MASCOT_POSES, SKILL_GUIDE_POSE } from '../src/mascot';

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

  it('each skill acts in real poses, including its map costume', () => {
    for (const [skill, poses] of Object.entries(SKILL_ACTION_POSES)) for (const p of poses) expect(MASCOT_POSES, skill).toContain(p);
    for (const [skill, pose] of Object.entries(SKILL_GUIDE_POSE)) expect(SKILL_ACTION_POSES[skill], skill).toContain(pose);
    expect(CARD_PICTURE_POSES as readonly string[]).not.toContain('thinking');
  });

  it("as a card's picture, takes turns between the skill's actions, its subject's prop and calm poses", () => {
    const astronomy = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => cardPicturePose('skill.science.astronomy', 4, i));
    for (const p of ['telescope', 'space-helmet', 'juggling-planets']) expect(astronomy).toContain(p);
    const music = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => cardPicturePose('skill.arts.music', 1, i));
    expect(music).toContain('piano');
    expect(astronomy).toContain('science');
    for (let i = 1; i < astronomy.length; i++) expect(astronomy[i]).not.toBe(astronomy[i - 1]);
    // A skill with no actions, in a subject with no prop: calm poses only.
    for (let i = 0; i < 10; i++) expect(QUIET_MASCOT_POSES as readonly string[]).toContain(cardPicturePose('skill.mind.logic', 1, i));
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => cardPicturePose('skill.world_systems.government', 1, i))).toContain('world-systems');
  });

  it('each tip has a spot with the same pose', () => {
    for (const [id, tip] of Object.entries(DR_SCROLL_TIPS)) expect(MASCOT_SPOTS[`tip.${id}` as keyof typeof MASCOT_SPOTS]?.pose).toBe(tip.pose);
  });

  it('keeps every line short and free of em dashes', () => {
    for (const line of [...Object.values(DR_SCROLL_LINES), ...Object.values(DR_SCROLL_SAYINGS).flat(), ...Object.values(DR_SCROLL_TIPS).map((t) => t.line)]) {
      expect(line.length).toBeLessThanOrEqual(MASCOT_LINE_MAX);
      expect(line).not.toContain(EM_DASH);
    }
  });

  it(`has at least ${MIN_SAYINGS_PER_MOMENT} different lines for every moment that comes round again`, () => {
    for (const [moment, lines] of Object.entries(DR_SCROLL_SAYINGS)) {
      expect(lines.length, moment).toBeGreaterThanOrEqual(MIN_SAYINGS_PER_MOMENT);
      expect(new Set(lines).size, moment).toBe(lines.length);
    }
  });

  it('never says the same thing on the next level or the next day', () => {
    for (const moment of Object.keys(DR_SCROLL_SAYINGS) as (keyof typeof DR_SCROLL_SAYINGS)[])
      for (let n = 1; n < 30; n++) expect(drScrollSaying(moment, 'skill.science.astronomy', n)).not.toBe(drScrollSaying(moment, 'skill.science.astronomy', n + 1));
  });
});
