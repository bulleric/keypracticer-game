import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { now } from '../audio/clock';
import { buzz } from '../audio/haptics';
import { Metronome, judgeTiming, type Beat } from '../audio/metronome';
import { say, stopSpeaking } from '../audio/speech';
import { midiAt, noteLabel, STRING_NAMES, type StringNumber } from '../music/notes';
import { useMicNotes } from '../pitch/MicService';
import { beatSequenceTargets, makeQuestion } from '../quiz/generate';
import { BOSS_HEARTS, checkMidi, multiplierFor, newRound, summarize, type RoundSummary } from '../quiz/round';
import type { BoardMark, Level, Question } from '../quiz/types';
import { useProgress } from '../store/progress';
import { C } from '../theme/colors';
import { Fretboard } from './Fretboard';
import { setDebug } from './QuizPlayer';
import { Hearts, ProgressBar } from './ui';

const COUNT_IN = 4;
/** Played-note window around a beat that counts as "on time". */
const ON_TIME = 0.12;

interface Prompt {
  q: Question;
  beat: number;
  time: number;
  end: number;
  hit: boolean;
  wrong: number;
  closed: boolean;
}

interface Target {
  label: string;
  string: StringNumber;
  midis: number[];
  beat: number;
  result: null | 'hit' | 'miss';
  offset?: number;
}

/**
 * Levels played against a metronome: "Play on the beat" (34), timed Fret Play
 * prompts (35, 36, 39, 40) and one-note-per-beat sequences (37, 38).
 */
export function RhythmPlayer({
  level,
  micOn,
  onDone,
}: {
  level: Level;
  micOn: boolean;
  onDone: (s: RoundSummary) => void;
}) {
  const { progress } = useProgress();
  const settings = progress.settings;
  const latency = settings.latencyMs / 1000;
  const metro = useRef(new Metronome(level.bpm ?? 60)).current;
  const beats = useRef<Beat[]>([]);
  const [beatNo, setBeatNo] = useState(-1);
  const [bpm, setBpm] = useState(level.bpm ?? 60);
  const [message, setMessage] = useState<{ text: string; color: string } | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const flash = useRef(new Animated.Value(0)).current;
  const done = useRef(false);

  // Shared tallies, turned into a round summary at the end.
  const tally = useRef({ correct: 0, total: 0, mistakes: 0, streak: 0, bestStreak: 0, points: 0, times: [] as number[], hearts: level.boss ? BOSS_HEARTS : null as number | null });
  const [, force] = useState(0);
  const rerender = () => force((x) => x + 1);

  // Level-specific state
  const prompts = useRef<Prompt[]>([]);
  const [current, setCurrent] = useState<Prompt | null>(null);
  const roundStats = useRef({ inRound: 0, clean: true });
  const reachedBpm = useRef(level.bpm ?? 60);
  const onBeatTargets = useRef<{ beat: number; time: number; result: null | 'hit' | 'miss' }[]>([]);
  const onBeatStreak = useRef(0);
  const bestOnBeat = useRef(0);
  const [seqTargets, setSeqTargets] = useState<Target[]>(() =>
    level.drill === 'beatSequence'
      ? beatSequenceTargets(level, Math.random).map((t, i) => ({ ...t, beat: COUNT_IN + i, result: null }))
      : [],
  );
  const seqRef = useRef(seqTargets);
  seqRef.current = seqTargets;
  const prevQ = useRef<Question | undefined>(undefined);
  const playLevel: Level = { ...level, drill: 'playNote' };

  const spb = () => 60 / metro.bpm;
  const beatTime = (k: number): number => {
    const b = beats.current.find((x) => x.index === k);
    if (b) return b.time;
    const last = beats.current[beats.current.length - 1];
    if (!last) return Infinity;
    return last.time + (k - last.index) * spb();
  };

  const finish = (passedOverride?: boolean) => {
    if (done.current) return;
    done.current = true;
    metro.stop();
    stopSpeaking();
    const t = tally.current;
    const st = {
      ...newRound(level),
      index: t.total,
      total: Math.max(1, t.total),
      correct: t.correct,
      mistakes: t.mistakes,
      bestStreak: t.bestStreak,
      points: t.points,
      times: t.times,
      hearts: t.hearts,
      finished: true,
      failed: passedOverride === false,
    };
    setDebug({ question: null, rhythm: null });
    setTimeout(
      () => onDone(summarize(level, st, { reachedBpm: reachedBpm.current, bestOnBeatStreak: bestOnBeat.current })),
      700,
    );
  };

  const score = (ok: boolean, reaction: number) => {
    const t = tally.current;
    t.total++;
    if (ok) {
      t.correct++;
      t.streak++;
      t.bestStreak = Math.max(t.bestStreak, t.streak);
      t.points += 10 * multiplierFor(t.streak);
      t.times.push(reaction);
      buzz('good');
    } else {
      t.streak = 0;
      t.mistakes++;
      buzz('bad');
      if (t.hearts !== null) {
        t.hearts--;
        if (t.hearts <= 0) finish(false);
      }
    }
    rerender();
  };

  // ---- fretPlay: prompts every N beats --------------------------------------------------
  const closePrompt = (p: Prompt) => {
    if (p.closed) return;
    p.closed = true;
    if (!p.hit) {
      score(false, 0);
      setMessage({ text: `Missed: ${p.q.reveal ?? ''}`, color: C.bad });
      roundStats.current.clean = false;
    }
    if (level.rampBpm && level.roundLength) {
      roundStats.current.inRound++;
      if (roundStats.current.inRound >= level.roundLength) {
        const clean = roundStats.current.clean;
        roundStats.current = { inRound: 0, clean: true };
        if (clean) {
          metro.bpm += level.rampBpm;
          reachedBpm.current = metro.bpm;
          setBpm(metro.bpm);
          setMessage({ text: `Clean round! Tempo up: ${metro.bpm} BPM`, color: C.accent2 });
          if (level.pass.kind === 'reachBpm' && metro.bpm >= level.pass.bpm) finish(true);
        } else {
          setMessage({ text: `Round not clean. Stay at ${metro.bpm} BPM`, color: C.dim });
        }
      }
    }
  };

  const onFretPlayBeat = (b: Beat) => {
    const bpp = level.beatsPerPrompt ?? 2;
    if (b.index < COUNT_IN || (b.index - COUNT_IN) % bpp !== 0) return;
    const j = (b.index - COUNT_IN) / bpp;
    // Close the previous prompt a moment later, so a note played right on the line still counts.
    const prev = prompts.current[prompts.current.length - 1];
    if (prev) setTimeout(() => !done.current && closePrompt(prev), 300);
    if (j >= level.questions) {
      setTimeout(() => finish(), 400);
      return;
    }
    const q = makeQuestion({ level: playLevel, index: j, rng: Math.random, prev: prevQ.current, seq: {}, stringStyle: level.stringStyle ?? settings.stringStyle });
    prevQ.current = q;
    const p: Prompt = { q, beat: b.index, time: b.time, end: b.time + bpp * spb(), hit: false, wrong: 0, closed: false };
    prompts.current.push(p);
    setCurrent(p);
    setHeard(null);
    if (q.speak) say(q.speak, 1.15);
    setDebug({ levelId: level.id, question: q, micOn, rhythm: { promptTime: p.time, end: p.end } });
  };

  // ---- onBeat: open low E on every click ------------------------------------------------
  const onOnBeatBeat = (b: Beat) => {
    if (b.index < COUNT_IN) return;
    // Judge the target from two beats ago if it was never played.
    for (const t of onBeatTargets.current) {
      if (t.result === null && b.time - t.time > spb() * 0.6) {
        t.result = 'miss';
        onBeatStreak.current = 0;
        score(false, 0);
        setMessage({ text: 'Missed a beat', color: C.bad });
      }
    }
    if (b.index - COUNT_IN >= level.questions) {
      finish();
      return;
    }
    onBeatTargets.current.push({ beat: b.index, time: b.time, result: null });
    setDebug({ levelId: level.id, question: { acceptMidis: [40], prompt: 'beat' }, micOn, rhythm: { beatTime: b.time, spb: spb() } });
  };

  // ---- beatSequence: one note per beat --------------------------------------------------
  const onSeqBeat = (b: Beat) => {
    const targets = seqRef.current;
    let changed = false;
    const next = targets.map((t) => {
      if (t.result === null && b.time - beatTime(t.beat) > spb() * 0.6) {
        changed = true;
        score(false, 0);
        return { ...t, result: 'miss' as const };
      }
      return t;
    });
    if (changed) {
      setSeqTargets(next);
      seqRef.current = next;
    }
    const idx = b.index - COUNT_IN;
    if (idx >= 0 && idx < targets.length) {
      const t = targets[idx];
      setDebug({ levelId: level.id, question: { acceptMidis: t.midis, string: t.string, prompt: t.label }, micOn, rhythm: { beatTime: b.time, spb: spb() } });
    }
    if (idx >= targets.length + 1) finish();
  };

  useEffect(() => {
    const off = metro.onBeat((b) => {
      if (done.current) return;
      beats.current.push(b);
      if (beats.current.length > 64) beats.current.shift();
      setBeatNo(b.index);
      flash.setValue(1);
      Animated.timing(flash, { toValue: 0, duration: 250, useNativeDriver: true }).start();
      if (level.drill === 'fretPlay') onFretPlayBeat(b);
      else if (level.drill === 'onBeat') onOnBeatBeat(b);
      else onSeqBeat(b);
    });
    if (level.drill === 'beatSequence') {
      const t = seqRef.current;
      say(level.sequence === 'alphabet' ? `${t.map((x) => x.label).join(' ')}, on the A string` : `${t[0].label.split(' ')[0]}, on every string`);
    }
    metro.start(level.drill === 'beatSequence' ? 2.2 : 0.6);
    return () => {
      off();
      metro.stop();
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A played (or tapped) note at time `time`. */
  const onPlayed = (midi: number, time: number, attack: boolean) => {
    if (done.current) return;
    setHeard(noteLabel(midi));
    if (level.drill === 'fretPlay') {
      const p = [...prompts.current].reverse().find((x) => !x.closed && time >= x.time - 0.15 && time <= x.end + 0.1);
      if (!p || p.hit) return;
      if (checkMidi(p.q, midi, false)) {
        p.hit = true;
        score(true, Math.max(0, time - p.time));
        setMessage({ text: `${p.q.target} ✓  ${(time - p.time).toFixed(1)} s`, color: C.good });
      } else if (attack) {
        p.wrong++;
        tally.current.mistakes++;
        roundStats.current.clean = false;
        setMessage({ text: `That was ${noteLabel(midi)}`, color: C.bad });
        rerender();
      }
      return;
    }
    if (level.drill === 'onBeat') {
      if (!attack) return;
      const ok = checkMidi({ id: 'e', prompt: '', input: 'mic', acceptMidis: [40] }, midi, settings.forgiveOctave);
      if (!ok) {
        setMessage({ text: `Play the open low E (heard ${noteLabel(midi)})`, color: C.bad });
        return;
      }
      // Nearest beat: a registered target, or the next beat if we're early.
      const cands = [...onBeatTargets.current.filter((t) => t.result === null)];
      const last = beats.current[beats.current.length - 1];
      if (last && last.index + 1 - COUNT_IN < level.questions && last.index + 1 >= COUNT_IN)
        cands.push({ beat: last.index + 1, time: last.time + spb(), result: null });
      let best: (typeof cands)[number] | null = null;
      for (const c of cands) if (!best || Math.abs(time - c.time) < Math.abs(time - best.time)) best = c;
      if (!best || Math.abs(time - best.time) > spb() / 2) return;
      const offset = time - best.time;
      const judged = judgeTiming(offset, ON_TIME);
      let target = onBeatTargets.current.find((t) => t.beat === best!.beat);
      if (!target) {
        target = { ...best };
        onBeatTargets.current.push(target);
      }
      const ms = Math.round(offset * 1000);
      if (judged === 'on time') {
        target.result = 'hit';
        onBeatStreak.current++;
        bestOnBeat.current = Math.max(bestOnBeat.current, onBeatStreak.current);
        score(true, Math.abs(offset));
        setMessage({ text: `On time (${ms > 0 ? '+' : ''}${ms} ms) · ${onBeatStreak.current} in a row`, color: C.good });
        const rule = level.pass;
        if (rule.kind === 'streak' && onBeatStreak.current >= rule.count) finish(true);
      } else {
        target.result = 'miss';
        onBeatStreak.current = 0;
        score(false, 0);
        setMessage({ text: `${judged === 'early' ? 'Early' : 'Late'} (${ms > 0 ? '+' : ''}${ms} ms)`, color: C.accent2 });
      }
      return;
    }
    // beatSequence
    const targets = seqRef.current;
    let bestI = -1;
    let bestD = Infinity;
    targets.forEach((t, i) => {
      const d = Math.abs(time - beatTime(t.beat));
      if (t.result === null && d < bestD) {
        bestD = d;
        bestI = i;
      }
    });
    if (bestI < 0 || bestD > spb() * 0.55) return;
    if (!attack && !targets[bestI].midis.includes(midi)) return;
    const t = targets[bestI];
    const offset = time - beatTime(t.beat);
    const ok = t.midis.includes(midi);
    const next = targets.map((x, i) => (i === bestI ? { ...x, result: ok ? ('hit' as const) : ('miss' as const), offset } : x));
    setSeqTargets(next);
    seqRef.current = next;
    score(ok, Math.abs(offset));
    const ms = Math.round(offset * 1000);
    setMessage(
      ok
        ? { text: `${t.label} ✓ ${judgeTiming(offset, ON_TIME)} (${ms > 0 ? '+' : ''}${ms} ms)`, color: C.good }
        : { text: `Heard ${noteLabel(midi)}, wanted ${t.label}`, color: C.bad },
    );
  };

  useMicNotes((n) => {
    if (!micOn) return;
    onPlayed(n.midi, n.onsetTime - latency, n.attack);
  });

  const onTap = (s: StringNumber, f: number) => onPlayed(midiAt(s, f), now(), true);

  // ---- view -----------------------------------------------------------------------------
  const counting = beatNo < COUNT_IN;
  const t = tally.current;
  let big = '';
  let sub = '';
  let tapString: StringNumber | undefined;
  let marks: BoardMark[] = [];
  if (counting) {
    big = beatNo < 0 ? 'Get ready' : String(COUNT_IN - beatNo);
    sub = level.drill === 'onBeat' ? 'Play open low E on every click' : 'Count-in';
  } else if (level.drill === 'fretPlay' && current) {
    big = current.q.prompt;
    sub = current.q.sub ?? '';
    tapString = current.q.string;
  } else if (level.drill === 'onBeat') {
    big = `${onBeatStreak.current} / ${(level.pass as any).count ?? 8}`;
    sub = 'in a row on time · open low E';
    tapString = 6;
  } else if (level.drill === 'beatSequence') {
    const idx = Math.min(seqTargets.length - 1, Math.max(0, beatNo - COUNT_IN));
    const cur = seqTargets[idx];
    big = cur?.label ?? '';
    sub = `${STRING_NAMES[cur?.string ?? 6]} string`;
    tapString = level.sequence === 'alphabet' ? cur?.string : undefined;
    marks = [];
  }

  const progressValue =
    level.drill === 'fretPlay'
      ? prompts.current.length / level.questions
      : level.drill === 'onBeat'
        ? Math.max(0, beatNo - COUNT_IN) / level.questions
        : seqTargets.filter((x) => x.result).length / Math.max(1, seqTargets.length);

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.hud}>
        <Text style={styles.bpm} testID="bpm">
          {bpm} BPM
        </Text>
        <View style={{ flex: 1 }}>
          <ProgressBar value={progressValue} />
        </View>
        {t.hearts !== null ? <Hearts n={t.hearts} /> : null}
        <Text style={[styles.combo, t.streak >= 3 && { color: C.accent2 }]}>x{multiplierFor(t.streak)}</Text>
        <Text style={styles.points} testID="points">
          {t.points}
        </Text>
      </View>

      <View style={styles.beatRow}>
        {[0, 1, 2, 3].map((i) => {
          const active = beatNo >= 0 && beatNo % 4 === i;
          return (
            <Animated.View
              key={i}
              style={[
                styles.beatDot,
                active && { backgroundColor: i === 0 ? C.accent : C.accent2 },
                active && { transform: [{ scale: flash.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }] },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.promptBox}>
        <Text style={[styles.prompt, counting && { color: C.accent2 }]} testID="prompt">
          {big}
        </Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>

      {level.drill === 'beatSequence' ? (
        <View style={styles.seqRow}>
          {seqTargets.map((x, i) => (
            <View
              key={i}
              style={[
                styles.seqChip,
                beatNo - COUNT_IN === i && { borderColor: C.accent },
                x.result === 'hit' && { backgroundColor: C.good },
                x.result === 'miss' && { backgroundColor: C.bad },
              ]}
            >
              <Text style={styles.seqText}>{level.sequence === 'alphabet' ? x.label : x.string}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ minHeight: 30, alignItems: 'center' }}>
        {message ? (
          <Text style={[styles.message, { color: message.color }]} testID="feedback">
            {message.text}
          </Text>
        ) : null}
        {micOn ? <Text style={styles.small}>🎸 {heard ? `heard ${heard}` : 'listening…'}</Text> : null}
      </View>

      <Fretboard marks={marks} onTap={micOn ? undefined : onTap} tapString={tapString} />
      {!micOn ? <Text style={styles.small}>Tap mode: tap the fret on the beat.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hud: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bpm: { color: C.accent2, fontWeight: '800', fontVariant: ['tabular-nums'] },
  combo: { color: C.faint, fontWeight: '800', fontSize: 16, minWidth: 30, textAlign: 'right' },
  points: { color: C.text, fontWeight: '800', fontSize: 16, minWidth: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },
  beatRow: { flexDirection: 'row', justifyContent: 'center', gap: 18, paddingVertical: 6 },
  beatDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.border },
  promptBox: { alignItems: 'center', minHeight: 80, justifyContent: 'center' },
  prompt: { color: C.text, fontSize: 34, fontWeight: '800', textAlign: 'center' },
  sub: { color: C.dim, fontSize: 15, marginTop: 4, textAlign: 'center' },
  message: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  small: { color: C.faint, fontSize: 13, textAlign: 'center', marginTop: 4 },
  seqRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  seqChip: { minWidth: 38, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: C.panel2, borderWidth: 2, borderColor: C.border, alignItems: 'center' },
  seqText: { color: C.text, fontWeight: '800', fontSize: 16 },
});
