/** Greater crowns in the Realm tab: the crowns you may proclaim, how near you are, and a Proclaim button when ready. */
import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CROWN, CROWNS, NATION, regionName } from '../../sim/content';
import { crownProgress, proclaimedBy, type CrownProgress } from '../../sim/crowns';
import { proclaimCrown } from '../../sim/commands';
import { yearOf } from '../../sim/util';
import { useStore } from '../../state/store';
import { Flag } from '../components/Flag';
import { Btn, Section, T } from '../components/kit';
import { C, sans } from '../theme';
import { modLines } from '../describe';

const HELP =
  'Hold a crown’s lands and its key regions to proclaim it: you take its name, arms and a lasting bonus, and claims on the lands you still lack. You must be at peace, no one’s subject, with order 0 or better. Lands of your junior partners in a shared crown count. Each crown is proclaimed once a game, and one crown leads on only to a greater one that names it.';

/** A former, as a name: a nation's, or a smaller crown's. */
const formerName = (f: string) => NATION[f]?.name ?? CROWN[f]?.name ?? f;

export function CrownsSection() {
  const st = useStore();
  const s = st.state!;
  const p = s.player;
  const me = s.nations[p];
  const [open, setOpen] = useState<string | null>(null);
  const aims = crownProgress(s, p);
  // Crowns yours could have led on to, taken by someone else.
  const taken = CROWNS.filter(
    c => c.formers.includes(me.crown ?? p) && proclaimedBy(s, c.id) && proclaimedBy(s, c.id)!.by !== p,
  );
  if (!aims.length && !taken.length && !me.crown) return null;
  const year = yearOf(s.day);
  const rows = [...aims.filter(a => a.ready), ...aims.filter(a => !a.ready)];
  return (
    <Section title="Greater crowns" help={HELP}>
      {me.crown ? (
        <T v="small">
          Your crown: {CROWN[me.crown].name}, since {yearOf(me.flags['crown_' + me.crown])}
        </T>
      ) : null}
      {rows.map(a => (
        <CrownRow
          key={a.id}
          a={a}
          year={year}
          open={open === a.id}
          onPress={() => setOpen(o => (o === a.id ? null : a.id))}
          onProclaim={() => st.run(x => proclaimCrown(x, a.id))}
          byzNote={p === 'BYZ' && !me.crown && a.id === 'HEL'}
        />
      ))}
      {taken.map(c => {
        const t = proclaimedBy(s, c.id)!;
        return (
          <View key={c.id} style={[styles.row, { opacity: 0.5 }]} testID={`crown-${c.id}`}>
            <Flag nation={c.id} flagDef={c.flag} size={22} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{c.name}</Text>
              <Text style={styles.sub}>
                Proclaimed by {t.was}, {yearOf(t.day)}
              </Text>
            </View>
          </View>
        );
      })}
    </Section>
  );
}

function CrownRow({
  a,
  year,
  open,
  onPress,
  onProclaim,
  byzNote,
}: {
  a: CrownProgress;
  year: number;
  open: boolean;
  onPress: () => void;
  onProclaim: () => void;
  byzNote: boolean;
}) {
  const st = useStore();
  const s = st.state!;
  const c = CROWN[a.id];
  // "6 of 8 lands · needs Rome · from 1469", or what else stands in the way.
  const parts = [`${Math.min(a.held, a.need)} of ${a.need} lands`];
  if (a.keysMissing.length) parts.push(`needs ${a.keysMissing.map(regionName).join(' and ')}`);
  if (c.from && year < c.from) parts.push(`from ${c.from}`);
  const blocker =
    !a.ready && !a.keysMissing.length && a.held >= a.need && !(c.from && year < c.from) ? a.why : undefined;
  const held = (r: string) => {
    const o = s.regions[r]?.owner;
    return o === s.player || (!!o && s.nations[o]?.overlord === s.player && s.nations[o].subjectType === 'union');
  };
  return (
    <View style={[styles.wrap, a.ready && styles.ready]}>
      <Pressable onPress={onPress} style={styles.row} accessibilityRole="button" testID={`crown-${a.id}`}>
        <Flag nation={a.id} flagDef={c.flag} size={22} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{c.name}</Text>
          <Text style={[styles.sub, a.ready && { color: C.gold }]}>
            {a.ready ? 'Ready to proclaim' : (blocker ?? parts.join(' · '))}
          </Text>
        </View>
        {a.ready ? <Btn small tone="gold" label="Proclaim" onPress={onProclaim} testID={`proclaim-${a.id}`} /> : null}
      </Pressable>
      {open ? (
        <View style={styles.detail}>
          <T v="small">{c.blurb}</T>
          <Text style={styles.bonus}>
            {modLines(c.mods)
              .map(m => m.text)
              .join(', ')}
            : {c.bonus}
          </Text>
          <Text style={styles.line}>
            <Text style={styles.label}>Lands </Text>
            {c.regions.map((r, i) => (
              <Fragment key={r}>
                {i ? ', ' : ''}
                <Text style={{ color: held(r) ? C.green : C.inkSoft, fontWeight: c.key.includes(r) ? '700' : '400' }}>
                  {regionName(r)}
                </Text>
              </Fragment>
            ))}
          </Text>
          <Text style={styles.line}>
            <Text style={styles.label}>Who may proclaim </Text>
            {c.formers.map(formerName).join(', ')}
          </Text>
          {byzNote ? <Text style={styles.line}>Byzantium may also go straight to the Roman Empire.</Text> : null}
          <T v="tiny" style={{ marginTop: 4 }}>
            {c.history}
          </T>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.parchmentLine },
  ready: { borderLeftWidth: 2, borderLeftColor: C.gold },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 6 },
  title: { fontFamily: sans, fontSize: 15, fontWeight: '700', color: C.ink },
  sub: { fontFamily: sans, fontSize: 12, color: C.muted, marginTop: 1 },
  detail: { paddingHorizontal: 6, paddingBottom: 10, gap: 4 },
  bonus: { fontFamily: sans, fontSize: 13, color: C.green },
  line: { fontFamily: sans, fontSize: 12, color: C.inkSoft },
  label: { fontWeight: '800', color: C.muted },
});
