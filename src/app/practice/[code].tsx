import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { resumeAudio } from '../../audio/context';
import { buzz } from '../../audio/haptics';
import { MicPanel } from '../../components/MicPanel';
import { setDebug } from '../../components/QuizPlayer';
import { Screen } from '../../components/Screen';
import { Button, Card, Confetti, ProgressBar, Stars, styles as ui } from '../../components/ui';
import { noteLabel } from '../../music/notes';
import { MicService, useMicNotes, useMicState } from '../../pitch/MicService';
import { ReelView, type Feedback } from '../../practice/ReelView';
import { multiplier, onHeard, result, startPractice, type PracticeState } from '../../practice/session';
import { buildExercise, configFromCode, practiceHref, positionCount, type Exercise } from '../../practice/theory';
import { useProgress } from '../../store/progress';
import { C } from '../../theme/colors';

const HOLD_MS = 90;
const SLIDE_S = 0.16;
const FX_S = 0.45;

/** Live Practice: the exercise waits on each note until the mic hears it. */
export default function LivePracticeScreen() {
  const params = useLocalSearchParams<{ code: string; reps?: string; name?: string }>();
  const reps = Math.max(1, Math.min(8, Number(params.reps) || 1));
  const cfg = configFromCode(String(params.code ?? ''), params.name);
  const exercise = useMemo<Exercise | null>(() => {
    if (!cfg) return null;
    const ex = buildExercise(cfg);
    return { ...ex, notes: Array.from({ length: reps }, () => ex.notes).flat() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code, params.name, reps]);

  if (!exercise || !cfg) {
    return (
      <Screen>
        <Text style={ui.h2}>Unknown practice code</Text>
        <Text style={ui.body}>"{params.code}" does not match an exercise.</Text>
        <Button title="Choose an exercise" onPress={() => router.replace('/practice')} />
      </Screen>
    );
  }
  return <Live key={`${exercise.id}-${reps}`} exercise={exercise} reps={reps} />;
}

function Live({ exercise, reps }: { exercise: Exercise; reps: number }) {
  const { progress, recordPractice } = useProgress();
  const mic = useMicState();
  const targets = useMemo(() => exercise.notes.map((n) => n.midi), [exercise]);
  const [run, setRun] = useState(0);
  const [st, setSt] = useState<PracticeState>(() => startPractice(targets));
  const stRef = useRef(st);
  stRef.current = st;
  const [saved, setSaved] = useState<{ best: boolean } | null>(null);
  const forgive = progress.settings.forgiveOctave;

  // The mic starts right away: the exercise is live as soon as the screen opens.
  useEffect(() => {
    MicService.setHoldMs(HOLD_MS);
    resumeAudio().catch(() => {});
    MicService.start();
    return () => MicService.setHoldMs(150);
  }, []);

  useMicNotes((n) => {
    const next = onHeard(stRef.current, { midi: n.midi, time: n.onsetTime, attack: n.attack }, forgive);
    if (next === stRef.current) return;
    stRef.current = next;
    setSt(next);
    if (next.last?.kind === 'miss') buzz('bad');
  });

  // Animate the strips to the next note, and the hit or miss effect.
  const { cursor, feedback } = useAnimation(st);

  // Finished: save once.
  useEffect(() => {
    if (!st.done || saved) return;
    const r = result(st);
    const best = recordPractice(exercise.id, r.score, r.stars, Math.round(r.score / 20));
    setSaved({ best });
    buzz('win');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.done]);

  // For the end-to-end test bot: what to play now.
  const micOn = mic.status === 'on';
  const question = useMemo(() => (st.done ? null : { id: `${run}-${st.index}`, acceptMidis: [targets[st.index]] }), [run, st.index, st.done, targets]);
  useEffect(() => {
    setDebug({ question, micOn, practice: { index: st.index, score: st.score, hits: st.hits, misses: st.misses, done: st.done } });
  }, [question, micOn, st]);

  const restart = () => {
    MicService.resetNote();
    const s = startPractice(targets);
    stRef.current = s;
    setSt(s);
    setSaved(null);
    setRun((r) => r + 1);
  };

  const cfg = exercise.config;
  const total = targets.length;
  const missed = st.last?.kind === 'miss' && st.last.index === st.index ? st.last : null;
  const best = progress.practiceBest[exercise.id];

  if (st.done) {
    const r = result(st);
    const nPos = positionCount(cfg);
    const nextHref = practiceHref({ ...cfg, position: (cfg.position % nPos) + 1 }, reps);
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Live Practice' }} />
        <Card style={{ gap: 12, alignItems: 'center' }}>
          {r.stars === 3 ? <Confetti /> : null}
          <Text style={ui.h1} testID="practice-done">
            {r.stars === 3 ? 'Perfect run!' : 'Done!'}
          </Text>
          <Stars n={r.stars} size={40} />
          <Text style={s.bigScore} testID="practice-score">
            {r.score}
          </Text>
          {saved?.best ? <Text style={{ color: C.star, fontWeight: '800' }}>New best score!</Text> : null}
          <View style={s.stats}>
            <Stat label="Accuracy" value={`${Math.round(r.accuracy * 100)}%`} testID="practice-accuracy" />
            <Stat label="Best combo" value={String(r.bestCombo)} />
            <Stat label="Time" value={`${r.seconds.toFixed(1)} s`} />
            <Stat label="Speed" value={r.eighthsBpm ? `${r.eighthsBpm} BPM` : 'n/a'} />
          </View>
          <Text style={ui.small}>Speed = the tempo if the notes were eighth notes. The video plays at its own BPM.</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button title="Again" onPress={restart} testID="practice-again" />
            <Button title={`Next box (${(cfg.position % nPos) + 1})`} kind="secondary" onPress={() => router.replace(nextHref as any)} />
            <Button title="Change exercise" kind="secondary" onPress={() => router.replace('/practice')} />
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Live Practice' }} />
      <View style={s.hud}>
        <Hud label="SCORE" value={String(st.score)} testID="hud-score" />
        <Hud label="COMBO" value={`x${multiplier(st.combo)} · ${st.combo}`} color={st.combo >= 8 ? C.star : C.text} />
        <Hud label="NOTE" value={`${Math.min(st.index + 1, total)} / ${total}`} />
        <Hud label="BEST" value={best ? String(best.score) : '–'} />
      </View>
      <ProgressBar value={st.index / total} color={C.good} />
      <View style={s.reelCard}>
        <ReelView
          exercise={exercise}
          index={st.index}
          cursor={cursor}
          feedback={feedback}
          meta={reps > 1 ? `${exercise.subtitle} | ${reps}x` : exercise.subtitle}
        />
      </View>
      <Text style={[s.message, missed ? { color: C.bad } : null]} testID="practice-message">
        {missed
          ? `You played ${noteLabel(missed.midi)}. Play ${noteLabel(targets[st.index])}.`
          : st.index === 0
            ? `Play ${noteLabel(targets[0])} to start. No metronome: take your time.`
            : st.last?.kind === 'hit'
              ? `+${st.last.points}`
              : ' '}
      </Text>
      <MicPanel />
      {mic.status !== 'on' ? <Button title="Start the mic" onPress={() => MicService.start()} testID="practice-mic" /> : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button small kind="secondary" title="Restart" onPress={restart} />
        <Button small kind="secondary" title="Change exercise" onPress={() => router.replace('/practice')} />
      </View>
    </Screen>
  );
}

/** Slides `cursor` to the target index and ages the hit or miss effect, with requestAnimationFrame. */
function useAnimation(st: PracticeState): { cursor: number; feedback: Feedback | null } {
  const [, setTick] = useState(0);
  const anim = useRef({ from: st.index, to: st.index, start: 0 });
  const fx = useRef<{ kind: 'hit' | 'miss'; index: number; start: number } | null>(null);
  const now = () => (globalThis.performance?.now?.() ?? Date.now()) / 1000;

  // New target or new event: start the animations.
  const a = anim.current;
  if (a.to !== st.index) {
    const t = now();
    const cur = currentCursor(a, t);
    anim.current = { from: st.index < a.to ? st.index : cur, to: st.index, start: t };
  }
  const lastKey = st.last ? `${st.last.kind}${st.last.index}${st.last.time}` : '';
  const fxKey = useRef('');
  if (lastKey && lastKey !== fxKey.current) {
    fxKey.current = lastKey;
    fx.current = { kind: st.last!.kind, index: st.last!.index, start: now() };
  }

  const t = now();
  const cursor = currentCursor(anim.current, t);
  const f = fx.current;
  const age = f ? (t - f.start) / FX_S : 1;
  const feedback = f && age < 1 ? { kind: f.kind, index: f.index, age } : null;
  const busy = cursor !== anim.current.to || feedback !== null;

  useEffect(() => {
    if (!busy) return;
    const id = requestAnimationFrame(() => setTick((n) => n + 1));
    return () => cancelAnimationFrame(id);
  });
  return { cursor, feedback };
}

function currentCursor(a: { from: number; to: number; start: number }, t: number) {
  const k = Math.min(1, (t - a.start) / SLIDE_S);
  const e = 1 - Math.pow(1 - k, 3);
  return k >= 1 ? a.to : a.from + (a.to - a.from) * e;
}

function Hud({ label, value, color = C.text, testID }: { label: string; value: string; color?: string; testID?: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={s.hudLabel}>{label}</Text>
      <Text style={[s.hudValue, { color }]} testID={testID}>
        {value}
      </Text>
    </View>
  );
}

function Stat({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={{ alignItems: 'center', minWidth: 80 }}>
      <Text style={{ color: C.text, fontSize: 20, fontWeight: '800' }} testID={testID}>
        {value}
      </Text>
      <Text style={ui.small}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  hud: { flexDirection: 'row', justifyContent: 'space-between' },
  hudLabel: { color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  hudValue: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  reelCard: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#F5F5F0' },
  message: { color: C.dim, textAlign: 'center', fontSize: 16, fontWeight: '700', minHeight: 22 },
  bigScore: { color: C.accent2, fontSize: 44, fontWeight: '900' },
  stats: { flexDirection: 'row', gap: 16, flexWrap: 'wrap', justifyContent: 'center' },
});
