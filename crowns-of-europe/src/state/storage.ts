/** Saves (an autosave per campaign, the 3 newest kept, + 3 manual slots), settings and lifetime achievements in AsyncStorage. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { displayIn } from '../sim/content';
import { migrateSave } from '../sim/state';
import type { GameState } from '../sim/types';
import { formatShortDate } from '../sim/util';

/** 'auto' is the autosave of the game being saved (`auto-<campaign>`; old saves keep the plain 'auto'). */
export type SlotId = 'auto' | '1' | '2' | '3' | `auto-${string}`;
export const SLOTS: SlotId[] = ['auto', '1', '2', '3'];
/** How many campaigns keep an autosave. */
export const AUTOSAVES_KEPT = 3;

export const isAutoSlot = (slot: SlotId): boolean => slot === 'auto' || slot.startsWith('auto-');
/** Where a game autosaves: its campaign's own slot. */
export const autoSlot = (s: GameState): SlotId => (s.campaign && s.campaign !== 'old' ? `auto-${s.campaign}` : 'auto');

export interface SaveMeta {
  slot: SlotId;
  nation: string;
  nationName: string;
  /** The greater crown the player had proclaimed, for its arms on the title screen. */
  crown?: string;
  date: string;
  day: number;
  savedAt: number;
  ironman: boolean;
}

const key = (slot: SlotId) => `coe.save.${slot}`;
const META = 'coe.saves';

export async function saveGame(given: SlotId, s: GameState): Promise<void> {
  const slot = given === 'auto' ? autoSlot(s) : given;
  // The message log is UI history; trim it to keep saves small.
  const data = JSON.stringify({ ...s, log: s.log.slice(0, 40) });
  await AsyncStorage.setItem(key(slot), data);
  const metas = await listSaves();
  const meta: SaveMeta = {
    slot,
    nation: s.player,
    nationName: displayIn(s, s.player).name,
    crown: s.nations[s.player]?.crown,
    date: formatShortDate(s.day),
    day: s.day,
    savedAt: Date.now(),
    ironman: s.settings.ironman,
  };
  let next = [...metas.filter(m => m.slot !== slot), meta];
  if (isAutoSlot(slot)) {
    // Each campaign has its own autosave; only the newest few are kept.
    const old = next
      .filter(m => isAutoSlot(m.slot))
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(AUTOSAVES_KEPT);
    for (const m of old) await AsyncStorage.removeItem(key(m.slot));
    next = next.filter(m => !old.includes(m));
  }
  await AsyncStorage.setItem(META, JSON.stringify(next));
}

export async function loadGame(slot: SlotId): Promise<GameState | null> {
  try {
    const raw = await AsyncStorage.getItem(key(slot));
    if (!raw) return null;
    return migrateSave(JSON.parse(raw) as GameState);
  } catch {
    return null;
  }
}

export async function listSaves(): Promise<SaveMeta[]> {
  try {
    const raw = await AsyncStorage.getItem(META);
    return raw ? (JSON.parse(raw) as SaveMeta[]) : [];
  } catch {
    return [];
  }
}

export async function deleteSave(slot: SlotId): Promise<void> {
  await AsyncStorage.removeItem(key(slot));
  const metas = await listSaves();
  await AsyncStorage.setItem(META, JSON.stringify(metas.filter(m => m.slot !== slot)));
}

export async function latestSave(): Promise<SaveMeta | null> {
  const metas = await listSaves();
  return metas.sort((a, b) => b.savedAt - a.savedAt)[0] ?? null;
}

// ---------------------------------------------------------------- lifetime achievements & prefs

const ACH = 'coe.achievements';
export async function loadAchievements(): Promise<string[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(ACH)) ?? '[]');
  } catch {
    return [];
  }
}
export async function recordAchievements(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const have = await loadAchievements();
  const next = [...new Set([...have, ...ids])];
  await AsyncStorage.setItem(ACH, JSON.stringify(next));
}

export interface Prefs {
  hintsSeen: string[];
  speed: number;
  mapStyle?: string;
}
const PREFS = 'coe.prefs';
export async function loadPrefs(): Promise<Prefs> {
  try {
    return { hintsSeen: [], speed: 1, ...JSON.parse((await AsyncStorage.getItem(PREFS)) ?? '{}') };
  } catch {
    return { hintsSeen: [], speed: 1 };
  }
}
export async function savePrefs(p: Prefs): Promise<void> {
  await AsyncStorage.setItem(PREFS, JSON.stringify(p));
}
