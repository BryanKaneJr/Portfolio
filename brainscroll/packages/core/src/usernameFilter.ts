/**
 * The username filter (owner, 2026-10-01). Usernames are the one thing
 * learners write that other learners see, so offensive ones are refused when
 * they're set. Mirrors SQL `username_blocked` and the `username_terms` table
 * (migration 20261026000000_username_filter.sql); a scripts test keeps the
 * lists identical.
 *
 * How it works (the usual approach: a term list, normalisation against
 * workarounds, and an allowlist for innocent words that contain a term):
 * - The name is split into parts at underscores. Runs of one-letter parts are
 *   joined, so `f_u_c_k` is read as one word.
 * - Look-alike digits count as letters (`sh1t`, `b00b`), and any letter of a
 *   term may repeat (`fuuuck`).
 * - `ANYWHERE` terms are refused inside any part, except inside an `ALLOWED`
 *   word (`grape`, `therapist`, `scunthorpe`).
 * - `WORD` terms are refused only as a whole part, because they hide inside
 *   ordinary words (`cocktail`, `dickens`, `cucumber`, `sussex`).
 *
 * No list is complete. Reports (and the admin's queue, which also lists
 * existing usernames that fail this filter) catch the rest.
 */

/** Refused anywhere in a part: unambiguous terms, and names that pose as BrainScroll. */
export const USERNAME_ANYWHERE: readonly string[] = [
  // Posing as BrainScroll or its staff
  'brainscroll', 'drscroll', 'admin', 'moderator', 'support', 'official',
  // Profanity
  'fuck', 'shit', 'cunt', 'bitch', 'bastard', 'asshole', 'twat', 'wank', 'motherf',
  // Sexual
  'porn', 'pussy', 'penis', 'vagina', 'dildo', 'blowjob', 'handjob', 'jizz', 'cumshot', 'orgasm', 'masturbat',
  'whore', 'slut', 'milf', 'hentai', 'boner', 'erection', 'genital', 'testicle', 'clitor',
  // Slurs
  'nigg', 'faggot', 'fagg', 'retard', 'tranny', 'dyke', 'wetback', 'beaner', 'gook', 'raghead', 'towelhead', 'chingchong',
  // Violence, abuse and hate
  'rape', 'rapist', 'molest', 'pedo', 'paedo', 'incest', 'bestial', 'nazi', 'hitler', 'kkk', 'swastika', 'whitepower',
  'killyourself', 'suicide', 'jihad', 'terrorist', 'genocide', 'lynch',
];

/** Refused only as a whole part: they hide inside ordinary words. */
export const USERNAME_WORD: readonly string[] = [
  'ass', 'arse', 'dick', 'cock', 'cum', 'sex', 'anal', 'anus', 'tit', 'tits', 'boob', 'boobs', 'nude', 'nudes', 'horny',
  'xxx', 'fag', 'hoe', 'thot', 'spic', 'chink', 'kike', 'coon', 'heil', 'sieg', 'kys', 'nonce', 'prick', 'piss', 'damnit',
];

/** Innocent words that contain an ANYWHERE term. */
export const USERNAME_ALLOWED: readonly string[] = [
  'grape', 'drape', 'scrape', 'trapeze', 'parapet', 'therapist', 'scunthorpe', 'niggle', 'snigger', 'sniggle',
  'torpedo', 'pedometer', 'encyclopedia', 'cyclopedia', 'expedition', 'pedometric', 'orthopedic', 'pedology',
  'badminton', 'lynchburg', 'shitake', 'supportive',
];

/** Look-alike digits read as letters. */
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g' };
const deLeet = (s: string) => s.replace(/[0-9]/g, (d) => LEET[d] ?? d);
const lettersOnly = (s: string) => s.replace(/[^a-z]/g, '');
/** A term as a pattern where each letter may repeat: `fuck` also finds `fuuuck`; `nigg` still needs two g's. */
const stretchy = (term: string) => term.split('').map((c) => `${c}+`).join('');
const ANYWHERE_RE = new RegExp(USERNAME_ANYWHERE.map(stretchy).join('|'));
const ALLOWED_RE = new RegExp(USERNAME_ALLOWED.map(stretchy).join('|'), 'g');
const collapse = (s: string) => s.replace(/(.)\1+/g, '$1');

/** The name's parts: split at underscores, with runs of one-character parts joined (`f_u_c_k` → `fuck`). */
export function usernameParts(name: string): string[] {
  const parts: string[] = [];
  let run = '';
  for (const p of name.trim().toLowerCase().split('_')) {
    if (p.length === 1) run += p;
    else {
      if (run) parts.push(run);
      run = '';
      if (p) parts.push(p);
    }
  }
  if (run) parts.push(run);
  return parts;
}

/** True when a username contains a blocked term (see the module comment). */
export function usernameBlocked(name: string): boolean {
  for (const part of usernameParts(name)) {
    const read = lettersOnly(deLeet(part));
    // Allowed words are cut out first, so `grapes` passes and `grape_rapist` doesn't.
    if (ANYWHERE_RE.test(read.replace(ALLOWED_RE, '_'))) return true;
    // Whole words: the part read with look-alike digits (also with repeats collapsed), and each run of plain letters in it (`dick69`).
    const words = new Set([read, collapse(read), ...part.split(/[^a-z]+/).filter(Boolean)]);
    for (const w of words) if (USERNAME_WORD.includes(w)) return true;
  }
  return false;
}
