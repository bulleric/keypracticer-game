import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Circle } from 'react-native-svg';
import type { PitchFrame } from '../pitch/tracker';
import { C } from '../theme/colors';
import { ProgressBar } from './ui';

/** Note name, octave, a cents needle and a level meter. */
export function TunerGauge({ frame, compact }: { frame: PitchFrame | null; compact?: boolean }) {
  const note = frame?.note ?? null;
  const cents = note?.cents ?? 0;
  const inTune = note && Math.abs(cents) <= 5;
  const w = compact ? 220 : 280;
  const h = compact ? 70 : 100;
  const cx = w / 2;
  const cy = h;
  const r = h - 10;
  const angle = ((note ? Math.max(-50, Math.min(50, cents)) : 0) / 50) * (Math.PI / 3);
  const nx = cx + Math.sin(angle) * r;
  const ny = cy - Math.cos(angle) * r;
  const level = frame ? Math.min(1, Math.sqrt(frame.rms) * 3) : 0;
  return (
    <View style={styles.wrap} testID="tuner">
      <Text style={[styles.note, compact && { fontSize: 40 }, { color: note ? (inTune ? C.good : C.text) : C.faint }]} testID="tuner-note">
        {note ? note.name : '–'}
        <Text style={styles.oct}>{note ? note.octave : ''}</Text>
      </Text>
      <Svg width={w} height={h + 6}>
        <Path
          d={`M ${cx - Math.sin(Math.PI / 3) * r} ${cy - Math.cos(Math.PI / 3) * r} A ${r} ${r} 0 0 1 ${cx + Math.sin(Math.PI / 3) * r} ${cy - Math.cos(Math.PI / 3) * r}`}
          stroke={C.border}
          strokeWidth={4}
          fill="none"
        />
        <Line x1={cx} y1={cy - r - 4} x2={cx} y2={cy - r + 10} stroke={C.good} strokeWidth={3} />
        <Line x1={cx} y1={cy} x2={nx} y2={ny} stroke={inTune ? C.good : C.accent} strokeWidth={3} strokeLinecap="round" />
        <Circle cx={cx} cy={cy} r={5} fill={C.text} />
      </Svg>
      <Text style={styles.cents} testID="tuner-cents">
        {note ? `${cents > 0 ? '+' : ''}${cents} cents${inTune ? ' · in tune' : cents < 0 ? ' · flat' : ' · sharp'}` : 'Play a note'}
      </Text>
      <View style={{ width: w, marginTop: 8 }}>
        <ProgressBar value={level} color={level > 0.85 ? C.bad : C.good} />
        <Text style={styles.meter}>Input level</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  note: { color: C.text, fontSize: 64, fontWeight: '800' },
  oct: { fontSize: 22, color: C.dim },
  cents: { color: C.dim, fontSize: 14, marginTop: 4 },
  meter: { color: C.faint, fontSize: 11, marginTop: 2, textAlign: 'center' },
});
