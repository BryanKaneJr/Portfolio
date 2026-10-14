/**
 * Centred cards that need an answer (events, offers from other rulers, battle results, the end), as event windows:
 * a picture at the head, the title in classical capitals, the story in a book face, then the choices, each with
 * what it will do. They sit on glass over the dimmed map.
 */
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { EVENT, NATION, nationName, regionName } from '../../sim/content';
import { answerOffer, playerAnswerEvent } from '../../sim/commands';
import { ULTIMATUM_SCORE, peaceCost, scoreFor, truceYears, ultimatumTerms } from '../../sim/war';
import { ownedRegions } from '../../sim/queries';
import type { BattleReport, Offer } from '../../sim/types';
import { formatDate, formatShortDate } from '../../sim/util';
import { offerLapses } from '../../sim/tick';
import { store, useStore } from '../../state/store';
import { Engraving, Icon, type IconName } from '../components/Icon';
import { Shield } from '../components/Flag';
import { Glass } from '../components/Glass';
import { Btn, Line, Row, T } from '../components/kit';
import { C, G, R, book, fmt, kmen, sans, serif } from '../theme';
import { effectsLines, lapseMeans } from '../describe';

export function CardShell({ children, wide, head }: { children: ReactNode; wide?: boolean; head?: ReactNode }) {
  return (
    <View style={styles.backdrop}>
      <Glass strong gilt radius={R.xl} style={[styles.card, wide && { maxWidth: 520 }]}>
        <ScrollView contentContainerStyle={{ paddingBottom: 18 }} bounces={false}>
          {head ? <View style={styles.head}>{head}</View> : null}
          <View style={{ paddingHorizontal: 18, paddingTop: head ? 14 : 18 }}>{children}</View>
        </ScrollView>
      </Glass>
    </View>
  );
}

/** One answer to an event: the choice, and under it what it will do. */
function Choice({ text, lines, onPress, testID, first }: { text: string; lines: { good: boolean; text: string }[]; onPress: () => void; testID: string; first?: boolean }) {
  return (
    <Pressable onPress={onPress} testID={testID} accessibilityRole="button" accessibilityLabel={text} style={({ pressed }) => [styles.choice, first && styles.choiceFirst, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <Text style={styles.choiceText}>{text}</Text>
      {lines.length ? (
        <View style={{ marginTop: 6, gap: 2 }}>
          {lines.map((l, j) => (
            <Text key={j} style={[styles.effect, { color: l.good ? G.good : G.bad }]}>
              {l.good ? '▲' : '▼'} {l.text}
            </Text>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

export function EventCard() {
  const st = useStore();
  const s = st.state!;
  const pe = s.pendingEvents[0];
  const e = pe ? EVENT[pe.event] : null;
  if (!pe || !e) return null;
  return (
    <CardShell head={<Engraving name={e.image as IconName} width={460} height={128} />}>
      <Text style={[styles.eventTitle, { textAlign: 'center' }]}>{e.title}</Text>
      <Text style={[styles.eventDate, { textAlign: 'center' }]}>{formatDate(pe.day)}</Text>
      <Text style={styles.story}>{e.text}</Text>
      <View style={{ gap: 8, marginTop: 16 }}>
        {e.choices.map((c, i) => (
          <Choice key={i} first={i === 0} text={c.text} lines={effectsLines(c.effects, { s, n: pe.nation, version: st.version })} onPress={() => store.run(x => playerAnswerEvent(x, 0, i), { quiet: true })} testID={`choice-${i}`} />
        ))}
      </View>
    </CardShell>
  );
}

/** An offer from another ruler. `onLater` closes it unanswered: it waits under the bell until it lapses. */
export function OfferCard({ offer: o, onLater }: { offer: Offer; onLater: () => void }) {
  const st = useStore();
  const s = st.state!;
  const from = nationName(o.from);
  const ultimatum = o.kind === 'peace' && o.ultimatum !== undefined && !!s.wars[o.war];
  const lapse = lapseMeans(s, o);
  let title = '';
  let body: ReactNode = null;
  let icon: IconName = 'scroll';
  if (o.kind === 'callToArms') {
    const w = s.wars[o.war];
    const defensive = w?.defenders[0] === o.from;
    title = 'A Call to Arms';
    icon = 'swords';
    body = (
      <>
        <T>
          {from} asks you to join the {w?.name ?? 'war'}
          {w ? ` against ${(defensive ? w.attackers : w.defenders).map(nationName).join(', ')}` : ''}.
        </T>
        <T v="small" style={{ marginTop: 8 }}>
          {defensive ? 'Refusing breaks the alliance and costs renown.' : 'Refusing only disappoints them.'}
        </T>
      </>
    );
  } else if (o.kind === 'peace') {
    const w = s.wars[o.war];
    const due = o.ultimatum;
    title = due !== undefined ? 'An Ultimatum' : 'A Peace Proposal';
    icon = 'treaty';
    // An ultimatum as it stands today (the land still theirs to take, the gold you have): what accepting signs.
    const t = (due !== undefined && w?.ultimatum?.from === o.from && ultimatumTerms(s, w)) || o.terms;
    const youWin = t.winner === s.player;
    body = (
      <>
        <T>
          {from} {due !== undefined ? 'demands' : 'proposes'} peace in the {w?.name ?? 'war'}.
        </T>
        <View style={{ marginTop: 8 }}>
          {t.white ? <Line label="White peace" value="no changes" /> : null}
          {t.regions.map(r => (
            <Line key={r} label={`${regionName(r)} goes to`} value={nationName(t.winner)} tone={youWin ? 'good' : 'bad'} />
          ))}
          {t.gold ? <Line label={youWin ? 'They pay you' : 'You pay'} value={`${t.gold} gold`} tone={youWin ? 'good' : 'bad'} /> : null}
          {w?.cb === 'independence' && !t.white && t.winner === w.attackers[0] ? <Line label={`${nationName(t.winner)} goes free`} value="independence" tone={youWin ? 'good' : 'bad'} /> : null}
          {w ? <Line label="Your leverage now" value={`${scoreFor(s, w, s.player)}%`} /> : null}
          {w && !t.white ? <Line label="Value of the deal" value={`${peaceCost(s, t)}%`} tone="muted" /> : null}
          {w ? <Line label="Truce" value={`${truceYears(t.white ? 0 : peaceCost(s, t))} years`} tone="muted" /> : null}
          {due !== undefined ? (
            <Line
              label="Takes effect"
              value={formatDate(due)}
              tone="bad"
              help={`Sent at ${ULTIMATUM_SCORE}% leverage, asking no more than it buys. If they still hold ${ULTIMATUM_SCORE}% on this day, these terms are imposed; push them below it and the ultimatum lapses. Refusing doesn’t stop the clock; any peace signed first ends it.`}
            />
          ) : null}
        </View>
      </>
    );
  } else {
    title = o.kind === 'alliance' ? 'An Offer of Alliance' : o.kind === 'marriage' ? 'A Royal Match' : 'A Request for Passage';
    icon = o.kind === 'marriage' ? 'marriage' : 'treaty';
    body = <T>{from} proposes {o.kind === 'alliance' ? 'an alliance.' : o.kind === 'marriage' ? 'a royal marriage between your houses.' : 'that you let their armies march through your lands.'}</T>;
  }
  return (
    <CardShell>
      <Row style={{ marginBottom: 12 }} gap={12}>
        <Shield nation={o.from} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.eventTitle}>{title}</Text>
          <Text style={styles.eventDate}>From {from}</Text>
        </View>
        <Icon name={icon} size={26} color={G.gold} />
      </Row>
      {body}
      <Row style={{ marginTop: 16 }}>
        <Btn style={{ flex: 1 }} label="Accept" onPress={() => store.run(x => answerOffer(x, o.id, true))} testID="offer-accept" />
        <Btn style={{ flex: 1 }} tone="secondary" label={ultimatum ? 'Refuse' : 'Decline'} onPress={() => store.run(x => answerOffer(x, o.id, false))} testID="offer-decline" />
      </Row>
      {ultimatum ? (
        <Btn
          style={{ marginTop: 8 }}
          tone="secondary"
          label="Offer other terms"
          testID="offer-counter"
          onPress={() => {
            // The ultimatum stands while you choose what to offer instead. The peace screen opens first, so an offer
            // waiting its turn comes up when it closes rather than under it.
            store.open({ kind: 'peace', war: o.war });
            store.run(x => answerOffer(x, o.id, false), { quiet: true });
          }}
        />
      ) : null}
      <Btn
        style={{ marginTop: 8 }}
        tone="ghost"
        label="Later"
        sub={ultimatum ? `Under the bell; takes effect ${formatShortDate(offerLapses(o))}` : `Under the bell until ${formatShortDate(offerLapses(o))}${lapse ? `, then lapses ${lapse}` : ''}`}
        onPress={onLater}
        testID="offer-later"
      />
    </CardShell>
  );
}

export function ReportCard({ report, onClose }: { report: BattleReport; onClose: () => void }) {
  const you = report.playerSide;
  const won = you !== null && report.winner === you;
  const verdict = report.scattered ? (won ? 'The Enemy Is Scattered' : 'Our Army Is Scattered') : won ? 'Victory' : 'Defeat';
  const title = report.wiped ? (won ? 'Annihilation!' : 'Our Army Is Destroyed') : you === null ? 'Battle Report' : verdict;
  return (
    <CardShell>
      <View style={[styles.banner, { backgroundColor: you === null ? G.raised : won ? 'rgba(128,200,144,0.18)' : 'rgba(236,122,104,0.18)', borderColor: you === null ? G.gilt : won ? G.good : G.bad }]}>
        <Icon name="swords" size={24} color={you === null ? G.gold : won ? G.good : G.bad} />
        <Text style={[styles.bannerText, { color: you === null ? G.text : won ? G.good : G.bad }]}>{title}</Text>
      </View>
      <Text style={[styles.eventTitle, { marginTop: 10 }]}>Battle of {regionName(report.node)}</Text>
      <Text style={styles.eventDate}>
        {formatDate(report.day)} · {report.days} day{report.days > 1 ? 's' : ''}
      </Text>
      {[0, 1].map(i => (
        <View key={i} style={[styles.side, report.winner === i && { borderColor: C.gold }]}>
          <Row gap={10}>
            <Shield nation={report.leaders[i]} size={28} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sideName}>
                {report.nations[i].map(n => (NATION[n] ? nationName(n) : 'Rebels')).join(', ')}
                {report.winner === i ? '  ✓' : ''}
              </Text>
              <Text style={styles.eventDate}>{report.generals[i] ? `General ${report.generals[i]}` : 'No general'}</Text>
            </View>
          </Row>
          <Line label="Men at the start" value={kmen(report.startMen[i])} />
          <Line label="Casualties" value={kmen(report.losses[i])} tone={report.winner === i ? undefined : 'bad'} />
        </View>
      ))}
      {report.wiped ? <T v="small" style={{ marginTop: 8 }}>The beaten army was annihilated.</T> : null}
      {report.scattered ? <T v="small" style={{ marginTop: 8 }}>Cut off with nowhere to retreat, the beaten army scattered.</T> : null}
      {report.warScore ? <T v="small" style={{ marginTop: 6 }}>Leverage +{report.warScore}% to the winner.</T> : null}
      <Btn style={{ marginTop: 14 }} label="Continue" onPress={onClose} testID="report-close" />
    </CardShell>
  );
}

export function GameOverCard() {
  const st = useStore();
  const s = st.state!;
  if (!s.gameOver) return null;
  const regions = ownedRegions(s, s.player).length;
  return (
    <CardShell>
      <View style={{ alignItems: 'center', marginHorizontal: -18, marginTop: -18, marginBottom: 6 }}>
        <Engraving name={s.gameOver.reason === 'end' ? 'crown' : 'death'} width={460} height={128} />
      </View>
      <Text style={[styles.eventTitle, { textAlign: 'center', marginTop: 10 }]}>{s.gameOver.reason === 'end' ? 'The Age Ends' : `The End of ${nationName(s.player)}`}</Text>
      <T style={{ textAlign: 'center', marginTop: 6 }}>
        {s.gameOver.reason === 'end' ? `It is ${formatDate(s.day)}. History will remember your reign.` : 'Your last region has fallen. Your dynasty passes into the history books.'}
      </T>
      <View style={{ marginTop: 12 }}>
        <Line label="Regions held (peak)" value={`${regions} (${s.stats.peakRegions})`} />
        <Line label="Battles won / lost" value={`${s.stats.battlesWon} / ${s.stats.battlesLost}`} />
        <Line label="Armies annihilated" value={`${s.stats.stackWipes}`} />
        <Line label="Wars won / lost" value={`${s.stats.warsWon} / ${s.stats.warsLost}`} />
        <Line label="Regions conquered" value={`${s.stats.regionsConquered}`} />
        <Line label="Enemies slain" value={fmt(s.stats.enemiesKilled)} />
        <Line label="Achievements" value={`${s.achievements.length}`} />
      </View>
      <Btn style={{ marginTop: 14 }} label="Back to the title screen" onPress={() => (store.unload(), router.replace('/'))} />
    </CardShell>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: C.overlay, alignItems: 'center', justifyContent: 'center', padding: 14 },
  card: { width: '100%', maxWidth: 440, maxHeight: '92%', overflow: 'hidden' },
  head: { height: 128, overflow: 'hidden', borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: G.gilt, alignItems: 'center' },
  eventTitle: { fontFamily: serif, fontSize: 22, color: G.text, letterSpacing: 0.5 },
  eventDate: { fontFamily: sans, fontSize: 12, color: G.text3, marginTop: 3, letterSpacing: 0.4 },
  story: { fontFamily: book, fontSize: 17, lineHeight: 25, color: '#e6dfcf', marginTop: 12 },
  choice: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: R.lg, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: G.line },
  choiceFirst: { borderColor: G.gilt, backgroundColor: 'rgba(214,178,110,0.10)' },
  choiceText: { fontFamily: sans, fontSize: 16, fontWeight: '700', color: G.text },
  effect: { fontFamily: sans, fontSize: 13, fontWeight: '600' },
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: R.lg, paddingVertical: 12, borderWidth: 1 },
  bannerText: { fontFamily: serif, fontSize: 22, letterSpacing: 0.6 },
  side: { marginTop: 10, borderWidth: 1, borderColor: 'transparent', borderRadius: R.md, padding: 12, backgroundColor: G.group },
  sideName: { fontFamily: serif, fontSize: 15, color: G.text },
});
