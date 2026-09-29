const { buildVisibility } = require('../src/services/storyVisibility');

describe('storyVisibility.buildVisibility', () => {
    test('substitutes viewer with a positional pg param', () => {
        const sql = buildVisibility(1);
        expect(sql).not.toMatch(/\$viewer/);
        expect(sql).toMatch(/\$1/);
    });
    test('includes all three visibility rules', () => {
        const sql = buildVisibility(1);
        // right-swipe (like) -> visible
        expect(sql).toMatch(/swipes/);
        expect(sql).toMatch(/direction = 'like'/);
        // active match -> visible
        expect(sql).toMatch(/matches/);
        expect(sql).toMatch(/unmatched = FALSE/);
        // friend link (unless opted out) -> visible
        expect(sql).toMatch(/friend_links/);
        expect(sql).toMatch(/friend_optout = FALSE/);
        // safety guards
        expect(sql).toMatch(/blocks/);
        expect(sql).toMatch(/is_banned = FALSE/);
        expect(sql).toMatch(/removed = FALSE/);
        expect(sql).toMatch(/expires_at > now\(\)/);
    });
});
