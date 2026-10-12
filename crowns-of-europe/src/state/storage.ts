/** Saves (autosave + 3 manual slots), settings and lifetime achievements in AsyncStorage. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NATION } from '../sim/content';
import { SAVE_VERSION } from '../sim/state';
import type { GameState } from '../sim/types';
import { formatShortDate } from '../sim/util';

export type SlotId = 'auto' | '1' | '2' | '3';
export const SLOTS: SlotId[] = ['auto', '1', '2', '3'];

export interface SaveMeta {
  slot: SlotId;
  nation: string;
  nationName: string;
  date: string;
  day: number;
  savedAt: number;
  ironman: boolean;
}

const key = (slot: SlotId) => `coe.save.${slot}`;
const META = 'coe.saves';

export async function saveGame(slot: SlotId, s: GameState): Promise<void> {
  // The message log is UI history; trim it to keep saves small.
  const data = JSON.stringify({ ...s, log: s.log.slice(0, 40) });
  await AsyncStorage.setItem(key(slot), data);
  const metas = await listSaves();
  const meta: SaveMeta = {
    slot,
    nation: s.player,
    nationName: NATION[s.player]?.name ?? s.player,
    date: formatShortDate(s.day),
    day: s.day,
    savedAt: Date.now(),
    ironman: s.settings.ironman,
  };
  const next = [...metas.filter(m => m.slot !== slot), meta];
  await AsyncStorage.setItem(META, JSON.stringify(next));
}

export async function loadGame(slot: SlotId): Promise<GameState | null> {
  try {
    const raw = await AsyncStorage.getItem(key(slot));
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (s.version !== SAVE_VERSION) return null;
    return s;
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
