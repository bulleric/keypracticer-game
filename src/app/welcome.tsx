import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../account/auth';
import { SignIn } from '../account/SignIn';
import { resumeAudio } from '../audio/context';
import { buzz } from '../audio/haptics';
import { busyUntil, playNote, playNotes } from '../audio/notePlayer';
import { CmdButton } from '../components/CmdButton';
import { MiniNeck, type NeckDot } from '../components/MiniNeck';
import { Confetti } from '../components/ui';
import { setDebug } from '../debug';
import { tuningAdvice } from '../engine/coach';
import { COMMAND_ORDER, COMMANDS } from '../engine/commands';
import { FLOW } from '../engine/flow';
import { useCommandHold, useCommands } from '../engine/useCommands';
import { MicService, useMicFrame, useMicNotes, useMicState } from '../pitch/MicService';
import { onHeard, startPractice, type PracticeState } from '../practice/session';
import type { Experience } from '../store/model';
import { useProgress } from '../store/progress';
import { C } from '../theme/colors';

/**
 * First launch: six short screens, then sign-up. Each sets something the
 * practice needs. The step is saved, so closing the app half way is fine.
 */
const STEPS = ['welcome', 'level', 'goal', 'mic', 'remote', 'firstWin', 'signup'] as const;
type Step = (typeof STEPS)[number];

const OPEN_STRINGS = [
  { midi: 40, label: 'E' },
  { midi: 45, label: 'A' },
  { midi: 50, label: 'D' },
  { midi: 55, label: 'G' },
  { midi: 59, label: 'B' },
  { midi: 64, label: 'e' },
];

/** A minor pentatonic: A (low E, 5) C (low E, 8) D (A, 5). */
const FIRST = [
  { midi: 45, string: 6, fret: 5, label: 'R', name: 'A', where: 'Low E string, fret 5, index finger' },
  { midi: 48, string: 6, fret: 8, label: 'b3', name: 'C', where: 'Low E string, fret 8, pinky' },
  { midi: 50, string: 5, fret: 5, label: '4', name: 'D', where: 'A string, fret 5, index finger' },
];

const PLACE: Record<Experience, { level: number; unlockedTo: number }> = {
  new: { level: 1, unlockedTo: 0 },
  box1: { level: 6, unlockedTo: 6 },
  all: { level: 16, unlockedTo: 20 },
};

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { progress, loaded, updateOnboarding, placeAt } = useProgress();
  const ob = progress.onboarding;
  const [i, setI] = useState(0);
  const [restored, setRestored] = useState(false);
  const [fromWelcome, setFromWelcome] = useState(false);
  const step: Step = STEPS[i];

  // Pick up where the player left off.
  useEffect(() => {
    if (!loaded || restored) return;
    setI(Math.min(Math.max(0, ob.step), STEPS.length - 1));
    setRestored(true);
  }, [loaded, restored, ob.step]);

  const go = (n: number) => {
    let next = Math.max(0, Math.min(STEPS.length - 1, n));
    // No mic: the sound remote can't work, skip it.
    if (STEPS[next] === 'remote' && progress.onboarding.mic === 'denied') next += n > i ? 1 : -1;
    setI(next);
    updateOnboarding({ step: next });
  };
  const next = () => go(i + 1);
  const back = () => go(i - 1);

  const finish = () => {
    const exp = progress.onboarding.experience ?? 'new';
    placeAt(PLACE[exp].level, PLACE[exp].unlockedTo);
    updateOnboarding({ done: true, step: 0 });
    router.replace('/');
  };

  useEffect(() => {
    setDebug({ onboarding: step });
  }, [step]);

  if (!loaded || !restored) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerShown: false, title: 'Welcome' }} />
      <ScrollView contentContainerStyle={[s.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]} keyboardShouldPersistTaps="handled">
        <View style={s.topRow}>
          {i > 0 && !fromWelcome ? (
            <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" testID="ob-back">
              <Text style={s.back}>‹</Text>
            </Pressable>
          ) : (
            <View style={{ width: 20 }} />
          )}
          <View style={s.dots} accessibilityLabel={`Step ${i + 1} of ${STEPS.length}`}>
            {STEPS.map((x, k) => (
              <View key={x} style={[s.dot, k === i && s.dotOn, k < i && s.dotDone]} />
            ))}
          </View>
          <View style={{ width: 20 }} />
        </View>
        <View style={s.body} testID={`ob-${step}`}>
          {step === 'welcome' ? (
            <WelcomeStep
              onNext={next}
              onHaveAccount={() => {
                setFromWelcome(true);
                go(STEPS.indexOf('signup'));
              }}
            />
          ) : null}
          {step === 'level' ? <LevelStep value={ob.experience} onPick={(e) => updateOnboarding({ experience: e })} onNext={next} onBack={back} /> : null}
          {step === 'goal' ? <GoalStep goal={ob.goalMin} onGoal={(g) => updateOnboarding({ goalMin: g })} onNext={next} onBack={back} /> : null}
          {step === 'mic' ? (
            <MicStep
              onNext={() => {
                updateOnboarding({ mic: 'granted' });
                next();
              }}
              onSkip={() => {
                updateOnboarding({ mic: 'denied' });
                setI(STEPS.indexOf('firstWin'));
                updateOnboarding({ step: STEPS.indexOf('firstWin'), mic: 'denied' });
              }}
            />
          ) : null}
          {step === 'remote' ? <RemoteStep onNext={next} onBack={back} /> : null}
          {step === 'firstWin' ? <FirstWinStep micOn={ob.mic !== 'denied'} onNext={next} /> : null}
          {step === 'signup' ? (
            <SignupStep
              fromWelcome={fromWelcome}
              onLater={() => {
                if (fromWelcome) {
                  setFromWelcome(false);
                  go(1);
                  return;
                }
                updateOnboarding({ signupLater: ob.signupLater + 1 });
                finish();
              }}
              onSignedIn={() => {
                // A returning player whose account already finished onboarding goes straight in.
                finish();
              }}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------- steps
function Title({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.title} accessibilityRole="header">
        {children}
      </Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
    </View>
  );
}

const BOX1: NeckDot[] = [
  [6, 5, 'R'], [6, 8, 'b3'], [5, 5, '4'], [5, 7, '5'], [4, 5, 'b7'], [4, 7, 'R'],
  [3, 5, 'b3'], [3, 7, '4'], [2, 5, '5'], [2, 8, 'b7'], [1, 5, 'R'], [1, 8, 'b3'],
].map(([string, fret, label]) => ({ string: string as number, fret: fret as number, label: label as string }));

function WelcomeStep({ onNext, onHaveAccount }: { onNext: () => void; onHaveAccount: () => void }) {
  useCommands({ ENTER: onNext });
  return (
    <>
      <MiniNeck dots={BOX1} from={4} to={9} />
      <Title sub="With your real guitar. The app listens and scores every note you play.">Play the pentatonic scale all over the neck</Title>
      <View style={s.bullets}>
        <Bullet icon="🎯" text="Short lessons with the theory behind each one" />
        <Bullet icon="👂" text="Listen to any practice before you play it" />
        <Bullet icon="🎸" text="Control the app with your guitar" />
      </View>
      <View style={s.grow} />
      <CmdButton title="Let's go" cmd="ENTER" onPress={onNext} testID="ob-start" />
      <Text style={s.fine}>{FLOW.welcome.hint}</Text>
      <CmdButton title="I already have an account" kind="ghost" small onPress={onHaveAccount} testID="ob-have-account" />
    </>
  );
}

function Bullet({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={s.bullet}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={s.bulletText}>{text}</Text>
    </View>
  );
}

function LevelStep({ value, onPick, onNext, onBack }: { value: Experience | null; onPick: (e: Experience) => void; onNext: () => void; onBack: () => void }) {
  const v = value ?? 'new';
  useEffect(() => {
    if (!value) onPick('new');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useCommands({ ENTER: onNext, BACK: onBack });
  const opts: { e: Experience; icon: string; title: string; sub: string }[] = [
    { e: 'new', icon: '🌱', title: "It's new to me", sub: 'Start with box 1, slowly.' },
    { e: 'box1', icon: '🎸', title: 'I know box 1', sub: 'Start at box 2. Box 1 lessons stay open to replay.' },
    { e: 'all', icon: '🔥', title: 'I know all five boxes', sub: 'Start with major pentatonic and new keys. Every lesson is open.' },
  ];
  return (
    <>
      <Title sub={FLOW.level.hint}>How well do you know the pentatonic?</Title>
      <View style={{ gap: 10 }} accessibilityRole="radiogroup">
        {opts.map((o) => (
          <Pressable
            key={o.e}
            onPress={() => onPick(o.e)}
            style={[s.option, v === o.e && s.optionOn]}
            accessibilityRole="radio"
            accessibilityState={{ checked: v === o.e }}
            testID={`ob-exp-${o.e}`}
          >
            <Text style={{ fontSize: 26 }}>{o.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.optionTitle}>{o.title}</Text>
              <Text style={s.optionSub}>{o.sub}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <View style={s.grow} />
      <CmdButton title="Continue" cmd="ENTER" onPress={onNext} testID="ob-next" />
    </>
  );
}

function GoalStep({ goal, onGoal, onNext, onBack }: { goal: 5 | 10 | 20; onGoal: (g: 5 | 10 | 20) => void; onNext: () => void; onBack: () => void }) {
  const [checks, setChecks] = useState([true, false, false]);
  useCommands({ ENTER: onNext, BACK: onBack });
  const items = ['Guitar in hand, strap on or a chair without arms', 'Phone on a stand or table, about 1 m away', 'Quiet room, notifications off'];
  return (
    <>
      <Title sub="Short, focused practice beats long, distracted practice. Pick a daily goal.">Set up your practice spot</Title>
      <View style={s.seg} accessibilityRole="radiogroup">
        {([5, 10, 20] as const).map((g) => (
          <Pressable key={g} onPress={() => onGoal(g)} style={[s.segBtn, goal === g && s.segOn]} accessibilityRole="radio" accessibilityState={{ checked: goal === g }} testID={`ob-goal-${g}`}>
            <Text style={[s.segText, goal === g && { color: C.onAccent }]}>{g} min</Text>
            <Text style={[s.segSub, goal === g && { color: C.onAccent }]}>{g === 5 ? 'Easy' : g === 10 ? 'Steady' : 'Serious'}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.kicker}>BEFORE EACH SESSION</Text>
      <View style={{ gap: 10 }}>
        {items.map((t, k) => (
          <Pressable
            key={t}
            onPress={() => setChecks((c) => c.map((x, j) => (j === k ? !x : x)))}
            style={s.check}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: checks[k] }}
          >
            <View style={[s.box, checks[k] && s.boxOn]}>{checks[k] ? <Text style={s.tick}>✓</Text> : null}</View>
            <Text style={s.checkText}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.grow} />
      <CmdButton title="Done" cmd="ENTER" onPress={onNext} testID="ob-next" />
    </>
  );
}

function MicStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const mic = useMicState();
  const frame = useMicFrame(20);
  const [inTune, setInTune] = useState<Record<number, boolean>>({});
  const [heardAny, setHeardAny] = useState(false);
  const streak = useRef<{ midi: number; n: number }>({ midi: 0, n: 0 });

  useEffect(() => {
    const n = frame?.note;
    if (!n) return;
    setHeardAny(true);
    const open = OPEN_STRINGS.find((o) => o.midi === n.midi);
    if (!open) return;
    if (Math.abs(n.cents) <= 12) {
      streak.current = streak.current.midi === n.midi ? { midi: n.midi, n: streak.current.n + 1 } : { midi: n.midi, n: 1 };
      if (streak.current.n >= 2 && !inTune[n.midi]) {
        setInTune((t) => ({ ...t, [n.midi]: true }));
        buzz('good');
      }
    }
  }, [frame, inTune]);

  // For the e2e bot: pluck the low E.
  useEffect(() => {
    setDebug({ question: mic.status === 'on' && !inTune[40] ? { id: 'tune-E', acceptMidis: [40] } : null, micOn: mic.status === 'on' });
    return () => setDebug({ question: null });
  }, [mic.status, inTune]);

  const start = async () => {
    await resumeAudio().catch(() => {});
    await MicService.start();
  };
  const note = frame?.note;
  const advice = note && OPEN_STRINGS.some((o) => o.midi === note.midi) ? tuningAdvice(note.cents) : null;

  if (mic.status !== 'on') {
    return (
      <>
        <Title sub="The app listens to your guitar to check every note. It only listens for notes: nothing is recorded or sent anywhere.">Let's hear your guitar</Title>
        <Text style={{ fontSize: 64, textAlign: 'center' }}>🎤</Text>
        {mic.status === 'error' ? (
          <View style={s.warn} testID="ob-mic-error">
            <Text style={s.warnText}>
              {mic.errorCode === 'denied'
                ? 'The mic is blocked. Allow it in your browser or phone settings, then try again.'
                : `The mic did not start: ${mic.error ?? 'unknown error'}.`}
            </Text>
          </View>
        ) : null}
        <View style={s.grow} />
        <CmdButton title={mic.status === 'starting' ? 'Starting…' : mic.status === 'error' ? 'Try again' : 'Turn on the mic'} onPress={start} disabled={mic.status === 'starting'} testID="ob-mic-on" />
        <CmdButton title="Continue without the mic" kind="ghost" small onPress={onSkip} testID="ob-mic-skip" />
        <Text style={s.fine}>Without the mic you can listen to every lesson, and turn the mic on later.</Text>
      </>
    );
  }

  return (
    <>
      <Title sub={heardAny ? 'Pluck each open string to check your tuning, or carry on.' : FLOW.mic.hint}>{heardAny ? 'We can hear you' : "Let's hear your guitar"}</Title>
      <View style={s.tuner} testID="ob-tuner">
        <Text style={s.tunerNote}>{note ? note.name : '–'}</Text>
        <Text style={s.fine}>{note ? `${note.name}${note.octave} · ${Math.round(note.frequency * 10) / 10} Hz` : 'Waiting for a note…'}</Text>
        <View style={s.needleTrack}>
          <View style={s.needleMid} />
          {note ? <View style={[s.needle, { left: `${50 + Math.max(-50, Math.min(50, note.cents))}%`, backgroundColor: advice?.ok ? C.good : C.star }]} /> : null}
        </View>
        {advice ? (
          <Text style={[s.advice, { color: advice.ok ? C.good : '#8A6A00' }]} testID="ob-advice">
            {advice.ok ? 'In tune ✓' : advice.text}
          </Text>
        ) : (
          <Text style={s.fine}> </Text>
        )}
      </View>
      <View style={s.strings}>
        {OPEN_STRINGS.map((o) => (
          <View key={o.midi} style={[s.stringChip, inTune[o.midi] && s.stringOk]} testID={`ob-string-${o.midi}`}>
            <Text style={[s.stringText, inTune[o.midi] && { color: C.onAccent }]}>{o.label}</Text>
          </View>
        ))}
      </View>
      <View style={s.grow} />
      <CmdButton title={heardAny ? 'Sounds good' : 'Waiting for your guitar…'} onPress={onNext} disabled={!heardAny} testID="ob-mic-next" />
      <CmdButton title="Continue without the mic" kind="ghost" small onPress={onSkip} />
    </>
  );
}

function RemoteStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const hold = useCommandHold();
  const [fired, setFired] = useState(false);
  useCommands({
    ENTER: () => {
      setFired(true);
      buzz('win');
      setTimeout(onNext, 700);
    },
    BACK: onBack,
  });
  useEffect(() => {
    setDebug({ question: fired ? null : { id: 'remote-E', acceptMidis: [40] }, micOn: true });
    return () => setDebug({ question: null });
  }, [fired]);
  const p = hold.cmd === 'ENTER' ? hold.progress : fired ? 1 : 0;
  return (
    <>
      <Title sub="Open strings work like buttons, so your hands can stay on the guitar. Try it: let the open low E ring.">Your guitar is the remote</Title>
      <View style={s.ringWrap}>
        <View style={[s.ring, { borderColor: p > 0 ? C.accent : C.border }]}>
          <View style={[s.ringFill, { height: `${Math.round(p * 100)}%` }]} />
          <Text style={s.ringText}>{fired ? '✓' : 'E'}</Text>
        </View>
        <Text style={s.fine} testID="ob-remote-state">
          {fired ? 'Enter! That is all it takes.' : p > 0 ? 'Hold it…' : 'Play the open low E and let it ring.'}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        {COMMAND_ORDER.map((c) => (
          <View key={c} style={s.cmdRow}>
            <View style={s.cmdLetter}>
              <Text style={s.cmdLetterText}>{COMMANDS[c].letter}</Text>
            </View>
            <Text style={s.cmdName}>{COMMANDS[c].label}</Text>
            <Text style={s.cmdWhat}>
              {c === 'ENTER' ? 'start, continue, next' : c === 'AGAIN' ? 'play it again' : c === 'DEMO' ? 'hear it' : c === 'GUIDE' ? 'theory and help' : 'go back'}
            </Text>
          </View>
        ))}
      </View>
      <Text style={s.fine}>The letter of the string is the first letter of the action. During a run every note is an answer, so commands only work between runs. Buttons show the letter.</Text>
      <View style={s.grow} />
      <CmdButton title="Skip, I'll tap the screen" kind="ghost" small onPress={onNext} testID="ob-remote-skip" />
    </>
  );
}

function FirstWinStep({ micOn, onNext }: { micOn: boolean; onNext: () => void }) {
  const targets = useMemo(() => FIRST.map((f) => f.midi), []);
  const [st, setSt] = useState<PracticeState>(() => startPractice(targets));
  const ref = useRef(st);
  ref.current = st;
  const mic = useMicState();
  const [wrong, setWrong] = useState<string | null>(null);
  useEffect(() => {
    if (micOn) MicService.start();
  }, [micOn]);
  useMicNotes((n) => {
    if (!micOn || ref.current.done) return;
    if (n.onsetTime < busyUntil()) return;
    const next = onHeard(ref.current, { midi: n.midi, time: n.onsetTime, attack: n.attack }, true);
    if (next === ref.current) return;
    ref.current = next;
    setSt(next);
    if (next.last?.kind === 'hit') {
      setWrong(null);
      buzz(next.done ? 'win' : 'good');
    } else {
      const t = FIRST[next.index];
      setWrong(`Not quite. ${t.where}.`);
      buzz('bad');
    }
  });
  const done = st.done || (!micOn && st.index >= FIRST.length);
  useCommands(done ? { ENTER: onNext } : {}, done);
  useEffect(() => {
    setDebug({ question: micOn && !st.done ? { id: `first-${st.index}`, acceptMidis: [targets[st.index]] } : null, micOn: mic.status === 'on' });
    return () => setDebug({ question: null });
  }, [st.index, st.done, micOn, mic.status, targets]);

  const cur = FIRST[Math.min(st.index, FIRST.length - 1)];
  const dots: NeckDot[] = FIRST.map((f, k) => ({ ...f, state: k < st.index ? 'done' : k === st.index && !done ? 'target' : 'normal' }));
  return (
    <>
      {done ? <Confetti count={50} /> : null}
      <Title sub={done ? "That's the start of A minor pentatonic: A, C and D. Lesson 1 plays the whole box." : micOn ? 'Three notes. Each one waits for you, take your time.' : 'Listen to the three notes. Without the mic, the app plays them for you.'}>
        {done ? 'You just played your first scale notes!' : 'Your first three notes'}
      </Title>
      <MiniNeck dots={dots} from={4} to={9} testID="ob-first-neck" />
      <View style={s.chips}>
        {FIRST.map((f, k) => (
          <View key={f.midi} style={[s.degree, { borderColor: k < st.index || done ? C.good : k === st.index ? C.accent : C.border }]}>
            <Text style={s.degreeName}>{f.name}</Text>
            <Text style={s.degreeInt}>{f.label}</Text>
          </View>
        ))}
      </View>
      {!done ? (
        <View style={s.coachBox} testID="ob-first-coach">
          <Text style={s.coachText}>{wrong ?? (micOn ? `${cur.where}.` : 'Tap Hear to listen.')}</Text>
        </View>
      ) : null}
      <View style={s.grow} />
      {done ? (
        <CmdButton title="Continue" cmd="ENTER" onPress={onNext} testID="ob-first-next" />
      ) : (
        <View style={{ gap: 8 }}>
          <CmdButton
            title={micOn ? `Hear ${cur.name}` : 'Hear the three notes'}
            icon="🔊"
            kind="secondary"
            onPress={async () => {
              if (micOn) playNote(cur.midi);
              else {
                await playNotes(targets, 0.6, 1.0);
                const s2 = { ...ref.current, index: FIRST.length, done: true };
                ref.current = s2;
                setTimeout(() => setSt(s2), 2000);
              }
            }}
            testID="ob-first-hear"
          />
          <CmdButton title="Skip" kind="ghost" small onPress={onNext} testID="ob-first-skip" />
        </View>
      )}
    </>
  );
}

function SignupStep({ fromWelcome, onLater, onSignedIn }: { fromWelcome: boolean; onLater: () => void; onSignedIn: () => void }) {
  const auth = useAuth();
  const { progress } = useProgress();
  const was = useRef(!!auth.session);
  useEffect(() => {
    if (auth.session && !was.current) onSignedIn();
    was.current = !!auth.session;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.session]);
  useCommands({ BACK: onLater });
  const exp = progress.onboarding.experience;
  return (
    <>
      <Text style={{ fontSize: 44, textAlign: 'center' }}>{fromWelcome ? '👋' : '🎉'}</Text>
      <Title sub={fromWelcome ? 'Sign in and your stars, streak and settings come back.' : FLOW.signup.hint + ' Phone, tablet and web.'}>{fromWelcome ? 'Welcome back' : 'Save your progress'}</Title>
      {!fromWelcome ? (
        <View style={s.summary}>
          <Text style={s.summaryText}>✓ First notes played</Text>
          <Text style={s.summaryText}>
            ✓ Level: {exp === 'all' ? 'all five boxes' : exp === 'box1' ? 'knows box 1' : 'new to it'} · Goal: {progress.onboarding.goalMin} min a day
          </Text>
        </View>
      ) : null}
      <SignIn />
      <View style={s.grow} />
      {auth.enabled ? (
        <CmdButton title={fromWelcome ? 'Back' : 'Later, play as a guest'} cmd="BACK" kind="ghost" onPress={onLater} testID="ob-later" />
      ) : (
        <CmdButton title="Start playing" onPress={onLater} testID="ob-later" />
      )}
    </>
  );
}

const s = StyleSheet.create({
  page: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 18, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: C.text, fontSize: 34, fontWeight: '300', marginTop: -6 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.border },
  dotOn: { width: 22, backgroundColor: C.accent },
  dotDone: { backgroundColor: C.accent2 },
  body: { flex: 1, gap: 16 },
  grow: { flexGrow: 1, minHeight: 8 },
  title: { color: C.text, fontSize: 28, fontWeight: '900', lineHeight: 33 },
  sub: { color: C.dim, fontSize: 16, lineHeight: 22 },
  fine: { color: C.faint, fontSize: 13, textAlign: 'center' },
  kicker: { color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  bullets: { gap: 10 },
  bullet: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  bulletText: { color: C.text, fontSize: 16, fontWeight: '600', flex: 1 },
  option: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: C.panel, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, padding: 14 },
  optionOn: { borderColor: C.accent, borderWidth: 2.5 },
  optionTitle: { color: C.text, fontSize: 17, fontWeight: '800' },
  optionSub: { color: C.faint, fontSize: 14 },
  seg: { flexDirection: 'row', backgroundColor: C.panel2, borderRadius: 14, padding: 4, gap: 4 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  segOn: { backgroundColor: C.accent },
  segText: { color: C.text, fontSize: 16, fontWeight: '900' },
  segSub: { color: C.faint, fontSize: 12, fontWeight: '700' },
  check: { flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 44 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: C.good, borderColor: C.good },
  tick: { color: '#fff', fontWeight: '900' },
  checkText: { color: C.text, fontSize: 15, flex: 1 },
  warn: { backgroundColor: '#FDECEA', borderRadius: 12, padding: 12 },
  warnText: { color: C.bad, fontSize: 15 },
  tuner: { alignItems: 'center', gap: 4, backgroundColor: C.panel, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16 },
  tunerNote: { color: C.text, fontSize: 64, fontWeight: '900', lineHeight: 70 },
  needleTrack: { width: '100%', height: 26, justifyContent: 'center' },
  needleMid: { position: 'absolute', left: '50%', width: 2, height: 26, backgroundColor: C.good, marginLeft: -1 },
  needle: { position: 'absolute', width: 12, height: 12, borderRadius: 6, marginLeft: -6, top: 7 },
  advice: { fontSize: 16, fontWeight: '800' },
  strings: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  stringChip: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' },
  stringOk: { backgroundColor: C.good, borderColor: C.good },
  stringText: { color: C.text, fontSize: 16, fontWeight: '900' },
  ringWrap: { alignItems: 'center', gap: 8 },
  ring: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: C.panel },
  ringFill: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(232,69,44,0.25)' },
  ringText: { color: C.accent, fontSize: 48, fontWeight: '900' },
  cmdRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cmdLetter: { width: 32, height: 30, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' },
  cmdLetterText: { color: C.text, fontWeight: '900', fontSize: 15 },
  cmdName: { color: C.text, fontWeight: '800', fontSize: 15, width: 60 },
  cmdWhat: { color: C.dim, fontSize: 14, flex: 1 },
  chips: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  degree: { borderWidth: 3, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4, alignItems: 'center', backgroundColor: C.panel, minWidth: 56 },
  degreeName: { color: C.text, fontSize: 22, fontWeight: '900' },
  degreeInt: { color: C.faint, fontSize: 13, fontWeight: '700' },
  coachBox: { backgroundColor: '#FFF6E0', borderColor: C.star, borderWidth: 1.5, borderRadius: 12, padding: 12 },
  coachText: { color: '#3D3200', fontSize: 15, fontWeight: '600' },
  summary: { backgroundColor: C.panel, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 12, gap: 4 },
  summaryText: { color: C.dim, fontSize: 14, fontWeight: '600' },
});
