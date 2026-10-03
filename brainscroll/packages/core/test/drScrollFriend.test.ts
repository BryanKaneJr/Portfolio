import { describe, expect, it } from 'vitest';
import { DR_SCROLL_FRIEND, DR_SCROLL_QUOTES, drScrollStats, drScrollTrophyIds, isDrScroll, nextDrScrollQuote } from '../src/drScrollFriend';
import { EM_DASH } from '../src/editorial';
import { MASCOT_LINE_MAX } from '../src/mascot';
import { LEGENDARY_AVATARS } from '../src/social';
import { trophyInfo } from '../src/trophies';

const catalog = {
  skills: [{ id: 'skill.science.astronomy', subjectId: 'subject.science', name: 'Astronomy' }],
  subjects: [{ id: 'subject.science', name: 'Science' }],
};

describe('Dr. Scroll, everyone\'s first friend', () => {
  it('has an id no account can have and wears the golden Dr. Scroll', () => {
    expect(DR_SCROLL_FRIEND.id).not.toMatch(/^[0-9a-f]{8}-/);
    expect(isDrScroll('dr-scroll')).toBe(true);
    expect(isDrScroll('00000000-0000-0000-0000-00000000000a')).toBe(false);
    expect(Object.keys(LEGENDARY_AVATARS)).toContain(DR_SCROLL_FRIEND.avatar);
  });
  it('has plenty of short, kind lines that take turns', () => {
    expect(DR_SCROLL_QUOTES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(DR_SCROLL_QUOTES).size).toBe(DR_SCROLL_QUOTES.length);
    for (const q of DR_SCROLL_QUOTES) {
      expect(q.length, q).toBeLessThanOrEqual(MASCOT_LINE_MAX);
      expect(q, q).not.toContain(EM_DASH);
    }
    expect(nextDrScrollQuote(0)).toBe(1);
    expect(nextDrScrollQuote(DR_SCROLL_QUOTES.length - 1)).toBe(0);
  });
  it('holds every trophy and maxed stats', () => {
    const ids = drScrollTrophyIds(catalog);
    expect(ids).toContain('trophy.mastery_astronomy');
    expect(ids).toContain('trophy.subject_science');
    expect(ids).toContain('trophy.master_of_all');
    for (const id of ids) expect(trophyInfo(id, catalog), id).toBeDefined();
    const stats = drScrollStats(2600);
    expect(stats.levels).toBe(2600);
    expect(stats.streakDays).toBe(1000);
    expect(stats.knowledgeLevel).toBeGreaterThan(1);
  });
});
