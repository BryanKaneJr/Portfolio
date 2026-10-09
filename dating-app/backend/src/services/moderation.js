// Minimal content moderation. Two use cases:
//   1. Bio / message / caption text: check against a small banned-word list
//      and a few obvious slur patterns. Anything matching is rejected with 400.
//   2. Image URLs / uploads: for MVP we don't run vision moderation - reports
//      + admin removal handle it. This module exposes the extension point so a
//      real provider (e.g. Sightengine, AWS Rekognition, hive.ai) can be
//      dropped in later.
//
// Real deployment should:
//   - swap `bannedWords` for a maintained blocklist and load it from disk
//   - add a queue-backed vision check for uploaded images
//   - track false positives to tune sensitivity

const bannedWords = [
    // A tiny illustrative set. In production this comes from an external file
    // that can be updated without a deploy. The pattern uses word boundaries
    // so 'assassin' isn't caught by 'ass'.
    'kill yourself',
    'kys',
];

const bannedPatterns = bannedWords.map(
    (w) => new RegExp(`\\b${w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i')
);

const checkText = (text) => {
    if (!text) return { ok: true };
    const trimmed = String(text).trim();
    if (trimmed.length > 5000) return { ok: false, reason: 'too_long' };
    for (const p of bannedPatterns) {
        if (p.test(trimmed)) return { ok: false, reason: 'blocked_content' };
    }
    return { ok: true };
};

// Vision moderation extension point. Currently a no-op that always accepts.
// Real implementations should return { ok: false, reason: 'nsfw' } etc.
const checkImage = async (_url) => ({ ok: true });

module.exports = { checkText, checkImage };
