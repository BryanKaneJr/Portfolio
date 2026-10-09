// In-process pub/sub for chat SSE. Single-node only; a horizontal deploy
// would swap this for Redis pub/sub or a queue. The API deliberately matches
// what such a swap would need: subscribe(topic, cb) -> unsubscribe fn,
// publish(topic, payload).
const topics = new Map();

const subscribe = (topic, cb) => {
    if (!topics.has(topic)) topics.set(topic, new Set());
    topics.get(topic).add(cb);
    return () => {
        const set = topics.get(topic);
        if (!set) return;
        set.delete(cb);
        if (!set.size) topics.delete(topic);
    };
};

const publish = (topic, payload) => {
    const set = topics.get(topic);
    if (!set) return;
    for (const cb of set) {
        try { cb(payload); } catch { /* subscriber crash must not block others */ }
    }
};

module.exports = { subscribe, publish };
