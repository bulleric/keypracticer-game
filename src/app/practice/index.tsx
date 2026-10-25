import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Button, Card, Stars, styles as ui } from '../../components/ui';
import { ARPEGGIOS, PATTERNS, ROOTS, SCALES, buildExercise, configFromCode, positionCount, practiceCode, practiceHref, type ExerciseConfig } from '../../practice/theory';
import { useProgress } from '../../store/progress';
import { C } from '../../theme/colors';

const START: ExerciseConfig = { mode: 'scale', key: 'F', name: 'Major Pentatonic', position: 2, pattern: 'Up & down' };

/** Pick a Keypracticer exercise (or type the code from a video) for Live Practice. */
export default function PracticePicker() {
  const { progress } = useProgress();
  const [cfg, setCfg] = useState<ExerciseConfig>(START);
  const [reps, setReps] = useState(1);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const nPos = positionCount(cfg);
  const set = (p: Partial<ExerciseConfig>) => {
    const next = { ...cfg, ...p };
    next.position = Math.min(next.position, positionCount(next));
    setCfg(next);
  };
  const go = (c: ExerciseConfig) => router.push(practiceHref(c, reps) as any);
  const openCode = () => {
    const c = configFromCode(code);
    setCodeError(!c);
    if (c) go(c);
  };
  const best = progress.practiceBest[buildExercise(cfg).id];

  return (
    <Screen>
      <Card style={{ gap: 6 }}>
        <Text style={ui.h2}>🎸 Live Practice</Text>
        <Text style={ui.body}>
          Play the exercise on your guitar. No metronome: the glowing note waits until the mic hears it, then the next one lights up. Right notes in a row build your combo.
        </Text>
      </Card>

      <Card style={{ gap: 8 }}>
        <Text style={s.label}>CODE FROM A VIDEO</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={code}
            onChangeText={(t) => {
              setCode(t);
              setCodeError(false);
            }}
            onSubmitEditing={openCode}
            placeholder="e.g. FPS2UD80"
            placeholderTextColor={C.faint}
            autoCapitalize="characters"
            autoCorrect={false}
            style={s.input}
            testID="practice-code"
          />
          <Button small title="Open" onPress={openCode} testID="practice-code-go" />
        </View>
        {codeError ? <Text style={{ color: C.bad }}>That code doesn't match a scale or arpeggio exercise.</Text> : null}
      </Card>

      <Card style={{ gap: 10 }}>
        <Chips label="TYPE" options={['scale', 'arpeggio']} value={cfg.mode} show={(m) => (m === 'scale' ? 'Scale' : 'Arpeggio')}
          onPick={(mode) => set({ mode, name: mode === 'scale' ? 'Minor Pentatonic' : 'Minor 7' })} />
        <Chips label="KEY" options={[...ROOTS]} value={cfg.key} onPick={(key) => set({ key })} />
        <Chips label={cfg.mode === 'scale' ? 'SCALE' : 'ARPEGGIO'} options={Object.keys(cfg.mode === 'scale' ? SCALES : ARPEGGIOS)} value={cfg.name} onPick={(name) => set({ name })} />
        <Chips label="BOX" options={Array.from({ length: nPos }, (_, i) => String(i + 1))} value={String(cfg.position)} onPick={(p) => set({ position: Number(p) })} />
        <Chips label="PATTERN" options={[...PATTERNS]} value={cfg.pattern} onPick={(pattern) => set({ pattern })} />
        <Chips label="REPEATS" options={['1', '2', '4']} value={String(reps)} onPick={(r) => setReps(Number(r))} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={ui.small}>Code {practiceCode(cfg)}</Text>
          {best ? (
            <>
              <Stars n={best.stars} size={14} />
              <Text style={ui.small}>best {best.score}</Text>
            </>
          ) : null}
        </View>
        <Button title="Start" onPress={() => go(cfg)} testID="practice-start" />
      </Card>
    </Screen>
  );
}

function Chips<T extends string>({ label, options, value, onPick, show }: { label: string; options: T[]; value: T; onPick: (v: T) => void; show?: (v: T) => string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <View style={s.chips}>
        {options.map((o) => (
          <Pressable key={o} onPress={() => onPick(o)} style={[s.chip, o === value && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: o === value }}>
            <Text style={[s.chipText, o === value && { color: '#1d140a' }]}>{show ? show(o) : o}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  label: { color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.border },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent2 },
  chipText: { color: C.text, fontWeight: '700', fontSize: 13 },
  input: { flex: 1, color: C.text, backgroundColor: C.panel2, borderColor: C.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16, fontWeight: '700' },
});
