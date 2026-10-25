import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { DOT_FRETS, STRINGS_LOW_TO_HIGH, noteAt, type StringNumber } from '../music/notes';
import type { BoardMark } from '../quiz/types';
import { C } from '../theme/colors';

export interface FretboardProps {
  frets?: number;
  highlightString?: StringNumber;
  highlightFret?: { string?: StringNumber; fret: number };
  marks?: BoardMark[];
  onTap?: (string: StringNumber, fret: number) => void;
  /** Only allow taps on this string. */
  tapString?: StringNumber;
  showAllNames?: boolean;
  height?: number;
}

const TOP_TO_BOTTOM: StringNumber[] = [1, 2, 3, 4, 5, 6];
const STRING_LETTER: Record<StringNumber, string> = { 1: 'e', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'E' };

const toneColor = (tone: BoardMark['tone']) =>
  tone === 'good' ? C.good : tone === 'bad' ? C.bad : tone === 'hint' ? C.hint : C.accent;

/** A guitar neck seen from the player: high e on top, low E at the bottom. */
export function Fretboard({
  frets = 12,
  highlightString,
  highlightFret,
  marks = [],
  onTap,
  tapString,
  showAllNames,
  height: fixedHeight,
}: FretboardProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const labelW = 18;
  const openW = Math.max(28, width * 0.07);
  const boardX = labelW + openW;
  const boardW = Math.max(0, width - boardX - 6);
  const height = fixedHeight ?? Math.min(240, Math.max(170, width * 0.32));
  const top = 12;
  const bottom = height - 26;
  const spacing = (bottom - top) / 5;
  const stringY = (s: StringNumber) => top + TOP_TO_BOTTOM.indexOf(s) * spacing;

  // Real guitars: each fret is 2^(-1/12) narrower than the last.
  const ratio = Math.pow(2, -1 / 12);
  const raw = Array.from({ length: frets }, (_, i) => Math.pow(ratio, i));
  const sum = raw.reduce((a, b) => a + b, 0);
  const fretX: number[] = [boardX];
  raw.forEach((w) => fretX.push(fretX[fretX.length - 1] + (w / sum) * boardW));
  // centre of the space for fret f (f >= 1); fret 0 sits left of the nut
  const fretCenter = (f: number) => (f === 0 ? labelW + openW / 2 : (fretX[f - 1] + fretX[f]) / 2);

  const marksToDraw: BoardMark[] = [...marks];
  if (highlightFret?.string) {
    marksToDraw.unshift({ string: highlightFret.string, fret: highlightFret.fret, tone: 'target' });
  }

  return (
    <View onLayout={onLayout} style={{ width: '100%', height }} testID="fretboard">
      {width > 0 && (
        <Svg width={width} height={height}>
          {/* wood */}
          <Rect x={boardX} y={top - 8} width={boardW} height={bottom - top + 16} fill={C.wood} rx={4} />
          {/* open-string area */}
          <Rect x={labelW} y={top - 8} width={openW - 4} height={bottom - top + 16} fill={C.panel2} rx={4} />
          {/* fret column highlight */}
          {highlightFret && !highlightFret.string && highlightFret.fret > 0 && (
            <Rect
              x={fretX[highlightFret.fret - 1]}
              y={top - 8}
              width={fretX[highlightFret.fret] - fretX[highlightFret.fret - 1]}
              height={bottom - top + 16}
              fill={C.accent}
              opacity={0.55}
            />
          )}
          {/* dots */}
          {DOT_FRETS.filter((f) => f <= frets).map((f) =>
            f === 12 ? (
              <G key={f}>
                <Circle cx={fretCenter(f)} cy={top + spacing * 1.5} r={5} fill={C.fret} opacity={0.7} />
                <Circle cx={fretCenter(f)} cy={top + spacing * 3.5} r={5} fill={C.fret} opacity={0.7} />
              </G>
            ) : (
              <Circle key={f} cx={fretCenter(f)} cy={top + spacing * 2.5} r={5} fill={C.fret} opacity={0.7} />
            ),
          )}
          {/* nut and frets */}
          <Rect x={boardX - 4} y={top - 8} width={5} height={bottom - top + 16} fill="#efe6d6" />
          {fretX.slice(1).map((x, i) => (
            <Line key={i} x1={x} x2={x} y1={top - 8} y2={bottom + 8} stroke={C.fret} strokeWidth={2} />
          ))}
          {/* strings */}
          {TOP_TO_BOTTOM.map((s, i) => {
            const lit = highlightString === s;
            return (
              <G key={s}>
                {lit && (
                  <Rect x={labelW} y={stringY(s) - 7} width={width - labelW - 4} height={14} rx={7} fill={C.accent} opacity={0.35} />
                )}
                <Line
                  x1={labelW}
                  x2={width - 4}
                  y1={stringY(s)}
                  y2={stringY(s)}
                  stroke={lit ? C.accent2 : C.string}
                  strokeWidth={1 + i * 0.45}
                />
                <SvgText x={2} y={stringY(s) + 4} fontSize={11} fontFamily="system-ui, sans-serif" fill={lit ? C.accent2 : C.dim} fontWeight="bold">
                  {STRING_LETTER[s]}
                </SvgText>
              </G>
            );
          })}
          {/* fret numbers */}
          {Array.from({ length: frets }, (_, i) => i + 1).map((f) => (
            <SvgText
              key={f}
              x={fretCenter(f)}
              y={height - 8}
              fontSize={11}
              fontFamily="system-ui, sans-serif"
              fill={DOT_FRETS.includes(f) ? C.text : C.faint}
              textAnchor="middle"
            >
              {f}
            </SvgText>
          ))}
          {/* all note names (reference) */}
          {showAllNames &&
            STRINGS_LOW_TO_HIGH.flatMap((s) =>
              Array.from({ length: frets + 1 }, (_, f) => (
                <SvgText key={`${s}-${f}`} x={fretCenter(f)} y={stringY(s) + 4} fontSize={10} fill={C.text} textAnchor="middle">
                  {noteAt(s, f)}
                </SvgText>
              )),
            )}
          {/* marks */}
          {marksToDraw.map((m, i) => (
            <G key={`m${i}`}>
              <Circle cx={fretCenter(m.fret)} cy={stringY(m.string)} r={Math.min(12, spacing * 0.42)} fill={toneColor(m.tone)} stroke="#fff" strokeWidth={1.5} />
              {m.label ? (
                <SvgText x={fretCenter(m.fret)} y={stringY(m.string) + 4} fontSize={11} fontWeight="bold" fill="#14110f" textAnchor="middle">
                  {m.label}
                </SvgText>
              ) : null}
            </G>
          ))}
          {/* tap targets */}
          {onTap &&
            TOP_TO_BOTTOM.filter((s) => !tapString || s === tapString).flatMap((s) =>
              Array.from({ length: frets + 1 }, (_, f) => {
                const x0 = f === 0 ? labelW : fretX[f - 1];
                const x1 = f === 0 ? boardX - 4 : fretX[f];
                return (
                  <Rect
                    key={`t${s}-${f}`}
                    id={`fret-${s}-${f}`}
                    x={x0}
                    y={stringY(s) - spacing / 2}
                    width={x1 - x0}
                    height={spacing}
                    fill="#ffffff"
                    fillOpacity={0.001}
                    onPress={() => onTap(s, f)}
                  />
                );
              }),
            )}
        </Svg>
      )}
    </View>
  );
}
