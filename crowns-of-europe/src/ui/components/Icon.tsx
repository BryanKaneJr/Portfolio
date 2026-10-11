/** Hand-drawn vector glyphs (no icon fonts, no images): resources, actions and event illustrations. */
import { memo } from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'gold'
  | 'manpower'
  | 'stability'
  | 'prestige'
  | 'threat'
  | 'crown'
  | 'swords'
  | 'ship'
  | 'castle'
  | 'siege'
  | 'bell'
  | 'menu'
  | 'play'
  | 'pause'
  | 'close'
  | 'chevron'
  | 'back'
  | 'scroll'
  | 'church'
  | 'plague'
  | 'harvest'
  | 'coins'
  | 'cannon'
  | 'treaty'
  | 'book'
  | 'rebels'
  | 'marriage'
  | 'death'
  | 'horse'
  | 'map'
  | 'flag'
  | 'layers'
  | 'target'
  | 'check'
  | 'plus'
  | 'minus'
  | 'info'
  | 'star'
  | 'shield'
  | 'eye'
  | 'gear';

const P: Record<IconName, string> = {
  gold: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18Zm0 3.5a5.5 5.5 0 1 1 0 11a5.5 5.5 0 0 1 0-11Z',
  manpower: 'M12 3l6 3v4c0 4-2.6 7.5-6 9c-3.4-1.5-6-5-6-9V6l6-3Zm0 4a2.2 2.2 0 1 0 0 4.4A2.2 2.2 0 0 0 12 7Zm-3.6 8.6c.8-1.6 2.1-2.4 3.6-2.4s2.8.8 3.6 2.4',
  stability: 'M12 3v17M7 20h10M5 8h14M5 8l-2.5 6h5L5 8Zm14 0l-2.5 6h5L19 8ZM12 3l-1.5 2h3L12 3Z',
  prestige: 'M12 2.5l2.7 5.6l6.1.9l-4.4 4.3l1 6.1L12 16.5l-5.4 2.9l1-6.1l-4.4-4.3l6.1-.9L12 2.5Z',
  threat: 'M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.6.7-2.8 1.6-3.8c.2 1.6 1 2.6 2 2.8C11 8 11.4 5.4 12 3ZM6 21h12',
  crown: 'M3 8l4 4l5-7l5 7l4-4l-2 10H5L3 8Zm2 12h14',
  swords: 'M4 4l9 9M4 4h4M4 4v4M20 4l-9 9M20 4h-4M20 4v4M10.5 15.5l-4 4M8 15l-3 3l1 1l3-3M13.5 15.5l4 4M16 15l3 3l-1 1l-3-3',
  ship: 'M4 15h16l-2.5 4.5h-11L4 15ZM12 3v12M12 4l6 8h-6M12 6l-5 6h5',
  castle: 'M4 20V9h3V6h2v3h2V6h2v3h2V6h2v3h3v11H4Zm6 0v-4a2 2 0 0 1 4 0v4',
  siege: 'M3 20h18M5 20l3-9l3 9M8 11l9-6M15 4.5l3 1.5M14 13l2-2l3 3l-2 2l-3-3Z',
  bell: 'M12 3a5 5 0 0 0-5 5v4l-2 3h14l-2-3V8a5 5 0 0 0-5-5Zm-2 15a2 2 0 0 0 4 0',
  menu: 'M4 7h16M4 12h16M4 17h16',
  play: 'M8 5l11 7l-11 7V5Z',
  pause: 'M7 5h3.5v14H7V5Zm6.5 0H17v14h-3.5V5Z',
  close: 'M6 6l12 12M18 6L6 18',
  chevron: 'M9 6l6 6l-6 6',
  back: 'M15 6l-6 6l6 6',
  scroll: 'M7 4h11a2 2 0 0 1 0 4h-1v10a2 2 0 0 1-2 2H6a2 2 0 0 1 0-4h1V4Zm0 12h8M10 8h5M10 11h5',
  church: 'M12 2v4M10 4h4M8 10l4-4l4 4v10H8V10Zm-4 4h4v6H4v-6Zm12 0h4v6h-4v-6Zm-5 6v-4h2v4',
  plague: 'M12 3a7 7 0 0 0-7 7c0 2.5 1.2 4 2.5 5v3h9v-3c1.3-1 2.5-2.5 2.5-5a7 7 0 0 0-7-7Zm-3 7.5a1.5 1.5 0 1 0 0 .1Zm6 0a1.5 1.5 0 1 0 0 .1ZM10 18v3M14 18v3M12 13l-1 2h2l-1-2Z',
  harvest: 'M12 21V8M12 8c-2-1-3-3-3-5c2 0 3 2 3 5Zm0 0c2-1 3-3 3-5c-2 0-3 2-3 5Zm0 5c-2.5-1-4-3-4-5c2.5 0 4 2 4 5Zm0 0c2.5-1 4-3 4-5c-2.5 0-4 2-4 5Zm0 5c-2.5-1-4-3-4-5c2.5 0 4 2 4 5Zm0 0c2.5-1 4-3 4-5c-2.5 0-4 2-4 5Z',
  coins: 'M9 6a5 2.5 0 1 0 0 .1ZM4 6v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V6M10 13v3c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-3M10 13c0-1.4 2.2-2.5 5-2.5s5 1.1 5 2.5s-2.2 2.5-5 2.5s-5-1.1-5-2.5Z',
  cannon: 'M3 14l12-6l2 4l-12 6l-2-4Zm4 4a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0ZM17 10l3-1M16 8l2-3',
  treaty: 'M6 3h9l4 4v14H6V3Zm9 0v4h4M9 11h7M9 14h7M9 17h4M16 18a1.5 1.5 0 1 0 0 .1Z',
  book: 'M4 5c3-1 6-1 8 1c2-2 5-2 8-1v14c-3-1-6-1-8 1c-2-2-5-2-8-1V5Zm8 1v14',
  rebels: 'M7 21V9M5 9V4M7 9V3M9 9V4M5 9h4M15 21V11l2-7l2 7v10M13 13h8',
  marriage: 'M9 9a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9Zm6 0a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9ZM10 4l2 2l2-2',
  death: 'M12 3v18M7 8h10M9 21h6',
  horse: 'M5 21l1-6c-2-2-2-5 0-7l4-3l2-2v3l5 3l2 4l-2 1l-3-2l-2 3v6M9 21v-4',
  map: 'M3 6l6-2l6 2l6-2v14l-6 2l-6-2l-6 2V6Zm6-2v14m6-12v14',
  flag: 'M5 21V3M5 4h12l-3 4l3 4H5',
  layers: 'M12 4l9 5l-9 5l-9-5l9-5Zm-9 9l9 5l9-5',
  target: 'M12 4a8 8 0 1 0 0 16a8 8 0 0 0 0-16Zm0 4a4 4 0 1 0 0 8a4 4 0 0 0 0-8Z',
  check: 'M5 12.5l4.5 4.5L19 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  info: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18Zm0 7v6m0-9v.5',
  star: 'M12 3l2.6 6.3l6.4.4l-4.9 4.2l1.5 6.3L12 16.8l-5.6 3.4l1.5-6.3L3 9.7l6.4-.4L12 3Z',
  shield: 'M12 3l7 3v6c0 4.5-3 8-7 9c-4-1-7-4.5-7-9V6l7-3Z',
  eye: 'M2 12s4-7 10-7s10 7 10 7s-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6a3 3 0 0 0 0-6Z',
  gear: 'M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7ZM12 2.5v3m0 13v3M2.5 12h3m13 0h3M5.3 5.3l2.1 2.1m9.2 9.2l2.1 2.1M5.3 18.7l2.1-2.1m9.2-9.2l2.1-2.1',
};

const FILLED = new Set<IconName>(['gold', 'prestige', 'play', 'pause', 'star', 'shield', 'crown']);

export const Icon = memo(function Icon({ name, size = 20, color = '#2a2118', fill }: { name: IconName; size?: number; color?: string; fill?: string }) {
  const filled = FILLED.has(name);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={P[name]}
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
export const Engraving = memo(function Engraving({ name, width = 280, height = 120 }: { name: IconName; width?: number; height?: number }) {
  const lines = Array.from({ length: 14 }, (_, i) => i);
  return (
    <Svg width={width} height={height} viewBox="0 0 280 120">
      <Rect x={0} y={0} width={280} height={120} fill="#e8d9b4" />
      <G opacity={0.25}>
        {lines.map(i => (
          <Path key={i} d={`M${-20 + i * 24} 120 L${40 + i * 24} 0`} stroke="#6b5233" strokeWidth={0.8} />
        ))}
      </G>
      <Rect x={6} y={6} width={268} height={108} fill="none" stroke="#6b5233" strokeWidth={1.5} />
      <Rect x={10} y={10} width={260} height={100} fill="none" stroke="#6b5233" strokeWidth={0.6} />
      <Circle cx={140} cy={60} r={42} fill="#f3e8cc" stroke="#6b5233" strokeWidth={1.5} />
      <Circle cx={140} cy={60} r={37} fill="none" stroke="#6b5233" strokeWidth={0.6} />
      <G transform="translate(110 30) scale(2.5)">
        <Path d={P[name]} fill={FILLED.has(name) ? '#5a4127' : 'none'} fillRule="evenodd" stroke="#3b2a17" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </Svg>
  );
});
