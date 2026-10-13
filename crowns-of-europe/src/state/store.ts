/**
 * The running game: one mutable GameState plus UI state (selection, map mode, speed), a game loop that
 * advances days in real time, and a version counter that components subscribe to.
 */
import { useSyncExternalStore } from 'react';
import { advanceDay } from '../sim/tick';
import { offerPause } from '../sim/log';
import { invalidateMods } from '../sim/queries';
import type { GameState, PauseReason } from '../sim/types';
import { dateOf } from '../sim/util';
import { loadPrefs, recordAchievements, saveGame, savePrefs } from './storage';
import type { Result } from '../sim/commands';
import * as commands from '../sim/commands';
import { MAP_REGION, MAP_SEA } from '../sim/content';
import { battleResult, offerTitle } from '../ui/describe';

/** How the map is painted (src/ui/map/styles.ts). A device preference, not part of the saved game. */
export type MapStyleId = 'illustrated' | 'painted' | 'atlas' | 'parchment' | 'flat';
export const MAP_STYLE_IDS: MapStyleId[] = ['illustrated', 'painted', 'atlas', 'parchment', 'flat'];
export type MapMode = 'political' | 'terrain' | 'development' | 'faith' | 'diplomatic' | 'threat' | 'goods' | 'science';
export type Selection =
  | { kind: 'region'; id: string }
  | { kind: 'army'; id: string }
  | { kind: 'fleet'; id: string }
  | { kind: 'nation'; id: string }
  | { kind: 'sea'; id: string }
  | { kind: 'battle'; id: string }
  | null;
export type Overlay =
  | null
  | { kind: 'menu'; tab: MenuTab }
  | { kind: 'log' }
  | { kind: 'peace'; war: string }
  | { kind: 'declareWar'; target: string }
  | { kind: 'breakdown'; what: 'gold' | 'manpower' | 'stability' | 'prestige' | 'threat' }
  | { kind: 'report'; id: string; back?: Overlay } // back: the page it was opened from, where closing it returns
  | { kind: 'offer'; id: string; back?: Overlay }
  | { kind: 'help' };
export type MenuTab = 'military' | 'diplomacy' | 'economy' | 'science' | 'colonies' | 'missions' | 'ledger' | 'settings';

/** Days per real second at each speed (1×, 2×, 4×). */
export const SPEEDS = [1.5, 3, 6];

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad';
  /** Where tapping the notice leads (an offer's card, a battle report). */
  action?: () => void;
}

class GameStore {
  state: GameState | null = null;
  version = 0;
  mapVersion = 0;
  selection: Selection = null;
  mapMode: MapMode = 'political';
  mapStyle: MapStyleId = 'illustrated';
  overlay: Overlay = null;
  speed = 1;
  paused = true;
  lastPause: PauseReason[] = [];
  toasts: Toast[] = [];
  focus: { x: number; y: number; zoom?: number; seq: number } | null = null;
  /** The map camera, published by MapView (read by play-test scripts). */
  camera: { cx: number; cy: number; k: number } | null = null;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastFrame = 0;
  private carry = 0;
  private toastSeq = 0;
  private lastSavedYear = 0;
  /** Offers and battle reports already announced (each is announced once). */
  private knownOffers = new Set<string>();
  private knownReports = new Set<string>();
  /** A card opened from a notice while time ran: closing it lets time run on. */
  private resumeOnClose = false;

  constructor() {
    loadPrefs()
      .then(p => {
        if (MAP_STYLE_IDS.includes(p.mapStyle as MapStyleId) && p.mapStyle !== this.mapStyle) {
          this.mapStyle = p.mapStyle as MapStyleId;
          this.emit(true);
        }
      })
      .catch(() => {});
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;

  emit(map = false) {
    this.version++;
    if (map) this.mapVersion++;
    for (const l of this.listeners) l();
  }

  load(s: GameState) {
    this.stop();
    this.state = s;
    this.selection = null;
    this.overlay = null;
    this.paused = true;
    this.mapMode = 'political';
    this.lastSavedYear = dateOf(s.day).year;
    // What was already waiting in the save is under the bell; only what arrives from now on is announced.
    this.knownOffers = new Set(s.offers.map(o => o.id));
    this.knownReports = new Set(s.reports.map(r => r.id));
    invalidateMods();
    this.emit(true);
  }

  unload() {
    this.stop();
    this.state = null;
    this.emit(true);
  }

  /** Run a command against the state, show its message, re-render. */
  run(cmd: (s: GameState) => Result, opts: { quiet?: boolean; map?: boolean } = {}): Result {
    if (!this.state) return { ok: false, msg: 'No game' };
    const r = cmd(this.state);
    if (r.msg && !(opts.quiet && r.ok)) this.toast(r.msg, r.ok ? 'info' : 'bad');
    invalidateMods();
    this.notify();
    this.emit(opts.map ?? true);
    return r;
  }

  /** A notice under the top bar (at most three at once). With an action, tapping it goes there. */
  toast(text: string, tone: Toast['tone'] = 'info', action?: () => void) {
    const t: Toast = { id: ++this.toastSeq, text, tone, ...(action ? { action } : {}) };
    this.toasts = [...this.toasts.slice(-2), t];
    this.emit();
    setTimeout(() => this.dismissToast(t.id), action ? 5000 : 3200);
  }
  dismissToast(id: number) {
    if (!this.toasts.some(x => x.id === id)) return;
    this.toasts = this.toasts.filter(x => x.id !== id);
    this.emit();
  }

  /**
   * Announce what arrived since the last look. An offer the player pauses for (its setting, as requestPause saw it)
   * opens its card and stops the clock; any other offer, and each of the player's battles, drops in as a notice that
   * opens it when tapped, and waits under the bell until answered or read. Also closes a card whose offer is gone.
   */
  notify() {
    const s = this.state;
    if (!s) return;
    // Runs every frame: the sets are rebuilt only when something came or went.
    let fresh = false;
    for (const o of s.offers) {
      if (this.knownOffers.has(o.id)) continue;
      fresh = true;
      const why = offerPause(o);
      if (s.settings.autoPause[why]) {
        if (this.overlay?.kind !== 'offer') this.open({ kind: 'offer', id: o.id });
        this.paused = true;
      } else this.toast(offerTitle(o), why === 'ultimatum' ? 'bad' : 'info', () => this.openFromNotice({ kind: 'offer', id: o.id }));
    }
    if (fresh || this.knownOffers.size !== s.offers.length) this.knownOffers = new Set(s.offers.map(o => o.id));
    fresh = false;
    for (const r of s.reports) {
      if (this.knownReports.has(r.id)) continue;
      fresh = true;
      if (r.playerSide === null) continue;
      this.toast(battleResult(r), r.winner === r.playerSide ? 'good' : 'bad', () => this.openFromNotice({ kind: 'report', id: r.id }));
    }
    if (fresh || this.knownReports.size !== s.reports.length) this.knownReports = new Set(s.reports.map(r => r.id));
    const ov = this.overlay;
    if (ov?.kind === 'offer' && !s.offers.some(o => o.id === ov.id)) this.leaveCard();
  }

  /** The player has read a battle report. */
  markReportSeen(id: string) {
    if (!this.state) return;
    this.state.unseenReports = this.state.unseenReports.filter(x => x !== id);
    this.emit();
  }

  select(sel: Selection) {
    this.selection = sel;
    this.emit();
  }
  setMapMode(m: MapMode) {
    this.mapMode = m;
    this.emit(true);
  }
  setMapStyle(id: MapStyleId) {
    this.mapStyle = id;
    this.emit(true);
    loadPrefs()
      .then(p => savePrefs({ ...p, mapStyle: id }))
      .catch(() => {});
  }
  open(o: Overlay) {
    this.resumeOnClose = false;
    this.overlay = o;
    if (o && o.kind !== 'breakdown') this.setPaused(true);
    this.emit();
  }
  close() {
    const resume = this.resumeOnClose;
    this.resumeOnClose = false;
    this.overlay = null;
    if (resume) this.setPaused(false);
    this.emit();
  }
  /** Open a card from its notice: time stops while it is read, and runs on afterwards if it was running. */
  openFromNotice(o: Overlay) {
    const running = !this.paused;
    this.open(o);
    this.resumeOnClose = running;
  }
  /** Close an offer or report card: back to the page it was opened from (the messages, a war), else to the map. */
  leaveCard() {
    const ov = this.overlay;
    if ((ov?.kind === 'offer' || ov?.kind === 'report') && ov.back) this.open(ov.back);
    else this.close();
  }
  focusOn(x: number, y: number, zoom?: number) {
    this.focus = { x, y, zoom, seq: (this.focus?.seq ?? 0) + 1 };
    this.emit();
  }

  setSpeed(i: number) {
    this.speed = Math.max(0, Math.min(SPEEDS.length - 1, i));
    this.emit();
  }

  setPaused(p: boolean) {
    if (!this.state) return;
    if (!p && (this.state.gameOver || this.blockingCard())) {
      this.paused = true;
      this.emit();
      return;
    }
    this.paused = p;
    if (!p) this.start();
    this.emit();
  }
  togglePause() {
    this.setPaused(!this.paused);
  }

  /** Cards that need an answer before time can run again: only events (offers wait under the bell). */
  blockingCard(): boolean {
    const s = this.state;
    if (!s) return false;
    return s.pendingEvents.length > 0;
  }

  private start() {
    if (this.timer) return;
    this.lastFrame = Date.now();
    this.carry = 0;
    this.timer = setInterval(this.frame, 50);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private frame = () => {
    const s = this.state;
    if (!s || this.paused) {
      this.stop();
      return;
    }
    const now = Date.now();
    const dt = Math.min(250, now - this.lastFrame);
    this.lastFrame = now;
    this.carry += (dt / 1000) * SPEEDS[this.speed];
    let days = Math.floor(this.carry);
    if (days <= 0) return;
    this.carry -= days;
    days = Math.min(days, 4);
    let map = false;
    const before = s.achievements.length;
    for (let i = 0; i < days; i++) {
      const r = advanceDay(s);
      map ||= r.mapChanged;
      if (r.pause.length) {
        this.lastPause = r.pause;
        this.paused = true;
        this.onPause(r.pause);
        break;
      }
    }
    this.notify();
    if (s.achievements.length > before) recordAchievements(s.achievements.slice(before)).catch(() => {});
    const y = dateOf(s.day).year;
    if (y !== this.lastSavedYear) {
      this.lastSavedYear = y;
      saveGame('auto', s).catch(() => {});
    }
    if (this.paused) this.stop();
    this.emit(map);
  };

  private onPause(reasons: PauseReason[]) {
    const s = this.state!;
    const text: Partial<Record<PauseReason, string>> = {
      warDeclaredOnYou: 'War has been declared on you!',
      battleStarted: 'A battle has begun.',
      siegeWon: 'A fortress has fallen.',
      armyArrived: 'Your army has arrived.',
    };
    for (const r of reasons) if (text[r]) this.toast(text[r]!, r === 'warDeclaredOnYou' ? 'bad' : 'info');
    if (s.gameOver) this.toast(s.gameOver.reason === 'end' ? 'The campaign is over.' : 'Your nation has fallen.', 'bad');
  }
}

export const store = new GameStore();

/** Re-render when the store changes; returns the store for reading. */
export function useStore(): GameStore {
  useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  return store;
}

/** The game state, asserting a game is loaded. */
export function useGame(): GameState {
  useStore();
  if (!store.state) throw new Error('No game loaded');
  return store.state;
}

// Scripted play-testing hook for the web build (scripts/screens.mjs drives the game through it).
if (typeof window !== 'undefined') {
  (window as unknown as { __coe: unknown }).__coe = {
    store,
    commands,
    point: (id: string) => MAP_REGION[id]?.label ?? MAP_SEA[id]?.label,
    /** Run `days` days at once, stopping at an event card or an offer the settings pause for (its card opens). */
    advance(days: number) {
      const s = store.state;
      if (!s) return;
      for (let i = 0; i < days; i++) {
        const r = advanceDay(s);
        if (!r.pause.length) continue;
        store.notify();
        if (s.pendingEvents.length || store.overlay?.kind === 'offer') break;
      }
      store.notify();
      store.emit(true);
    },
  };
}
