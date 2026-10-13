/** Simple public-domain-style heraldry drawn from each nation's flag spec (nations.json `flag`). */
import { memo, type ReactElement } from 'react';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';
import { NATION } from '../../sim/content';
import type { FlagDef } from '../../sim/types';
import { CHARGES } from './charges';

const W = 30;
const H = 20;

/** A figure on the flag (charges.ts), centred on (15, 10) of the 30 x 20 box; a plain roundel if unknown. */
function Charge({ kind, color }: { kind?: string; color: string }) {
  const drawn = kind ? CHARGES[kind] : undefined;
  if (!drawn) return <Circle cx={15} cy={10} r={4} fill={color} />;
  return (
    <>
      {drawn.map((p, i) => (
        <Path key={i} d={p.d} fill={color} fillRule={p.evenOdd ? 'evenodd' : 'nonzero'} />
      ))}
    </>
  );
}

/** A small cross, as in the quarters of a cross cantoned. */
const smallCross = (x: number, y: number, c: string) => (
  <>
    <Rect x={x - 0.7} y={y - 2.2} width={1.4} height={4.4} fill={c} />
    <Rect x={x - 2.2} y={y - 0.7} width={4.4} height={1.4} fill={c} />
  </>
);
/** A firesteel (a B-shaped fire striker), its straight back at x, opening away from it (dir 1: right, -1: left). */
const beta = (x: number, y: number, dir: number, c: string) => (
  <Path d={`M${x} ${y - 2.3}v4.6h${1.3 * dir}a${1.15} ${1.15} 0 0 ${dir > 0 ? 0 : 1} 0 -2.3a${1.15} ${1.15} 0 0 ${dir > 0 ? 0 : 1} 0 -2.3Z`} fill={c} />
);
/** A charge drawn small in one quarter of a quarterly flag (quarters 1-4: top left, top right, bottom left, bottom right). */
const inQuarter = (q: number, kind: string, color: string) => {
  const cx = q % 2 === 1 ? 7.5 : 22.5;
  const cy = q <= 2 ? 5 : 15;
  return (
    <G key={`q${q}`} transform={`translate(${cx - 7.5} ${cy - 5}) scale(0.5)`}>
      <Charge kind={kind} color={color} />
    </G>
  );
};

/** The flag's field (its pattern, in colors[0], colors[1] and colors[2]) in a W x H box. */
function field(f: FlagDef): ReactElement {
  const [a, b, c = a] = f.colors as string[];
  switch (f.pattern) {
    case 'perPale':
      return (
        <>
          <Rect width={W} height={H} fill={a} />
          <Rect x={15} width={15} height={H} fill={b} />
        </>
      );
    case 'perFess':
      return (
        <>
          <Rect width={W} height={H} fill={a} />
          <Rect y={10} width={W} height={10} fill={b} />
        </>
      );
    case 'chief':
      return (
        <>
          <Rect width={W} height={H} fill={a} />
          <Rect width={W} height={6.6} fill={b} />
        </>
      );
    case 'canton':
      return (
        <>
          <Rect width={W} height={H} fill={a} />
          <Rect width={12} height={9} fill={b} />
        </>
      );
    case 'tierced':
      return (
        <>
          <Rect width={W} height={6.7} fill={a} />
          <Rect y={6.6} width={W} height={6.8} fill={b} />
          <Rect y={13.3} width={W} height={6.7} fill={c} />
        </>
      );
    case 'chevron':
      return (
        <>
          <Rect width={W} height={H} fill={a} />
          <Path d="M0 15L15 4L30 15L30 20L15 9L0 20Z" fill={b} />
        </>
      );
    case 'bordure':
      return (
        <>
          <Rect width={W} height={H} fill={b} />
          <Rect x={2.8} y={2.8} width={24.4} height={14.4} fill={a} />
        </>
      );
    case 'cross':
      return (
        <>
          <Rect width={W} height={H} fill={a} />
          <Rect x={12.5} width={5} height={H} fill={b} />
          <Rect y={7.5} width={W} height={5} fill={b} />
        </>
      );
    case 'crossPatty':
      // Four arms widening to notched ends, as the Hospitallers' cross.
      return (
        <>
          <Rect width={W} height={H} fill={a} />
          <Path d="M15 10L11.6 2.4L15 4.2L18.4 2.4ZM15 10L22.6 6.6L20.8 10L22.6 13.4ZM15 10L18.4 17.6L15 15.8L11.6 17.6ZM15 10L7.4 13.4L9.2 10L7.4 6.6Z" fill={b} />
        </>
      );
    case 'crossCantoned':
      return (
        <>
          <Rect width={W} height={H} fill={a} />
          <Rect x={13.2} width={3.6} height={H} fill={b} />
          <Rect y={8.2} width={W} height={3.6} fill={b} />
          {smallCross(6.6, 4.1, b)}
          {smallCross(23.4, 4.1, b)}
          {smallCross(6.6, 15.9, b)}
          {smallCross(23.4, 15.9, b)}
        </>
      );
    case 'crossBetas':
      // The Palaiologoi's cross between four firesteels (betas), their backs to the cross.
      return (
        <>
          <Rect width={W} height={H} fill={a} />
          <Rect x={13.2} width={3.6} height={H} fill={b} />
          <Rect y={8.2} width={W} height={3.6} fill={b} />
          {beta(10.6, 4.1, -1, b)}
          {beta(19.4, 4.1, 1, b)}
          {beta(10.6, 15.9, -1, b)}
          {beta(19.4, 15.9, 1, b)}
        </>
      );
    case 'nordic':
      return (
        <>
          <Rect width={W} height={H} fill={a} />
          <Rect x={9} width={4} height={H} fill={b} />
          <Rect y={8} width={W} height={4} fill={b} />
        </>
      );
    case 'saltire':
      return (
        <>
          <Rect width={W} height={H} fill={a} />
          <Path d="M0 0L30 20M30 0L0 20" stroke={b} strokeWidth={4} />
        </>
      );
    case 'quarterly':
      return (
        <>
          <Rect width={W} height={H} fill={a} />
          <Rect x={15} width={15} height={10} fill={b} />
          <Rect y={10} width={15} height={10} fill={b} />
        </>
      );
    case 'pales':
      return (
        <>
          <Rect width={W} height={H} fill={a} />
          {[3.75, 11.25, 18.75, 26.25].map(x => (
            <Rect key={x} x={x - 1.9} width={3.75} height={H} fill={b} />
          ))}
        </>
      );
    case 'barry':
      return (
        <>
          <Rect width={W} height={H} fill={a} />
          {[2.5, 7.5, 12.5, 17.5].map(y => (
            <Rect key={y} y={y - 1.25} width={W} height={2.5} fill={b} />
          ))}
        </>
      );
    case 'fess':
      return (
        <>
          <Rect width={W} height={H} fill={a} />
          <Rect y={6.5} width={W} height={7} fill={b} />
        </>
      );
    case 'bend':
      return (
        <>
          <Rect width={W} height={H} fill={a} />
          <Path d="M0 0L30 20" stroke={b} strokeWidth={5} />
        </>
      );
    case 'bendy':
      return (
        <>
          <Rect width={W} height={H} fill={a} />
          {[-10, 0, 10, 20].map(x => (
            <Path key={x} d={`M${x} 0L${x + 20} 20`} stroke={b} strokeWidth={3.5} />
          ))}
        </>
      );
    case 'lozengy':
      return (
        <>
          <Rect width={W} height={H} fill={a} />
          {[0, 6, 12, 18, 24, 30].flatMap(x =>
            [0, 10, 20].map(y => <Polygon key={`${x}-${y}`} points={`${x},${y - 5} ${x + 3},${y} ${x},${y + 5} ${x - 3},${y}`} fill={b} />),
          )}
        </>
      );
    case 'ermine':
      return (
        <>
          <Rect width={W} height={H} fill={a} />
          {[5, 15, 25].flatMap(x => [5, 15].map(y => <Path key={`${x}${y}`} d={`M${x} ${y - 2.5}v4M${x - 1.5} ${y + 2}l1.5-1.5l1.5 1.5`} stroke={b} strokeWidth={1.2} fill="none" />))}
        </>
      );
    case 'lis':
      // Three fleurs-de-lis, two and one.
      return (
        <>
          <Rect width={W} height={H} fill={a} />
          <G transform="translate(-7 -1.5) scale(0.6)">
            <Charge kind="lis" color={b} />
          </G>
          <G transform="translate(9 -1.5) scale(0.6)">
            <Charge kind="lis" color={b} />
          </G>
          <G transform="translate(1 6.5) scale(0.6)">
            <Charge kind="lis" color={b} />
          </G>
        </>
      );
    case 'semeLis':
      // Strewn with fleurs-de-lis.
      return (
        <>
          <Rect width={W} height={H} fill={a} />
          {[
            [5, 4],
            [15, 4],
            [25, 4],
            [10, 10],
            [20, 10],
            [5, 16],
            [15, 16],
            [25, 16],
          ].map(([x, y]) => (
            <G key={`${x}-${y}`} transform={`translate(${x - 15 * 0.36} ${y - 10 * 0.36}) scale(0.36)`}>
              <Charge kind="lis" color={b} />
            </G>
          ))}
        </>
      );
    default: // 'plain'
      return <Rect width={W} height={H} fill={a} />;
  }
}

/** The flag's field and charges, drawn in a W x H box. */
export function flagBody(nation: string): ReactElement {
  const def = NATION[nation];
  if (!def)
    // Rebels: a black banner with a pitchfork-ish mark.
    return (
      <>
        <Rect width={W} height={H} fill="#2b2b2b" />
        <Path d="M15 4v12M12 4v4h6V4" stroke="#d8d8d8" strokeWidth={1.4} fill="none" />
      </>
    );
  const f = def.flag;
  const color = f.chargeColor ?? f.colors[1];
  if (f.pattern === 'quarterly' && f.charge)
    // Quartered arms: the charge in quarters 1 and 4, the second charge (if any) in 2 and 3.
    return (
      <>
        {field(f)}
        {inQuarter(1, f.charge, color)}
        {inQuarter(4, f.charge, color)}
        {f.charge2 ? inQuarter(2, f.charge2, f.charge2Color ?? f.colors[0]) : null}
        {f.charge2 ? inQuarter(3, f.charge2, f.charge2Color ?? f.colors[0]) : null}
      </>
    );
  return (
    <>
      {field(f)}
      {f.charge ? <Charge kind={f.charge} color={color} /> : null}
    </>
  );
}

export const Flag = memo(function Flag({ nation, size = 28, rounded = true }: { nation: string; size?: number; rounded?: boolean }) {
  const w = size;
  const h = (size * H) / W;
  const id = `clip_${nation}_${size}`;
  const body = flagBody(nation);
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <ClipPath id={id}>
          <Rect width={W} height={H} rx={rounded ? 2.2 : 0} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${id})`}>{body}</G>
      <Rect x={0.4} y={0.4} width={W - 0.8} height={H - 0.8} rx={rounded ? 2 : 0} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={0.8} />
    </Svg>
  );
});

/** Heraldic shield outline in a 30 x 36 box. */
export const SHIELD = 'M1.6 1.6H28.4V15.2C28.4 25.6 21.4 31.6 15 34.6C8.6 31.6 1.6 25.6 1.6 15.2Z'; // on a 30 × 36 box

/**
 * The nation's arms on a shield with a gilded rim and a little light and shade, for headers and the top bar
 * (`size` is the width; the shield is 1.2 times as tall).
 */
export const Shield = memo(function Shield({ nation, size = 32, rim = '#d6b26e' }: { nation: string; size?: number; rim?: string }) {
  const id = `sh_${nation}_${size}`;
  return (
    <Svg width={size} height={size * 1.2} viewBox="0 0 30 36">
      <Defs>
        <ClipPath id={id}>
          <Path d={SHIELD} />
        </ClipPath>
        <LinearGradient id={`${id}_l`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ffffff" stopOpacity={0.28} />
          <Stop offset="0.45" stopColor="#ffffff" stopOpacity={0} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0.3} />
        </LinearGradient>
      </Defs>
      <G clipPath={`url(#${id})`}>
        <G transform="translate(-12 0) scale(1.8)">{flagBody(nation)}</G>
        <Rect width={30} height={36} fill={`url(#${id}_l)`} />
      </G>
      <Path d={SHIELD} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={2.6} />
      <Path d={SHIELD} fill="none" stroke={rim} strokeWidth={1.4} />
    </Svg>
  );
});
