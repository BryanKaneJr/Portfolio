/** Realm menu tab: science a month, what your scholars study, and the three tracks of advances (war, sea, statecraft). */
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { ADVANCE, ERA } from '../../sim/content';
import { setResearch, setScienceFunding } from '../../sim/commands';
import { ledger } from '../../sim/economy';
import { FIELDS, FUNDING_BOOST, FUNDING_SHARE, UNIVERSITY_MIN_DEV, UNIVERSITY_SCIENCE, advanceCost, advanceUnlockText, availableAdvances, knows, scienceRate, studies, track } from '../../sim/science';
import type { AdvanceDef } from '../../sim/types';
import { useStore } from '../../state/store';
import { Icon, type IconName } from '../components/Icon';
import { Bar, Line, Pill, Row, Section, Stat, T } from '../components/kit';
import { modLines } from '../describe';
import { Endowment } from './Endowment';
import { C, fmt, sans } from '../theme';

const FIELD: Record<AdvanceDef['field'], { label: string; icon: IconName }> = {
  war: { label: 'War', icon: 'cannon' },
  sea: { label: 'Sea', icon: 'ship' },
  state: { label: 'Statecraft', icon: 'scroll' },
};

/** What an advance gives, as short green lines. */
function Gives({ a }: { a: AdvanceDef }) {
  const lines = [advanceUnlockText(a), ...(a.mods ? modLines(a.mods).map(m => m.text) : [])].filter(Boolean);
  return (
    <View style={{ marginTop: 3 }}>
      {lines.map(l => (
        <Text key={l} style={styles.gives}>
          • {l}
        </Text>
      ))}
    </View>
  );
}

const eta = (months: number) => (months <= 1 ? 'next month' : months < 18 ? `about ${Math.ceil(months)} months` : `about ${Math.round(months / 12)} years`);

export function ScienceTab() {
  const st = useStore();
  const s = st.state!;
  const p = s.player;
  const me = s.nations[p];
  const rate = scienceRate(s, p);
  const [why, setWhy] = useState(false);
  const [whyCost, setWhyCost] = useState(false);
  if (!studies(s, p)) return <T v="small">Your people follow their own ways.</T>;
  const open = new Set(availableAdvances(s, p).map(a => a.id));
  const current = me.researching ? ADVANCE[me.researching] : undefined;
  const cost = current ? advanceCost(s, p, current.id) : undefined;
  const monthsFor = (c: number) => (rate.total > 0 ? Math.max(0, (c - me.science) / rate.total) : 999);
  const known = me.advances.length;
  const fundingGold = ledger(s, p).totalIncome * FUNDING_SHARE;

  return (
    <View>
      <Row gap={6}>
        <Stat label="Science / month" value={fmt(rate.total, 1)} icon="book" onPress={() => setWhy(w => !w)} />
        <Stat label="Advances" value={`${known} / 12`} icon="star" />
        <Stat label="Troops" value={ERA(me.era).name} icon="swords" />
      </Row>
      {why ? (
        <View style={{ marginTop: 8 }}>
          {rate.sources.map(l => (
            <Line key={l.label} label={l.label} value={`+${l.value.toFixed(1)}`} />
          ))}
          {rate.factors.map(f => (
            <Line key={f.label} label={f.label} value={`×${f.value.toFixed(2)}`} tone={f.value >= 1 ? 'good' : 'bad'} />
          ))}
        </View>
      ) : null}

      <View style={styles.funding}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>Fund your scholars</Text>
          <T v="tiny">+{Math.round(FUNDING_BOOST * 100)}% science · {fmt(fundingGold, 1)} gold a month</T>
        </View>
        <Switch value={!!me.scienceFunding} onValueChange={v => void st.run(z => setScienceFunding(z, v))} trackColor={{ true: C.gold, false: C.parchmentLine }} testID="funding" />
      </View>
      <Endowment fields={FIELD} />

      <Section
        title="Studying"
        help={`Learning lives in rich towns: raise the prosperity of your best regions, found universities (prosperity ${UNIVERSITY_MIN_DEV}+, +${UNIVERSITY_SCIENCE} a month each) and fund your scholars (a tenth of your income). Tap Science / month for where it comes from. Big realms pay more for each advance; an advance costs more the earlier you take it and less once your neighbours know it. Every three advances open a policy slot.`}
      >
        {current && cost ? (
          <View>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="h3" style={{ flex: 1 }}>{current.name}</T>
              <T v="tiny">{eta(monthsFor(cost.total))}</T>
            </Row>
            <Bar value={me.science / cost.total} color={C.gold} height={8} />
            <Gives a={current} />
            <Line label="Science" value={`${fmt(me.science)} / ${fmt(cost.total)}`} onPress={() => setWhyCost(w => !w)} />
            {whyCost ? (
              <View style={{ marginTop: 4 }}>
                <Line label="Base cost" value={fmt(cost.base)} tone="muted" />
                {cost.factors.map(f => (
                  <Line key={f.label} label={f.label} value={`×${f.value.toFixed(2)}`} tone={f.value <= 1 ? 'good' : 'bad'} />
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.idle}>
            <Icon name="book" size={18} color={C.red} />
            <T v="small" style={{ flex: 1 }}>{open.size ? 'Nothing: pick an advance below.' : 'Everything is learned.'}</T>
          </View>
        )}
      </Section>

      {FIELDS.map(field => {
        const steps = track(field);
        const next = steps.find(a => open.has(a.id));
        return (
          <Section key={field} title={FIELD[field].label}>
            <View style={styles.steps}>
              {steps.map(a => (
                <View key={a.id} style={[styles.step, knows(me, a.id) && styles.stepDone, a.id === me.researching && styles.stepNow]}>
                  <Text style={[styles.stepText, knows(me, a.id) && { color: C.chromeText }]} numberOfLines={2}>
                    {knows(me, a.id) ? '✓ ' : ''}
                    {a.name}
                  </Text>
                </View>
              ))}
            </View>
            {next ? (
              <Pressable onPress={() => st.run(z => setResearch(z, me.researching === next.id ? null : next.id))} style={[styles.card, me.researching === next.id && styles.cardOn]} testID={`advance-${next.id}`}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row gap={6} style={{ flex: 1 }}>
                    <Icon name={FIELD[field].icon} size={16} color={C.goldDark} />
                    <Text style={styles.name}>{next.name}</Text>
                  </Row>
                  <Pill text={me.researching === next.id ? 'Studying' : eta(monthsFor(advanceCost(s, p, next.id).total))} color={me.researching === next.id ? C.gold : C.parchment2} textColor={me.researching === next.id ? '#1a1408' : undefined} />
                </Row>
                <Text style={styles.desc}>{next.desc}</Text>
                <Gives a={next} />
                <Text style={styles.meta}>c. {next.year}</Text>
              </Pressable>
            ) : (
              <T v="tiny">{steps.every(a => knows(me, a.id)) ? 'All learned.' : 'Learn the earlier advances first.'}</T>
            )}
          </Section>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  funding: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: C.parchment2 },
  steps: { flexDirection: 'row', gap: 4, marginBottom: 6 },
  step: { flex: 1, minHeight: 34, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 3, backgroundColor: C.parchment2, justifyContent: 'center' },
  stepDone: { backgroundColor: C.green },
  stepNow: { borderWidth: 2, borderColor: C.gold },
  stepText: { fontFamily: sans, fontSize: 10, fontWeight: '700', color: C.inkSoft, textAlign: 'center' },
  card: { padding: 10, borderRadius: 10, borderWidth: 1, borderColor: C.parchmentLine, backgroundColor: C.parchment },
  cardOn: { borderColor: C.gold, borderWidth: 2, backgroundColor: 'rgba(214,178,110,0.14)' },
  name: { fontFamily: sans, fontSize: 15, fontWeight: '700', color: C.ink, flexShrink: 1 },
  desc: { fontFamily: sans, fontSize: 12, color: C.inkSoft, marginTop: 3, lineHeight: 16 },
  gives: { fontFamily: sans, fontSize: 12, fontWeight: '600', color: C.green },
  meta: { fontFamily: sans, fontSize: 11, color: C.muted, marginTop: 4 },
  idle: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 10, borderRadius: 10, backgroundColor: C.redSoft },
});
