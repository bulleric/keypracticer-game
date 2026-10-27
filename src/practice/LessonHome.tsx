import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../account/auth';
import { CmdButton } from '../components/CmdButton';
import { ProgressBar, Stars } from '../components/ui';
import { FLOW } from '../engine/flow';
import { useCommands } from '../engine/useCommands';
import { playerLevel } from '../game/xp';
import { todaySeconds } from '../store/model';
import { useProgress } from '../store/progress';
import { C } from '../theme/colors';
import { totalPentaStars, WORLDS, type Level } from './game';
import { nextRung, rungsFor, theoryFor, type Rung } from './lessons';

/**
 * The lesson start: where you are on the path, the lesson ladder
 * (Learn, Listen, Play), today's goal, and one big button.
 */
export function LessonHome({ level }: { level: Level }) {
  const insets = useSafeAreaInsets();
  const { progress } = useProgress();
  const auth = useAuth();
  const p = progress.penta;
  const rungs = rungsFor(level, progress.rungs[level.id], p);
  const next = nextRung(level, progress.rungs[level.id], p);
  const rec = p.levels[level.id];
  const card = theoryFor(level.id)[0];
  const world = WORLDS.find((w) => w.id === level.world);
  const today = todaySeconds(progress);
  const goal = progress.onboarding.goalMin * 60;
  const pl = playerLevel(progress.xp);
  const runLabel = level.setup.mode === 'metronome' ? 'On the beat' : 'Play';
  const noMic = progress.onboarding.mic === 'denied';

  const open = (r: Rung) => {
    if (r === 'learn') router.push(`/learn/${level.id}`);
    else if (r === 'listen') router.push(`/play/${level.id}?view=listen`);
    else router.push(`/play/${level.id}`);
  };
  const primary =
    next === 'learn'
      ? { title: 'Start: learn the idea', icon: '📘' }
      : next === 'listen'
        ? { title: 'Listen to it first', icon: '👂' }
        : { title: rec?.stars ? `${runLabel} again` : runLabel, icon: level.setup.mode === 'metronome' ? '🥁' : '🎸' };

  useCommands({
    ENTER: () => open(next),
    DEMO: () => open('listen'),
    GUIDE: () => open('learn'),
    BACK: () => router.push('/path'),
  });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerShown: false, title: level.title }} />
      <ScrollView contentContainerStyle={[s.page, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24 }]}>
        <View style={s.top}>
          <View style={{ flex: 1 }}>
            <Text style={s.kicker}>
              WORLD {level.world} · LESSON {level.id}
              {level.boss ? ' · BOSS 👑' : ''}
            </Text>
            <Text style={s.title} accessibilityRole="header" testID="lesson-title">
              {level.title}
            </Text>
          </View>
          <Pressable onPress={() => router.push('/account')} style={s.pill} accessibilityRole="button" accessibilityLabel={auth.session ? 'Account' : 'Sign up'} testID="open-account">
            <Text style={s.pillText}>{auth.session ? '👤' : '☁︎'}</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/settings')} style={s.pill} accessibilityRole="button" accessibilityLabel="Settings" testID="open-settings">
            <Text style={s.pillText}>⚙</Text>
          </Pressable>
        </View>
        <View style={s.statsRow}>
          <Text style={s.stat}>🔥 {p.streak.count} day{p.streak.count === 1 ? '' : 's'}</Text>
          <Text style={s.stat}>⭐ {totalPentaStars(p)}</Text>
          <Text style={[s.stat, { color: C.hint }]}>
            Lv {pl.level} {pl.title}
          </Text>
        </View>

        <View style={s.goal} testID="home-goal">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={s.kicker}>TODAY</Text>
            <Text style={s.kicker}>
              {Math.round(today / 60)} OF {progress.onboarding.goalMin} MIN
            </Text>
          </View>
          <ProgressBar value={today / goal} color={C.accent} />
        </View>

        <View style={s.ladder} accessibilityLabel="Lesson steps">
          {rungs.map((r, k) => {
            const now = r.id === next && !r.done;
            return (
              <Pressable
                key={r.id}
                onPress={() => open(r.id)}
                style={[s.rung, r.done && s.rungDone, now && s.rungNow]}
                accessibilityRole="button"
                accessibilityLabel={`${r.label}${r.done ? ', done' : ''}`}
                testID={`rung-${r.id}`}
              >
                <Text style={[s.rungNum, (r.done || now) && { color: C.onAccent }]}>{r.done ? '✓' : k + 1}</Text>
                <Text style={[s.rungLabel, (r.done || now) && { color: C.onAccent }]}>{r.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={s.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Stars n={rec?.stars ?? 0} size={22} />
            <Text style={s.best}>{rec ? `best ${rec.best}` : 'not played yet'}</Text>
          </View>
          <Text style={s.meta}>
            {level.setup.key} {level.setup.scale.toLowerCase()} · box {level.setup.position} · {level.setup.pattern.toLowerCase()} ·{' '}
            {level.setup.mode === 'metronome' ? `${level.setup.bpm} BPM${level.setup.perBeat === 2 ? ', 2 notes per click' : ''}` : 'each note waits for you'}
          </Text>
        </View>

        {card ? (
          <Pressable style={s.card} onPress={() => open('learn')} accessibilityRole="button" testID="home-idea">
            <Text style={s.kicker}>THE IDEA</Text>
            <Text style={s.ideaTitle}>{card.title}</Text>
            <Text style={s.idea} numberOfLines={3}>
              {card.body}
            </Text>
          </Pressable>
        ) : null}

        <View style={s.tip}>
          <Text style={s.tipText}>💡 {level.tip}</Text>
        </View>

        {noMic ? (
          <View style={s.tip}>
            <Text style={s.tipText}>The mic is off, so lessons can only be heard. Turn it on in Play mode or in Settings.</Text>
          </View>
        ) : null}

        <CmdButton title={primary.title} icon={primary.icon} cmd="ENTER" onPress={() => open(next)} testID="lesson-go" />
        <View style={s.row}>
          <CmdButton small kind="secondary" title="Listen" cmd="DEMO" onPress={() => open('listen')} style={{ flex: 1 }} testID="lesson-listen" />
          <CmdButton small kind="secondary" title="Theory" cmd="GUIDE" onPress={() => open('learn')} style={{ flex: 1 }} testID="lesson-learn" />
          <CmdButton small kind="secondary" title="Path" cmd="BACK" onPress={() => router.push('/path')} style={{ flex: 1 }} testID="lesson-path" />
        </View>
        {next !== 'run' ? (
          <CmdButton small kind="ghost" title={`Skip to ${runLabel}`} onPress={() => open('run')} testID="lesson-play" />
        ) : null}
        <Text style={s.hint}>{progress.settings.soundControl && !noMic ? FLOW.lessonHome.hint : 'Tap a step to start.'}</Text>
        {world ? <Text style={s.hint}>{`${world.name}: ${world.subtitle}`}</Text> : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 16, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kicker: { color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: C.text, fontSize: 28, fontWeight: '900' },
  pill: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 18, color: C.text },
  statsRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  stat: { color: C.text, fontWeight: '800', fontSize: 14 },
  goal: { gap: 6 },
  ladder: { flexDirection: 'row', gap: 8 },
  rung: { flex: 1, backgroundColor: C.panel2, borderRadius: 12, paddingVertical: 10, alignItems: 'center', gap: 2, minHeight: 56 },
  rungDone: { backgroundColor: C.good },
  rungNow: { backgroundColor: C.accent },
  rungNum: { color: C.dim, fontWeight: '900', fontSize: 15 },
  rungLabel: { color: C.dim, fontWeight: '800', fontSize: 13 },
  card: { backgroundColor: C.panel, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, gap: 6 },
  best: { color: C.faint, fontWeight: '700' },
  meta: { color: C.dim, fontSize: 14 },
  ideaTitle: { color: C.text, fontSize: 18, fontWeight: '900' },
  idea: { color: C.dim, fontSize: 15, lineHeight: 21 },
  tip: { backgroundColor: C.panel, borderRadius: 12, padding: 12, borderLeftWidth: 4, borderLeftColor: C.star },
  tipText: { color: C.dim, fontSize: 14 },
  row: { flexDirection: 'row', gap: 8 },
  hint: { color: C.faint, fontSize: 13, textAlign: 'center' },
});
