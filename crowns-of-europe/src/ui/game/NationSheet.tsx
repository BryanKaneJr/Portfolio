/** Another nation: who they are, what they think of you (and why), and the diplomatic actions. */
import { useState } from 'react';
import { View } from 'react-native';
import { NATION, TRAITS, nationName } from '../../sim/content';
import { diplomacy, freeSubject, playerExcommunicate } from '../../sim/commands';
import { acceptance, annexCost, canRival, cooldownLeft, GIFT_AMOUNT, opinionBreakdown, type DiploAction } from '../../sim/diplomacy';
import { REBELS, allied, alliesOf, hasTruce, married, militaryPower, ownedRegions, rulerAge, subjectsOf, totalDev, warBetween } from '../../sim/queries';
import { EXCOMMUNICATE_COST } from '../../sim/religion';
import { perceivedThreat } from '../../sim/threat';
import { canDeclareWar } from '../../sim/war';
import { store, useStore } from '../../state/store';
import { Flag } from '../components/Flag';
import { Btn, Line, Pill, Row, Section, Stat, T } from '../components/kit';
import { C, fmt, signed } from '../theme';
import { regionPoint } from '../map/geometry';
import { Sheet } from './Sheet';

const GOV: Record<string, string> = { monarchy: 'Monarchy', republic: 'Republic', theocracy: 'Theocracy' };
const PERS: Record<string, string> = { expansionist: 'Expansionist', defensive: 'Defensive', trader: 'Trader', opportunist: 'Opportunist' };

export function NationSheet({ id }: { id: string }) {
  const st = useStore();
  const s = st.state!;
  const n = s.nations[id];
  const def = NATION[id];
  const [whyOpinion, setWhyOpinion] = useState(false);
  const [expanded, setExpanded] = useState<DiploAction | null>(null);
  if (!n || !def) return null;
  if (id === s.player) {
    return (
      <Sheet title={def.name} subtitle="Your nation" left={<Flag nation={id} size={34} />} onClose={() => st.select(null)}>
        <Btn label="Open the realm" onPress={() => st.open({ kind: 'menu', tab: 'economy' })} />
      </Sheet>
    );
  }
  const breakdown = opinionBreakdown(s, id, s.player);
  const op = breakdown.reduce((t, r) => t + r.value, 0);
  const war = warBetween(s, id, s.player);
  const threat = perceivedThreat(s, id, s.player);
  const me = s.nations[s.player];
  const myPower = militaryPower(s, s.player);
  const theirPower = militaryPower(s, id);

  const actions: { key: DiploAction; label: string; sub: string; show: boolean }[] = [
    { key: 'improve', label: 'Improve relations', sub: '+30 opinion, fading over time', show: true },
    { key: 'alliance', label: 'Propose alliance', sub: 'Mutual defense and calls to arms', show: !allied(s, s.player, id) && !war },
    { key: 'marriage', label: 'Royal marriage', sub: '+20 opinion; a chance to inherit or unite crowns', show: !married(s, s.player, id) && def.gov === 'monarchy' && NATION[s.player].gov === 'monarchy' && !war },
    { key: 'access', label: 'Ask for military access', sub: 'March your armies through their land', show: !(`${id}>${s.player}` in s.access) && !war },
    { key: 'gift', label: `Send a gift (${GIFT_AMOUNT(s, s.player)} gold)`, sub: 'Opinion up', show: !war },
    { key: 'rival', label: 'Declare rival', sub: 'Extra prestige for beating them, and a reason for war', show: !me.rivals.includes(id) },
    { key: 'unrival', label: 'Drop rivalry', sub: '', show: me.rivals.includes(id) },
    { key: 'vassalize', label: 'Demand vassalage', sub: 'Peaceful subjugation of a much weaker friend', show: !n.overlord && !war },
    { key: 'annex', label: `Annex (${annexCost(s, id)} gold)`, sub: 'Absorb a loyal subject', show: n.overlord === s.player },
    { key: 'insult', label: 'Insult', sub: '−50 opinion, +3 prestige', show: true },
    { key: 'breakAlliance', label: 'Break alliance', sub: '', show: allied(s, s.player, id) },
  ];

  return (
    <Sheet
      title={def.name}
      subtitle={`${GOV[def.gov]} · ${def.faith[0].toUpperCase() + def.faith.slice(1)} · ${PERS[def.personality]}${n.overlord ? ` · Subject of ${nationName(n.overlord)}` : ''}`}
      left={<Flag nation={id} size={34} />}
      onClose={() => st.select(null)}
    >
      <Row gap={6} style={{ marginBottom: 6, flexWrap: 'wrap' }}>
        {war ? <Pill text="At war with you" color={C.redSoft} textColor={C.red} /> : null}
        {allied(s, s.player, id) ? <Pill text="Ally" color={C.blueSoft} textColor={C.blue} /> : null}
        {married(s, s.player, id) ? <Pill text="Royal marriage" color={C.parchment2} /> : null}
        {hasTruce(s, s.player, id) ? <Pill text="Truce" color={C.parchment2} /> : null}
        {me.rivals.includes(id) ? <Pill text="Your rival" color={C.redSoft} textColor={C.red} /> : null}
        {n.rivals.includes(s.player) ? <Pill text="Rivals you" color={C.redSoft} textColor={C.red} /> : null}
        {s.hre.emperor === id ? <Pill text="Emperor" color={C.gold} /> : null}
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
        <Line label="Regions / development" value={`${ownedRegions(s, id).length} / ${totalDev(s, id)}`} />
        {alliesOf(s, id).length ? <Line label="Allies" value={alliesOf(s, id).map(nationName).join(', ')} /> : null}
        {subjectsOf(s, id).length ? <Line label="Subjects" value={subjectsOf(s, id).map(nationName).join(', ')} /> : null}
      </Section>
      <Section title="Diplomacy">
        <View style={{ gap: 6 }}>
          {actions
            .filter(a => a.show)
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
                      <T v="tiny">Tap again to ask anyway (the cooldown still starts).</T>
                    </View>
                  ) : null}
                </View>
              );
            })}
          {n.overlord === s.player ? <Btn tone="ghost" label="Set them free" onPress={() => st.run(x => freeSubject(x, id))} /> : null}
          {me.faith === 'catholic' && n.faith === 'catholic' && id !== REBELS ? (
            <Btn tone="ghost" label="Ask the Pope to excommunicate their ruler" sub={`${EXCOMMUNICATE_COST} Papal Favor (you have ${Math.floor(me.papalFavor)})`} disabled={me.papalFavor < EXCOMMUNICATE_COST} onPress={() => st.run(x => playerExcommunicate(x, id))} />
          ) : null}
          {war ? (
            <Btn tone="danger" icon="treaty" label="Negotiate peace" onPress={() => st.open({ kind: 'peace', war: war.id })} />
          ) : (
            <Btn tone="danger" icon="swords" label="Declare war…" disabled={!!canDeclareWar(s, s.player, id)} sub={canDeclareWar(s, s.player, id) ?? undefined} onPress={() => st.open({ kind: 'declareWar', target: id })} />
          )}
          <Btn small tone="ghost" label="Show on map" onPress={() => store.focusOn(...regionPoint(n.capital))} />
        </View>
      </Section>
    </Sheet>
  );
}
