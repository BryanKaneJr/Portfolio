import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/**
 * BrainScroll's small sound family (roadmap §14). Each event that has a sound
 * names a file in `app/assets/sounds/`. Until the owner adds a file, its entry
 * stays commented out and that event is silent, so the app never depends on
 * sound: everything still reads with sound off.
 *
 * To add one: drop `<name>.m4a` into `app/assets/sounds/` and uncomment its line.
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
  // select: require('../../assets/sounds/select.m4a'),
  // correct: require('../../assets/sounds/correct.m4a'),
  // incorrect: require('../../assets/sounds/incorrect.m4a'),
  // levelComplete: require('../../assets/sounds/level-complete.m4a'),
  // levelUp: require('../../assets/sounds/level-up.m4a'),
  // checkpoint: require('../../assets/sounds/checkpoint.m4a'),
  // milestone: require('../../assets/sounds/milestone.m4a'),
  // mastery: require('../../assets/sounds/mastery.m4a'),
  // unlock: require('../../assets/sounds/unlock.m4a'),
  // chooseTick: require('../../assets/sounds/choose-tick.m4a'),
  // chooseLand: require('../../assets/sounds/choose-land.m4a'),
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
