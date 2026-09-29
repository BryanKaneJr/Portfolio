const { pair } = require('../src/services/matching');

describe('matching.pair', () => {
    test('canonicalises so smaller id is always first', () => {
        expect(pair('b', 'a')).toEqual(['a', 'b']);
        expect(pair('a', 'b')).toEqual(['a', 'b']);
    });
    test('is stable across inputs', () => {
        const ids = ['aaa', 'bbb', 'ccc'];
        for (let i = 0; i < ids.length; i++) {
            for (let j = 0; j < ids.length; j++) {
                if (i === j) continue;
                const [x, y] = pair(ids[i], ids[j]);
                expect(x < y).toBe(true);
            }
        }
    });
});
