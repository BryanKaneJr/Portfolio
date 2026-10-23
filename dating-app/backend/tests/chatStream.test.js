const chatStream = require('../src/services/chatStream');

describe('chatStream', () => {
    test('subscribers receive published messages for their topic only', () => {
        const gotA = [];
        const gotB = [];
        const unA = chatStream.subscribe('a', (m) => gotA.push(m));
        const unB = chatStream.subscribe('b', (m) => gotB.push(m));

        chatStream.publish('a', { id: 1 });
        chatStream.publish('b', { id: 2 });
        chatStream.publish('a', { id: 3 });

        expect(gotA).toEqual([{ id: 1 }, { id: 3 }]);
        expect(gotB).toEqual([{ id: 2 }]);
        unA(); unB();
    });

    test('unsubscribe removes listener without affecting others', () => {
        const seen = [];
        const un1 = chatStream.subscribe('c', (m) => seen.push('one:' + m.id));
        chatStream.subscribe('c', (m) => seen.push('two:' + m.id));
        chatStream.publish('c', { id: 1 });
        un1();
        chatStream.publish('c', { id: 2 });
        expect(seen).toContain('one:1');
        expect(seen).toContain('two:1');
        expect(seen).toContain('two:2');
        expect(seen).not.toContain('one:2');
    });

    test('a throwing subscriber does not block others', () => {
        const good = [];
        chatStream.subscribe('d', () => { throw new Error('boom'); });
        chatStream.subscribe('d', (m) => good.push(m));
        expect(() => chatStream.publish('d', { id: 42 })).not.toThrow();
        expect(good).toEqual([{ id: 42 }]);
    });
});
