/**
 * The war: both sides under their arms (the enemy's on fire), the leverage as a tug of war with what it is made of,
 * how the fighting has gone, and the peace table, where leverage buys terms. Opened from the burning shields down the
 * left of the map.
 */
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { NATION, nationName, regionName } from '../../sim/content';
import { proposePeace, separatePeace } from '../../sim/commands';
import { REBELS, ownedRegions, sideOf, subjectsOf } from '../../sim/queries';
import { CB_LABEL, ULTIMATUM_SCORE, concessionValue, demandableRegions, isCapitalAtStake, offerValue, peaceCost, proposalAnswer, regionPeaceCost, scoreFor, warScore } from '../../sim/war';
import type { NationId, PeaceTerms, War } from '../../sim/types';
import { DAYS_PER_YEAR, formatDate, formatShortDate, isIn } from '../../sim/util';
import { useStore } from '../../state/store';
import { BurningShield, ShieldMedallion } from '../components/BurningShield';
import { Shield } from '../components/Flag';
import { Icon, type IconName } from '../components/Icon';
import { Btn, Empty, HelpButton, HelpNote, Line, Section, T } from '../components/kit';
import { G, R, display, displaySemi, fmt, kmen, sans, signed } from '../theme';
import { Panel } from './Panels';

const tone = (v: number) => (v > 5 ? G.good : v < -5 ? G.bad : G.text2);

function duration(days: number): string {
  const y = Math.floor(days / DAYS_PER_YEAR);
  const m = Math.floor((days - y * DAYS_PER_YEAR) / 30.44);
  if (!y && !m) return 'just begun';
  return [y ? `${y} year${y > 1 ? 's' : ''}` : '', m ? `${m} month${m > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ');
}

/** Battles fought in this war (by nations on its two sides, since it began), with the player's side first. */
function warBattles(s: ReturnType<typeof useStore>['state'] & object, w: War, ours: NationId[], theirs: NationId[]) {
  return s.reports
    .filter(r => r.day >= w.started && ((r.nations[0].some(n => ours.includes(n)) && r.nations[1].some(n => theirs.includes(n))) || (r.nations[1].some(n => ours.includes(n)) && r.nations[0].some(n => theirs.includes(n)))))
    .map(r => {
      const me = r.nations[0].some(n => ours.includes(n)) ? 0 : 1;
      return { r, won: r.winner === me, lostUs: r.losses[me], lostThem: r.losses[1 - me] };
    });
}

export function WarPanel({ warId }: { warId: string }) {
  const st = useStore();
  const s = st.state!;
  const w = s.wars[warId];
  const [regions, setRegions] = useState<string[]>([]);
  const [gold, setGold] = useState(0);
  const [vassalize, setVassalize] = useState(false);
  const [release, setRelease] = useState<string[]>([]);
  // Losing, you'll want to offer something rather than demand.
  const [mode, setMode] = useState<'demand' | 'offer'>(() => (w && sideOf(w, s.player) !== null && scoreFor(s, w, s.player) < 0 ? 'offer' : 'demand'));
  const [levHelp, setLevHelp] = useState(false);
  if (!w || sideOf(w, s.player) === null) {
    return (
      <Panel title="War" onClose={() => st.close()}>
        <Empty text="This war is over." />
      </Panel>
    );
  }
  const side = sideOf(w, s.player)!;
  const ours = side === 0 ? w.attackers : w.defenders;
  const theirs = side === 0 ? w.defenders : w.attackers;
  const leader = ours[0];
  const enemy = theirs[0];
  const isLeader = leader === s.player;
  const sc = scoreFor(s, w, s.player);
  const ws = warScore(s, w);
  const flip = side === 1 ? -1 : 1;

  // The peace table: demand what you may take, or offer any land of yours, the land they value most first.
  const winner = mode === 'demand' ? s.player : enemy;
  const loser = mode === 'demand' ? enemy : s.player;
  const candidates =
    mode === 'demand'
      ? demandableRegions(s, w, winner).map(r => ({ r, price: regionPeaceCost(s, winner, r), why: '' }))
      : ownedRegions(s, s.player)
          .map(reg => {
            const v = concessionValue(s, w, enemy, reg.id);
            return { r: reg.id, price: v.value, why: v.why };
          })
          .sort((a, b) => b.price - a.price || regionName(a.r).localeCompare(regionName(b.r)));
  const terms: PeaceTerms = { regions, gold, vassalize, release: mode === 'demand' ? release : [], winner, loser };
  const white: PeaceTerms = { regions: [], gold: 0, vassalize: false, release: [], white: true, winner: s.player, loser: enemy };
  const cost = mode === 'demand' ? peaceCost(s, terms) : offerValue(s, w, terms);
  // The same verdict proposePeace acts on.
  const answer = proposalAnswer(s, w, terms, s.player);
  const whiteAnswer = proposalAnswer(s, w, white, s.player);
  const myGold = s.nations[s.player].gold;
  const ult = w.ultimatum?.from === enemy ? w.ultimatum : undefined;
  const anyTerms = regions.length > 0 || gold > 0 || vassalize || release.length > 0;
  const toggle = (r: string) => setRegions(rs => (rs.includes(r) ? rs.filter(x => x !== r) : [...rs, r]));
  const reset = (m: 'demand' | 'offer') => {
    setMode(m);
    setRegions([]);
    setGold(0);
    setVassalize(false);
    setRelease([]);
  };
  const canVassalize = mode === 'demand' && !s.nations[enemy].overlord && subjectsOf(s, enemy).length === 0;
  // Nations the enemy could be made to free: its subjects, and fallen peoples whose old lands it holds.
  const releasable =
    mode === 'demand'
      ? [...subjectsOf(s, enemy), ...Object.keys(NATION).filter(n => n !== enemy && n !== s.player && !s.nations[n]?.alive && ownedRegions(s, enemy).some(r => r.cores.includes(n)))]
      : [];
  const budget = mode === 'demand' ? sc : -sc;

  // How the war has gone.
  const battles = warBattles(s, w, ours, theirs);
  const won = battles.filter(b => b.won).length;
  const heldOfTheirs = Object.values(s.regions).filter(r => isIn(theirs, r.owner) && isIn(ours, r.controller)).length;
  const heldOfOurs = Object.values(s.regions).filter(r => isIn(ours, r.owner) && isIn(theirs, r.controller)).length;
  const myWe = s.nations[s.player].warExhaustion;
  const theirWe = s.nations[enemy]?.warExhaustion ?? 0;

  const footer = isLeader ? (
    <View>
      <View style={styles.deal}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dealLabel}>{anyTerms ? (mode === 'demand' ? `Terms ${cost}%` : `Worth ${cost}% to them`) : `${mode === 'demand' ? 'Leverage' : 'Their leverage'} ${signed(budget)}%`}</Text>
          {anyTerms ? <Text style={styles.dealSub}>{mode === 'demand' ? 'Leverage' : 'Their leverage'} {signed(budget)}%</Text> : null}
        </View>
        {anyTerms ? (
          <View style={[styles.verdict, { borderColor: answer.accept ? G.good : G.bad }]}>
            <Icon name={answer.accept ? 'check' : 'close'} size={13} color={answer.accept ? G.good : G.bad} />
            <Text style={[styles.verdictText, { color: answer.accept ? G.good : G.bad }]}>{answer.accept ? 'They accept' : 'They refuse'}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <Btn
          style={{ flex: 1 }}
          tone="secondary"
          label="White peace"
          sub={whiteAnswer.accept ? 'they’d accept' : 'they’d refuse'}
          onPress={() => {
            const r = st.run(x => proposePeace(x, w.id, white));
            if (r.ok) st.close();
          }}
        />
        <Btn
          style={{ flex: 1.3 }}
          label={mode === 'demand' ? 'Send demands' : 'Offer these terms'}
          disabled={!anyTerms}
          testID="send-peace"
          onPress={() => {
            const r = st.run(x => proposePeace(x, w.id, terms));
            if (r.ok) st.close();
          }}
        />
      </View>
    </View>
  ) : (
    <Btn tone="secondary" label="Make a separate peace" onPress={() => (st.run(x => separatePeace(x, w.id)), st.close())} />
  );

  return (
    <Panel title="War" onClose={() => st.close()} footer={footer}>
      {/* Both sides under their arms. */}
      <View style={styles.hero}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="warSky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#2b1611" />
              <Stop offset="1" stopColor="#13161c" />
            </LinearGradient>
            <RadialGradient id="warEmber" cx="0.8" cy="0.42" r="0.5">
              <Stop offset="0" stopColor="#ff5a14" stopOpacity={0.28} />
              <Stop offset="1" stopColor="#ff5a14" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#warSky)" />
          <Rect width="100%" height="100%" fill="url(#warEmber)" />
        </Svg>
        <Text style={styles.warName} numberOfLines={2}>
          {w.name}
        </Text>
        <View style={styles.sides}>
          <SideColumn nations={ours} label={side === 0 ? 'Attacking' : 'Defending'}>
            <ShieldMedallion nation={leader} size={36} />
          </SideColumn>
          <View style={styles.vs}>
            <Icon name="swords" size={20} color={G.goldBright} />
          </View>
          <SideColumn nations={theirs} label={side === 0 ? 'Defending' : 'Attacking'}>
            <BurningShield nation={enemy} size={36} seed={7} />
          </SideColumn>
        </View>
        <View style={styles.reason}>
          <Icon name="scroll" size={14} color={G.gold} />
          <Text style={styles.reasonText} numberOfLines={2}>
            {w.cb === 'none' ? 'Fought without a reason for war' : CB_LABEL[w.cb]}
            {w.goal ? ` · war goal: ${regionName(w.goal)}` : ''}
          </Text>
        </View>
        <Text style={styles.since}>
          Since {formatShortDate(w.started)} · {duration(s.day - w.started)}
        </Text>
      </View>

      {/* Their ultimatum: what they demand, and when it takes effect. */}
      {ult ? (
        <View style={[styles.card, styles.ultimatum]} testID="ultimatum">
          <View style={styles.levTitle}>
            <Icon name="scroll" size={14} color={G.bad} />
            <Text style={[styles.cardTitle, { color: G.bad }]}>Ultimatum</Text>
          </View>
          <View style={{ marginTop: 6 }}>
            {ult.terms.regions.map(r => (
              <Line key={r} label={`${regionName(r)} goes to`} value={nationName(ult.from)} tone="bad" />
            ))}
            {ult.terms.gold ? <Line label="You pay" value={`${ult.terms.gold} gold`} tone="bad" /> : null}
            <Line
              label="Takes effect"
              value={formatDate(ult.due)}
              help={`Sent at ${ULTIMATUM_SCORE}% leverage, asking no more than it buys. If they still hold ${ULTIMATUM_SCORE}% on this day, these terms are imposed; push them below it and the ultimatum lapses. Any peace signed first ends it.`}
            />
          </View>
          {isLeader ? (
            <Btn
              style={{ marginTop: 10 }}
              tone="secondary"
              label="Accept their terms"
              testID="accept-ultimatum"
              onPress={() => {
                const r = st.run(x => proposePeace(x, w.id, ult.terms));
                if (r.ok) st.close();
              }}
            />
          ) : null}
        </View>
      ) : null}

      {/* Leverage: a tug of war, and what it is made of. */}
      <View style={styles.card}>
        <View style={styles.levHead}>
          <View style={styles.levTitle}>
            <Text style={styles.cardTitle}>Leverage</Text>
            <HelpButton open={levHelp} onPress={() => setLevHelp(o => !o)} label="About leverage" />
          </View>
          <Text style={[styles.levValue, { color: tone(sc) }]}>{signed(sc)}%</Text>
        </View>
        {levHelp ? (
          <HelpNote style={{ marginTop: 8 }}>
            What you can ask for in a peace: the sum of the four parts below. Battles count by their size, occupation by the prosperity of the land you hold, the war goal while you hold it, blockades by their coasts your fleets close.
          </HelpNote>
        ) : null}
        <TugOfWar value={sc} />
        <View style={styles.parts}>
          <Part icon="swords" label="Battles" value={ws.battles * flip} />
          <Part icon="flag" label="Occupation" value={ws.occupation * flip} />
          <Part icon="target" label="War goal" value={ws.goal * flip} />
          <Part icon="ship" label="Blockades" value={ws.blockade * flip} />
        </View>
      </View>

      {/* How the fighting has gone. */}
      <Section
        title="The war so far"
        help={`Each pair is your side, then theirs. Land held: regions of the other side's that each side occupies. War exhaustion grows with every month at war and every man lost; it slows your levies (now −${Math.round(Math.min(0.7, myWe / 30) * 100)}%), stirs unrest, and fades in peace. Under each battle: your losses, then theirs.`}
      >
        <View style={styles.tiles}>
          <Tile label="Battles" value={battles.length ? `${won} won · ${battles.length - won} lost` : 'None yet'} />
          <Versus label="Men lost" us={battles.length ? kmen(battles.reduce((t, b) => t + b.lostUs, 0)) : '0'} them={battles.length ? kmen(battles.reduce((t, b) => t + b.lostThem, 0)) : '0'} a={leader} b={enemy} />
          <Versus label="Land held" us={`${heldOfTheirs}`} them={`${heldOfOurs}`} a={leader} b={enemy} />
          <Versus label="War exhaustion" us={fmt(myWe, 1)} them={fmt(theirWe, 1)} a={leader} b={enemy} bad={myWe > theirWe + 2} />
        </View>
        {battles.length ? (
          <View style={{ marginTop: 10 }}>
            {battles.slice(0, 5).map(b => (
              <Pressable key={b.r.id} onPress={() => st.open({ kind: 'report', id: b.r.id })} style={({ pressed }) => [styles.battle, pressed && { opacity: 0.6 }]}>
                <View style={[styles.battleMark, { backgroundColor: b.won ? 'rgba(128,200,144,0.16)' : 'rgba(236,122,104,0.16)' }]}>
                  <Icon name={b.won ? 'check' : 'close'} size={13} color={b.won ? G.good : G.bad} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.battleTitle}>Battle of {regionName(b.r.node)}</Text>
                  <Text style={styles.battleSub}>
                    {formatShortDate(b.r.day)}
                    {b.r.wiped ? ' · annihilated' : ''}
                  </Text>
                </View>
                <Text style={styles.battleLoss}>
                  −{kmen(b.lostUs)} / −{kmen(b.lostThem)}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Section>

      {/* The peace table. */}
      {!isLeader ? (
        <Section title="Peace">
          <T v="small">{nationName(leader)} leads the peace talks.</T>
        </Section>
      ) : (
        <>
          <Section
            title="Peace"
            help={
              mode === 'demand'
                ? 'Each term costs leverage: the % beside a region (less if you claim it, double for a capital), 1% for every 10 gold. Ask for more than your leverage and they refuse. A vassal pays you tribute and fights your wars, and can be annexed after 15 years.'
                : `Offer any of your land, or gold. The % beside a region is what it is worth to ${nationName(enemy)}: its full price if it is next to their land, they claim, want or hold it, or it is the war goal; half for land far from them. Gold is 1% for every 10. They accept if it covers their leverage.`
            }
          >
            <View style={styles.seg}>
              {(['demand', 'offer'] as const).map(m => (
                <Pressable key={m} testID={`peace-mode-${m}`} onPress={() => reset(m)} style={[styles.segItem, mode === m && styles.segOn]}>
                  <Text style={[styles.segText, mode === m && styles.segTextOn]}>{m === 'demand' ? 'Demand' : 'Offer concessions'}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.sub}>{mode === 'demand' ? 'Regions to take' : 'Regions to give up'}</Text>
            {candidates.length ? (
              candidates.map(({ r, price, why }) => {
                const on = regions.includes(r);
                const reg = s.regions[r];
                return (
                  <Pressable key={r} testID={`peace-${r}`} onPress={() => toggle(r)} style={[styles.option, on && styles.optionOn]}>
                    <Shield nation={reg.owner ?? REBELS} size={22} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionText}>{regionName(r)}</Text>
                      <Text style={styles.optionSub}>
                        Prosperity {reg.dev}
                        {mode === 'offer' ? ` · ${why}` : ''}
                        {mode === 'demand' && (r in s.nations[winner].claims || reg.cores.includes(winner)) ? ' · claimed' : ''}
                        {mode === 'demand' && reg.controller === winner ? ' · occupied' : ''}
                        {isCapitalAtStake(s, r) ? ' · capital' : ''}
                      </Text>
                    </View>
                    <View style={[styles.cost, on && styles.costOn]}>
                      <Text style={[styles.costText, on && { color: '#1a1408' }]}>{price}%</Text>
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <Empty text={mode === 'demand' ? 'Occupy or claim their regions to demand them.' : 'You have no land to offer.'} />
            )}
            <Text style={styles.sub}>{mode === 'demand' ? 'Gold reparations' : 'Pay gold'}</Text>
            <View style={styles.seg}>
              {[0, 50, 100, 200, 400].map(g => {
                // You can't offer gold you don't have.
                const short = mode === 'offer' && g > myGold;
                return (
                  <Pressable key={g} disabled={short} onPress={() => setGold(g)} style={[styles.segItem, gold === g && styles.segOn, short && { opacity: 0.35 }]}>
                    <Text style={[styles.segText, gold === g && styles.segTextOn]}>{g ? `${g}` : 'None'}</Text>
                  </Pressable>
                );
              })}
            </View>
            {releasable.length ? (
              <>
                <Text style={styles.sub}>Free a nation</Text>
                {releasable.map(n => {
                  const on = release.includes(n);
                  return (
                    <Pressable key={n} onPress={() => setRelease(rs => (on ? rs.filter(x => x !== n) : [...rs, n]))} style={[styles.option, on && styles.optionOn]}>
                      <Shield nation={n} size={22} />
                      <Text style={[styles.optionText, { flex: 1 }]}>{nationName(n)}</Text>
                      {on ? <Icon name="check" size={16} color={G.gold} /> : null}
                    </Pressable>
                  );
                })}
              </>
            ) : null}
            {canVassalize ? (
              <Pressable onPress={() => setVassalize(v => !v)} style={[styles.option, vassalize && styles.optionOn, { marginTop: 10 }]}>
                <Icon name="crown" size={18} color={G.gold} />
                <Text style={[styles.optionText, { flex: 1 }]}>Make {nationName(enemy)} your vassal</Text>
                {vassalize ? <Icon name="check" size={16} color={G.gold} /> : null}
              </Pressable>
            ) : null}
          </Section>
          {anyTerms ? (
            <Section title="Their answer" help={`${nationName(enemy)} accepts if these add up to 0 or more.`}>
              {answer.reasons
                .filter(r => r.value)
                .map(r => (
                  <Line key={r.label} label={r.label} value={signed(r.value)} tone={r.value >= 0 ? 'good' : 'bad'} />
                ))}
              <Line label="Total" value={signed(answer.reasons.reduce((t, r) => t + r.value, 0))} tone={answer.accept ? 'good' : 'bad'} bold />
            </Section>
          ) : null}
        </>
      )}
    </Panel>
  );
}

/** One side of the war: its leader's arms, what it is doing, its allies' shields. */
function SideColumn({ nations, label, children }: { nations: NationId[]; label: string; children: ReactNode }) {
  const lead = nations[0];
  return (
    <View style={styles.sideCol}>
      {children}
      <Text style={styles.sideName} numberOfLines={1}>
        {lead === REBELS ? 'Rebels' : nationName(lead)}
      </Text>
      <Text style={styles.sideRole}>{label}</Text>
      {nations.length > 1 ? (
        <View style={styles.allies}>
          {nations.slice(1, 7).map(n => (
            <Shield key={n} nation={n} size={16} />
          ))}
          {nations.length > 7 ? <Text style={styles.more}>+{nations.length - 7}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

/** The leverage from −100 to +100: the bar pulls toward whoever is winning. */
function TugOfWar({ value }: { value: number }) {
  const v = Math.max(-100, Math.min(100, value));
  const half = Math.abs(v) / 2;
  return (
    <View style={styles.tug}>
      <View style={[styles.tugFill, v >= 0 ? { left: '50%', width: `${half}%`, backgroundColor: G.good } : { right: '50%', width: `${half}%`, backgroundColor: G.bad }]} />
      <View style={styles.tugMid} />
      <View style={[styles.knob, { left: `${50 + v / 2}%` }]} />
    </View>
  );
}

function Part({ icon, label, value }: { icon: IconName; label: string; value: number }) {
  return (
    <View style={styles.part}>
      <View style={styles.partHead}>
        <Icon name={icon} size={13} color={G.gold} />
        <Text style={styles.partLabel}>{label}</Text>
      </View>
      <Text style={[styles.partValue, { color: value > 0 ? G.good : value < 0 ? G.bad : G.text2 }]}>{signed(value)}</Text>
    </View>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

/** A number for each side, each beside its arms: no caption needed to say whose is whose. */
function Versus({ label, us, them, a, b, bad }: { label: string; us: string; them: string; a: NationId; b: NationId; bad?: boolean }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <View style={styles.versus}>
        <Shield nation={a} size={14} />
        <Text style={[styles.tileValue, { marginTop: 0 }, bad && { color: G.bad }]}>{us}</Text>
        <Text style={styles.vsDot}>·</Text>
        <Shield nation={b} size={14} />
        <Text style={[styles.tileValue, { marginTop: 0 }]}>{them}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: R.lg, overflow: 'hidden', paddingTop: 14, paddingBottom: 14, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: G.gilt },
  warName: { fontFamily: display, fontSize: 20, color: G.text, textAlign: 'center', letterSpacing: 0.4 },
  sides: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
  sideCol: { flex: 1, alignItems: 'center' },
  sideName: { fontFamily: displaySemi, fontSize: 14, color: G.text, marginTop: 4, letterSpacing: 0.3 },
  sideRole: { fontFamily: sans, fontSize: 11.5, color: G.text3, marginTop: 1, textTransform: 'uppercase', letterSpacing: 1 },
  allies: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 3, marginTop: 6, maxWidth: 130 },
  more: { color: G.text2, fontFamily: sans, fontSize: 12, fontWeight: '700', alignSelf: 'center' },
  vs: { width: 40, height: 40, borderRadius: 20, marginTop: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(13,16,21,0.85)', borderWidth: 1, borderColor: G.gilt },
  reason: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 },
  reasonText: { color: G.text, fontFamily: sans, fontSize: 13.5, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  since: { color: G.text3, fontFamily: sans, fontSize: 12, textAlign: 'center', marginTop: 3 },
  card: { marginTop: 12, backgroundColor: G.group, borderRadius: R.lg, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: G.line },
  ultimatum: { borderWidth: 1, borderColor: G.bad, backgroundColor: 'rgba(236,122,104,0.08)' },
  cardTitle: { fontFamily: displaySemi, fontSize: 12, color: G.gold, letterSpacing: 1.6, textTransform: 'uppercase' },
  levHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  levTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  levValue: { fontFamily: display, fontSize: 30 },
  tug: { height: 12, borderRadius: 6, backgroundColor: G.raised, marginTop: 10, justifyContent: 'center' },
  tugFill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 6 },
  tugMid: { position: 'absolute', left: '50%', width: 2, marginLeft: -1, top: -3, bottom: -3, backgroundColor: G.text2, borderRadius: 1 },
  knob: { position: 'absolute', width: 14, height: 14, marginLeft: -7, borderRadius: 3, backgroundColor: G.goldBright, borderWidth: 2, borderColor: '#1a1408', transform: [{ rotate: '45deg' }] },
  parts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  part: { flexBasis: '48%', flexGrow: 1, backgroundColor: G.raised, borderRadius: R.md, padding: 10 },
  partHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  partLabel: { color: G.text2, fontFamily: sans, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  partValue: { fontFamily: sans, fontSize: 20, fontWeight: '700', marginTop: 4, fontVariant: ['tabular-nums'] },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tile: { flexBasis: '48%', flexGrow: 1, backgroundColor: G.group, borderRadius: R.md, padding: 10 },
  tileLabel: { color: G.text3, fontFamily: sans, fontSize: 11.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  tileValue: { color: G.text, fontFamily: sans, fontSize: 17, fontWeight: '700', marginTop: 3, fontVariant: ['tabular-nums'] },
  versus: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  vsDot: { color: G.text3, fontFamily: sans, fontSize: 15, marginHorizontal: 2 },
  battle: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: G.line },
  battleMark: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  battleTitle: { color: G.text, fontFamily: sans, fontSize: 14.5, fontWeight: '600' },
  battleSub: { color: G.text3, fontFamily: sans, fontSize: 12, marginTop: 1 },
  battleLoss: { color: G.text2, fontFamily: sans, fontSize: 12.5, fontVariant: ['tabular-nums'] },
  seg: { flexDirection: 'row', backgroundColor: G.raised, borderRadius: R.pill, padding: 3, gap: 2 },
  segItem: { flex: 1, height: 34, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segOn: { backgroundColor: G.gold },
  segText: { color: G.text2, fontFamily: sans, fontSize: 13.5, fontWeight: '600' },
  segTextOn: { color: '#1a1408', fontWeight: '700' },
  sub: { color: G.text2, fontFamily: sans, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 14, marginBottom: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: G.group, borderRadius: R.md, padding: 11, borderWidth: 1.5, borderColor: 'transparent', marginBottom: 6 },
  optionOn: { borderColor: G.gold, backgroundColor: 'rgba(214,178,110,0.12)' },
  optionText: { fontFamily: sans, fontSize: 15, fontWeight: '600', color: G.text },
  optionSub: { fontFamily: sans, fontSize: 12, color: G.text3, marginTop: 2 },
  cost: { minWidth: 46, height: 26, paddingHorizontal: 8, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: G.raised },
  costOn: { backgroundColor: G.gold },
  costText: { fontFamily: sans, fontSize: 13, fontWeight: '800', color: G.text, fontVariant: ['tabular-nums'] },
  deal: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dealLabel: { color: G.text, fontFamily: sans, fontSize: 15, fontWeight: '700' },
  dealSub: { color: G.text3, fontFamily: sans, fontSize: 12.5, marginTop: 1 },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 28, borderRadius: 14, borderWidth: 1 },
  verdictText: { fontFamily: sans, fontSize: 13, fontWeight: '700' },
});
