import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { now } from '../audio/clock';
import { resumeAudio } from '../audio/context';
import { buzz } from '../audio/haptics';
import { AnswerPad } from '../components/AnswerPad';
import { Fretboard } from '../components/Fretboard';
import { MicPanel } from '../components/MicPanel';
import { setDebug } from '../components/QuizPlayer';
import { Screen } from '../components/Screen';
import { Button, Card, Confetti, Juicy, ProgressBar, styles as ui } from '../components/ui';
import { midiAt, noteLabel, type StringNumber } from '../music/notes';
import { MicService, useMicNotes, useMicState } from '../pitch/MicService';
import { makeQuestion } from '../quiz/generate';
import { checkMidi, checkPad, multiplierFor } from '../quiz/round';
import type { Level, Question } from '../quiz/types';
import { useProgress } from '../store/progress';
import { C } from '../theme/colors';

const DURATION = 60;
type Mode = 'tap' | 'play';
const RANGES: { label: string; strings: StringNumber[] }[] = [
  { label: 'Low E + A', strings: [6, 5] },
  { label: 'All strings', strings: [6, 5, 4, 3, 2, 1] },
];

/** Note Rush: as many right answers as possible in 60 seconds. */
export default function RushScreen() {
  const { progress, recordRush } = useProgress();
  const mic = useMicState();
  const [mode, setMode] = useState<Mode>('tap');
  const [rangeIdx, setRangeIdx] = useState(0);
  const [phase, setPhase] = useState<'setup' | 'play' | 'done'>('setup');
  const [q, setQ] = useState<Question | null>(null);
  const qRef = useRef<Question | null>(null);
  const [score, setScore] = useState(0);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [shake, setShake] = useState(0);
  const [pop, setPop] = useState(0);
  const [best, setBest] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const qStart = useRef(0);
  const ended = useRef(false);
  const stats = useRef({ score: 0, points: 0, streak: 0 });

  const micOn = mode === 'play' && progress.settings.guitarMode && mic.status === 'on';
  const level: Level = {
    id: 0,
    world: 2,
    title: 'Note Rush',
    drill: mode === 'tap' ? 'nameFret' : 'playNote',
    description: '',
    questions: 999,
    pass: { kind: 'accuracy', min: 0 },
    range: { strings: RANGES[rangeIdx].strings, minFret: 0, maxFret: 12 },
    usesMic: mode === 'play',
  };

  const nextQ = () => {
    const nq = makeQuestion({ level, index: 0, rng: Math.random, prev: qRef.current ?? undefined, seq: {}, stringStyle: progress.settings.stringStyle });
    qRef.current = nq;
    setQ(nq);
    setHeard(null);
    qStart.current = now();
    MicService.resetNote();
    setDebug({ levelId: 'rush', question: nq, micOn });
  };

  const start = async () => {
    await resumeAudio().catch(() => {});
    if (mode === 'play' && progress.settings.guitarMode) await MicService.start();
    stats.current = { score: 0, points: 0, streak: 0 };
    setScore(0);
    setPoints(0);
    setStreak(0);
    setLeft(DURATION);
    ended.current = false;
    setPhase('play');
    nextQ();
  };

  useEffect(() => {
    if (phase !== 'play') return;
    const t0 = now();
    const iv = setInterval(() => {
      const l = Math.max(0, DURATION - (now() - t0));
      setLeft(l);
      if (l <= 0 && !ended.current) {
        ended.current = true;
        clearInterval(iv);
        setBest(recordRush(mode, stats.current.score, stats.current.points));
        setDebug({ question: null });
        setPhase('done');
        buzz('win');
      }
    }, 200);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const answer = (ok: boolean) => {
    if (ended.current) return;
    const s = stats.current;
    if (ok) {
      s.score++;
      s.streak++;
      s.points += 10 * multiplierFor(s.streak);
      setPop((k) => k + 1);
      buzz('good');
    } else {
      s.streak = 0;
      setShake((k) => k + 1);
      buzz('bad');
    }
    setScore(s.score);
    setPoints(s.points);
    setStreak(s.streak);
    nextQ();
  };

  useMicNotes((n) => {
    if (!micOn || phase !== 'play' || !qRef.current) return;
    if (n.onsetTime < qStart.current - 0.02) return;
    setHeard(noteLabel(n.midi));
    const ok = checkMidi(qRef.current, n.midi, false);
    if (!ok && !n.attack) return;
    answer(ok);
  });

  return (
    <Screen>
      {phase === 'setup' && (
        <Card style={{ gap: 12 }}>
          <Text style={ui.h1}>⚡ Note Rush</Text>
          <Text style={ui.body}>60 seconds. As many right answers as you can. A miss only resets your combo.</Text>
          <Text style={s.label}>Mode</Text>
          <View style={s.row}>
            <Button small kind={mode === 'tap' ? 'primary' : 'secondary'} title="Name it (tap)" onPress={() => setMode('tap')} testID="mode-tap" />
            <Button small kind={mode === 'play' ? 'primary' : 'secondary'} title="🎸 Play it" onPress={() => setMode('play')} testID="mode-play" />
          </View>
          <Text style={s.label}>Range</Text>
          <View style={s.row}>
            {RANGES.map((r, i) => (
              <Button key={r.label} small kind={rangeIdx === i ? 'primary' : 'secondary'} title={r.label} onPress={() => setRangeIdx(i)} />
            ))}
          </View>
          <Text style={ui.small}>
            Best: {progress.rushBest.tap} named · {progress.rushBest.play} played
          </Text>
          {mode === 'play' && progress.settings.guitarMode ? <MicPanel /> : null}
          <Button title="Go!" onPress={start} testID="start" />
        </Card>
      )}
      {phase === 'play' && q && (
        <View style={{ gap: 14 }}>
          <View style={s.hud}>
            <Text style={s.time} testID="time-left">
              {Math.ceil(left)}s
            </Text>
            <View style={{ flex: 1 }}>
              <ProgressBar value={left / DURATION} color={left < 10 ? C.bad : C.accent} />
            </View>
            <Text style={[s.combo, streak >= 3 && { color: C.accent2 }]}>x{multiplierFor(streak)}</Text>
            <Text style={s.score} testID="rush-score">
              {score}
            </Text>
          </View>
          <Juicy shakeKey={shake} popKey={pop}>
            <Text style={s.prompt} testID="prompt">
              {q.prompt}
            </Text>
          </Juicy>
          <Fretboard
            highlightFret={q.highlightFret}
            onTap={q.input === 'mic' && !micOn ? (st, f) => answer(checkMidi(q, midiAt(st, f), false)) : undefined}
            tapString={q.string}
          />
          {q.input === 'pad' && q.padOptions ? <AnswerPad options={q.padOptions} onAnswer={(v) => answer(checkPad(q, v))} /> : null}
          {micOn ? <Text style={s.small}>🎸 {heard ? `heard ${heard}` : 'listening…'}</Text> : null}
        </View>
      )}
      {phase === 'done' && (
        <View>
          <Card style={{ gap: 12, alignItems: 'center' }}>
            <Text style={ui.h1} testID="rush-result">
              {score} correct
            </Text>
            <Text style={s.small}>+{points} XP</Text>
            {best ? <Text style={{ color: C.accent2, fontWeight: '800' }}>New personal best!</Text> : null}
            <View style={s.row}>
              <Button title="Again" onPress={start} />
              <Button title="Change mode" kind="secondary" onPress={() => setPhase('setup')} />
            </View>
          </Card>
          {best && score > 0 ? <Confetti /> : null}
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  label: { color: C.dim, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  hud: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  time: { color: C.text, fontWeight: '800', fontSize: 18, minWidth: 40, fontVariant: ['tabular-nums'] },
  combo: { color: C.faint, fontWeight: '800', fontSize: 16 },
  score: { color: C.star, fontWeight: '900', fontSize: 22, minWidth: 36, textAlign: 'right' },
  prompt: { color: C.text, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  small: { color: C.faint, fontSize: 13, textAlign: 'center' },
});
