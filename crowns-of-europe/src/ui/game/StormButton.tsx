/**
 * Storm the walls: one button on a fort siege the player leads (army sheet and region sheet), with the odds and the
 * men it costs on it before the tap; the "?" beside it holds what the odds are made of. The odds shown are the odds
 * rolled (siege.ts stormOdds).
 */
import { useState } from 'react';
import { View } from 'react-native';
import { stormWalls } from '../../sim/commands';
import { STORM_MEN_PER_FORT, STORM_MIN_DAYS, STORM_SETBACK, stormOdds } from '../../sim/siege';
import { useStore } from '../../state/store';
import { Btn, ConfirmBtn, HelpButton, HelpNote, Line, Row, T, useConfirm } from '../components/kit';
import { signed } from '../theme';

export function StormButton({ region }: { region: string }) {
  const st = useStore();
  const s = st.state!;
  const confirm = useConfirm(`storm-${region}`);
  const [help, setHelp] = useState(false);
  const o = stormOdds(s, region);
  if (!o || o.by !== s.player || s.regions[region].fort <= 0) return null;
  const pct = Math.round(o.chance * 100);
  const sub = o.blocked ?? `${pct}% · about ${o.men.toLocaleString()} men`;
  return (
    <View style={{ marginTop: 10 }}>
      <Row gap={8}>
        {confirm.armed ? (
          <ConfirmBtn
            style={{ flex: 1 }}
            armKey={`storm-${region}`}
            state={confirm}
            label="Storm the walls"
            confirm="Tap again to storm"
            consequences={[sub]}
            onConfirm={() => st.run(x => stormWalls(x, region))}
            testID="storm"
          />
        ) : (
          <Btn style={{ flex: 1 }} tone="ghost" icon="siege" label="Storm the walls" sub={sub} disabled={!!o.blocked} onPress={confirm.arm} testID="storm" />
        )}
        <HelpButton open={help} onPress={() => setHelp(h => !h)} label="About storming the walls" />
      </Row>
      {help ? (
        <HelpNote style={{ marginTop: 8 }}>
          {o.parts.map(p => (
            <Line key={p.label} label={p.label} value={p.label === 'Base' ? `${p.value}%` : `${signed(p.value)}%`} />
          ))}
          <Line label="Odds (5% to 85%)" value={`${pct}%`} bold />
          <T v="small" style={{ marginTop: 6 }}>
            Win or lose, {STORM_MEN_PER_FORT} men fall per fort level. Thrown back, the siege loses {Math.round(STORM_SETBACK * 100)}% and you wait {STORM_MIN_DAYS} days to try again.
          </T>
        </HelpNote>
      ) : null}
    </View>
  );
}
