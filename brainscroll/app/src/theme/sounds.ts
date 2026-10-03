import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/**
 * BrainScroll's small sound family (roadmap §14). Each event that has a sound
 * names a file in `app/assets/sounds/` (the owner's pack, 2026-10-03, trimmed
 * and level-matched). An event without a file stays silent, and the app never
 * depends on sound: everything still reads with sound off.
 *
 * To change one: replace its file in `app/assets/sounds/` (same name).
 * Keep sounds short (under about a second), warm and tonal; never casino or arcade.
 */
export type SoundName =
  | 'select'
  | 'correct'
  | 'incorrect'
  | 'levelComplete'
  | 'levelUp'
  | 'checkpoint'
  | 'milestone'
  | 'mastery'
  | 'unlock'
  | 'chooseTick'
  | 'chooseLand';

const FILES: Partial<Record<SoundName, number>> = {
  select: require('../../assets/sounds/select.wav'),
  correct: require('../../assets/sounds/correct.wav'),
  incorrect: require('../../assets/sounds/incorrect.wav'),
  levelComplete: require('../../assets/sounds/level-complete.wav'),
  levelUp: require('../../assets/sounds/level-up.wav'),
  // The big moments share the level-up sound until they get their own.
  checkpoint: require('../../assets/sounds/level-up.wav'),
  milestone: require('../../assets/sounds/level-up.wav'),
  mastery: require('../../assets/sounds/level-up.wav'),
  unlock: require('../../assets/sounds/unlock.wav'),
  chooseTick: require('../../assets/sounds/choose-tick.wav'),
  chooseLand: require('../../assets/sounds/choose-land.wav'),
};

/** Softer sounds for small moments, fuller for big ones; never loud. */
const VOLUME: Partial<Record<SoundName, number>> = { select: 0.35, chooseTick: 0.3, incorrect: 0.45 };

const players = new Map<SoundName, AudioPlayer>();
let modeSet = false;

export function hasSound(name: SoundName): boolean {
  return FILES[name] !== undefined;
}

/** Plays a sound if its file exists. Never throws; respects the silent switch. */
export function playSound(name: SoundName): void {
  const file = FILES[name];
  if (file === undefined) return;
  try {
    if (!modeSet) {
      modeSet = true;
      // Effects follow the ring/silent switch and mix with the learner's own audio.
      void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
    }
    let p = players.get(name);
    if (!p) {
      p = createAudioPlayer(file);
      p.volume = VOLUME[name] ?? 0.6;
      players.set(name, p);
    }
    void p.seekTo(0).then(() => p.play()).catch(() => {});
  } catch {
    // Sound is decoration; a failure must never interrupt learning.
  }
}

/** True once at least one sound file is registered. */
export function hasAnySound(): boolean {
  return Object.keys(FILES).length > 0;
}
