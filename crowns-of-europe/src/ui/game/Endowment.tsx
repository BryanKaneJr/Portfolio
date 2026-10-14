/** Science tab row: endow one field of learning (War, Sea, Statecraft). Tap a field, then confirm. */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { setEndowment } from '../../sim/commands';
import { ENDOW, endowBlocked, endowLockedUntil, type Field } from '../../sim/endowment';
import { FIELDS } from '../../sim/science';
import { yearOf, years } from '../../sim/util';
import { useStore } from '../../state/store';
import { Icon, type IconName } from '../components/Icon';
import { ConfirmBtn, Row, T, useConfirm } from '../components/kit';
import { C, sans } from '../theme';

const pct = (x: number) => `${Math.round(Math.abs(x) * 100)}%`;

export function Endowment({ fields }: { fields: Record<Field, { label: string; icon: IconName }> }) {
  const st = useStore();
  const s = st.state!;
  const p = s.player;
  const me = s.nations[p];
  const [pick, setPick] = useState<Field | null>(null);
  const until = endowLockedUntil(me);
  const lockedTill = until !== undefined && s.day < until ? yearOf(until) : null;
  const armed = pick && !endowBlocked(s, p, pick) ? pick : null;
  // Picking a field arms its confirmation at once: the field, then the confirm (two taps).
  const confirm = useConfirm(armed ?? '');
  return (
    <View style={styles.box}>
      <Text style={styles.name}>Endow</Text>
      <T v="tiny">{lockedTill ? `Change again in ${lockedTill}` : `Pick a field: its advances ${pct(ENDOW.own)} cheaper, the others ${pct(ENDOW.others)} dearer`}</T>
      <Row gap={6} style={{ marginTop: 8 }}>
        {FIELDS.map(f => {
          const on = me.endowment?.field === f;
          const blocked = !!endowBlocked(s, p, f);
          return (
            <Pressable
              key={f}
              testID={`endow-${f}`}
              accessibilityRole="button"
              accessibilityLabel={`Endow ${fields[f].label}`}
              accessibilityState={{ selected: on, disabled: blocked }}
              onPress={
                blocked
                  ? undefined
                  : () => {
                      const next = pick === f ? null : f;
                      setPick(next);
                      if (next) confirm.armFor(next);
                    }
              }
              style={[styles.seg, on && styles.segOn, armed === f && styles.segArmed, blocked && !on && { opacity: 0.4 }]}
            >
              <Icon name={fields[f].icon} size={15} color={on ? '#1a1408' : C.goldDark} />
              <Text style={[styles.segText, on && { color: '#1a1408' }]}>{fields[f].label}</Text>
            </Pressable>
          );
        })}
      </Row>
      {armed ? (
        <View style={{ marginTop: 8 }}>
          <ConfirmBtn
            small
            tone="secondary"
            armedTone="gold"
            state={confirm}
            armKey={armed}
            label={`Endow ${fields[armed].label}`}
            confirm={`Tap to endow ${fields[armed].label}`}
            consequences={[`${fields[armed].label} advances ${pct(ENDOW.own)} cheaper, the others ${pct(ENDOW.others)} dearer`]}
            onConfirm={() => {
              setPick(null);
              void st.run(z => setEndowment(z, armed));
            }}
            testID="endow"
          />
          <T v="tiny" style={{ marginTop: 3, textAlign: 'center' }}>
            locked until {yearOf(s.day + years(ENDOW.years))}
          </T>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: C.parchment2 },
  name: { fontFamily: sans, fontSize: 15, fontWeight: '700', color: C.ink },
  seg: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.parchmentLine, backgroundColor: C.parchment },
  segOn: { backgroundColor: C.gold, borderColor: C.gold },
  segArmed: { borderColor: C.gold, borderWidth: 2 },
  segText: { fontFamily: sans, fontSize: 13, fontWeight: '700', color: C.ink },
});
