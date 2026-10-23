const moderation = require('../src/services/moderation');

describe('moderation.checkText', () => {
    test('accepts normal text', () => {
        expect(moderation.checkText('Hey, want to grab coffee?')).toEqual({ ok: true });
    });
    test('accepts empty', () => {
        expect(moderation.checkText('')).toEqual({ ok: true });
        expect(moderation.checkText(null)).toEqual({ ok: true });
    });
    test('rejects extremely long text', () => {
        const r = moderation.checkText('x'.repeat(6000));
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('too_long');
    });
    test('flags banned phrases as blocked_content', () => {
        const r = moderation.checkText('kys');
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('blocked_content');
    });
    test('word-boundary aware (does not overmatch)', () => {
        // The lightweight list intentionally uses word boundaries so common
        // words containing these substrings aren't caught.
        expect(moderation.checkText('kysergic-acid').ok).toBe(true);
    });
});
