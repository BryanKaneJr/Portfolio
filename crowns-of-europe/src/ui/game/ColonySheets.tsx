/**
 * Colonies in the UI: the uncharted New World, uncolonized regions (there and on the African coast), colonies being
 * settled, founded colonies a colonist is growing, and the Colonies tab.
 */
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { ADVANCE, NATION, POLICY, REGION, nationName } from '../../sim/content';
import {
  BASE_COLONIST_DEV,
  COLONY_COST,
  COLONY_GUARD_UPKEEP,
  COLONY_UPKEEP,
  DISCOVERY_YEAR,
  EXPEDITION_COST,
  EXPEDITION_MONTHS,
  GOOD_NAME,
  GROW_SETTLERS,
  HOSTILITY_NAME,
  MAX_GROWN_DEV,
  RAID_MAX,
  RAID_PER_REG,
  SETTLERS_NEEDED,
  attackChance,
  attackLines,
  attackLinesFor,
  canColonize,
  canGrow,
  canSendExpedition,
  charted,
  colonistSources,
  colonistsOf,
  coloniesOf,
  colonySites,
  foundingDev,
  freeColonists,
  goodsIncome,
  growingOf,
  guardOf,
  monthlySettlers,
  newWorldRegions,
  settlerGrowth,
  settlerGrowthFor,
  type ColonistPart,
  type ColonySite,
} from '../../sim/colonies';
import { abandonPlayerColony, colonize, fundExpedition, growColony, setColonyGuard, setColonyPolicy, stopGrowing } from '../../sim/commands';
import { REBELS, armyRegs, seesUnit } from '../../sim/queries';
import { advanceFor } from '../../sim/science';
import type { GameState, NationId, NativePolicy, Region } from '../../sim/types';
import { formatDate, formatShortDate } from '../../sim/util';
import { store, useStore } from '../../state/store';
import { regionPoint } from '../map/geometry';
import { Shield } from '../components/Flag';
import { Icon } from '../components/Icon';
import { Bar, Btn, Empty, HelpButton, HelpNote, Line, Pill, Row, Section, Stat, T } from '../components/kit';
import { C, G, fmt, sans, signed } from '../theme';
import { Sheet } from './Sheet';

// ---------------------------------------------------------------- shared helpers

/** Close the menu and centre the map on a region (its sheet opens). */
function showOnMap(id: string) {
  store.close();
  store.select({ kind: 'region', id });
  store.focusOn(...regionPoint(id));
}

const total = (parts: ColonistPart[]) => parts.reduce((t, p) => t + p.value, 0);
const perMo = (n: number) => `+${fmt(n, 1)}/mo`;
const plus = (n: number) => `+${fmt(n, 1)}`;

/** Time to gather `left` settlers at `perMonth`: "~9 yrs", or under a year "~5 mo". */
function eta(left: number, perMonth: number): string {
  const m = Math.max(1, Math.ceil(Math.max(0, left) / Math.max(1, perMonth)));
  if (m < 12) return `~${m} mo`;
  const y = Math.round(m / 12);
  return `~${y} yr${y > 1 ? 's' : ''}`;
}

/** Days a raid stays news: the colony's sheet and the outliner mark it this long. */
const RAID_NEWS_DAYS = 90;
export const raidedRecently = (s: GameState, r: Region) => r.lastRaid !== undefined && s.day - r.lastRaid <= RAID_NEWS_DAYS;

/** Would the natives attack this colony with nobody guarding it? */
const exposed = (s: GameState, r: Region) => !!r.colony && total(attackLinesFor(s, r.id, r.colony.policy ?? 'force', null)) > 1e-9;

/** Colonists with nothing to do while there is something for them to do (land to settle, or a colony to grow). */
export function idleColonists(s: GameState, n: NationId): number {
  const free = freeColonists(s, n);
  if (free <= 0) return 0;
  const land = Object.values(s.regions).some(r => !r.owner && !r.colony && charted(s, r.id));
  return land || newWorldRegions(s, n).some(r => !canGrow(s, n, r.id)) ? free : 0;
}

/** A breakdown behind a "?": one row per part. `bad` says which values count against you. */
function Parts({ parts, format, bad, note }: { parts: ColonistPart[]; format: (v: number) => string; bad: (v: number) => boolean; note?: string }) {
  return (
    <View style={{ gap: 4 }}>
      {parts.map(p => (
        <View key={p.label} style={styles.part}>
          <Text style={styles.partLabel}>{p.label}</Text>
          <Text style={[styles.partValue, { color: bad(p.value) ? G.bad : G.text }]}>{format(p.value)}</Text>
        </View>
      ))}
      {note ? <Text style={[styles.partLabel, { marginTop: 2 }]}>{note}</Text> : null}
    </View>
  );
}
const settlerFmt = (v: number) => signed(v, v % 1 ? 1 : 0);
const chanceFmt = (v: number) => `${signed(v * 100, 1)}%`;
const pctText = (p: number) => `${fmt(p * 100, p < 0.1 ? 1 : 0)}%`;

/** A two-tap button's state: the first tap arms it for a few seconds, the second does it. */
function useArmed(): [string | null, (k: string | null) => void] {
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return [armed, setArmed];
}

// ---------------------------------------------------------------- sheets

/** A region or sea in the New World before anyone has found it. */
export function UnchartedSheet() {
  const st = useStore();
  const s = st.state!;
  const why = canSendExpedition(s, s.player);
  return (
    <Sheet
      title="Uncharted"
      subtitle="Beyond the western ocean"
      onClose={() => st.select(null)}
      help={`Fund an expedition and you may be the first to find what lies west; by ${DISCOVERY_YEAR} the way becomes common knowledge anyway. Armies and fleets can’t enter uncharted lands and waters.`}
    >
      <T v="small">No ship has come back from these waters yet.</T>
      <View style={{ marginTop: 10, gap: 6 }}>
        <Btn icon="ship" label={s.nations[s.player].expedition ? 'Your expedition is at sea' : 'Fund an expedition west'} sub={s.nations[s.player].expedition ? `Back around ${formatDate(s.nations[s.player].expedition!.done)}` : `${EXPEDITION_COST} gold · back in about ${EXPEDITION_MONTHS} months`} disabled={!!why} onPress={() => st.run(fundExpedition)} testID="expedition" />
        {why && !s.nations[s.player].expedition ? <T v="tiny">{why}</T> : null}
      </View>
    </Sheet>
  );
}

/** Uncolonized land: natives, its export, and settling it (or the colony being settled there). */
export function WildSheet({ id }: { id: string }) {
  const st = useStore();
  const s = st.state!;
  const r = s.regions[id];
  const def = REGION[id];
  const c = r.colony;
  const armiesHere = Object.values(s.armies).filter(a => a.node === id && seesUnit(s, s.player, a.owner, id, a.rebelOf));
  const hostility = def.hostility ?? 0;
  return (
    <Sheet
      title={def.name}
      subtitle={`${def.terrain[0].toUpperCase() + def.terrain.slice(1)} · ${c ? 'Colony being settled' : 'Uncolonized'}${def.good ? ` · ${GOOD_NAME[def.good]}` : ''}`}
      onClose={() => st.select(null)}
      left={c ? <Shield nation={c.by} size={30} /> : undefined}
      help="Uncolonized land belongs to no crown: any army may enter it, but no one can besiege it or win it in a peace."
    >
      <Row gap={6}>
        <Stat label="Natives" value={r.natives > 0 ? `${fmt(r.natives, 1)}k` : 'None'} icon="manpower" />
        <Stat label="Hostility" value={HOSTILITY_NAME[hostility]} tone={hostility >= 2 && r.natives > 0 ? 'bad' : undefined} icon="swords" />
        <Stat label="Export" value={def.good ? GOOD_NAME[def.good] : 'None'} icon="coins" />
      </Row>
      {c ? <ColonySection key={id} id={id} /> : <SettleSection id={id} />}
      {armiesHere.length ? (
        <Section title="Armies here">
          {armiesHere.map(a => (
            <Line key={a.id} label={`${a.owner === REBELS ? 'Rebels' : nationName(a.owner)}: ${a.name}`} value={`${armyRegs(a)} regs`} tone={a.owner === s.player ? 'good' : undefined} />
          ))}
        </Section>
      ) : null}
    </Sheet>
  );
}

/** Starting a colony: where natives live, trade with them or take their land. */
function SettleSection({ id }: { id: string }) {
  const st = useStore();
  const s = st.state!;
  const p = s.player;
  const r = s.regions[id];
  const def = REGION[id];
  const blocked = canColonize(s, p, id);
  const natives = r.natives > 0;
  const hostility = def.hostility ?? 0;
  const pace = (pol: NativePolicy) => Math.max(1, total(settlerGrowthFor(s, p, id, pol)));
  const risk = (pol: NativePolicy) => total(attackLinesFor(s, id, pol, null)) > 1e-9;
  const dev = { trade: foundingDev(s, id, 'trade'), force: foundingDev(s, id, 'force') };
  const cost = `${COLONY_COST} gold`;
  const tradeGist = [risk('trade') ? 'fewer attacks' : 'no attacks', dev.trade > dev.force ? 'richer' : ''].filter(Boolean).join(', ');
  const forceGist = risk('force') ? 'they may attack' : 'no attacks';
  const help = [
    `A colony costs ${cost}, then ${COLONY_UPKEEP} gold a month until ${fmt(SETTLERS_NEEDED)} settlers make it a region of yours; the years are at today's pace.`,
    natives
      ? `Trading with the natives costs your settlers some time, but the natives keep the peace${hostility >= 3 ? ' (fierce ones still attack, half as often)' : ''} and join the colony: prosperity ${dev.trade} at founding here. Taking the land is slower the more natives live on it, they may attack unless guards or troops of yours are there, and fewer of them join (prosperity ${dev.force} here, with today's natives), resenting it for a while. A trading colony can turn to taking the land later, never back.`
      : '',
    def.good ? `Once founded, its ${GOOD_NAME[def.good].toLowerCase()} pays you every month on top of taxes.` : '',
    'Inland land can only be settled from a region of yours next door.',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Section title="Settle it" help={help}>
      <View style={{ gap: 6 }}>
        {natives ? (
          <>
            <Btn tone="secondary" icon="treaty" label="Trade with the natives" sub={`${cost} · ${eta(SETTLERS_NEEDED, pace('trade'))} · ${tradeGist}`} disabled={!!blocked} onPress={() => st.run(x => colonize(x, id, 'trade'))} testID="colonize-trade" />
            <Btn tone="secondary" icon="swords" label="Take the land" sub={`${cost} · ${eta(SETTLERS_NEEDED, pace('force'))} · ${forceGist}`} disabled={!!blocked} onPress={() => st.run(x => colonize(x, id, 'force'))} testID="colonize" />
          </>
        ) : (
          <Btn icon="ship" label="Start a colony" sub={`${cost}, then ${COLONY_UPKEEP} gold/mo · ${eta(SETTLERS_NEEDED, pace('force'))}`} disabled={!!blocked} onPress={() => st.run(x => colonize(x, id))} testID="colonize" />
        )}
        {blocked ? <T v="tiny">{blocked}</T> : null}
      </View>
    </Section>
  );
}

/** A colony being settled: its pace, the natives, raids, guards; for its founder, turning to force and abandoning it. */
function ColonySection({ id }: { id: string }) {
  const st = useStore();
  const s = st.state!;
  const [armed, arm] = useArmed();
  const r = s.regions[id];
  const c = r.colony!;
  const mine = c.by === s.player;
  const per = monthlySettlers(s, r);
  const risk = attackChance(s, r);
  const trade = (c.policy ?? 'force') === 'trade';
  const raided = raidedRecently(s, r);
  // What turning to force would mean: the pace then, and whether the natives would fight.
  const forcePer = Math.max(1, total(settlerGrowthFor(s, c.by, id, 'force')));
  const forceRisk = total(attackLinesFor(s, id, 'force', null)) > 1e-9;
  return (
    <Section
      title={mine ? 'Your colony' : `${nationName(c.by)}’s colony`}
      right={<T v="tiny">{fmt(c.settlers)} / {fmt(SETTLERS_NEEDED)} settlers</T>}
      help={`At ${fmt(SETTLERS_NEEDED)} settlers the colony becomes a region of its founder's; until then it costs ${COLONY_UPKEEP} gold a month. If every settler dies, it is lost.`}
    >
      <Bar value={c.settlers / SETTLERS_NEEDED} color={NATION[c.by]?.color ?? C.gold} height={8} />
      <View style={{ marginTop: 8 }}>
        <Line label="Settlers per month" value={plus(per)} help={<Parts parts={settlerGrowth(s, r)} format={settlerFmt} bad={v => v < 0} />} />
        <Line label="Founded in" value={eta(SETTLERS_NEEDED - c.settlers, per)} />
        {r.natives > 0 || trade ? <Line label="With the natives" value={trade ? 'Trading' : 'Taking the land'} tone="muted" /> : null}
        {r.natives > 0 ? (
          <Line
            label="Native attacks"
            value={risk ? `${pctText(risk)} a month` : 'None'}
            tone={risk ? 'bad' : 'good'}
            help={<Parts parts={attackLines(s, r)} format={chanceFmt} bad={v => v > 0} note={`An attack kills ${fmt(50 + r.natives * 25)} settlers.`} />}
          />
        ) : null}
        {raided ? (
          <Line
            label="Raided by enemy troops"
            value={formatShortDate(r.lastRaid!)}
            tone="bad"
            help={`Enemy troops standing in a colony being settled kill ${RAID_PER_REG} settlers per regiment a month (${RAID_MAX} at most), unless troops of its founder or a friend are there.`}
          />
        ) : null}
        {!mine && c.guard ? <Line label="Guards" value="Paid" tone="muted" /> : null}
      </View>
      {mine && (exposed(s, r) || c.guard) ? <GuardToggle id={id} trade={trade} /> : null}
      {mine ? (
        <View style={{ gap: 6, marginTop: 10 }}>
          {trade && r.natives > 0 ? (
            <Btn
              small
              tone={armed === `force:${id}` ? 'danger' : 'secondary'}
              icon="swords"
              label={armed === `force:${id}` ? 'Tap again: they never trade again' : 'Take the land'}
              sub={armed === `force:${id}` ? undefined : `${eta(SETTLERS_NEEDED - c.settlers, forcePer)} left · ${forceRisk ? 'they may attack' : 'no attacks'}`}
              onPress={() => {
                if (armed !== `force:${id}`) return arm(`force:${id}`);
                arm(null);
                st.run(x => setColonyPolicy(x, id, 'force'));
              }}
              testID="colony-force"
            />
          ) : null}
          <Btn
            small
            tone={armed === `abandon:${id}` ? 'danger' : 'ghost'}
            label={armed === `abandon:${id}` ? (c.settlers >= 1 ? `Tap again: ${fmt(c.settlers)} settlers lost` : 'Tap again to abandon it') : 'Abandon the colony'}
            onPress={() => {
              if (armed !== `abandon:${id}`) return arm(`abandon:${id}`);
              arm(null);
              st.run(x => abandonPlayerColony(x, id));
            }}
            testID="colony-abandon"
          />
        </View>
      ) : null}
    </Section>
  );
}

/** Paid guards on and off, with what they cost and do behind a "?". */
function GuardToggle({ id, trade }: { id: string; trade: boolean }) {
  const st = useStore();
  const s = st.state!;
  const [open, setOpen] = useState(false);
  const r = s.regions[id];
  const paid = !!r.colony?.guard;
  const troops = guardOf(s, r) === 'troops';
  const sub = `${COLONY_GUARD_UPKEEP} gold a month${troops ? ' · your troops guard it now' : ''}`;
  return (
    <View style={{ marginTop: 6 }}>
      <View style={styles.toggle}>
        <View style={{ flex: 1 }}>
          <Row gap={7}>
            <Text style={styles.toggleLabel}>Guard the settlers</Text>
            <HelpButton open={open} onPress={() => setOpen(o => !o)} label="About guards" />
          </Row>
          <Text style={styles.rowSub}>{sub}</Text>
        </View>
        <Switch
          value={paid}
          onValueChange={on => void st.run(x => setColonyGuard(x, id, on))}
          trackColor={{ true: G.goldDeep, false: C.parchmentLine }}
          thumbColor={paid ? G.goldBright : G.text2}
          {...WEB_THUMB}
          accessibilityLabel="Guard the settlers"
          testID="colony-guard"
        />
      </View>
      {open ? (
        <HelpNote style={{ marginTop: 6 }}>
          {`Paid guards keep the natives from attacking${trade ? '' : ' and slowly push them back'}. Any regiment of yours standing here does the same for free, and also keeps enemy troops from raiding the colony; guards don't.`}
        </HelpNote>
      ) : null}
    </View>
  );
}

/** On an owned New World region's sheet: send a colonist to grow it, or follow one already there. */
export function GrowSection({ id }: { id: string }) {
  const st = useStore();
  const s = st.state!;
  const p = s.player;
  const r = s.regions[id];
  const g = r.growing?.by === p ? r.growing : undefined;
  if (!g && r.dev >= MAX_GROWN_DEV) return null;
  const help = `A colonist can bring settlers to a colony of yours: every ${fmt(GROW_SETTLERS)} who arrive raise its prosperity by 1, up to ${MAX_GROWN_DEV}, for ${COLONY_UPKEEP} gold a month. Then the colonist is free again. The time is at today's pace.`;
  if (g) {
    const per = monthlySettlers(s, r);
    return (
      <Section title="Settlers" right={<T v="tiny">{fmt(g.settlers)} / {fmt(GROW_SETTLERS)}</T>} help={help}>
        <Bar value={g.settlers / GROW_SETTLERS} color={C.green} height={8} />
        <View style={{ marginTop: 8 }}>
          <Line label="Settlers per month" value={plus(per)} help={<Parts parts={settlerGrowth(s, r)} format={settlerFmt} bad={v => v < 0} />} />
          <Line label={`Prosperity ${r.dev + 1} in`} value={eta(GROW_SETTLERS - g.settlers, per)} />
        </View>
        <Btn small tone="ghost" label="Stop sending settlers" onPress={() => st.run(x => stopGrowing(x, id))} style={{ marginTop: 8 }} testID="grow-stop" />
      </Section>
    );
  }
  const why = canGrow(s, p, id);
  const pace = Math.max(1, total(settlerGrowthFor(s, p, id, 'force', true)));
  return (
    <Section title="Settlers" help={help}>
      <View style={{ gap: 6 }}>
        <Btn tone="secondary" icon="ship" label="Grow this colony" sub={`${COLONY_UPKEEP} gold/mo · uses a colonist · ${eta(GROW_SETTLERS, pace)} per prosperity`} disabled={!!why} onPress={() => st.run(x => growColony(x, id))} testID="grow" />
        {why ? <T v="tiny">{why}</T> : null}
      </View>
    </Section>
  );
}

// ---------------------------------------------------------------- the Colonies tab

/** One colony being settled: settlers so far, the pace, and how it stands. Tap to see it on the map. */
function SettlingRow({ s, r }: { s: GameState; r: Region }) {
  const c = r.colony!;
  const per = monthlySettlers(s, r);
  const tags: { text: string; bad?: boolean }[] = [];
  if ((c.policy ?? 'force') === 'trade') tags.push({ text: 'trading' });
  if (raidedRecently(s, r)) tags.push({ text: 'raided', bad: true });
  if (attackChance(s, r) > 0) tags.push({ text: 'at risk', bad: true });
  else if (c.guard || (guardOf(s, r) && exposed(s, r))) tags.push({ text: 'guarded' });
  return (
    <Pressable onPress={() => showOnMap(r.id)} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${REGION[r.id].name}: show on the map`} testID={`settling-${r.id}`}>
      <View style={{ flex: 1, gap: 5 }}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {REGION[r.id].name}
          </Text>
          <Text style={styles.rowNum}>
            {fmt(c.settlers)} / {fmt(SETTLERS_NEEDED)}
          </Text>
        </View>
        <Bar value={c.settlers / SETTLERS_NEEDED} color={C.green} />
        <Text style={styles.rowSub} numberOfLines={1}>
          {perMo(per)} · {eta(SETTLERS_NEEDED - c.settlers, per)}
          {tags.map(t => (
            <Text key={t.text} style={t.bad ? { color: G.bad } : undefined}>
              {' · '}
              {t.text}
            </Text>
          ))}
        </Text>
      </View>
      <Icon name="chevron" size={11} color={G.text3} />
    </Pressable>
  );
}

/** One founded colony a colonist is growing: settlers toward the next point of prosperity. */
function GrowingRow({ s, r }: { s: GameState; r: Region }) {
  const g = r.growing!;
  const per = monthlySettlers(s, r);
  return (
    <Pressable onPress={() => showOnMap(r.id)} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${REGION[r.id].name}: show on the map`} testID={`growing-${r.id}`}>
      <View style={{ flex: 1, gap: 5 }}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {REGION[r.id].name}
          </Text>
          <Text style={styles.rowNum}>
            {fmt(g.settlers)} / {fmt(GROW_SETTLERS)}
          </Text>
        </View>
        <Bar value={g.settlers / GROW_SETTLERS} color={C.green} />
        <Text style={styles.rowSub} numberOfLines={1}>
          {perMo(per)} · prosperity {r.dev + 1} in {eta(GROW_SETTLERS - g.settlers, per)}
        </Text>
      </View>
      <Icon name="chevron" size={11} color={G.text3} />
    </Pressable>
  );
}

/** A place to settle: the pace, the years, its export and whether the natives would fight. Tap to see it. */
function SiteRow({ s, site, why }: { s: GameState; site: ColonySite; why: string | null }) {
  const best = Math.max(site.perMonth.force, site.perMonth.trade);
  // Natives who would attack even settlers who trade with them (taking the land, most natives may).
  const fierce = site.natives > 0 && total(attackLinesFor(s, site.id, 'trade', null)) > 1e-9;
  return (
    <Pressable onPress={() => showOnMap(site.id)} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${REGION[site.id].name}: show on the map`} testID={`site-${site.id}`}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, site.blocked ? { color: G.text2 } : null]} numberOfLines={1}>
          {REGION[site.id].name}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {perMo(best)} · {eta(SETTLERS_NEEDED, best)}
          {fierce ? <Text style={{ color: G.bad }}> · at risk</Text> : null}
        </Text>
        {why ? (
          <Text style={[styles.rowSub, { fontStyle: 'italic' }]} numberOfLines={2}>
            {why}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.rowNum}>{site.good ? GOOD_NAME[site.good] : 'No export'}</Text>
        {site.good ? <Text style={styles.rowSub}>+{fmt(site.value, 1)} gold</Text> : null}
      </View>
      <Icon name="chevron" size={11} color={G.text3} />
    </Pressable>
  );
}

const SITES_SHOWN = 8;
/** react-native-web colours a switched-on thumb with its own prop (teal by default). */
const WEB_THUMB = Platform.OS === 'web' ? ({ activeThumbColor: G.goldBright } as object) : {};

/** Realm menu tab: colonists, colonies being settled and grown, where to settle, the New World and expeditions. */
export function ColoniesTab() {
  const st = useStore();
  const s = st.state!;
  const [allSites, setAllSites] = useState(false);
  const p = s.player;
  const me = s.nations[p];
  const sources = colonistSources(s, p);
  const colonists = colonistsOf(s, p);
  const settling = coloniesOf(s, p);
  const growing = growingOf(s, p);
  const owned = newWorldRegions(s, p);
  const goods = owned.reduce((t, r) => t + goodsIncome(s, r), 0);
  const why = canSendExpedition(s, p);
  const sites = colonySites(s, p);
  const shown = allSites ? sites : sites.slice(0, SITES_SHOWN);
  // One reason that holds every shown site back (all colonists busy, short of gold...) is said once, not per row.
  const shared = shown.length && shown.every(x => x.blocked && x.blocked === shown[0].blocked) ? shown[0].blocked : null;
  const busy = settling.length + growing.length;
  const charters = POLICY.overseas_charters?.name ?? 'Overseas Charters';
  return (
    <View>
      {!s.discovery ? (
        <Section
          title="The western ocean"
          help={`Find a New World first for renown and an extra colonist for 30 years; if nobody does, the way west becomes common knowledge in ${DISCOVERY_YEAR}. Closer to home, the African coast from Arguin to the Gold Coast can be settled once you know Caravels.`}
        >
          <View style={{ gap: 6 }}>
            <Btn icon="ship" label={me.expedition ? 'Your expedition is at sea' : 'Fund an expedition west'} sub={me.expedition ? `Back around ${formatDate(me.expedition.done)}` : `${EXPEDITION_COST} gold · back in about ${EXPEDITION_MONTHS} months`} disabled={!!why} onPress={() => st.run(fundExpedition)} testID="menu-expedition" />
            {why && !me.expedition ? <T v="tiny">{why}</T> : null}
          </View>
        </Section>
      ) : (
        <T v="small" style={{ marginBottom: 6 }}>
          New World found {formatDate(s.discovery.day)}
          {s.discovery.by ? ` by ${nationName(s.discovery.by)}` : ''}.
        </T>
      )}
      <Section
        title="Colonists"
        right={<Pill text={`${busy} / ${colonists} busy`} color={colonists ? C.greenSoft : C.parchment2} />}
        help={`Each colonist settles one colony, or grows one of your colonies across the ocean, at a time. A Christian crown with an ocean coast gets one when it learns ${advanceFor('oceanColonies').name}, and a second once it also knows ${ADVANCE.galleons?.name ?? 'Galleons'} and has ${BASE_COLONIST_DEV} prosperity at home. ${charters} (a policy), being first to the New World, events and missions add more.`}
      >
        {sources.length ? sources.map(x => <Line key={x.label} label={x.label} value={signed(x.value)} />) : <Empty text="None yet" />}
      </Section>
      <Section title="Being settled" help={`Settlers a month and the time left until ${fmt(SETTLERS_NEEDED)} found the colony. At risk: the natives may attack; guard it or station troops there. Tap one to see it.`}>
        {settling.length ? settling.map(r => <SettlingRow key={r.id} s={s} r={r} />) : <Empty text="None under way" />}
      </Section>
      {growing.length || owned.length ? (
        <Section title="Growing" help={`A colonist growing a colony of yours: every ${fmt(GROW_SETTLERS)} settlers raise its prosperity by 1, up to ${MAX_GROWN_DEV}, for ${COLONY_UPKEEP} gold a month. To start, tap a colony of yours below, then Grow this colony.`}>
          {growing.length ? growing.map(r => <GrowingRow key={r.id} s={s} r={r} />) : <Empty text="No colony is being grown" />}
        </Section>
      ) : null}
      <Section
        title="Where to settle"
        help={`Land nobody holds, the most worth having first. +N/mo: settlers a month if you began today (trading or taking the land, whichever is quicker), then the years to ${fmt(SETTLERS_NEEDED)}. Gold: its export each month once founded, more as it prospers. At risk: natives fierce enough to attack even settlers who trade with them. Tap one to see it.`}
      >
        {shared ? <T v="tiny" style={{ marginBottom: 2 }}>{shared}</T> : null}
        {shown.length ? shown.map(x => <SiteRow key={x.id} s={s} site={x} why={shared ? null : x.blocked} />) : <Empty text={growing.length || owned.length ? 'No land is left to settle. Grow a colony instead.' : 'No land is left to settle.'} />}
        {sites.length > SITES_SHOWN ? <Btn small tone="ghost" label={allSites ? 'Show fewer' : `Show all ${sites.length}`} onPress={() => setAllSites(a => !a)} style={{ marginTop: 8 }} testID="sites-all" /> : null}
      </Section>
      <Section title="Your lands across the ocean">
        {owned.length ? owned.map(r => <Line key={r.id} label={REGION[r.id].name} value={REGION[r.id].good ? `${GOOD_NAME[REGION[r.id].good!]} +${fmt(goodsIncome(s, r), 1)}` : '–'} onPress={() => showOnMap(r.id)} />) : <Empty text="None yet" />}
        {owned.length > 1 && goods ? <Line label="Exports in all" value={`+${fmt(goods, 1)} gold/mo`} bold /> : null}
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.parchmentLine },
  pressed: { opacity: 0.65 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  rowTitle: { fontFamily: sans, fontSize: 15, fontWeight: '700', color: G.text, flexShrink: 1 },
  rowSub: { fontFamily: sans, fontSize: 12.5, color: G.text3, marginTop: 1 },
  rowNum: { fontFamily: sans, fontSize: 13.5, fontWeight: '700', color: G.text2, fontVariant: ['tabular-nums'] },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.parchmentLine },
  toggleLabel: { fontFamily: sans, fontSize: 15, color: G.text },
  part: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  partLabel: { fontFamily: sans, fontSize: 13, color: G.text2, lineHeight: 18, flexShrink: 1 },
  partValue: { fontFamily: sans, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
