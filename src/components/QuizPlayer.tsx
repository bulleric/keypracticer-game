import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { now } from '../audio/clock';
import { say, stopSpeaking } from '../audio/speech';
import { buzz } from '../audio/haptics';
import { midiAt, noteLabel, STRING_NAMES, type StringNumber } from '../music/notes';
import { MicService, useMicFrame, useMicNotes } from '../pitch/MicService';
import { makeQuestion } from '../quiz/generate';
import {
  applyAnswer,
  applyTimeout,
  bossTimeLimit,
  checkMidi,
  checkPad,
  defaultTimeGoal,
  HINT_AFTER,
  newRound,
  summarize,
  markHintUsed,
  type RoundState,
  type RoundSummary,
} from '../quiz/round';
import type { BoardMark, Level, Question } from '../quiz/types';
import { useProgress } from '../store/progress';
import { C } from '../theme/colors';
import { AnswerPad } from './AnswerPad';
import { Fretboard } from './Fretboard';
import { TunerGauge } from './Tuner';
import { Hearts, Juicy, ProgressBar } from './ui';

type Feedback = { kind: 'good' | 'bad' | 'reveal'; text: string } | null;

export function setDebug(info: Record<string, unknown>) {
  (globalThis as any).__NT__ = { ...((globalThis as any).__NT__ ?? {}), ...info };
}

export function QuizPlayer({
  level,
  micOn,
  onDone,
}: {
  level: Level;
  /** Mic questions are answered by playing (true) or by tapping the board (false). */
  micOn: boolean;
  onDone: (s: RoundSummary) => void;
}) {
  const { progress } = useProgress();
  const settings = progress.settings;
  const timeGoal = defaultTimeGoal(level);
  const seq = useRef({});
  const [round, setRound] = useState<RoundState>(() => newRound(level));
  const roundRef = useRef(round);
  roundRef.current = round;
  const [q, setQ] = useState<Question>(() =>
    makeQuestion({ level, index: 0, rng: Math.random, seq: seq.current, stringStyle: settings.stringStyle }),
  );
  const qRef = useRef(q);
  qRef.current = q;
  const qStart = useRef(now());
  const locked = useRef(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [badPads, setBadPads] = useState<string[]>([]);
  const [goodPad, setGoodPad] = useState<string | null>(null);
  const [marks, setMarks] = useState<BoardMark[]>([]);
  const [hint, setHint] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [popKey, setPopKey] = useState(0);
  const [combo, setCombo] = useState(1);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const frame = useMicFrame();
  const forgiveOctave = settings.forgiveOctave && level.world <= 2;

  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  };
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      stopSpeaking();
    },
    [],
  );

  const startQuestion = useCallback(
    (question: Question) => {
      setQ(question);
      qRef.current = question;
      qStart.current = now();
      locked.current = false;
      setFeedback(null);
      setBadPads([]);
      setGoodPad(null);
      setMarks([]);
      setHint(false);
      setHeard(null);
      MicService.resetNote();
      if ((level.voice || question.tuner) && question.speak) say(question.speak);
      else if (level.voice) say(question.prompt);
      setDebug({ levelId: level.id, question, micOn, startedAt: qStart.current });
    },
    [level, micOn],
  );

  // First question
  useEffect(() => {
    startQuestion(qRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishOrNext = useCallback(
    (st: RoundState) => {
      if (st.finished) {
        setDebug({ question: null });
        onDone(summarize(level, st));
        return;
      }
      startQuestion(
        makeQuestion({ level, index: st.index, rng: Math.random, prev: qRef.current, seq: seq.current, stringStyle: settings.stringStyle }),
      );
    },
    [level, onDone, settings.stringStyle, startQuestion],
  );

  const revealMarks = (question: Question): BoardMark[] => {
    if (!question.acceptMidis || !question.string) return [];
    const s = question.string;
    const out: BoardMark[] = [];
    for (let f = 0; f <= 12; f++)
      if (question.acceptMidis.includes(midiAt(s, f))) out.push({ string: s, fret: f, label: question.target, tone: 'good' });
    return out;
  };

  const answer = useCallback(
    (correct: boolean, detail: { pad?: string; mark?: BoardMark; heard?: string } = {}) => {
      if (locked.current) return;
      const question = qRef.current;
      const secs = now() - qStart.current;
      const res = applyAnswer(roundRef.current, correct, secs, {
        timeGoal,
        countMistake: !level.forgiving,
      });
      let st = res.state;
      if (res.outcome === 'retry' && st.triesOnCurrent >= HINT_AFTER && !hint && (question.hint || question.hintMark)) {
        st = markHintUsed(st);
        setHint(true);
      }
      setRound(st);
      roundRef.current = st;
      setCombo(res.outcome === 'correct' ? res.multiplier : 1);
      if (res.outcome === 'correct') {
        locked.current = true;
        buzz('good');
        setPopKey((k) => k + 1);
        if (detail.pad) setGoodPad(detail.pad);
        setMarks(detail.mark ? [{ ...detail.mark, tone: 'good' }] : revealMarks(question));
        setFeedback({ kind: 'good', text: `${question.reveal ?? 'Correct'}  +${res.gained}` });
        later(() => finishOrNext(st), question.tuner ? 900 : 650);
      } else if (res.outcome === 'retry') {
        if (level.forgiving) return;
        buzz('bad');
        setShakeKey((k) => k + 1);
        if (detail.pad) setBadPads((b) => [...b, detail.pad!]);
        if (detail.mark) setMarks([{ ...detail.mark, tone: 'bad' }]);
        setFeedback({ kind: 'bad', text: detail.heard ? `That was ${detail.heard}. Try again.` : 'Not quite. Try again.' });
      } else {
        locked.current = true;
        buzz('bad');
        setShakeKey((k) => k + 1);
        if (question.correctPad) setGoodPad(question.correctPad);
        setMarks(revealMarks(question));
        setFeedback({ kind: 'reveal', text: question.reveal ?? 'Here is the answer' });
        later(() => finishOrNext(st), st.failed ? 1200 : 1600);
      }
    },
    [finishOrNext, hint, level.forgiving, timeGoal],
  );

  // Boss levels: a clock per question that speeds up.
  useEffect(() => {
    if (!level.boss) return;
    const limit = bossTimeLimit(round.index, round.total);
    const started = qStart.current;
    const iv = setInterval(() => {
      if (locked.current) return;
      const left = limit - (now() - started);
      setTimeLeft(Math.max(0, left));
      if (left <= 0) {
        locked.current = true;
        const st = applyTimeout(roundRef.current, limit);
        setRound(st);
        roundRef.current = st;
        setCombo(1);
        buzz('bad');
        setShakeKey((k) => k + 1);
        setMarks(revealMarks(qRef.current));
        if (qRef.current.correctPad) setGoodPad(qRef.current.correctPad);
        setFeedback({ kind: 'reveal', text: `Time! ${qRef.current.reveal ?? ''}` });
        later(() => finishOrNext(st), 1400);
      }
    }, 100);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.id, level.boss]);

  const listensToMic = micOn && !!q.acceptMidis && (q.input === 'mic' || q.input === 'pad');

  useMicNotes((n) => {
    if (!listensToMic || locked.current) return;
    if (n.onsetTime < qStart.current - 0.02 && n.confirmTime - qStart.current < 0.3) return; // still ringing from before
    const question = qRef.current;
    const label = noteLabel(n.midi);
    setHeard(label);
    const ok = checkMidi(question, n.midi, forgiveOctave);
    if (!ok && !n.attack) return; // a ringing note drifting, not a new pluck
    answer(ok, { heard: label });
  });

  const onTap = (s: StringNumber, f: number) => {
    if (locked.current) return;
    const ok = checkMidi(q, midiAt(s, f), false);
    answer(ok, { mark: { string: s, fret: f, label: undefined } });
  };

  const boardTappable = q.input === 'board' || (q.input === 'mic' && !micOn);
  const hintMarks: BoardMark[] = hint && q.hintMark ? [q.hintMark] : [];
  const boardMarks = [...hintMarks, ...marks];
  const showBoard = !!(q.highlightString || q.highlightFret || q.string || q.hintMark);

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.hud}>
        <Text style={styles.counter} testID="counter">
          {Math.min(round.index + 1, round.total)}/{round.total}
        </Text>
        <View style={{ flex: 1 }}>
          <ProgressBar value={round.index / round.total} />
        </View>
        {round.hearts !== null ? <Hearts n={round.hearts} /> : null}
        <Text style={[styles.combo, combo > 1 && { color: C.accent2 }]} testID="combo">
          x{combo}
        </Text>
        <Text style={styles.points} testID="points">
          {round.points}
        </Text>
      </View>
      {timeLeft !== null && level.boss ? (
        <ProgressBar value={timeLeft / bossTimeLimit(round.index, round.total)} color={timeLeft < 2 ? C.bad : C.hint} height={4} />
      ) : null}

      <Juicy shakeKey={shakeKey} popKey={popKey}>
        <View style={styles.promptBox}>
          <Text style={styles.prompt} testID="prompt">
            {q.prompt}
          </Text>
          {q.sub ? <Text style={styles.sub}>{q.sub}</Text> : null}
          {q.input === 'mic' && !micOn ? <Text style={styles.sub}>Tap the fret on the board</Text> : null}
        </View>
      </Juicy>

      {q.tuner && micOn ? <TunerGauge frame={frame} compact /> : null}

      {showBoard ? (
        <Fretboard
          highlightString={q.highlightString}
          highlightFret={q.highlightFret}
          marks={boardMarks}
          onTap={boardTappable ? onTap : undefined}
          tapString={q.string}
        />
      ) : null}

      <View style={{ minHeight: 44, alignItems: 'center' }}>
        {feedback ? (
          <Text
            testID="feedback"
            style={[
              styles.feedback,
              { color: feedback.kind === 'good' ? C.good : feedback.kind === 'bad' ? C.bad : C.accent2 },
            ]}
          >
            {feedback.text}
          </Text>
        ) : listensToMic ? (
          <Text style={styles.listening} testID="listening">
            🎸 Listening{heard ? ` · heard ${heard}` : '…'}
          </Text>
        ) : null}
        {hint && q.hint ? (
          <Text style={styles.hint} testID="hint">
            Hint: {q.hint}
          </Text>
        ) : null}
      </View>

      {q.input === 'pad' && q.padOptions ? (
        <AnswerPad
          options={q.padOptions}
          good={goodPad}
          bad={badPads}
          onAnswer={(v) => answer(checkPad(q, v), { pad: v })}
        />
      ) : null}
      {q.input === 'pad' && listensToMic ? (
        <Text style={styles.small}>Guitar mode: you can also play the lit fret.</Text>
      ) : null}
      {q.string && q.input !== 'pad' ? (
        <Text style={styles.small}>
          String {q.string} ({STRING_NAMES[q.string]})
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hud: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  counter: { color: C.dim, fontVariant: ['tabular-nums'], fontWeight: '700' },
  combo: { color: C.faint, fontWeight: '800', fontSize: 16, minWidth: 30, textAlign: 'right' },
  points: { color: C.text, fontWeight: '800', fontSize: 16, minWidth: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },
  promptBox: { alignItems: 'center', paddingVertical: 8 },
  prompt: { color: C.text, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  sub: { color: C.dim, fontSize: 15, marginTop: 4, textAlign: 'center' },
  feedback: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  listening: { color: C.dim, fontSize: 15 },
  hint: { color: C.hint, fontSize: 15, marginTop: 6, textAlign: 'center' },
  small: { color: C.faint, fontSize: 13, textAlign: 'center' },
});
