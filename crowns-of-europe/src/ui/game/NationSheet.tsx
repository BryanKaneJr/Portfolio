/** Another nation: who they are, what they think of you (and why), and the diplomatic actions. */
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { NATION, TRAITS, nationName, regionName } from '../../sim/content';
import { activeAims, bondsOf, holds } from '../../sim/aims';
import { diplomacy, freeSubject, playerExcommunicate } from '../../sim/commands';
import { acceptance, annexCost, canRival, cooldownLeft, GIFT_AMOUNT, opinionBreakdown, type DiploAction } from '../../sim/diplomacy';
import { REBELS, allied, alliesOf, hasTruce, married, militaryPower, ownedRegions, rulerAge, subjectsOf, totalDev, warBetween } from '../../sim/queries';
import { EXCOMMUNICATE_COST } from '../../sim/religion';
import { perceivedThreat } from '../../sim/threat';
import { canDeclareWar } from '../../sim/war';
import { MAX_MONTHLY, warOdds, type WarBlock } from '../../sim/ai';
import { pairKey, yearOf } from '../../sim/util';
import { store, useStore } from '../../state/store';
import { Shield } from '../components/Flag';
import { Btn, Line, Pill, Row, Section, Stat, T } from '../components/kit';
import { C, fmt, signed } from '../theme';
import { regionPoint } from '../map/geometry';
import { claimsText, claimsWhy } from '../describe';
import { Sheet } from './Sheet';

const GOV: Record<string, string> = { monarchy: 'Monarchy', republic: 'Republic', theocracy: 'Theocracy' };
/** Shown at once; the rest (access, gifts, rivals, vassalage, insults...) wait behind "More options". */
const MAIN_ACTIONS: DiploAction[] = ['improve', 'alliance', 'marriage', 'annex'];
const PERS: Record<string, string> = { expansionist: 'Expansionist', defensive: 'Defensive', trader: 'Trader', opportunist: 'Opportunist' };
/** Why a crown weighs no war (the gates with no value of their own). */
const NO_WAR: Partial<Record<WarBlock, string>> = { order: 'Order too low', weariness: 'Too war-weary', debt: 'Too deep in debt', subject: 'A subject' };
/** A chance as a percentage: one decimal below 10%. */
const pc = (p: number) => {
  const v = p * 100;
  return `${v > 0 && v < 10 ? v.toFixed(1) : Math.round(v)}%`;
};

export function NationSheet({ id }: { id: string }) {
  const st = useStore();
  const s = st.state!;
  const n = s.nations[id];
  const def = NATION[id];
  const [whyOpinion, setWhyOpinion] = useState(false);
  const [expanded, setExpanded] = useState<DiploAction | null>(null);
  const [more, setMore] = useState(false);
  const [whyWar, setWhyWar] = useState(false);
  // A crown run by the computer weighs war once a month: its chance this month and what makes it up. Recomputed on
  // every new day and every command (the store's version), as the state changes in place.
  const version = st.getVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const odds = useMemo(() => (n && def && !def.native && id !== s.player && id !== REBELS ? warOdds(s, id) : null), [version, id]);
  if (!n || !def) return null;
  if (id === s.player) {
    return (
      <Sheet title={def.name} subtitle="Your nation" left={<Shield nation={id} size={30} />} onClose={() => st.select(null)}>
        <Btn label="Open the realm" onPress={() => st.open({ kind: 'menu', tab: 'economy' })} />
      </Sheet>
    );
  }
  const aims = activeAims(s, id);
  // Reasons for war between you and them, each until the year shown.
  // (A claim on a subject's land is a reason for war on its overlord.)
  const heldBy = (r: string, by: string) => {
    const o = s.regions[r]?.owner;
    return !!o && (o === by || s.nations[o]?.overlord === by);
  };
  const onMine = id === s.player ? [] : Object.keys(n.claims).filter(r => heldBy(r, s.player));
  const onTheirs = id === s.player ? [] : Object.keys(s.nations[s.player].claims).filter(r => heldBy(r, id));
  const claimHelp = (by: string, regions: string[]) => ['A reason for war, until the year shown.', claimsWhy(s, by, regions)].filter(Boolean).join(' ');
  const bonds = bondsOf(s, id);
  const breakdown = opinionBreakdown(s, id, s.player);
  const op = breakdown.reduce((t, r) => t + r.value, 0);
  const war = warBetween(s, id, s.player);
  const threat = perceivedThreat(s, id, s.player);
  const me = s.nations[s.player];
  const myPower = militaryPower(s, s.player);
  const theirPower = militaryPower(s, id);

  const actions: { key: DiploAction; label: string; sub: string; show: boolean }[] = [
    { key: 'improve', label: 'Improve relations', sub: '+30 opinion', show: true },
    { key: 'alliance', label: 'Propose alliance', sub: '', show: !allied(s, s.player, id) && !war && !def.native },
    { key: 'marriage', label: 'Royal marriage', sub: '', show: !married(s, s.player, id) && def.gov === 'monarchy' && NATION[s.player].gov === 'monarchy' && !war && !def.native },
    { key: 'access', label: 'Ask for military access', sub: '', show: !(`${id}>${s.player}` in s.access) && !war && !def.native },
    { key: 'gift', label: `Send a gift (${GIFT_AMOUNT(s, s.player)} gold)`, sub: '', show: !war },
    { key: 'rival', label: 'Declare rival', sub: '', show: !me.rivals.includes(id) },
    { key: 'unrival', label: 'Drop rivalry', sub: '', show: me.rivals.includes(id) },
    { key: 'vassalize', label: 'Demand vassalage', sub: '', show: !n.overlord && !war && !def.native },
    { key: 'annex', label: `Annex (${annexCost(s, id)} gold)`, sub: '', show: n.overlord === s.player },
    { key: 'insult', label: 'Insult', sub: '−50 opinion, +3 renown', show: true },
    { key: 'breakAlliance', label: 'Break alliance', sub: '', show: allied(s, s.player, id) },
  ];

  return (
    <Sheet
      title={def.name}
      subtitle={`${GOV[def.gov]} · ${def.faith === 'native' ? 'Native beliefs' : def.faith[0].toUpperCase() + def.faith.slice(1)} · ${PERS[def.personality]}${n.overlord ? ` · Subject of ${nationName(n.overlord)}` : ''}`}
      left={<Shield nation={id} size={30} />}
      onClose={() => st.select(null)}
      help={`Tap Opinion for what makes it up.${def.native ? ' A New World people makes no treaties and fields weaker armies.' : ''} Army vs yours compares the strength of their regiments with yours.${def.flag.stylised ? ' Their banner is a stylisation: no flag or arms of theirs survive from this time, so it is drawn from their own symbols.' : ''}`}
    >
      <Row gap={6} style={{ marginBottom: 6, flexWrap: 'wrap' }}>
        {def.native ? <Pill text="New World people" color={C.parchment2} /> : null}
        {war ? <Pill text="At war with you" color={C.redSoft} textColor={C.red} /> : null}
        {allied(s, s.player, id) ? <Pill text="Ally" color={C.blueSoft} textColor={C.blue} /> : null}
        {married(s, s.player, id) ? <Pill text="Royal marriage" color={C.parchment2} /> : null}
        {hasTruce(s, s.player, id) ? <Pill text={`Truce to ${yearOf(s.truces[pairKey(s.player, id)])}`} color={C.parchment2} /> : null}
        {me.rivals.includes(id) ? <Pill text="Your rival" color={C.redSoft} textColor={C.red} /> : null}
        {n.rivals.includes(s.player) ? <Pill text="Rivals you" color={C.redSoft} textColor={C.red} /> : null}
        {s.hre.emperor === id ? <Pill text="Emperor" color={C.gold} textColor="#1a1408" /> : null}
        {s.hre.electors.includes(id) ? <Pill text="Elector" color={C.parchment2} /> : null}
      </Row>
      <Row gap={6}>
        <Stat label="Opinion of you" value={signed(Math.round(op))} tone={op >= 50 ? 'good' : op < -25 ? 'bad' : undefined} onPress={() => setWhyOpinion(w => !w)} icon="eye" />
        <Stat label="Threat from you" value={fmt(threat)} tone={threat >= 40 ? 'bad' : undefined} icon="threat" />
        <Stat label="Army vs yours" value={`${fmt(theirPower)} : ${fmt(myPower)}`} icon="swords" />
      </Row>
      {whyOpinion ? (
        <View style={{ marginTop: 8 }}>
          {breakdown.map(r => (
            <Line key={r.label} label={r.label} value={signed(r.value)} tone={r.value >= 0 ? 'good' : 'bad'} />
          ))}
        </View>
      ) : null}
      <Section title="Realm">
        <Line label="Ruler" value={`${n.ruler.name} · skill ${n.ruler.skill} · age ${rulerAge(s, id)}`} />
        <Line label="Traits" value={[TRAITS.national[def.trait]?.name, ...n.ruler.traits.map(t => TRAITS.ruler[t]?.name)].filter(Boolean).join(', ')} />
        <Line label="Regions / prosperity" value={`${ownedRegions(s, id).length} / ${totalDev(s, id)}`} />
        {alliesOf(s, id).length ? <Line label="Allies" value={alliesOf(s, id).map(nationName).join(', ')} /> : null}
        {subjectsOf(s, id).length ? <Line label="Subjects" value={subjectsOf(s, id).map(nationName).join(', ')} /> : null}
        {onMine.length ? <Line label="Their claims on you" value={claimsText(s, id, onMine)} tone="bad" help={claimHelp(id, onMine)} /> : null}
        {onTheirs.length ? <Line label="Your claims on them" value={claimsText(s, s.player, onTheirs)} tone="good" help={claimHelp(s.player, onTheirs)} /> : null}
        {odds && n.alive ? <WarChance odds={odds} player={s.player} open={whyWar} onPress={() => setWhyWar(w => !w)} /> : null}
      </Section>
      {aims.length || bonds.length ? (
        <Section title="What they want" help="Crowns follow their history: they forge claims on the land they want, go to war for it and dislike whoever holds it.">
          {aims.map(a => {
            const lacking = a.regions.filter(r => !holds(s, id, r));
            const yours = lacking.filter(r => holds(s, s.player, r));
            return (
              <View key={a.id} style={{ marginBottom: 6 }}>
                <T v="small" style={{ fontWeight: '700' }}>{a.title}</T>
                <T v="tiny" style={yours.length ? { color: C.red } : undefined}>
                  {lacking.map(regionName).join(', ')}
                  {yours.length ? ` (${yours.length === lacking.length ? 'all yours' : `${yours.map(regionName).join(', ')} yours`})` : ''}
                </T>
              </View>
            );
          })}
          {bonds.map(b => {
            const other = b.a === id ? b.b : b.a;
            return <Line key={`${b.a}${b.b}`} label={`${b.kind === 'friends' ? 'Old friends' : 'Old enemies'}: ${nationName(other)}`} value={b.label} tone={other === s.player ? (b.kind === 'friends' ? 'good' : 'bad') : undefined} />;
          })}
        </Section>
      ) : null}
      <Section
        title="Diplomacy"
        help="Allies defend each other and answer calls to arms. A royal marriage can bring an inheritance or a union of crowns. Military access lets your armies through their land. A rival is a reason for war, with extra renown for beating them. Vassalage makes a much weaker friend your subject. Tap an offer they would refuse to see why; tap again to ask anyway (the wait before asking again still starts)."
      >
        <View style={{ gap: 6 }}>
          {actions
            .filter(a => a.show && (more || MAIN_ACTIONS.includes(a.key)))
            .map(a => {
              const acc = acceptance(s, s.player, id, a.key);
              const cd = cooldownLeft(s, s.player, id, a.key);
              const verdict = acc.blocked ? acc.blocked : ['improve', 'gift', 'insult', 'rival', 'unrival', 'breakAlliance', 'annex'].includes(a.key) ? '' : acc.accept ? `They would accept (+${acc.score})` : `They would refuse (${acc.score})`;
              const rivalWhy = a.key === 'rival' ? canRival(s, s.player, id) : null;
              return (
                <View key={a.key}>
                  <Btn
                    tone={acc.accept && !acc.blocked && !rivalWhy ? 'secondary' : 'ghost'}
                    label={a.label}
                    sub={rivalWhy ?? (verdict || a.sub) + (cd ? ` · wait ${Math.ceil(cd / 30)} mo` : '')}
                    disabled={!!acc.blocked || !!rivalWhy}
                    onPress={() => {
                      if (!acc.accept && !acc.blocked && expanded !== a.key && acc.reasons.length > 1) {
                        setExpanded(a.key);
                        return;
                      }
                      st.run(x => diplomacy(x, id, a.key));
                      setExpanded(null);
                    }}
                  />
                  {expanded === a.key ? (
                    <View style={{ paddingHorizontal: 6, paddingTop: 4 }}>
                      {acc.reasons.map(r => (
                        <Line key={r.label} label={r.label} value={signed(r.value)} tone={r.value >= 0 ? 'good' : 'bad'} />
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          {more && n.overlord === s.player ? <Btn tone="ghost" label="Set them free" onPress={() => st.run(x => freeSubject(x, id))} /> : null}
          {more && me.faith === 'catholic' && n.faith === 'catholic' && id !== REBELS ? (
            <Btn tone="ghost" label="Ask the Pope to excommunicate their ruler" sub={`${EXCOMMUNICATE_COST} Papal Favor (you have ${Math.floor(me.papalFavor)})`} disabled={me.papalFavor < EXCOMMUNICATE_COST} onPress={() => st.run(x => playerExcommunicate(x, id))} />
          ) : null}
          {war ? (
            <Btn tone="danger" icon="treaty" label="Negotiate peace" onPress={() => st.open({ kind: 'peace', war: war.id })} />
          ) : (
            <Btn tone="danger" icon="swords" label="Declare war…" disabled={!!canDeclareWar(s, s.player, id)} sub={canDeclareWar(s, s.player, id) ?? undefined} onPress={() => st.open({ kind: 'declareWar', target: id })} />
          )}
          <Row gap={6}>
            <Btn small tone="ghost" style={{ flex: 1 }} label={more ? 'Fewer options' : 'More options'} onPress={() => setMore(m => !m)} />
            <Btn small tone="ghost" style={{ flex: 1 }} label="Show on map" onPress={() => store.focusOn(...regionPoint(n.capital))} />
          </Row>
        </View>
      </Section>
    </Sheet>
  );
}

/** An AI crown's chance of war this month; tap for what makes it up. */
function WarChance({ odds, player, open, onPress }: { odds: ReturnType<typeof warOdds>; player: string; open: boolean; onPress: () => void }) {
  const help = 'Once a month, on a day of its own, a crown run by the computer weighs war on the neighbour it most wants to fight.';
  const waiting = odds.blocked === 'waiting' && odds.waitingFor && odds.restUntil !== undefined;
  const reason = waiting
    ? `Its truce with ${odds.waitingFor === player ? 'you' : nationName(odds.waitingFor!)} ends then, and it holds a claim there`
    : odds.blocked
      ? NO_WAR[odds.blocked]
      : odds.best
        ? undefined
        : 'No neighbour worth a war';
  const value =
    odds.blocked === 'war'
      ? 'At war'
      : (odds.blocked === 'rest' || waiting) && odds.restUntil !== undefined
        ? `${waiting ? 'Waiting' : 'Resting'} until ${yearOf(odds.restUntil)}`
        : reason
          ? 'None'
          : `${pc(odds.monthly)} a month`;
  const you = odds.best?.target === player || odds.waitingFor === player;
  const tappable = !odds.blocked && !!odds.best;
  const shown = odds.factors.filter(f => f.key === 'base' || Math.abs(f.x - 1) > 1e-9);
  const withinYear = 1 - Math.pow(1 - odds.monthly, 12);
  return (
    <View>
      <Line label={you ? 'Could attack you' : 'War chance'} value={value} tone={you ? 'bad' : undefined} help={help} onPress={tappable ? onPress : undefined} />
      {reason ? <T v="tiny">{reason}</T> : null}
      {open && tappable ? (
        <View style={{ paddingHorizontal: 6, paddingTop: 4 }}>
          {shown.map(f => (
            <Line key={f.key} label={f.label} value={f.key === 'base' ? `${f.x}% a year` : `×${f.x.toFixed(2)}`} tone="muted" />
          ))}
          <T v="tiny">{`→ ${Math.round(odds.yearly)}% a year ÷ 12 = ${pc(odds.monthly)} a month (never more than ${Math.round(MAX_MONTHLY * 100)}%), about ${Math.round(withinYear * 100)}% within a year`}</T>
        </View>
      ) : null}
    </View>
  );
}
