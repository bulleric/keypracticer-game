import { StyleSheet, Text, View } from 'react-native';
import { playNotes } from '../audio/notePlayer';
import { Button } from '../components/ui';
import { C } from '../theme/colors';
import { intervalColor } from './reel';
import { buildExercise, type Exercise } from './theory';

const STRING_NAME: Record<number, string> = { 1: 'high e', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'low E' };

/** Music theory at hand: what the pentatonic is, and the scale and box you are playing now. */
export function TheoryPanel({ exercise }: { exercise: Exercise }) {
  const minor = exercise.scale === 'Minor Pentatonic';
  const key = exercise.config.key;
  // One octave of the scale from the root, with intervals.
  const seen = new Set<string>();
  const degrees = [...exercise.box]
    .sort((a, b) => a.midi - b.midi)
    .filter((n) => (seen.has(n.interval) ? false : (seen.add(n.interval), true)));
  const order = minor ? ['R', 'b3', '4', '5', 'b7'] : ['R', '2', '3', '5', '6'];
  degrees.sort((a, b) => order.indexOf(a.interval) - order.indexOf(b.interval));
  const roots = exercise.box.filter((n) => n.interval === 'R');
  const frets = exercise.box.map((n) => n.fret);
  const relKey = minor ? degrees.find((d) => d.interval === 'b3')?.name : degrees.find((d) => d.interval === '6')?.name;
  const relName = minor ? `${relKey} major pentatonic` : `${relKey} minor pentatonic`;
  const scaleUp = [...exercise.box].sort((a, b) => a.midi - b.midi).map((n) => n.midi);
  const other = minor ? 'Major Pentatonic' : 'Minor Pentatonic';
  const otherEx = buildExercise({ ...exercise.config, name: other, position: 1, pattern: 'Up' });

  return (
    <View style={{ gap: 14 }} testID="theory-panel">
      <Section title="What is a pentatonic scale?">
        <P>
          "Penta" means five: the scale has five notes per octave. It is the major or minor scale with the two notes left out that
          clash most easily. What remains sounds good over almost any chord in the key, which is why so many rock, blues, pop and
          country solos are built on it.
        </P>
      </Section>

      <Section title={`Now playing: ${exercise.title}`}>
        <View style={s.chips}>
          {degrees.map((d) => (
            <View key={d.interval} style={[s.degree, { borderColor: intervalColor(d.interval) }]}>
              <Text style={[s.degreeName, { color: intervalColor(d.interval) }]}>{d.name}</Text>
              <Text style={[s.degreeInt, { color: intervalColor(d.interval) }]}>{d.interval}</Text>
            </View>
          ))}
        </View>
        <P>
          {minor
            ? 'Minor pentatonic: R b3 4 5 b7 (0 3 5 7 10 semitones from the root). Dark and bluesy.'
            : 'Major pentatonic: R 2 3 5 6 (0 2 4 7 9 semitones from the root). Bright and open.'}
        </P>
        <P>
          Box {exercise.config.position} covers frets {Math.min(...frets)} to {Math.max(...frets)}. The root ({key}) is on the{' '}
          {[...new Set(roots.map((r) => STRING_NAME[r.string]))].join(' and ')} string
          {new Set(roots.map((r) => r.string)).size > 1 ? 's' : ''}. Aim for the red R dots: start and end your phrases there.
        </P>
        <Button small kind="secondary" title="▶ Hear the box" onPress={() => playNotes(scaleUp, 0.32, 1.2)} testID="hear-box" />
      </Section>

      <Section title="Minor and major share the shapes">
        <P>
          {exercise.title} uses the same five notes as {relName}. Only the root moves, so every box you learn counts twice. The
          minor root is the 6 of the major scale; the major root is the b3 of the minor scale.
        </P>
        <P>
          {other} in {key} starts box 1 on fret {Math.min(...otherEx.box.filter((n) => n.string === 6).map((n) => n.fret))} of the
          low E string.
        </P>
      </Section>

      <Section title="The five boxes">
        <P>
          The notes repeat across the neck in five shapes that link together: the top notes of one box are the bottom notes of the
          next. Box 1 starts on the root on the low E string. After box 5 the pattern starts again 12 frets higher.
        </P>
      </Section>

      <Section title="Practice tips">
        <P>• One finger per fret: index on the lowest fret of the box.</P>
        <P>• Slow and clean beats fast and messy. Speed comes from accuracy.</P>
        <P>• Alternate your picking: down, up, down, up.</P>
        <P>• Say the interval out loud while you play (R, b3, 4...). You will start to hear them.</P>
      </Section>

      <Section title="Colours">
        <View style={s.chips}>
          {['R', '2', 'b3', '4', '5', '6', 'b7'].map((i) => (
            <View key={i} style={[s.dot, { backgroundColor: intervalColor(i) }]}>
              <Text style={s.dotText}>{i}</Text>
            </View>
          ))}
        </View>
        <P>Every interval has its own colour, the same as in the Keypracticer videos.</P>
      </Section>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.h}>{title}</Text>
      {children}
    </View>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={s.p}>{children}</Text>;
}

const s = StyleSheet.create({
  h: { color: C.text, fontSize: 17, fontWeight: '800' },
  p: { color: C.dim, fontSize: 15, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  degree: { borderWidth: 3, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4, alignItems: 'center', minWidth: 52, backgroundColor: C.panel },
  degreeName: { fontSize: 20, fontWeight: '800' },
  degreeInt: { fontSize: 13, fontWeight: '700' },
  dot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dotText: { color: '#fff', fontWeight: '800' },
});
