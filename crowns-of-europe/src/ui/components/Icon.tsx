/**
 * Icons, all vector (no icon fonts, no images): the game's emblems (resources, war, the realm, event pictures) are
 * glyphs from game-icons.net (`gameIcons.ts`, CC BY 3.0, built by scripts/build-icons.ts); the plain controls (play,
 * close, menu...) are simple line icons drawn here, like a phone's.
 */
import { memo } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { GLYPHS, type GlyphName } from './gameIcons';

const glyphOf = (name: string) => (name in GLYPHS ? GLYPHS[name as GlyphName].d : null);
const lineOf = (name: IconName) => P[name as LineName];

/** The plain controls, drawn here as line icons. */
type LineName =
  | 'bell'
  | 'menu'
  | 'play'
  | 'pause'
  | 'close'
  | 'chevron'
  | 'back'
  | 'map'
  | 'layers'
  | 'check'
  | 'plus'
  | 'minus'
  | 'info'
  | 'star'
  | 'shield'
  | 'eye'
  | 'gear';

/** Every icon: the controls, plus the game's emblems (from game-icons.net; the map's own pikeman and fire are used
 * there directly). */
export type IconName = LineName | Exclude<GlyphName, 'pikeman' | 'fire'>;

const P: Record<LineName, string> = {
  bell: 'M12 3a5 5 0 0 0-5 5v4l-2 3h14l-2-3V8a5 5 0 0 0-5-5Zm-2 15a2 2 0 0 0 4 0',
  menu: 'M4 7h16M4 12h16M4 17h16',
  play: 'M8 5l11 7l-11 7V5Z',
  pause: 'M7 5h3.5v14H7V5Zm6.5 0H17v14h-3.5V5Z',
  close: 'M6 6l12 12M18 6L6 18',
  chevron: 'M9 6l6 6l-6 6',
  back: 'M15 6l-6 6l6 6',
  map: 'M3 6l6-2l6 2l6-2v14l-6 2l-6-2l-6 2V6Zm6-2v14m6-12v14',
  layers: 'M12 4l9 5l-9 5l-9-5l9-5Zm-9 9l9 5l9-5',
  check: 'M5 12.5l4.5 4.5L19 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  info: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18Zm0 7v6m0-9v.5',
  star: 'M12 3l2.6 6.3l6.4.4l-4.9 4.2l1.5 6.3L12 16.8l-5.6 3.4l1.5-6.3L3 9.7l6.4-.4L12 3Z',
  shield: 'M12 3l7 3v6c0 4.5-3 8-7 9c-4-1-7-4.5-7-9V6l7-3Z',
  eye: 'M2 12s4-7 10-7s10 7 10 7s-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6a3 3 0 0 0 0-6Z',
  gear: 'M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7ZM12 2.5v3m0 13v3M2.5 12h3m13 0h3M5.3 5.3l2.1 2.1m9.2 9.2l2.1 2.1M5.3 18.7l2.1-2.1m9.2-9.2l2.1-2.1',
};

const FILLED = new Set<string>(['play', 'pause', 'star', 'shield']);

export const Icon = memo(function Icon({ name, size = 20, color = '#2a2118', fill }: { name: IconName; size?: number; color?: string; fill?: string }) {
  const glyph = glyphOf(name);
  if (glyph) {
    // A touch larger than the line icons: the emblems carry their own padding.
    return (
      <Svg width={size} height={size} viewBox="16 16 480 480">
        <Path d={glyph} fill={fill ?? color} />
      </Svg>
    );
  }
  const filled = FILLED.has(name);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={lineOf(name)}
        fill={filled ? (fill ?? color) : 'none'}
        fillRule="evenodd"
        stroke={color}
        strokeWidth={filled ? 1.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
});

/** A larger "engraving" for event cards: the glyph inside a double-ruled oval on parchment. */
/**
 * The picture at the head of an event: the event's emblem in gold on a dark medallion, framed in gilt, over a dark
 * panel with a faint glow and fine hatching (sized to fill whatever width it is given).
 */
export const Engraving = memo(function Engraving({ name, width = 280, height = 120 }: { name: IconName; width?: number; height?: number }) {
  const lines = Array.from({ length: 16 }, (_, i) => i);
  const gold = '#d6b26e';
  return (
    <Svg width={width} height={height} viewBox="0 0 280 120" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="engBg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#262d39" />
          <Stop offset="1" stopColor="#11151b" />
        </LinearGradient>
        <RadialGradient id="engGlow" cx="50%" cy="50%" r="55%">
          <Stop offset="0" stopColor={gold} stopOpacity={0.28} />
          <Stop offset="1" stopColor={gold} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={-60} y={0} width={400} height={120} fill="url(#engBg)" />
      <G opacity={0.07}>
        {lines.map(i => (
          <Path key={i} d={`M${-60 + i * 26} 120 L${0 + i * 26} 0`} stroke={gold} strokeWidth={0.8} />
        ))}
      </G>
      <Rect x={-60} y={0} width={400} height={120} fill="url(#engGlow)" />
      <Circle cx={140} cy={60} r={41} fill="#141920" stroke={gold} strokeWidth={1.5} />
      <Circle cx={140} cy={60} r={36} fill="none" stroke={gold} strokeWidth={0.6} opacity={0.7} />
      <Path d="M140 13l4 4-4 4-4-4Z M140 99l4 4-4 4-4-4Z" fill={gold} opacity={0.8} />
      {glyphOf(name) ? (
        <G transform={`translate(116 36) scale(${48 / 512})`}>
          <Path d={glyphOf(name)!} fill={gold} />
        </G>
      ) : (
        <G transform="translate(110 30) scale(2.5)">
          <Path d={lineOf(name)} fill={FILLED.has(name) ? gold : 'none'} fillRule="evenodd" stroke={gold} strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" />
        </G>
      )}
    </Svg>
  );
});
