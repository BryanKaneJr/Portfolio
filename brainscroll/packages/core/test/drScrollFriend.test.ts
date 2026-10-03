import { describe, expect, it } from 'vitest';
import { DR_SCROLL_FRIEND, DR_SCROLL_POSTS, DR_SCROLL_QUOTES, drScrollPosts, drScrollStats, drScrollTrophyIds, isDrScroll, nextDrScrollQuote } from '../src/drScrollFriend';
import { EM_DASH } from '../src/editorial';
import { EVERYDAY_POSES, MASCOT_LINE_MAX } from '../src/mascot';
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
  it('posts one off-duty moment a day, newest first, each in an everyday pose', () => {
    expect(new Set(DR_SCROLL_POSTS.map((p) => p.pose)).size).toBe(DR_SCROLL_POSTS.length);
    for (const p of DR_SCROLL_POSTS) {
      expect(EVERYDAY_POSES as readonly string[]).toContain(p.pose);
      expect(p.line, p.line).not.toContain(EM_DASH);
    }
    // Noon: today's post (8 to 11 am) is up, plus the two days before.
    const noon = new Date(2026, 9, 3, 12, 0);
    const posts = drScrollPosts(noon);
    expect(posts).toHaveLength(3);
    expect(new Set(posts.map((p) => p.key)).size).toBe(3);
    expect(new Set(posts.map((p) => p.line)).size).toBe(3);
    for (let i = 1; i < posts.length; i++) expect(Date.parse(posts[i - 1]!.at)).toBeGreaterThan(Date.parse(posts[i]!.at));
    for (const p of posts) expect(Date.parse(p.at)).toBeLessThanOrEqual(noon.getTime());
    // Just after midnight, today's isn't up yet.
    expect(drScrollPosts(new Date(2026, 9, 3, 0, 5))).toHaveLength(2);
    // The same day always gives the same post.
    expect(drScrollPosts(new Date(2026, 9, 3, 23, 0))[0]).toEqual(posts[0]);
  });
  it('visits every moment before repeating one', () => {
    const seen = new Set<string>();
    for (let d = 0; d < DR_SCROLL_POSTS.length; d++) seen.add(drScrollPosts(new Date(2026, 0, 1 + d, 23, 0), 1)[0]!.line);
    expect(seen.size).toBe(DR_SCROLL_POSTS.length);
  });
});
