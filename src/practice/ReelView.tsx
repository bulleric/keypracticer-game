import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { ClipPath, Defs, Ellipse, G, Line, LinearGradient, Polygon, Polyline, Rect, Stop, Circle, Text as SvgText } from 'react-native-svg';
import type { Exercise, ExNote } from './theory';
import {
  CELL, FLAT_STEPS, K, PLAY_X, SAFE_X0, SAFE_X1, SHARP_STEPS, intervalColor, keySigAccidentals, keySigPitchClasses, staffPos,
} from './reel';

/**
 * The Keypracticer reel layout (title, fretboard, note lane, staff, tab and the
 * red playhead), drawn in one SVG in the reel's own 1080 px wide coordinates.
 * Ported from keypracticer-content-gen remotion/src/versions/v4. The strips are
 * moved by `cursor` (the target note index, animated) instead of video time.
 */

// Part of the 1080 x 1920 reel that is shown: title to tab.
const VIEW_Y = 160;
const VIEW_H = 1360;

// Fretboard (geometry.ts)
const FRET_X0 = 101;
const FRET_X1 = 979;
const FRET_Y0 = 320;
const FRET_Y1 = 760;
const FRET_PAD = 16;
const STRING_GAP = 66;
const STRING_TOP = FRET_Y0 + 48;
const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOT_R = 29;

// Lanes (ReelComposition.tsx)
const STAFF_TOP = 1085;
const LANE_H = 88;
const LANE_DIVIDER_Y = STAFF_TOP - 28;
const LANE_TOP = LANE_DIVIDER_Y - LANE_H - 8;
const TAB_Y = 1285;
const PLAYHEAD_TOP = LANE_TOP - 8;
const PLAYHEAD_BOTTOM = TAB_Y + 5 * 36 + 40;

// Staff (staffPositions.ts)
const STAFF_GAP = 16;
const STAFF_BASE = STAFF_TOP + 112;
const STEM = Math.round(3.5 * STAFF_GAP);
const staffY = (step: number) => STAFF_BASE - (step - 30) * (STAFF_GAP / 2);

const FONT = 'Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
const MUSIC_FONT = "'Noto Music', 'Bravura Text', 'Segoe UI Symbol', 'Apple Symbols', serif";

export interface Feedback {
  kind: 'hit' | 'miss';
  /** Note index it belongs to. */
  index: number;
  /** 0 when it happened, 1 when the effect is over. */
  age: number;
}

export interface ReelViewProps {
  exercise: Exercise;
  /** Index of the note to play now (integer). */
  index: number;
  /** Animated position of the strips; equals index when at rest. */
  cursor: number;
  feedback?: Feedback | null;
  /** Lines under the title, e.g. the subtitle. */
  meta: string;
}

function fretRange(notes: ExNote[]): [number, number] {
  const frets = notes.map((n) => n.fret);
  let lo = Math.max(0, Math.min(...frets) - 1);
  if (lo === 1) lo = 0;
  const hi = Math.max(...frets) + 1;
  return [lo, Math.max(hi, lo + 1)];
}

export function ReelView({ exercise, index, cursor, feedback, meta }: ReelViewProps) {
  const [w, setW] = useState(360);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const h = (w * VIEW_H) / 1080;
  const notes = exercise.notes;
  const target = notes[Math.min(index, notes.length - 1)];
  const finished = index >= notes.length;

  // ---- fretboard geometry (Fretboard.tsx)
  const [lo, hi] = fretRange([...exercise.box, ...notes]);
  const fw = (FRET_X1 - FRET_X0 - 2 * FRET_PAD) / (lo === 0 ? hi : hi - lo + 1);
  const cx = (f: number) => {
    const base = FRET_X0 + FRET_PAD;
    if (lo === 0) return f === 0 ? base : base + (f - 0.5) * fw;
    return base + (f - lo + 0.5) * fw;
  };
  const cy = (s: number) => STRING_TOP + (s - 1) * STRING_GAP;
  const range = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

  // ---- strips
  const xOf = (i: number) => PLAY_X + (i - cursor) * CELL;
  const visible = notes.map((n, i) => ({ n, i, x: xOf(i) })).filter((v) => v.x > SAFE_X0 + 24 && v.x < SAFE_X1 + 60);
  const minor = /minor|blues|dorian|aeolian/i.test(exercise.scale ?? '');
  const keySig = keySigAccidentals(exercise.keyRootPc, minor);
  const keySigPcs = keySigPitchClasses(exercise.keyRootPc, minor);
  const staffFade = SAFE_X0 + Math.max(84, 70 + keySig.count * 14 + 4);
  const laneFade = SAFE_X0 + 84;

  const hitFx = feedback?.kind === 'hit' ? feedback : null;
  const missFx = feedback?.kind === 'miss' && feedback.index === index ? feedback : null;
  const hitNote = hitFx ? notes[hitFx.index] : null;

  return (
    <View onLayout={onLayout} style={{ width: '100%', aspectRatio: 1080 / VIEW_H }} testID="reel">
      <Svg width={w} height={h} viewBox={`0 ${VIEW_Y} 1080 ${VIEW_H}`}>
        <Defs>
          <ClipPath id="lane">
            <Rect x={laneFade - 20} y={LANE_TOP - 10} width={SAFE_X1 - laneFade + 20} height={LANE_H + 20} />
          </ClipPath>
          <ClipPath id="staff">
            <Rect x={staffFade - 20} y={STAFF_TOP - 40} width={SAFE_X1 + 40 - staffFade} height={240} />
          </ClipPath>
          <ClipPath id="tab">
            <Rect x={laneFade - 20} y={TAB_Y - 20} width={SAFE_X1 + 40 - laneFade} height={220} />
          </ClipPath>
          <LinearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={K.bg} stopOpacity="1" />
            <Stop offset="1" stopColor={K.bg} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={VIEW_Y} width={1080} height={VIEW_H} fill={K.bg} />

        {/* Title block */}
        <SvgText x={540} y={250} textAnchor="middle" fontFamily={FONT} fontWeight="700" fontSize={68} fill={K.text}>
          {exercise.title}
        </SvgText>
        <SvgText x={540} y={298} textAnchor="middle" fontFamily={FONT} fontWeight="600" fontSize={32} fill={K.text} opacity={0.65}>
          {meta}
        </SvgText>

        {/* Fretboard panel, inlays, frets, strings, numbers */}
        <Rect x={FRET_X0} y={FRET_Y0} width={FRET_X1 - FRET_X0} height={FRET_Y1 - FRET_Y0} rx={28} fill={K.panel} />
        {range
          .filter((f) => INLAYS.includes(f % 24))
          .map((f) => <Circle key={`in${f}`} cx={cx(f)} cy={(FRET_Y0 + FRET_Y1) / 2} r={13} fill={K.inlay} />)}
        {range
          .filter((f) => f > 0 && f % 12 === 0)
          .flatMap((f) => [cy(2) + 34, cy(5) - 34].map((yy) => <Circle key={`d${f}${yy}`} cx={cx(f)} cy={yy} r={13} fill={K.inlay} />))}
        {Array.from({ length: lo === 0 ? hi + 1 : hi - lo + 2 }, (_, i) => {
          const fx = FRET_X0 + FRET_PAD + i * fw;
          const nut = lo === 0 && i === 0;
          return (
            <Rect key={`f${i}`} x={fx - (nut ? 5 : 2)} y={FRET_Y0 + 10} width={nut ? 10 : 4} height={FRET_Y1 - FRET_Y0 - 20} fill={nut ? K.fret : K.line} />
          );
        })}
        {Array.from({ length: 6 }, (_, s) => {
          const sh = 2 + Math.round(s * 0.5);
          return <Rect key={`s${s}`} x={FRET_X0 + FRET_PAD} y={STRING_TOP + s * STRING_GAP - sh / 2} width={FRET_X1 - FRET_X0 - 2 * FRET_PAD} height={sh} fill={K.line} />;
        })}
        {range.map((f) => (
          <SvgText key={`n${f}`} x={cx(f)} y={FRET_Y1 + 42} textAnchor="middle" fontFamily={FONT} fontSize={26} fill={K.muted}>
            {f}
          </SvgText>
        ))}

        {/* Box dots */}
        {exercise.box.map((m) => {
          const c = intervalColor(m.interval);
          return (
            <G key={`b${m.string}:${m.fret}`}>
              <Circle cx={cx(m.fret)} cy={cy(m.string)} r={DOT_R - 1.5} fill={c} fillOpacity={0.22} stroke={c} strokeWidth={3} />
              <SvgText x={cx(m.fret)} y={cy(m.string) + 9} textAnchor="middle" fontFamily={FONT} fontWeight="700" fontSize={26} fill={K.text}>
                {m.interval}
              </SvgText>
            </G>
          );
        })}

        {/* Right note: a green ring that grows and fades */}
        {hitNote && hitFx ? (
          <Circle
            cx={cx(hitNote.fret)}
            cy={cy(hitNote.string)}
            r={37 + 40 * hitFx.age}
            fill="none"
            stroke={K.good}
            strokeWidth={8 * (1 - hitFx.age) + 1}
            opacity={1 - hitFx.age}
          />
        ) : null}

        {/* Target note with glow */}
        {!finished && target ? (
          <G testID="target">
            <Circle cx={cx(target.fret)} cy={cy(target.string)} r={62} fill={intervalColor(target.interval)} opacity={0.12} />
            <Circle cx={cx(target.fret)} cy={cy(target.string)} r={48} fill={intervalColor(target.interval)} opacity={0.18} />
            <Circle cx={cx(target.fret)} cy={cy(target.string)} r={39} fill="none" stroke={intervalColor(target.interval)} strokeWidth={3} />
            <Circle cx={cx(target.fret)} cy={cy(target.string)} r={35} fill={intervalColor(target.interval)} stroke={K.bg} strokeWidth={4} />
            <SvgText x={cx(target.fret)} y={cy(target.string) + 11} textAnchor="middle" fontFamily={FONT} fontWeight="700" fontSize={32} fill="#FFFFFF">
              {target.interval}
            </SvgText>
            {missFx ? (
              <Circle cx={cx(target.fret)} cy={cy(target.string)} r={46 + 6 * Math.sin(missFx.age * Math.PI * 4)} fill="none" stroke={K.bad} strokeWidth={6} opacity={1 - missFx.age} />
            ) : null}
          </G>
        ) : null}

        {/* Note lane: names and intervals */}
        <G clipPath="url(#lane)">
          {visible.map(({ n, i, x }) => {
            const c = intervalColor(n.interval);
            const active = i === index;
            const sepTall = i % 2 === 0;
            const bar = i % 8 === 0;
            return (
              <G key={`l${i}`} opacity={active ? 1 : i < index ? 0.4 : 0.72}>
                <Rect
                  x={x - CELL / 2 - (bar ? 1.5 : 1)}
                  y={sepTall || bar ? LANE_TOP : LANE_TOP + 52}
                  width={bar ? 3 : 2}
                  height={sepTall || bar ? LANE_H : LANE_H - 52}
                  fill={bar ? K.text : K.line}
                />
                <SvgText x={x} y={LANE_TOP + 44} textAnchor="middle" fontFamily={FONT} fontWeight="700" fontSize={active ? 43 : 40} fill={c}>
                  {n.name}
                </SvgText>
                <SvgText x={x} y={LANE_TOP + 76} textAnchor="middle" fontFamily={FONT} fontWeight={active ? '700' : '500'} fontSize={26} fill={c}>
                  {n.interval}
                </SvgText>
                {active ? <Rect x={x - 20} y={LANE_TOP + 82} width={40} height={4} fill={c} /> : null}
              </G>
            );
          })}
        </G>
        <Rect x={laneFade - 20} y={LANE_TOP - 10} width={36} height={LANE_H + 20} fill="url(#fade)" />
        <Line x1={SAFE_X0} x2={SAFE_X1} y1={LANE_DIVIDER_Y} y2={LANE_DIVIDER_Y} stroke={K.line} strokeWidth={3} strokeDasharray="5 9" opacity={0.72} />

        {/* Staff */}
        {[0, 1, 2, 3, 4].map((i) => (
          <Line key={`sl${i}`} x1={SAFE_X0} x2={SAFE_X1} y1={STAFF_BASE - i * STAFF_GAP} y2={STAFF_BASE - i * STAFF_GAP} stroke={K.line} strokeWidth={2} />
        ))}
        <Line x1={SAFE_X0 + 1} x2={SAFE_X0 + 1} y1={STAFF_BASE - 4 * STAFF_GAP} y2={STAFF_BASE} stroke={K.line} strokeWidth={2} />
        <SvgText x={SAFE_X0 + 16} y={STAFF_BASE - STAFF_GAP + 1} fontFamily={MUSIC_FONT} fontSize={STAFF_GAP * 4.6} fill={K.text}>
          {'𝄞'}
        </SvgText>
        {(keySig.type === 'sharp' ? SHARP_STEPS : FLAT_STEPS).slice(0, keySig.count).map((step, i) => (
          <SvgText key={`ks${i}`} x={SAFE_X0 + 70 + i * 14} y={staffY(step) + 13} fontFamily={MUSIC_FONT} fontSize={STAFF_GAP * 2.4} fill={K.text}>
            {keySig.type === 'sharp' ? '♯' : '♭'}
          </SvgText>
        ))}
        <G clipPath="url(#staff)">{staffNotes(notes, visible, index, keySigPcs)}</G>
        <Rect x={staffFade - 20} y={STAFF_TOP - 40} width={36} height={240} fill="url(#fade)" />
        <Line x1={SAFE_X0} x2={SAFE_X1} y1={TAB_Y - 8} y2={TAB_Y - 8} stroke={K.line} strokeWidth={3} strokeDasharray="5 9" opacity={0.72} />

        {/* Tab */}
        {['e', 'B', 'G', 'D', 'A', 'E'].map((name, s) => (
          <G key={`t${s}`}>
            <SvgText x={SAFE_X0} y={TAB_Y + 18 + s * 30 + 8} fontFamily={FONT} fontSize={22} fill={K.muted}>
              {name}
            </SvgText>
            <Rect x={SAFE_X0 + 46} y={TAB_Y + 18 + s * 30 - 1} width={SAFE_X1 - SAFE_X0 - 46} height={2} fill={K.line} />
          </G>
        ))}
        <G clipPath="url(#tab)">
          {visible
            .filter(({ i }) => i % 8 === 0)
            .map(({ i, x }) => (
              <Rect key={`tb${i}`} x={x - CELL / 2 - 1} y={TAB_Y + 17} width={2} height={152} fill={K.text} />
            ))}
          {visible.map(({ n, i, x }) => {
            const c = intervalColor(n.interval);
            const y = TAB_Y + 18 + (n.string - 1) * 30;
            if (i === index) {
              return (
                <G key={`tn${i}`}>
                  <Circle cx={x} cy={y} r={20} fill={K.bg} stroke={c} strokeWidth={4} />
                  <SvgText x={x} y={y + 12} textAnchor="middle" fontFamily={FONT} fontWeight="700" fontSize={n.fret > 9 ? 26 : 34} fill={c}>
                    {n.fret}
                  </SvgText>
                </G>
              );
            }
            return (
              <G key={`tn${i}`} opacity={i < index ? 0.45 : 1}>
                <Rect x={x - 25} y={y - 18} width={50} height={36} rx={12} fill={K.bg} />
                <SvgText x={x} y={y + 12} textAnchor="middle" fontFamily={FONT} fontWeight="500" fontSize={34} fill={c}>
                  {n.fret}
                </SvgText>
              </G>
            );
          })}
        </G>
        <Rect x={laneFade - 20} y={TAB_Y - 20} width={36} height={220} fill="url(#fade)" />

        {/* Playhead */}
        <Rect x={PLAY_X - 2} y={PLAYHEAD_TOP} width={4} height={PLAYHEAD_BOTTOM - PLAYHEAD_TOP} rx={2} fill={K.root} />
      </Svg>
    </View>
  );
}

/** Note heads, ledger lines, stems and beams (StaffStrip.tsx), beamed in pairs. */
function staffNotes(notes: ExNote[], visible: { n: ExNote; i: number; x: number }[], index: number, keySigPcs: Set<number>) {
  const out: React.ReactNode[] = [];
  const byIndex = new Map(visible.map((v) => [v.i, v]));
  // Pairs of eighths share a beam.
  for (let g = 0; g < notes.length; g += 2) {
    const group = [g, g + 1].filter((i) => i < notes.length).map((i) => byIndex.get(i)).filter(Boolean) as typeof visible;
    if (!group.length) continue;
    const steps = group.map((v) => staffPos(v.n.midi).step);
    const ys = steps.map(staffY);
    const up = steps.reduce((a, b) => a + b, 0) / steps.length < 34;
    const beamY = up ? Math.min(...ys) - STEM : Math.max(...ys) + STEM;
    const sx = (x: number) => x + (up ? 9.5 : -9.5);
    const col = group.every((v) => v.i < index) ? K.muted : K.text;
    group.forEach((v, k) => out.push(<Line key={`st${v.i}`} x1={sx(v.x)} x2={sx(v.x)} y1={ys[k]} y2={beamY} stroke={col} strokeWidth={2.2} />));
    const whole = g + 1 < notes.length;
    if (group.length === 2) {
      const x0 = sx(group[0].x) - 1.1;
      const x1 = sx(group[1].x) + 1.1;
      const t = up ? 6 : -6;
      out.push(<Polygon key={`bm${g}`} points={`${x0},${beamY} ${x1},${beamY} ${x1},${beamY + t} ${x0},${beamY + t}`} fill={col} />);
    } else if (!whole) {
      const fx = sx(group[0].x);
      const d = up ? 1 : -1;
      const pts = Array.from({ length: 9 }, (_, j) => {
        const f = j / 8;
        return `${fx + 3 * f + 9 * f * f},${beamY + d * (10 * f + 6 * f * f)}`;
      }).join(' ');
      out.push(<Polyline key={`fl${g}`} points={pts} fill="none" stroke={col} strokeWidth={2.4} strokeLinecap="round" />);
    }
  }
  for (const { n, i, x } of visible) {
    const p = staffPos(n.midi);
    const y = staffY(p.step);
    const c = intervalColor(n.interval);
    for (let s = 28; s >= p.step; s -= 2) out.push(<Line key={`lb${i}${s}`} x1={x - 17} x2={x + 17} y1={staffY(s)} y2={staffY(s)} stroke={K.line} strokeWidth={2} />);
    for (let s = 40; s <= p.step; s += 2) out.push(<Line key={`la${i}${s}`} x1={x - 17} x2={x + 17} y1={staffY(s)} y2={staffY(s)} stroke={K.line} strokeWidth={2} />);
    out.push(<Ellipse key={`h${i}`} cx={x} cy={y} rx={10.5} ry={7.5} rotation={-20} origin={`${x}, ${y}`} fill={c} opacity={i < index ? 0.5 : 1} />);
    if (i === index) out.push(<Ellipse key={`g${i}`} cx={x} cy={y} rx={17} ry={13} rotation={-20} origin={`${x}, ${y}`} fill="none" stroke={c} strokeWidth={2} opacity={0.6} />);
    if (p.isAccidental && !keySigPcs.has(n.midi % 12)) {
      out.push(
        <SvgText key={`a${i}`} x={x - 30} y={y + 8} fontFamily={MUSIC_FONT} fontSize={26} fill={c}>
          {'♯'}
        </SvgText>,
      );
    }
  }
  return out;
}
