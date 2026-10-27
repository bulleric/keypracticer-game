import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { now } from '../audio/clock';
import { resumeAudio } from '../audio/context';
import { buzz } from '../audio/haptics';
import { Metronome } from '../audio/metronome';
import { busyUntil, playNote, playNotes, stopNotes } from '../audio/notePlayer';
import { CmdButton } from '../components/CmdButton';
import { MicPanel } from '../components/MicPanel';
import { setDebug } from '../debug';
import { describeMiss, whereIs } from '../engine/coach';
import { FLOW } from '../engine/flow';
import { boxLowFret, fromSource } from '../engine/timeline';
import { useCommands } from '../engine/useCommands';
import { Button, Confetti, Juicy, ProgressBar, Stars } from '../components/ui';
import { playerLevel } from '../game/xp';
import { noteLabel } from '../music/notes';
import { MicService, useMicNotes, useMicState } from '../pitch/MicService';
import { todaySeconds } from '../store/model';
import { useProgress } from '../store/progress';
import { C } from '../theme/colors';
import {
  BADGES, getLevel, isLevelOpen, LEVELS, toExercise, totalPentaStars, WORLDS,
  type Badge, type Level, type PracticeMode, type RunSetup,
} from './game';
import { intervalColor } from './reel';
import { ReelView, type Feedback } from './ReelView';
import {
  back, GRADE, gradeCounts, metroHeard, metroResult, metroTick, multiplier, onHeard, result, skip,
  startMetro, startPractice, type Grade, type MetroState, type PracticeResult, type PracticeState,
} from './session';
import { TheoryPanel } from './TheoryPanel';
import { PATTERNS, ROOTS } from './theory';

const HOLD_MS = 90;
const SLIDE_S = 0.16;
const FX_S = 0.45;
const COUNT_IN = 4;
/** Play mode: show where the note is after this long without a right note. */
const HINT_AFTER_S = 6;
/** Play mode: pause after this long without any note. */
const PAUSE_AFTER_S = 10;

type View_ = 'listen' | 'run';
type Panel = 'none' | 'settings' | 'levels' | 'theory';

interface Done {
  result: PracticeResult;
  grades?: Record<Grade, number>;
  newBadges: Badge[];
  newBest: boolean;
  unlocked: number | null;
  xp: number;
}

/**
 * Live Practice as a game. Three views of one exercise: Listen (the app plays
 * it), Play (each note waits for you) and On the beat (metronome). The guitar
 * works as a remote whenever the app is not waiting for a scale note.
 */
export function PracticeGame({
  levelId: startId,
  setup: startSetup,
  initialView = 'run',
}: {
  levelId: number | null;
  setup: RunSetup;
  initialView?: View_;
}) {
  const { progress, recordPentaRun, setPentaCurrent, markRung, addPracticeTime } = useProgress();
  const insets = useSafeAreaInsets();
  const mic = useMicState();
  const [levelId, setLevelId] = useState<number | null>(startId);
  const [setup, setSetup] = useState<RunSetup>(startSetup);
  const [view, setView] = useState<View_>(initialView);
  const level = levelId ? getLevel(levelId) : undefined;
  const timeline = useMemo(() => fromSource({ kind: 'scale', setup }), [setup]);
  const exercise = timeline.exercise;
  const targets = useMemo(() => exercise.notes.map((n) => n.midi), [exercise]);
  const lowFret = useMemo(() => boxLowFret(timeline), [timeline]);
  const [panel, setPanel] = useState<Panel>('none');
  const [run, setRun] = useState(0);
  const forgive = progress.settings.forgiveOctave;
  const latency = progress.settings.latencyMs / 1000;

  // ---- detect mode
  const [det, setDet] = useState<PracticeState>(() => startPractice(targets));
  const detRef = useRef(det);
  detRef.current = det;
  // ---- metronome mode
  const [metro, setMetro] = useState<MetroState | null>(null);
  const metroRef = useRef<MetroState | null>(null);
  metroRef.current = metro;
  const metronome = useRef<Metronome | null>(null);
  const [countIn, setCountIn] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  // ---- listen and results
  const [demo, setDemo] = useState<{ start: number; step: number } | null>(null);
  const [listenBpm, setListenBpm] = useState(() => (startSetup.mode === 'metronome' ? startSetup.bpm : 70));
  const [loop, setLoop] = useState(false);
  const loopRef = useRef(loop);
  loopRef.current = loop;
  const [done, setDone] = useState<Done | null>(null);
  const [popup, setPopup] = useState<{ text: string; color: string; key: number } | null>(null);
  const [shake, setShake] = useState(0);
  const [pop, setPop] = useState(0);
  const [, setTick] = useState(0);
  // ---- coach
  const [coach, setCoach] = useState<{ text: string; key: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const lastHeard = useRef(now());
  const lastHit = useRef(now());
  const missesHere = useRef(0);
  const runStart = useRef<number | null>(null);

  const isMetro = setup.mode === 'metronome';
  const listening = view === 'listen';
  const step = 60 / setup.bpm / setup.perBeat;

  const flash = useCallback((text: string, color: string) => setPopup((p) => ({ text, color, key: (p?.key ?? 0) + 1 })), []);
  const say = useCallback((text: string) => setCoach((c) => ({ text, key: (c?.key ?? 0) + 1 })), []);
  // Pop-ups go away on their own.
  useEffect(() => {
    if (!popup) return;
    const t = setTimeout(() => setPopup((p) => (p?.key === popup.key ? null : p)), 800);
    return () => clearTimeout(t);
  }, [popup]);

  // ---- mic on from the start (unless the player said no), shorter confirm time for fast runs
  const micAllowed = progress.onboarding.mic !== 'denied';
  useEffect(() => {
    MicService.setHoldMs(HOLD_MS);
    resumeAudio().catch(() => {});
    if (micAllowed) MicService.start();
    return () => {
      MicService.setHoldMs(150);
      metronome.current?.stop();
      stopNotes();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (levelId) setPentaCurrent(levelId);
  }, [levelId, setPentaCurrent]);

  // ---- reset when the exercise or mode changes
  const reset = useCallback(() => {
    metronome.current?.stop();
    metronome.current = null;
    stopNotes();
    MicService.resetNote();
    const s = startPractice(targets);
    detRef.current = s;
    setDet(s);
    metroRef.current = null;
    setMetro(null);
    setCountIn(null);
    setPlaying(false);
    setDemo(null);
    setDone(null);
    setPopup(null);
    setCoach(null);
    setPaused(false);
    missesHere.current = 0;
    runStart.current = null;
    lastHeard.current = now();
    lastHit.current = now();
    setRun((r) => r + 1);
  }, [targets]);
  useEffect(() => {
    reset();
  }, [reset, setup.mode, setup.bpm, setup.perBeat, view]);

  // ---- finishing a run
  const finish = useCallback(
    (r: PracticeResult, perfectRun: number, grades?: Record<Grade, number>) => {
      metronome.current?.stop();
      setPlaying(false);
      const xp = Math.round(r.score / 20);
      const seconds = runStart.current ? now() - runStart.current : r.seconds;
      const out = recordPentaRun({ levelId, setup, score: r.score, stars: r.stars, accuracy: r.accuracy, bestCombo: r.bestCombo, perfectRun }, xp, seconds);
      setDone({ result: r, grades, xp, ...out });
      buzz(r.stars >= 1 ? 'win' : 'bad');
    },
    [levelId, setup, recordPentaRun],
  );

  // ---- mic notes
  useMicNotes((n) => {
    if (done || demo || listening || paused) return;
    if (n.onsetTime < busyUntil()) return; // our own speaker
    if (n.attack) lastHeard.current = now();
    if (!isMetro) {
      const prev = detRef.current;
      const next = onHeard(prev, { midi: n.midi, time: n.onsetTime, attack: n.attack }, forgive);
      if (next === prev) return;
      detRef.current = next;
      setDet(next);
      if (runStart.current === null) runStart.current = now();
      if (next.last?.kind === 'hit') {
        lastHit.current = now();
        missesHere.current = 0;
        setCoach(null);
        setPop((p) => p + 1);
        const m = multiplier(next.combo);
        if (m > multiplier(prev.combo)) flash(`COMBO x${m}!`, C.star);
        else flash(`+${next.last.points}`, C.good);
        if (next.done) finish(result(next), 0);
      } else {
        setShake((k) => k + 1);
        buzz('bad');
        flash(`WRONG: ${noteLabel(n.midi)}`, C.bad);
        missesHere.current += 1;
        const t = exercise.notes[prev.index];
        if (t) say(describeMiss(t, n.midi) + (missesHere.current >= 3 ? ' Tap Hear to listen to it.' : ''));
      }
      return;
    }
    const cur = metroRef.current;
    if (!cur || !playing) return;
    const next = metroHeard(cur, { midi: n.midi, time: n.onsetTime - latency, attack: n.attack }, forgive);
    if (next === cur) return;
    metroRef.current = next;
    setMetro(next);
    onGraded(cur, next);
  });

  const onGraded = (prev: MetroState, next: MetroState) => {
    const l = next.last;
    if (!l) return;
    const g = GRADE[l.grade];
    if (l.grade === 'wrong' || l.grade === 'miss') {
      if (l.grade === 'wrong') setShake((k) => k + 1);
      flash(l.grade === 'wrong' && l.midi ? `WRONG: ${noteLabel(l.midi)}` : g.label, C.bad);
    } else {
      setPop((p) => p + 1);
      const m = multiplier(next.combo);
      flash(m > multiplier(prev.combo) ? `COMBO x${m}!` : `${g.label} +${l.points}`, l.grade === 'perfect' ? C.star : C.good);
    }
    if (next.done) finish(metroResult(next), Math.max(next.perfectRun, prev.perfectRun), gradeCounts(next));
  };

  // ---- metronome run
  const startMetroRun = async () => {
    reset();
    setNotice(null);
    await resumeAudio().catch(() => {});
    if (micAllowed) await MicService.start();
    const m = new Metronome(setup.bpm);
    metronome.current = m;
    let t0: number | null = null;
    m.onBeat((b) => {
      if (t0 === null) {
        t0 = b.time + COUNT_IN * (60 / setup.bpm);
        const s = startMetro(targets, t0, step);
        metroRef.current = s;
        setMetro(s);
        lastHeard.current = t0;
        runStart.current = now();
      }
      setCountIn(b.index < COUNT_IN ? COUNT_IN - b.index : null);
    });
    setPlaying(true);
    await m.start(0.3);
  };
  const stopMetroRun = () => {
    reset();
  };

  // Ticker: misses and silence in metronome mode, and animation frames.
  const metroActive = isMetro && playing && !!metro && !metro.done && !listening;
  useEffect(() => {
    if (!metroActive && !demo) return;
    let id = 0;
    const loopFn = () => {
      const cur = metroRef.current;
      if (cur && !cur.done && isMetro && !listening) {
        const t = now();
        const next = metroTick(cur, t);
        if (next !== cur) {
          metroRef.current = next;
          setMetro(next);
          onGraded(cur, next);
        }
        // Two bars without a note: the player stopped, so stop the run.
        if (t > cur.t0 && t - Math.max(lastHeard.current, cur.t0) > (8 * 60) / setup.bpm && !next.done) {
          reset();
          setNotice('Stopped: no notes for two bars. Start again when you are ready.');
          return;
        }
      }
      if (demo && now() > demo.start + targets.length * demo.step + 0.4) onDemoEnd();
      setTick((x) => x + 1);
      id = requestAnimationFrame(loopFn);
    };
    id = requestAnimationFrame(loopFn);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metroActive, demo]);

  // Coach and pause by silence (Play mode).
  const coachRef = useRef(coach);
  coachRef.current = coach;
  useEffect(() => {
    if (isMetro || listening || done || paused || demo) return;
    const id = setInterval(() => {
      const d = detRef.current;
      if (d.done) return;
      const t = now();
      const t0 = exercise.notes[d.index];
      if (d.hits > 0 && t - Math.max(lastHeard.current, lastHit.current) > PAUSE_AFTER_S) {
        setPaused(true);
        setCoach(null);
        return;
      }
      if (t0 && t - lastHit.current > HINT_AFTER_S && !coachRef.current) say(`${whereIs(t0, lowFret)}.`);
    }, 500);
    return () => clearInterval(id);
  }, [isMetro, listening, done, paused, demo, exercise, lowFret, say]);

  // ---- practice tools
  const hear = () => playNote(targets[Math.min(det.index, targets.length - 1)]);
  const listenStep = 60 / listenBpm / (setup.mode === 'metronome' ? setup.perBeat : 1);
  const startListen = async () => {
    const start = await playNotes(targets, listenStep, 1.0);
    setDemo({ start, step: listenStep });
  };
  const stopListen = () => {
    stopNotes();
    setDemo(null);
  };
  const onDemoEnd = () => {
    const d = demo;
    setDemo(null);
    if (!listening || !d) return;
    if (levelId) markRung(levelId, 'listen');
    addPracticeTime(targets.length * d.step);
    if (loopRef.current) setTimeout(() => startListen(), 400);
  };
  const doSkip = () => {
    const next = skip(detRef.current);
    detRef.current = next;
    setDet(next);
    MicService.resetNote();
    setCoach(null);
    if (next.done) finish(result(next), 0);
  };
  const doBack = () => {
    const next = back(detRef.current);
    detRef.current = next;
    setDet(next);
    MicService.resetNote();
  };
  const resume = () => {
    setPaused(false);
    lastHeard.current = now();
    lastHit.current = now();
    MicService.resetNote();
  };
  const toLesson = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // ---- strip position
  const slide = useSlide(det.index);
  let cursor = slide.cursor;
  let index = det.index;
  if (demo) {
    cursor = Math.max(0, (now() - demo.start) / demo.step);
    index = Math.min(targets.length - 1, Math.round(cursor));
  } else if (listening) {
    cursor = 0;
    index = 0;
  } else if (isMetro) {
    cursor = metro ? Math.min(targets.length, (now() - metro.t0) / metro.step) : 0;
    index = metro ? Math.max(0, Math.min(targets.length - 1, Math.round(cursor))) : 0;
  }
  const feedback = useFeedback(listening ? null : isMetro ? metro?.last ?? null : det.last);

  // ---- settings changes (leave the level for free play)
  const change = (p: Partial<RunSetup>) => {
    const next = { ...setup, ...p };
    if (levelId && JSON.stringify(next) !== JSON.stringify(level?.setup)) setLevelId(null);
    setSetup(next);
  };
  const pickMode = (m: 'listen' | PracticeMode) => {
    if (m === 'listen') {
      setView('listen');
      return;
    }
    setView('run');
    if (m !== setup.mode) change({ mode: m });
  };
  const loadLevel = (l: Level) => {
    setLevelId(l.id);
    setSetup(l.setup);
    setPanel('none');
    setView('run');
  };
  const nextLevel = levelId ? getLevel(levelId + 1) : undefined;
  const nextOpen = nextLevel && isLevelOpen(progress.penta, nextLevel.id) ? nextLevel : undefined;

  // ---- sound remote: only when the app is not waiting for a scale note
  const commandsOn = panel === 'none' && (!!done || paused || listening || (isMetro && !playing));
  useCommands(
    done
      ? {
          ENTER: () => (nextOpen && done.result.stars >= 1 ? loadLevel(nextOpen) : reset()),
          AGAIN: reset,
          BACK: toLesson,
        }
      : paused
        ? { ENTER: resume, AGAIN: reset, DEMO: hear, BACK: toLesson }
        : listening
          ? { ENTER: () => pickMode(setup.mode), DEMO: () => (demo ? stopListen() : startListen()), BACK: toLesson }
          : { ENTER: startMetroRun, DEMO: () => pickMode('listen'), BACK: toLesson },
    commandsOn,
  );

  // ---- for the e2e bot: what to play now (and when, in metronome mode)
  const nextSlot = metro ? metro.grades.findIndex((g) => g === null) : -1;
  const question = useMemo(() => {
    if (done || demo || listening || paused) return null;
    if (!isMetro) return det.done ? null : { id: `${run}-d${det.index}`, acceptMidis: [targets[det.index]] };
    if (!metro || nextSlot < 0) return null;
    return { id: `${run}-m${nextSlot}`, acceptMidis: [targets[nextSlot]] };
  }, [done, demo, listening, paused, isMetro, det.done, det.index, run, targets, metro?.t0, nextSlot]);
  useEffect(() => {
    const rhythm = isMetro && metro && nextSlot >= 0 ? { beatTime: metro.t0 + nextSlot * metro.step } : undefined;
    setDebug({
      question,
      micOn: mic.status === 'on',
      rhythm,
      view,
      paused,
      practice: isMetro
        ? { mode: 'metronome', index: nextSlot, score: metro?.score ?? 0, grades: metro ? gradeCounts(metro) : null, done: !!done }
        : { mode: 'detect', index: det.index, score: det.score, hits: det.hits, misses: det.misses, done: !!done },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, mic.status, done, view, paused]);

  // ---- numbers for the HUD
  const score = isMetro ? metro?.score ?? 0 : det.score;
  const combo = isMetro ? metro?.combo ?? 0 : det.combo;
  const total = targets.length;
  const progressFrac = listening ? (demo ? Math.min(1, cursor / total) : 0) : isMetro ? (metro ? metro.grades.filter(Boolean).length / total : 0) : det.index / total;
  const accuracy = isMetro
    ? metro && metro.grades.some(Boolean)
      ? metro.grades.reduce((a, g) => a + (g ? GRADE[g].weight : 0), 0) / metro.grades.filter(Boolean).length
      : null
    : det.hits + det.misses + det.skips > 0
      ? det.hits / (det.hits + det.misses + det.skips)
      : null;
  const pl = playerLevel(progress.xp);
  const penta = progress.penta;
  const stars = totalPentaStars(penta);

  const meta = `${exercise.subtitle.replace('Scale | ', '')} | ${listening ? `Listen · ${listenBpm} BPM` : isMetro ? `${setup.bpm} BPM${setup.perBeat === 2 ? ' eighths' : ''}` : 'Play'}`;
  const runLabel = isMetro ? 'On the beat' : 'Play';
  const cur = exercise.notes[Math.min(det.index, total - 1)];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={[s.page, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        {/* Top bar */}
        <View style={s.top}>
          <Pressable onPress={toLesson} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to the lesson" testID="to-lesson">
            <Text style={s.back}>‹</Text>
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => setPanel('levels')} testID="open-levels">
            <Text style={s.kicker}>{level ? `WORLD ${level.world} · LESSON ${level.id}${level.boss ? ' · BOSS 👑' : ''}` : 'FREE PLAY'}</Text>
            <Text style={s.levelTitle} numberOfLines={1}>
              {level ? level.title : exercise.title}
            </Text>
          </Pressable>
          <View style={s.pill}>
            <Text style={s.pillText}>🔥 {penta.streak.count}</Text>
          </View>
          <View style={s.pill}>
            <Text style={s.pillText}>⭐ {stars}</Text>
          </View>
        </View>
        <View style={s.xpRow}>
          <Text style={s.xpText}>
            Lv {pl.level} {pl.title}
          </Text>
          <View style={{ flex: 1 }}>
            <ProgressBar value={pl.xpForNext ? pl.xpIntoLevel / pl.xpForNext : 1} color={C.hint} height={5} />
          </View>
        </View>

        {/* Tabs for the panels */}
        <View style={s.tabs}>
          <Tab label="🗺 Path" onPress={() => setPanel('levels')} testID="tab-levels" />
          <Tab label="📚 Theory" onPress={() => setPanel('theory')} testID="tab-theory" />
          <Tab label="⚙ Settings" onPress={() => setPanel('settings')} testID="tab-settings" />
        </View>

        {/* Mode switch: Listen, Play (each note waits), On the beat (metronome) */}
        <View style={s.segment} accessibilityRole="tablist">
          {(['listen', 'detect', 'metronome'] as const).map((m) => {
            const on = m === 'listen' ? listening : !listening && setup.mode === m;
            return (
              <Pressable key={m} onPress={() => pickMode(m)} style={[s.segBtn, on && s.segOn]} testID={`mode-${m}`} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                <Text style={[s.segText, on && { color: C.onAccent }]}>{m === 'listen' ? '👂 Listen' : m === 'detect' ? '🎸 Play' : '🥁 Beat'}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* HUD */}
        {listening ? (
          <Text style={s.modeHint}>The app plays the exercise for you. Follow the dot and listen to each note.</Text>
        ) : (
          <View style={s.hud}>
            <Hud label="SCORE" value={String(score)} testID="hud-score" />
            <Hud label="COMBO" value={`${combo >= 8 ? '🔥' : ''}x${multiplier(combo)} · ${combo}`} color={combo >= 8 ? C.accent : C.text} />
            <Hud label="ACCURACY" value={accuracy === null ? '–' : `${Math.round(accuracy * 100)}%`} />
            <Hud label="BEST" value={level ? String(penta.levels[level.id]?.best ?? '–') : '–'} />
          </View>
        )}
        <ProgressBar value={progressFrac} color={listening ? C.hint : C.good} />

        {/* The reel */}
        <View>
          <Juicy shakeKey={shake} popKey={pop}>
            <View style={s.reelCard}>
              <ReelView exercise={exercise} index={index} cursor={cursor} feedback={feedback} meta={meta} />
            </View>
          </Juicy>
          {popup ? <Popup key={popup.key} text={popup.text} color={popup.color} /> : null}
          {countIn ? (
            <View style={s.countIn} pointerEvents="none">
              <Text style={s.countInText} testID="count-in">
                {countIn}
              </Text>
            </View>
          ) : null}
          {paused ? (
            <View style={s.pausedWrap} testID="paused">
              <View style={s.pausedCard}>
                <Text style={s.pausedTitle}>Paused</Text>
                <Text style={s.hint}>{FLOW.paused.hint}</Text>
                {cur ? <Text style={s.message}>Next: {cur.name} ({cur.interval}) · {whereIs(cur, lowFret)}</Text> : null}
                <CmdButton title="Continue" cmd="ENTER" onPress={resume} testID="pause-continue" />
                <View style={s.row2}>
                  <CmdButton small kind="secondary" title="Hear it" cmd="DEMO" onPress={hear} style={{ flex: 1 }} />
                  <CmdButton small kind="secondary" title="Restart" cmd="AGAIN" onPress={reset} style={{ flex: 1 }} />
                </View>
                <CmdButton small kind="ghost" title="Back to the lesson" cmd="BACK" onPress={toLesson} />
              </View>
            </View>
          ) : null}
        </View>

        {/* Controls */}
        {listening ? (
          <View style={{ gap: 8 }} testID="listen-controls">
            <View style={s.tools}>
              <Tool icon="−" label="Slower" onPress={() => setListenBpm((b) => Math.max(40, b - 10))} />
              <View style={{ alignItems: 'center', minWidth: 90 }}>
                <Text style={s.bpm}>{listenBpm}</Text>
                <Text style={s.toolLabel}>BPM</Text>
              </View>
              <Tool icon="+" label="Faster" onPress={() => setListenBpm((b) => Math.min(160, b + 10))} />
              <Tool icon="🔁" label={loop ? 'Loop on' : 'Loop off'} onPress={() => setLoop((l) => !l)} testID="listen-loop" active={loop} />
            </View>
            <CmdButton
              title={demo ? 'Stop' : 'Play it for me'}
              icon={demo ? '■' : '▶'}
              cmd="DEMO"
              kind={demo ? 'secondary' : 'primary'}
              onPress={demo ? stopListen : startListen}
              testID="listen-play"
            />
            <CmdButton title={`I'm ready: ${runLabel}`} cmd="ENTER" kind="secondary" onPress={() => pickMode(setup.mode)} testID="listen-ready" />
          </View>
        ) : !isMetro ? (
          <View style={{ gap: 8 }}>
            <Text style={s.message} testID="practice-message">
              {demo
                ? 'Listen…'
                : det.done
                  ? ' '
                  : det.index === 0 && det.hits === 0
                    ? `Play ${cur?.name ?? noteLabel(targets[0])} to start: ${cur ? whereIs(cur, lowFret) : ''}. The note waits for you.`
                    : `Next: ${cur?.name ?? ''} (${cur?.interval ?? ''}) · fret ${cur?.fret ?? ''}`}
            </Text>
            {coach && !det.done ? (
              <View style={s.coach} testID="coach">
                <Text style={s.coachText}>{coach.text}</Text>
              </View>
            ) : null}
            <View style={s.tools}>
              <Tool icon="⏮" label="Back" onPress={doBack} disabled={det.index === 0} testID="tool-back" />
              <Tool icon="🔊" label="Hear" onPress={hear} testID="tool-hear" />
              <Tool icon="⏭" label="Skip" onPress={doSkip} testID="tool-skip" />
              <Tool icon="⏸" label="Pause" onPress={() => setPaused(true)} testID="tool-pause" />
              <Tool icon="↺" label="Restart" onPress={reset} testID="tool-restart" />
            </View>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <View style={s.tools}>
              <Tool icon="−" label="Slower" onPress={() => change({ bpm: Math.max(40, setup.bpm - 5) })} disabled={playing} />
              <View style={{ alignItems: 'center', minWidth: 90 }}>
                <Text style={s.bpm}>{setup.bpm}</Text>
                <Text style={s.toolLabel}>BPM {setup.perBeat === 2 ? '· eighths' : '· quarters'}</Text>
              </View>
              <Tool icon="+" label="Faster" onPress={() => change({ bpm: Math.min(200, setup.bpm + 5) })} disabled={playing} />
            </View>
            {playing ? (
              <Button title="■ Stop" kind="secondary" onPress={stopMetroRun} testID="metro-stop" />
            ) : (
              <CmdButton title="Start with metronome" icon="▶" cmd="ENTER" onPress={startMetroRun} testID="metro-start" />
            )}
            {notice && !playing ? (
              <View style={s.coach} testID="notice">
                <Text style={s.coachText}>{notice}</Text>
              </View>
            ) : null}
            <Text style={s.hint}>4 clicks count you in. Every note is graded PERFECT, GREAT, GOOD, WRONG or MISS. Stop playing for two bars to stop.</Text>
          </View>
        )}

        {level && !done ? (
          <View style={s.tipCard}>
            <Text style={s.tip}>💡 {level.tip}</Text>
          </View>
        ) : null}
        {listening ? null : micAllowed ? (
          <>
            <MicPanel onUseTaps={() => setView('listen')} />
            {mic.status !== 'on' && mic.status !== 'starting' ? <Button title="🎤 Start the mic" onPress={() => MicService.start()} testID="practice-mic" /> : null}
          </>
        ) : (
          <View style={s.coach}>
            <Text style={s.coachText}>The mic is off, so nothing is graded. Listen mode works without it.</Text>
            <Button small kind="secondary" title="🎤 Turn on the mic" onPress={() => MicService.start()} testID="practice-mic" />
          </View>
        )}
      </ScrollView>

      {/* Results */}
      {done ? (
        <Results
          done={done}
          level={level}
          nextLevel={nextOpen}
          today={todaySeconds(progress)}
          goalMin={progress.onboarding.goalMin}
          onAgain={reset}
          onNext={() => nextOpen && loadLevel(nextOpen)}
          onLesson={toLesson}
        />
      ) : null}

      {/* Panels */}
      <Sheet open={panel !== 'none'} onClose={() => setPanel('none')} title={panel === 'levels' ? 'Pentatonic Path' : panel === 'theory' ? 'Theory' : 'Settings'}>
        {panel === 'theory' ? <TheoryPanel exercise={exercise} /> : null}
        {panel === 'levels' ? <LevelsPanel current={levelId} onPick={loadLevel} /> : null}
        {panel === 'settings' ? <SettingsPanel setup={setup} onChange={change} inLevel={!!levelId} /> : null}
      </Sheet>
    </View>
  );
}

// ---------------------------------------------------------------- hooks
function useSlide(index: number) {
  const [, setTick] = useState(0);
  const a = useRef({ from: index, to: index, start: 0 });
  const t = now();
  if (a.current.to !== index) {
    const cur = slideAt(a.current, t);
    a.current = { from: index < a.current.to - 1 || index === 0 ? index : cur, to: index, start: t };
  }
  const cursor = slideAt(a.current, t);
  const busy = cursor !== a.current.to;
  useEffect(() => {
    if (!busy) return;
    const id = requestAnimationFrame(() => setTick((n) => n + 1));
    return () => cancelAnimationFrame(id);
  });
  return { cursor };
}

function slideAt(a: { from: number; to: number; start: number }, t: number) {
  const k = Math.min(1, (t - a.start) / SLIDE_S);
  return k >= 1 ? a.to : a.from + (a.to - a.from) * (1 - Math.pow(1 - k, 3));
}

/** Turns the last hit, miss or grade into a short-lived ring on the fretboard. */
function useFeedback(last: { index: number; kind?: string; grade?: Grade } | null): Feedback | null {
  const [, setTick] = useState(0);
  const ref = useRef<{ last: unknown; start: number; kind: 'hit' | 'miss'; index: number } | null>(null);
  if (last && ref.current?.last !== last) {
    const bad = last.kind === 'miss' || last.grade === 'wrong' || last.grade === 'miss';
    ref.current = { last, start: now(), kind: bad ? 'miss' : 'hit', index: last.index };
  }
  const f = ref.current;
  const age = f ? (now() - f.start) / FX_S : 1;
  const active = !!f && age < 1;
  useEffect(() => {
    if (!active) return;
    const id = requestAnimationFrame(() => setTick((n) => n + 1));
    return () => cancelAnimationFrame(id);
  });
  return active && f ? { kind: f.kind, index: f.index, age } : null;
}

// ---------------------------------------------------------------- pieces
function Popup({ text, color }: { text: string; color: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.popup,
        {
          opacity: v.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, -30] }) },
            { scale: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.7, 1.15, 1] }) },
          ],
        },
      ]}
    >
      <Text style={[s.popupText, { color }]} testID="popup">
        {text}
      </Text>
    </Animated.View>
  );
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

function Tab({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.tab, pressed && { opacity: 0.7 }]} testID={testID} accessibilityRole="button">
      <Text style={s.tabText}>{label}</Text>
    </Pressable>
  );
}

function Tool({ icon, label, onPress, disabled, testID, active }: { icon: string; label: string; onPress: () => void; disabled?: boolean; testID?: string; active?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [s.tool, active && s.toolOn, pressed && { transform: [{ scale: 0.94 }] }, disabled && { opacity: 0.35 }]} testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={active !== undefined ? { selected: active } : undefined}>
      <Text style={s.toolIcon}>{icon}</Text>
      <Text style={s.toolLabel}>{label}</Text>
    </Pressable>
  );
}

function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} testID="sheet-close">
              <Text style={s.close}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Results({
  done,
  level,
  nextLevel,
  today,
  goalMin,
  onAgain,
  onNext,
  onLesson,
}: {
  done: Done;
  level?: Level;
  nextLevel?: Level;
  today: number;
  goalMin: number;
  onAgain: () => void;
  onNext: () => void;
  onLesson: () => void;
}) {
  const r = done.result;
  const passed = r.stars >= 1;
  const mins = Math.round(today / 60);
  return (
    <View style={s.resultsWrap}>
      {r.stars === 3 ? <Confetti count={60} /> : null}
      <ScrollView style={{ width: '100%', maxWidth: 440 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View style={s.results}>
          <Text style={[s.resultTitle, { color: passed ? C.good : C.bad }]} testID="practice-done">
            {r.stars === 3 ? 'Flawless!' : passed ? (level ? 'Lesson cleared!' : 'Nice run!') : 'Almost! Try again'}
          </Text>
          <Stars n={r.stars} size={44} />
          <Text style={s.bigScore} testID="practice-score">
            {r.score}
          </Text>
          {done.newBest ? <Text style={s.newBest}>New best score!</Text> : null}
          <Text style={s.xpGain}>+{done.xp} XP</Text>
          <View style={s.stats}>
            <Stat label="Accuracy" value={`${Math.round(r.accuracy * 100)}%`} testID="practice-accuracy" />
            <Stat label="Best combo" value={String(r.bestCombo)} />
            {r.eighthsBpm ? <Stat label="Speed" value={`${Math.round(r.notesPerMinute)}/min`} /> : null}
          </View>
          {done.grades ? (
            <View style={s.stats}>
              {(Object.keys(done.grades) as Grade[]).map((g) => (
                <Stat key={g} label={GRADE[g].label.toLowerCase()} value={String(done.grades![g])} />
              ))}
            </View>
          ) : null}
          {!passed ? <Text style={s.hint}>Get 70% right to pass. Try Listen first, or Play mode where each note waits for you.</Text> : null}
          {done.unlocked ? <Text style={s.unlock}>🔓 Lesson {done.unlocked} unlocked!</Text> : null}
          {done.newBadges.map((b) => (
            <View key={b.id} style={s.badgeNew} testID="badge-new">
              <Text style={{ fontSize: 26 }}>{b.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.badgeTitle}>Badge: {b.title}</Text>
                <Text style={s.hint}>{b.text}</Text>
              </View>
            </View>
          ))}
          <View style={s.goal} testID="today-goal">
            <Text style={s.kicker}>
              TODAY · {mins} OF {goalMin} MIN
            </Text>
            <ProgressBar value={today / (goalMin * 60)} color={C.accent} />
            {today >= goalMin * 60 ? <Text style={s.hint}>Daily goal reached. Keep going or call it a day.</Text> : null}
          </View>
          <View style={s.resultButtons}>
            {nextLevel && passed ? <CmdButton title={`Next: ${nextLevel.title}`} cmd="ENTER" onPress={onNext} testID="next-level" /> : null}
            <CmdButton title="Play again" cmd={nextLevel && passed ? 'AGAIN' : 'ENTER'} kind={nextLevel && passed ? 'secondary' : 'primary'} onPress={onAgain} testID="practice-again" />
            <CmdButton title="Back to the lesson" cmd="BACK" kind="ghost" onPress={onLesson} testID="results-lesson" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={{ alignItems: 'center', minWidth: 64 }}>
      <Text style={{ color: C.text, fontSize: 20, fontWeight: '800' }} testID={testID}>
        {value}
      </Text>
      <Text style={s.toolLabel}>{label}</Text>
    </View>
  );
}

export function LevelsPanel({ current, onPick }: { current: number | null; onPick: (l: Level) => void }) {
  const { progress } = useProgress();
  const p = progress.penta;
  return (
    <View style={{ gap: 16 }}>
      {WORLDS.map((w) => (
        <View key={w.id} style={{ gap: 8 }}>
          <View>
            <Text style={s.kicker}>WORLD {w.id}</Text>
            <Text style={s.worldName}>{w.name}</Text>
            <Text style={s.hint}>{w.subtitle}</Text>
          </View>
          {LEVELS.filter((l) => l.world === w.id).map((l) => {
            const open = isLevelOpen(p, l.id);
            const rec = p.levels[l.id];
            return (
              <Pressable key={l.id} disabled={!open} onPress={() => onPick(l)} style={[s.levelRow, current === l.id && s.levelRowOn, !open && { opacity: 0.45 }]} testID={`plevel-${l.id}`}>
                <View style={[s.levelNum, l.boss && { backgroundColor: '#8B4FD6' }, rec?.stars ? { backgroundColor: C.good } : null]}>
                  <Text style={s.levelNumText}>{open ? (l.boss ? '👑' : l.id) : '🔒'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.levelName}>{l.title}</Text>
                  <Text style={s.hint}>
                    {l.setup.key} {l.setup.scale.replace(' Pentatonic', '')} · box {l.setup.position} · {l.setup.pattern} ·{' '}
                    {l.setup.mode === 'detect' ? 'play' : `on the beat, ${l.setup.bpm} BPM${l.setup.perBeat === 2 ? ' eighths' : ''}`}
                  </Text>
                </View>
                <Stars n={rec?.stars ?? 0} size={14} />
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={{ gap: 8 }}>
        <Text style={s.worldName}>Badges</Text>
        <View style={s.badges}>
          {BADGES.map((b) => {
            const has = p.badges.includes(b.id);
            return (
              <View key={b.id} style={[s.badge, !has && { opacity: 0.35 }]}>
                <Text style={{ fontSize: 26 }}>{has ? b.icon : '❔'}</Text>
                <Text style={s.badgeName}>{b.title}</Text>
                <Text style={s.badgeText}>{b.text}</Text>
              </View>
            );
          })}
        </View>
      </View>
      <Text style={s.hint}>Coming later: battle other players on the same exercise.</Text>
    </View>
  );
}

function SettingsPanel({ setup, onChange, inLevel }: { setup: RunSetup; onChange: (p: Partial<RunSetup>) => void; inLevel: boolean }) {
  return (
    <View style={{ gap: 12 }}>
      {inLevel ? <Text style={s.hint}>Changing anything here switches from the level to free play. Pick the level again in Levels.</Text> : null}
      <Chips label="MODE" options={['detect', 'metronome']} value={setup.mode} show={(m) => (m === 'detect' ? '🎸 Play' : '🥁 On the beat')} onPick={(mode) => onChange({ mode: mode as PracticeMode })} />
      <Chips label="KEY" options={[...ROOTS]} value={setup.key} onPick={(key) => onChange({ key })} />
      <Chips label="SCALE" options={['Minor Pentatonic', 'Major Pentatonic']} value={setup.scale} show={(v) => v.replace(' Pentatonic', '')} onPick={(v) => onChange({ scale: v as RunSetup['scale'] })} />
      <Chips label="BOX" options={['1', '2', '3', '4', '5']} value={String(setup.position)} onPick={(v) => onChange({ position: Number(v) })} />
      <Chips label="PATTERN" options={[...PATTERNS]} value={setup.pattern} onPick={(pattern) => onChange({ pattern: pattern as RunSetup['pattern'] })} />
      <Chips label="TEMPO (METRONOME)" options={['50', '60', '70', '80', '90', '100', '120']} value={String(setup.bpm)} show={(v) => `${v}`} onPick={(v) => onChange({ bpm: Number(v) })} />
      <Chips label="NOTES PER CLICK" options={['1', '2']} value={String(setup.perBeat)} show={(v) => (v === '1' ? 'Quarters (1)' : 'Eighths (2)')} onPick={(v) => onChange({ perBeat: Number(v) as 1 | 2 })} />
      <Pressable onPress={() => router.push('/settings')} style={s.chip} accessibilityRole="link" testID="open-app-settings">
        <Text style={s.chipText}>🎤 Mic, timing and progress settings ›</Text>
      </Pressable>
    </View>
  );
}

function Chips({ label, options, value, onPick, show }: { label: string; options: string[]; value: string; onPick: (v: string) => void; show?: (v: string) => string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.kicker}>{label}</Text>
      <View style={s.chips}>
        {options.map((o) => (
          <Pressable key={o} onPress={() => onPick(o)} style={[s.chip, o === value && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: o === value }} testID={`set-${label.split(' ')[0].toLowerCase()}-${o}`}>
            <Text style={[s.chipText, o === value && { color: C.onAccent }]}>{show ? show(o) : o}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}


const s = StyleSheet.create({
  page: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 14, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { color: C.text, fontSize: 34, fontWeight: '300', paddingRight: 4, marginTop: -4 },
  kicker: { color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  levelTitle: { color: C.text, fontSize: 19, fontWeight: '800' },
  pill: { backgroundColor: C.panel, borderColor: C.border, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { color: C.text, fontWeight: '800' },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  xpText: { color: C.hint, fontWeight: '800', fontSize: 12 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, backgroundColor: C.panel, borderColor: C.border, borderWidth: 1, borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  tabText: { color: C.text, fontWeight: '700', fontSize: 14 },
  segment: { flexDirection: 'row', backgroundColor: C.panel2, borderRadius: 14, padding: 4 },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  segOn: { backgroundColor: C.accent },
  segText: { color: C.text, fontWeight: '800', fontSize: 15 },
  hud: { flexDirection: 'row' },
  hudLabel: { color: C.faint, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  hudValue: { fontSize: 19, fontWeight: '900', fontVariant: ['tabular-nums'] },
  reelCard: { width: '100%', maxWidth: 500, alignSelf: 'center', borderRadius: 18, overflow: 'hidden', backgroundColor: '#F5F5F0', borderWidth: 1, borderColor: C.border },
  popup: { position: 'absolute', top: '40%', left: 0, right: 0, alignItems: 'center' },
  popupText: { fontSize: 30, fontWeight: '900', textShadowColor: 'rgba(255,255,255,0.9)', textShadowRadius: 8, letterSpacing: 1 },
  countIn: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245,245,240,0.55)', borderRadius: 18 },
  countInText: { fontSize: 110, fontWeight: '900', color: C.accent },
  message: { color: C.dim, textAlign: 'center', fontSize: 15, fontWeight: '700' },
  tools: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  tool: { alignItems: 'center', backgroundColor: C.panel, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingVertical: 8, minWidth: 60 },
  toolOn: { borderColor: C.accent, borderWidth: 2 },
  toolIcon: { fontSize: 20, color: C.text },
  toolLabel: { color: C.faint, fontSize: 11, fontWeight: '700' },
  bpm: { color: C.text, fontSize: 30, fontWeight: '900' },
  hint: { color: C.faint, fontSize: 13 },
  modeHint: { color: C.dim, fontSize: 14, textAlign: 'center' },
  coach: { backgroundColor: '#FFF6E0', borderColor: C.star, borderWidth: 1.5, borderRadius: 12, padding: 10, gap: 8 },
  coachText: { color: '#3D3200', fontSize: 15, fontWeight: '600' },
  pausedWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245,245,240,0.85)', borderRadius: 18, padding: 12 },
  pausedCard: { backgroundColor: C.panel, borderRadius: 18, padding: 16, gap: 10, width: '100%', maxWidth: 380, borderWidth: 1, borderColor: C.border },
  pausedTitle: { color: C.text, fontSize: 24, fontWeight: '900' },
  row2: { flexDirection: 'row', gap: 8 },
  goal: { alignSelf: 'stretch', gap: 6, paddingTop: 4 },
  tipCard: { backgroundColor: C.panel, borderRadius: 12, padding: 12, borderLeftWidth: 4, borderLeftColor: C.star },
  tip: { color: C.dim, fontSize: 14 },
  resultsWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(22,24,29,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  results: { backgroundColor: C.panel, borderRadius: 22, padding: 20, gap: 10, alignItems: 'center', width: '100%', maxWidth: 440 },
  resultTitle: { fontSize: 28, fontWeight: '900' },
  bigScore: { color: C.text, fontSize: 46, fontWeight: '900' },
  newBest: { color: C.star, fontWeight: '900' },
  xpGain: { color: C.hint, fontWeight: '900' },
  stats: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  unlock: { color: C.good, fontWeight: '900', fontSize: 16 },
  badgeNew: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: C.bg, borderRadius: 12, padding: 10, alignSelf: 'stretch' },
  badgeTitle: { color: C.text, fontWeight: '800' },
  resultButtons: { gap: 8, alignSelf: 'stretch' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(22,24,29,0.35)' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '88%', padding: 16, width: '100%', maxWidth: 640, alignSelf: 'center' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sheetTitle: { flex: 1, color: C.text, fontSize: 22, fontWeight: '900' },
  close: { color: C.faint, fontSize: 22, fontWeight: '700' },
  worldName: { color: C.text, fontSize: 18, fontWeight: '900' },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.panel, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: C.border },
  levelRowOn: { borderColor: C.accent, borderWidth: 2 },
  levelNum: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  levelNumText: { color: C.onAccent, fontWeight: '900' },
  levelName: { color: C.text, fontWeight: '800', fontSize: 15 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { width: '31%', minWidth: 100, flexGrow: 1, backgroundColor: C.panel, borderRadius: 12, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  badgeName: { color: C.text, fontWeight: '800', fontSize: 12, textAlign: 'center' },
  badgeText: { color: C.faint, fontSize: 10, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.text, fontWeight: '700', fontSize: 13 },
});
