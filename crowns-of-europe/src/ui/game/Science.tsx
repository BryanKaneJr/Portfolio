/** Realm menu tab: science per month (and why), what your scholars study, funding, and every advance. */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ADVANCES, ERA } from '../../sim/content';
import { setResearch, setScienceFunding } from '../../sim/commands';
import { FUNDING, UNIVERSITY_MIN_DEV, UNIVERSITY_SCIENCE, advanceCost, advanceUnlockText, availableAdvances, knows, policySlots, scienceRate, universityCost } from '../../sim/science';
import { ownedRegions } from '../../sim/queries';
import type { AdvanceDef } from '../../sim/types';
import { useStore } from '../../state/store';
import { Icon, type IconName } from '../components/Icon';
import { Bar, Btn, Empty, Line, Pill, Row, Section, Stat, T } from '../components/kit';
import { modLines } from '../describe';
import { C, fmt, sans } from '../theme';

const FIELD: Record<AdvanceDef['field'], { label: string; icon: IconName }> = {
  war: { label: 'War', icon: 'cannon' },
  sea: { label: 'Sea', icon: 'ship' },
  state: { label: 'Statecraft', icon: 'scroll' },
};
const x = (v: number) => `×${v.toFixed(2)}`;

/** What an advance gives: its unlock and its modifiers. */
function Gives({ a }: { a: AdvanceDef }) {
  const unlock = advanceUnlockText(a);
  const mods = a.mods ? modLines(a.mods) : [];
  return (
    <View style={{ marginTop: 3 }}>
      {unlock ? <Text style={[styles.gives, { color: C.green }]}>• {unlock}</Text> : null}
      {mods.map(m => (
        <Text key={m.text} style={[styles.gives, { color: m.good ? C.green : C.red }]}>
          • {m.text}
        </Text>
      ))}
    </View>
  );
}

export function ScienceTab() {
  const st = useStore();
  const s = st.state!;
  const p = s.player;
  const me = s.nations[p];
  const rate = scienceRate(s, p);
  const [why, setWhy] = useState(false);
  const [showKnown, setShowKnown] = useState(false);
  const options = availableAdvances(s, p);
  const current = me.researching ? ADVANCES.find(a => a.id === me.researching) : undefined;
  const cost = current ? advanceCost(s, p, current.id) : undefined;
  const months = cost && rate.total > 0 ? Math.max(0, (cost.total - me.science) / rate.total) : 0;
  const known = ADVANCES.filter(a => knows(me, a.id));
  const locked = ADVANCES.filter(a => !knows(me, a.id) && !options.includes(a));
  const unis = ownedRegions(s, p).filter(r => r.university).length;

  return (
    <View>
      <Row gap={6}>
        <Stat label="Science / month" value={fmt(rate.total, 1)} icon="book" onPress={() => setWhy(w => !w)} />
        <Stat label="Advances" value={`${known.length} / ${ADVANCES.length}`} icon="star" />
        <Stat label="Troops' age" value={ERA(me.era).name} icon="swords" />
      </Row>
      {why ? (
        <View style={{ marginTop: 8 }}>
          {rate.sources.map(l => (
            <Line key={l.label} label={l.label} value={`+${l.value.toFixed(1)}`} />
          ))}
          {rate.factors.map(f => (
            <Line key={f.label} label={f.label} value={x(f.value)} tone={f.value >= 1 ? 'good' : 'bad'} />
          ))}
          <Line label="Science each month" value={fmt(rate.total, 1)} bold />
        </View>
      ) : (
        <T v="tiny" style={{ marginTop: 4 }}>Tap science to see where it comes from. Rich towns, trade centres, universities and funding all add to it; Italy and the West learn fastest.</T>
      )}

      <Section title="Your scholars are studying">
        {current && cost ? (
          <View>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="h3" style={{ flex: 1 }}>{current.name}</T>
              <Pill text={`${fmt(me.science)} / ${fmt(cost.total)}`} />
            </Row>
            <Bar value={me.science / cost.total} color={C.gold} height={8} />
            <T v="tiny" style={{ marginTop: 4 }}>
              {months <= 0 ? 'Ready next month.' : `About ${months >= 18 ? `${Math.round(months / 12)} years` : `${Math.ceil(months)} months`} at this pace.`}
            </T>
            <Gives a={current} />
            <View style={{ marginTop: 6 }}>
              <Line label="Base cost" value={fmt(cost.base)} tone="muted" />
              {cost.factors.map(f => (
                <Line key={f.label} label={f.label} value={x(f.value)} tone={f.value <= 1 ? 'good' : 'bad'} />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.idle}>
            <Icon name="book" size={18} color={C.red} />
            <T v="small" style={{ flex: 1 }}>
              {options.length ? `Nothing. Pick an advance below; your ${fmt(me.science)} science is kept until you do.` : 'Your scholars have learned everything there is to learn.'}
            </T>
          </View>
        )}
      </Section>

      <Section title="Funding">
        <Row gap={6}>
          {FUNDING.map((f, i) => (
            <Btn key={f.label} small style={{ flex: 1 }} tone={me.scienceFunding === i ? 'primary' : 'secondary'} label={f.label} sub={f.gold ? `${f.gold}g · +${f.science}` : 'free'} onPress={() => st.run(z => setScienceFunding(z, i))} testID={`funding-${i}`} />
          ))}
        </Row>
        <T v="tiny" style={{ marginTop: 4 }}>
          Gold a month paid to scholars, and the science it adds before your learning factor. Universities add +{UNIVERSITY_SCIENCE} each: found one from a region of prosperity {UNIVERSITY_MIN_DEV}+ (you have {unis}; the next costs {universityCost(s, p)} gold).
        </T>
      </Section>

      <Section title="Choose what to study">
        {options.length ? (
          options.map(a => {
            const c = advanceCost(s, p, a.id).total;
            const on = me.researching === a.id;
            return (
              <Pressable key={a.id} onPress={() => st.run(z => setResearch(z, on ? null : a.id))} style={[styles.card, on && styles.cardOn]} testID={`advance-${a.id}`}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row gap={6} style={{ flex: 1 }}>
                    <Icon name={FIELD[a.field].icon} size={16} color={C.goldDark} />
                    <Text style={styles.name}>{a.name}</Text>
                  </Row>
                  <Text style={styles.cost}>{fmt(c)}</Text>
                </Row>
                <Text style={styles.desc}>{a.desc}</Text>
                <Gives a={a} />
                <Text style={styles.meta}>
                  {FIELD[a.field].label} · historically about {a.year}
                  {on ? ' · studying now' : ''}
                </Text>
              </Pressable>
            );
          })
        ) : (
          <Empty text="Nothing left to study." />
        )}
        <T v="tiny" style={{ marginTop: 4 }}>
          An advance costs more the earlier you take it than its historical year, and less once neighbours know it. Science is never lost when you switch. Every five advances open a policy slot (you have {policySlots(me)}).
        </T>
      </Section>

      {locked.length ? (
        <Section title="Later">
          {locked.map(a => (
            <View key={a.id} style={[styles.card, { opacity: 0.55 }]}>
              <Row gap={6}>
                <Icon name={FIELD[a.field].icon} size={14} color={C.muted} />
                <Text style={[styles.name, { fontSize: 14 }]}>{a.name}</Text>
              </Row>
              <Text style={styles.meta}>Needs {a.requires.filter(r => !knows(me, r)).map(r => ADVANCES.find(z => z.id === r)!.name).join(' and ')} · about {a.year}</Text>
            </View>
          ))}
        </Section>
      ) : null}

      <Section title={`Known (${known.length})`} right={<Btn small tone="ghost" label={showKnown ? 'Hide' : 'Show'} onPress={() => setShowKnown(v => !v)} />}>
        {showKnown ? (
          known.map(a => (
            <View key={a.id} style={styles.card}>
              <Row gap={6}>
                <Icon name="check" size={14} color={C.green} />
                <Text style={[styles.name, { fontSize: 14 }]}>{a.name}</Text>
              </Row>
              <Gives a={a} />
            </View>
          ))
        ) : (
          <T v="tiny">{known.map(a => a.name).join(', ') || 'None yet.'}</T>
        )}
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 10, borderRadius: 10, borderWidth: 1, borderColor: C.parchmentLine, backgroundColor: C.parchment, marginBottom: 6 },
  cardOn: { borderColor: C.gold, borderWidth: 2, backgroundColor: '#f6ebcd' },
  name: { fontFamily: sans, fontSize: 15, fontWeight: '700', color: C.ink, flexShrink: 1 },
  cost: { fontFamily: sans, fontSize: 14, fontWeight: '800', color: C.goldDark },
  desc: { fontFamily: sans, fontSize: 12, color: C.inkSoft, marginTop: 3, lineHeight: 16 },
  gives: { fontFamily: sans, fontSize: 12, fontWeight: '600' },
  meta: { fontFamily: sans, fontSize: 11, color: C.muted, marginTop: 4 },
  idle: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 10, borderRadius: 10, backgroundColor: C.redSoft },
});
