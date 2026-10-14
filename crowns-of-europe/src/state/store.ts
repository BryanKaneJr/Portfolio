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
import { MAP_REGION, MAP_SEA, bindDisplay } from '../sim/content';
import { battleResult, offerTitle } from '../ui/describe';
import { buzz } from '../ui/haptics';
import { FAST, SPEEDS, allowedSpeed } from './speed';
export { FAST, SPEEDS, SPEED_LABELS, allowedSpeed } from './speed';

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
  | { kind: 'moment'; ids: string[]; back?: Overlay } // great turns of the game (log.ts moment()), one card for a batch
  | { kind: 'help' };
export type MenuTab = 'military' | 'diplomacy' | 'economy' | 'science' | 'colonies' | 'missions' | 'ledger' | 'settings';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad';
  /** Where tapping the notice leads (an offer's card, a battle report). */
  action?: () => void;
  /** The offer or battle report it announces: the notice goes when that does. */
  offer?: string;
  report?: string;
  /** The moment it announces (a banner: log.ts moment()). */
  moment?: string;
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
  /** Commands run so far (the goal strip recomputes after each). */
  runs = 0;
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
  /** Offers the settings pause for that arrived while another offer's card was up: shown next, in turn. */
  private queuedOffers: string[] = [];
  /** Moments already announced, and moment cards waiting behind an offer, report or event card. */
  private knownMoments = new Set<string>();
  private queuedMoments: string[] = [];

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
    // A new campaign gets its own id here (the sim never reads the clock), so it keeps its own autosave.
    s.campaign ??= `${s.player}-${Date.now().toString(36)}`;
    this.state = s;
    bindDisplay(s);
    this.selection = null;
    this.overlay = null;
    this.paused = true;
    this.mapMode = 'political';
    // The last game's notices and waiting cards are not this one's.
    this.toasts = [];
    this.queuedOffers = [];
    this.resumeOnClose = false;
    this.lastSavedYear = dateOf(s.day).year;
    // What was already waiting in the save is under the bell; only what arrives from now on is announced.
    this.knownOffers = new Set(s.offers.map(o => o.id));
    this.knownReports = new Set(s.reports.map(r => r.id));
    this.knownMoments = new Set((s.moments ?? []).map(m => m.id));
    this.queuedMoments = [];
    invalidateMods();
    this.emit(true);
  }

  unload() {
    this.stop();
    this.state = null;
    bindDisplay(null);
    this.emit(true);
  }

  /** Run a command against the state, show its message, re-render. */
  run(cmd: (s: GameState) => Result, opts: { quiet?: boolean; map?: boolean } = {}): Result {
    if (!this.state) return { ok: false, msg: 'No game' };
    const r = cmd(this.state);
    if (r.ok) buzz();
    this.runs++;
    invalidateMods();
    // A moment card that opens says it better than the command's own notice.
    const card = this.notify();
    if (r.msg && !(opts.quiet && r.ok) && !card) this.toast(r.msg, r.ok ? 'info' : 'bad');
    this.emit(opts.map ?? true);
    return r;
  }

  /** A notice under the top bar (at most three at once). With an action, tapping it goes there. */
  toast(text: string, tone: Toast['tone'] = 'info', action?: () => void, about?: { offer?: string; report?: string; moment?: string }) {
    const t: Toast = { id: ++this.toastSeq, text, tone, ...(action ? { action } : {}), ...about };
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
   * opens its card and stops the clock (one at a time: those that come while a card is up are queued, and open in turn
   * as each is answered or set aside); any other offer, and each of the player's battles, drops in as a notice that
   * opens it when tapped, and waits under the bell until answered or read. Also closes a card, and drops a notice,
   * whose offer or report is gone. New moments: banners drop in as notices; cards open together as one (true if
   * they did).
   */
  notify(): boolean {
    const s = this.state;
    if (!s) return false;
    // Runs every frame: the sets are rebuilt only when something came or went.
    let fresh = false;
    for (const o of s.offers) {
      if (this.knownOffers.has(o.id)) continue;
      fresh = true;
      const why = offerPause(s, o);
      if (s.settings.autoPause[why]) {
        if (this.overlay?.kind !== 'offer') this.open({ kind: 'offer', id: o.id });
        else this.queuedOffers.push(o.id);
        this.paused = true;
      } else
        this.toast(offerTitle(o), why === 'ultimatum' || why === 'allyAttacked' ? 'bad' : 'info', () => this.openFromNotice({ kind: 'offer', id: o.id }), { offer: o.id });
    }
    const offersChanged = fresh || this.knownOffers.size !== s.offers.length;
    if (offersChanged) this.knownOffers = new Set(s.offers.map(o => o.id));
    fresh = false;
    for (const r of s.reports) {
      if (this.knownReports.has(r.id)) continue;
      fresh = true;
      if (r.playerSide === null) continue;
      this.toast(battleResult(r), r.winner === r.playerSide ? 'good' : 'bad', () => this.openFromNotice({ kind: 'report', id: r.id }), { report: r.id });
    }
    const reportsChanged = fresh || this.knownReports.size !== s.reports.length;
    if (reportsChanged) this.knownReports = new Set(s.reports.map(r => r.id));
    // A notice for an offer answered or withdrawn (or a report that has dropped out of the list) goes with it.
    if ((offersChanged || reportsChanged) && this.toasts.some(t => (t.offer && !this.knownOffers.has(t.offer)) || (t.report && !this.knownReports.has(t.report)))) {
      this.toasts = this.toasts.filter(t => !(t.offer && !this.knownOffers.has(t.offer)) && !(t.report && !this.knownReports.has(t.report)));
    }
    if (this.cardGone()) this.leaveCard();
    return this.announceMoments();
  }

  /** New moments since the last look: banners as notices (tap for the moment), cards queued and opened as one. True
   * if a card opened or is waiting its turn. */
  private announceMoments(): boolean {
    const list = this.state?.moments ?? [];
    let card = false;
    for (const m of list) {
      if (this.knownMoments.has(m.id)) continue;
      this.knownMoments.add(m.id);
      if (m.card) {
        this.queuedMoments.push(m.id);
        card = true;
      } else this.toast(m.title, m.tone, () => this.showMoment(m.id), { moment: m.id });
    }
    return this.openMoments() || card;
  }

  /**
   * Open the moment cards waiting, as one card. They wait their turn behind an offer, report or event card, and
   * behind the war and declaration panels (which close themselves once their command has run). New ones join a
   * moment card already up. A card stops the clock, and lets it run on when closed if it was running.
   */
  private openMoments(): boolean {
    const s = this.state;
    const ov = this.overlay;
    const behind = ov?.kind === 'offer' || ov?.kind === 'report' || ov?.kind === 'peace' || ov?.kind === 'declareWar';
    if (!s || !this.queuedMoments.length || behind || s.pendingEvents.length || s.gameOver) return false;
    const ids = this.queuedMoments.filter(id => s.moments?.some(m => m.id === id));
    this.queuedMoments = [];
    if (!ids.length) return false;
    if (ov?.kind === 'moment') {
      this.overlay = { ...ov, ids: [...ov.ids, ...ids] };
      this.emit();
      return true;
    }
    const running = !this.paused;
    this.open({ kind: 'moment', ids, ...(ov && ov.kind !== 'breakdown' ? { back: ov } : {}) });
    this.resumeOnClose = running;
    return true;
  }

  /** A banner tapped: one with a place shows it on the map; the others open as a card. */
  showMoment(id: string) {
    const m = this.state?.moments?.find(x => x.id === id);
    if (!m) {
      this.toast('That has already passed.');
      return;
    }
    const at = !m.card && m.node ? (MAP_REGION[m.node]?.label ?? MAP_SEA[m.node]?.label) : undefined;
    if (at) this.focusOn(at[0], at[1]);
    else this.openFromNotice({ kind: 'moment', ids: [id] });
  }

  /** The offer or report card up is for something no longer there (answered, withdrawn, lapsed, dropped from the list). */
  cardGone(): boolean {
    const s = this.state;
    const ov = this.overlay;
    if (!s) return false;
    if (ov?.kind === 'offer') return !s.offers.some(o => o.id === ov.id);
    if (ov?.kind === 'report') return !s.reports.some(r => r.id === ov.id);
    return false;
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
    if (o?.kind === 'offer' && this.queuedOffers.includes(o.id)) this.queuedOffers = this.queuedOffers.filter(id => id !== o.id);
    if (o && o.kind !== 'breakdown') this.setPaused(true);
    this.emit();
  }
  close() {
    if (this.openQueued()) return;
    const resume = this.resumeOnClose;
    this.resumeOnClose = false;
    this.overlay = null;
    if (resume) this.setPaused(false);
    this.openMoments();
    this.emit();
  }
  /**
   * Open a card from its notice: time stops while it is read, and runs on afterwards if it was running. A notice can
   * outlive what it announced (answered from the messages, withdrawn, lapsed): then it only says so.
   */
  openFromNotice(o: Overlay) {
    const s = this.state;
    if (!s) return;
    if ((o?.kind === 'offer' && !s.offers.some(x => x.id === o.id)) || (o?.kind === 'report' && !s.reports.some(x => x.id === o.id))) {
      this.toast('That has already passed.');
      return;
    }
    const running = !this.paused;
    this.open(o);
    this.resumeOnClose = running;
  }
  /**
   * Close an offer or report card: on to the next offer waiting its turn, else back to the page it was opened from
   * (the messages, a war), else to the map.
   */
  leaveCard() {
    const ov = this.overlay;
    const back = ov?.kind === 'offer' || ov?.kind === 'report' || ov?.kind === 'moment' ? ov.back : undefined;
    if (this.openQueued(back)) return;
    if (back) {
      this.open(back);
      this.openMoments();
    } else this.close();
  }
  /** Open the next queued offer still waiting (it keeps the clock stopped, as its setting asks). */
  private openQueued(back?: Overlay): boolean {
    const s = this.state;
    while (s && this.queuedOffers.length) {
      const id = this.queuedOffers.shift()!;
      if (!s.offers.some(o => o.id === id)) continue;
      this.open({ kind: 'offer', id, ...(back ? { back } : {}) });
      return true;
    }
    return false;
  }
  focusOn(x: number, y: number, zoom?: number) {
    this.focus = { x, y, zoom, seq: (this.focus?.seq ?? 0) + 1 };
    this.emit();
  }

  setSpeed(i: number) {
    const want = Math.max(0, Math.min(SPEEDS.length - 1, i));
    this.speed = allowedSpeed(this.state, want);
    if (this.speed !== want) this.toast('At war: 8× waits for peace');
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
    if (this.speed === FAST && allowedSpeed(s, FAST) !== FAST) {
      this.speed = FAST - 1;
      this.toast('At war: back to 4×', 'bad');
    }
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
