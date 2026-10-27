import { View } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';
import { intervalColor } from '../practice/reel';
import { C } from '../theme/colors';

export interface NeckDot {
  string: number;
  fret: number;
  /** Interval label: 'R', 'b3', ... */
  label: string;
  state?: 'normal' | 'big' | 'faint' | 'target' | 'done';
}

/** A small fretboard with coloured dots, for theory cards and onboarding. */
export function MiniNeck({ dots, from, to, testID }: { dots: NeckDot[]; from?: number; to?: number; testID?: string }) {
  const frets = dots.map((d) => d.fret);
  const lo = from ?? Math.max(0, Math.min(...frets) - 1);
  const hi = to ?? Math.max(lo + 4, Math.max(...frets) + 1);
  const n = hi - lo + 1;
  const W = 320;
  const H = 150;
  const pad = 16;
  const top = 14;
  const gap = (H - top - 26) / 5;
  const fw = (W - pad * 2) / n;
  const x = (f: number) => pad + (f - lo + 0.5) * fw;
  const y = (s: number) => top + (s - 1) * gap;
  return (
    <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center' }} testID={testID}>
      <Svg width="100%" height={undefined} viewBox={`0 0 ${W} ${H}`} style={{ aspectRatio: W / H }}>
        {Array.from({ length: n + 1 }, (_, i) => (
          <Line key={`f${i}`} x1={pad + i * fw} y1={top} x2={pad + i * fw} y2={top + gap * 5} stroke={C.fret} strokeWidth={lo === 0 && i === 0 ? 5 : 2} />
        ))}
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <Line key={`s${s}`} x1={pad} y1={y(s)} x2={W - pad} y2={y(s)} stroke={C.string} strokeWidth={0.8 + (s - 1) * 0.35} />
        ))}
        {Array.from({ length: n }, (_, i) => (
          <SvgText key={`n${i}`} x={x(lo + i)} y={H - 6} fontSize={12} textAnchor="middle" fill={C.faint}>
            {String(lo + i)}
          </SvgText>
        ))}
        {dots.map((d, i) => {
          const c = intervalColor(d.label);
          const st = d.state ?? 'normal';
          const r = st === 'big' || st === 'target' ? 13 : st === 'faint' ? 8 : 10;
          const filled = st === 'big' || st === 'target' || st === 'done';
          return (
            <G key={i}>
              {st === 'target' ? <Circle cx={x(d.fret)} cy={y(d.string)} r={19} fill={c} opacity={0.2} /> : null}
              <Circle cx={x(d.fret)} cy={y(d.string)} r={r} fill={filled ? c : '#FFFFFF'} stroke={c} strokeWidth={2} opacity={st === 'faint' ? 0.45 : st === 'done' ? 0.5 : 1} />
              <SvgText x={x(d.fret)} y={y(d.string) + 4} fontSize={st === 'faint' ? 8 : 10} fontWeight="800" textAnchor="middle" fill={filled ? '#FFFFFF' : c} opacity={st === 'faint' ? 0.6 : 1}>
                {d.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}
