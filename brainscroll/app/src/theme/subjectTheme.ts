import { color, subjectColor } from './tokens';

/**
 * A subject's colour as a full set of shades (owner, 2026-09-30: "more color";
 * each skill tree wears its subject's colour). Progression surfaces tint with
 * it: the skill map's waypoints, road and banner, level emblems and progress
 * bars on the Skills tab and Level Complete, and the lesson's progress bar.
 * Actions stay violet and mastery stays gold.
 *
 * Every shade is derived from the one subject colour, so a new subject needs
 * only its entry in `subjectColor`. Ink on the solid fill is chosen by
 * contrast (white or near-black). Every subject passes AA (4.5:1) for its ink
 * on the fill and its text on the background and on a cleared waypoint.
 */
export interface SubjectTint {
  /** Solid fill: the next waypoint, a level emblem, a progress bar. */
  base: string;
  /** The darker underside that makes a fill stand up. */
  edge: string;
  /** A soft wash behind an icon. */
  soft: string;
  /** Rings and the walked road. */
  line: string;
  /** Text and icons in the subject's colour, on the dark background. */
  text: string;
  /** Ink on `base`. */
  ink: string;
  /** Cleared waypoints: a muted face with `text` numbers, so the next level stays brightest. */
  clearedFace: string;
  clearedEdge: string;
}

const BRAND: SubjectTint = {
  base: color.brand,
  edge: color.brandEdge,
  soft: color.brandSoft,
  line: color.brandLine,
  text: color.brandText,
  ink: color.onBrand,
  clearedFace: '#34306B',
  clearedEdge: '#241F4D',
};

type RGB = [number, number, number];
const rgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
const hex = (c: RGB) => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
const mix = (a: string, b: string, t: number) => {
  const [x, y] = [rgb(a), rgb(b)];
  return hex([0, 1, 2].map((i) => x[i]! + (y[i]! - x[i]!) * t) as RGB);
};
/** A lighter tint of a colour, for the lit top of a gradient (components/ui/gradient.tsx). */
export const lift = (h: string, t = 0.2) => (h.startsWith('#') && h.length === 7 ? mix(h, '#FFFFFF', t) : h);
const alpha = (h: string, a: number) => `rgba(${rgb(h).join(',')},${a})`;

/** WCAG relative luminance and contrast, to pick readable ink. */
export function luminance(h: string): number {
  const [r, g, b] = rgb(h).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as RGB;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

const cache = new Map<string, SubjectTint>();

/** The shades for a subject id (`subject.science`); violet when it has no colour. */
export function subjectTint(subjectId: string | undefined): SubjectTint {
  const base = subjectId ? subjectColor[subjectId] : undefined;
  if (!base) return BRAND;
  const hit = cache.get(base);
  if (hit) return hit;
  const ink = contrast(base, '#FFFFFF') >= contrast(base, color.bgDeep) ? '#FFFFFF' : color.bgDeep;
  const tint: SubjectTint = {
    base,
    edge: mix(base, '#000000', 0.38),
    soft: alpha(base, 0.16),
    line: alpha(base, 0.5),
    text: mix(base, '#FFFFFF', 0.25),
    ink,
    clearedFace: mix(base, color.bg, 0.68),
    clearedEdge: mix(base, color.bg, 0.82),
  };
  cache.set(base, tint);
  return tint;
}

/** The shades for a skill's subject. */
export function skillTint(skillId: string | undefined, skills: readonly { id: string; subjectId: string }[]): SubjectTint {
  return subjectTint(skills.find((s) => s.id === skillId)?.subjectId);
}
