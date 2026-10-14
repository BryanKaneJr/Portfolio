/**
 * The realm's one-tap acts (fun batch 2): Crack down (region sheet), Seize estates, Abdicate and the Golden age
 * section (Realm tab), and the gilt sun on your arms while a golden age lasts (top bar). The rules are in
 * sim/realm.ts and sim/rulers.ts; each button shows its price before the tap.
 */
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { NATION, isNativeNation } from '../../sim/content';
import { abdicateRuler, crackDownOn, proclaimGolden, seizeTheEstates } from '../../sim/commands';
import {
  ABDICATE,
  CRACKDOWN,
  GOLDEN,
  GOLDEN_MODS,
  SEIZE,
  canAbdicate,
  commas,
  crackdownBlocked,
  crackdownCost,
  crackdownUntil,
  goldenChecks,
  inGoldenAge,
  seizeBlocked,
  seizeGold,
} from '../../sim/realm';
import { yearOf } from '../../sim/util';
import { useStore } from '../../state/store';
import { Btn, ConfirmBtn, Line, Section, useConfirm } from '../components/kit';
import { G, sans } from '../theme';
import { modLines } from '../describe';

const minus = (v: number) => `−${Math.abs(v)}`;

/** A two-tap button that shows its price (`sub`) before the first tap and again while armed. */
function TwoTap({
  armKey,
  label,
  sub,
  confirm,
  disabled,
  onConfirm,
  tone = 'secondary',
  small,
  testID,
}: {
  armKey: string;
  label: string;
  sub: string;
  confirm: string;
  disabled?: boolean;
  onConfirm: () => void;
  tone?: 'secondary' | 'gold';
  small?: boolean;
  testID: string;
}) {
  const c = useConfirm(armKey);
  if (disabled || !c.armed) return <Btn small={small} tone={tone} label={label} sub={sub} disabled={disabled} onPress={c.arm} style={{ marginTop: 6 }} testID={testID} />;
  return <ConfirmBtn small={small} state={c} armKey={armKey} label={label} confirm={confirm} consequences={[sub]} onConfirm={onConfirm} style={{ marginTop: 6 }} testID={testID} />;
}

/** The Invest section's help sentence on the crackdown's price. */
export const CRACKDOWN_HELP = `A crackdown costs ${CRACKDOWN.menPerProsperity} levies a point of prosperity (at least ${commas(CRACKDOWN.minMen)}).`;
/** The Order and renown section's help on seizing the estates. */
export const SEIZE_HELP = `Seizing the estates takes a year of your taxes at once (not trade or exports); you may do it once every ${SEIZE.cooldownYears} years, with order −1 or better.`;

/** Region sheet, Invest: soldiers keep order for five years, paid in levies. Shown while there is unrest to put down. */
export function CrackDownBtn({ id }: { id: string }) {
  const st = useStore();
  const s = st.state!;
  const r = s.regions[id];
  if (!r || r.owner !== s.player) return null;
  const until = crackdownUntil(s, r);
  if (until === null && r.unrest < 1) return null;
  const why = crackdownBlocked(s, s.player, id);
  const price = `${minus(CRACKDOWN.unrest)} unrest for ${CRACKDOWN.years} years · ${commas(crackdownCost(r))} levies`;
  return (
    <Btn
      tone="secondary"
      icon="rebels"
      label={until !== null ? `Crackdown until ${yearOf(until)}` : 'Crack down'}
      sub={until !== null ? undefined : why ?? price}
      disabled={!!why}
      onPress={() => st.run(x => crackDownOn(x, id))}
      testID="crackdown"
    />
  );
}

/** Realm tab, beside Raise order: a year's taxes at once, for order and unrest; once in ten years. */
export function SeizeEstatesBtn() {
  const st = useStore();
  const s = st.state!;
  const why = seizeBlocked(s, s.player);
  const waiting = why?.startsWith('Seize');
  const price = `+${commas(seizeGold(s, s.player))} gold · order ${minus(SEIZE.order)} · unrest +${SEIZE.unrest} for ${SEIZE.unrestYears} years`;
  return (
    <TwoTap
      small
      armKey="seize"
      label={waiting ? why! : 'Seize estates'}
      sub={waiting ? `once every ${SEIZE.cooldownYears} years` : why ?? price}
      confirm="Tap again to seize"
      disabled={!!why}
      onConfirm={() => st.run(seizeTheEstates)}
      testID="seize"
    />
  );
}

/** Realm tab, under the heir: the monarch steps down for a grown heir. Not for republics or theocracies. */
export function AbdicateRow() {
  const st = useStore();
  const s = st.state!;
  const me = s.nations[s.player];
  if (NATION[s.player]?.gov !== 'monarchy') return null;
  const why = canAbdicate(s, s.player);
  const first = me.heir?.name.split(' ')[0];
  return (
    <TwoTap
      small
      armKey={`abdicate-${me.heir?.name ?? ''}`}
      label={first ? `Abdicate for ${first}` : 'Abdicate'}
      sub={why ?? `order ${minus(ABDICATE.order)} · renown ${minus(ABDICATE.renown)}`}
      confirm="Tap again to step down"
      disabled={!!why}
      onConfirm={() => st.run(abdicateRuler)}
      testID="abdicate"
    />
  );
}

const HELP = 'Once a game, at the height of your power: fifty years of plenty.';

/** Realm tab, after the greater crowns: what a golden age needs, then the proclamation; during it, its bonuses. */
export function GoldenAgeSection() {
  const st = useStore();
  const s = st.state!;
  const p = s.player;
  const g = s.nations[p].golden;
  if (isNativeNation(p)) return null;
  if (g && inGoldenAge(s, p))
    return (
      <Section title="Golden age" help={HELP}>
        <Line label="Golden age" value={`until ${yearOf(g.until)}`} tone="good" />
        {modLines(GOLDEN_MODS).map(m => (
          <Text key={m.text} style={{ fontFamily: sans, fontSize: 13, color: m.good ? G.good : G.bad }}>
            {m.text}
          </Text>
        ))}
      </Section>
    );
  if (g)
    return (
      <Section title="Golden age" help={HELP}>
        <Line label="Your golden age" value={`${yearOf(g.since)}–${yearOf(g.until)}`} />
      </Section>
    );
  const checks = goldenChecks(s, p);
  return (
    <Section title="Golden age" help={HELP}>
      {checks.map(c => (
        <Line key={c.label} label={c.label} value={c.ok ? '✓' : '✗'} tone={c.ok ? 'good' : 'bad'} />
      ))}
      <TwoTap
        armKey="golden"
        tone="gold"
        label="Proclaim a golden age"
        sub={`${GOLDEN.years} years · once a game`}
        confirm="Tap again to proclaim"
        disabled={!checks.every(c => c.ok)}
        onConfirm={() => st.run(proclaimGolden)}
        testID="golden-age"
      />
    </Section>
  );
}

const SUN = [
  'M12 7.2A4.8 4.8 0 1 0 12 16.8A4.8 4.8 0 1 0 12 7.2Z',
  'M11.2 1H12.8L12 5.6ZM11.2 23H12.8L12 18.4ZM1 11.2V12.8L5.6 12ZM23 11.2V12.8L18.4 12ZM4.3 3.2L3.2 4.3L7.5 7.5ZM19.7 20.8L20.8 19.7L16.5 16.5ZM3.2 19.7L4.3 20.8L7.5 16.5ZM20.8 4.3L19.7 3.2L16.5 7.5Z',
];

/** A small gilt sun over the top-right of your arms in the top bar, while your golden age lasts. */
export function GoldenMark({ size = 13 }: { size?: number }) {
  const st = useStore();
  const s = st.state!;
  if (!inGoldenAge(s, s.player)) return null;
  return (
    <View pointerEvents="none" accessibilityLabel="Golden age" style={{ position: 'absolute', top: -4, right: -5 }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {/* The dark outline first, then the gold over it: the thin rays keep their gold. */}
        {SUN.map(d => (
          <Path key={`o${d}`} d={d} fill="rgba(40,28,8,0.85)" stroke="rgba(40,28,8,0.85)" strokeWidth={2.2} strokeLinejoin="round" />
        ))}
        {SUN.map(d => (
          <Path key={d} d={d} fill={G.goldBright} />
        ))}
      </Svg>
    </View>
  );
}
