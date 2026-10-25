import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { buzz } from '../../audio/haptics';
import { resumeAudio } from '../../audio/context';
import { MicPanel } from '../../components/MicPanel';
import { QuizPlayer } from '../../components/QuizPlayer';
import { RhythmPlayer } from '../../components/RhythmPlayer';
import { Screen } from '../../components/Screen';
import { Button, Card, Confetti, Stars, styles as ui } from '../../components/ui';
import { playerLevel } from '../../game/xp';
import { MicService, useMicState } from '../../pitch/MicService';
import { getLevel, isRhythmLevel } from '../../quiz/levels';
import type { RoundSummary } from '../../quiz/round';
import type { Level } from '../../quiz/types';
import { isUnlocked, useProgress } from '../../store/progress';
import { C } from '../../theme/colors';

function passText(l: Level): string {
  const p = l.pass;
  if (p.kind === 'streak') return `${p.count} in a row on time`;
  if (p.kind === 'reachBpm') return `Reach ${p.bpm} BPM`;
  const parts = [p.min >= 1 ? `${l.questions}/${l.questions} correct` : `${Math.round(p.min * 100)}% correct`];
  if (p.avgSecondsMax) parts.push(`under ${p.avgSecondsMax} s each`);
  if (p.totalSecondsMax) parts.push(`in under ${p.totalSecondsMax} s`);
  return parts.join(', ');
}

export default function LevelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const level = getLevel(Number(id));
  const { progress, loaded, recordRound } = useProgress();
  const mic = useMicState();
  const [phase, setPhase] = useState<'intro' | 'play' | 'done'>('intro');
  const [summary, setSummary] = useState<RoundSummary | null>(null);
  const [extra, setExtra] = useState<{ newBest: boolean; unlockedNext: boolean } | null>(null);
  const [tapMode, setTapMode] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [xpBefore, setXpBefore] = useState(0);

  useEffect(() => {
    setPhase('intro');
    setSummary(null);
  }, [id]);

  if (!level) {
    return (
      <Screen>
        <Text style={ui.h2}>Level not found</Text>
        <Button title="Back to the map" onPress={() => router.replace('/')} />
      </Screen>
    );
  }
  if (loaded && !isUnlocked(progress, level.id)) {
    return (
      <Screen>
        <Text style={ui.h2}>🔒 Locked</Text>
        <Text style={ui.body}>Finish the previous level first.</Text>
        <Button title="Back to the map" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const wantsMic = level.usesMic && progress.settings.guitarMode && !tapMode;
  const micOn = wantsMic && mic.status === 'on';

  const start = async () => {
    await resumeAudio().catch(() => {});
    if (wantsMic) await MicService.start();
    setXpBefore(progress.xp);
    setRunKey((k) => k + 1);
    setPhase('play');
  };

  const onDone = (s: RoundSummary) => {
    const r = recordRound(level.id, s);
    setSummary(s);
    setExtra(r);
    setPhase('done');
    buzz(s.passed ? 'win' : 'bad');
  };

  const next = getLevel(level.id + 1);
  const title = `${level.id}. ${level.title}`;
  const plBefore = playerLevel(xpBefore);
  const plAfter = playerLevel(progress.xp);

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      {phase === 'intro' && (
        <Card style={{ gap: 12 }}>
          <Text style={s.kicker}>
            WORLD {level.world} · LEVEL {level.id}
            {level.boss ? ' · BOSS' : ''}
          </Text>
          <Text style={ui.h1}>{level.title}</Text>
          <Text style={ui.body}>{level.description}</Text>
          <Text style={s.goal}>Goal: {passText(level)}</Text>
          {level.boss ? <Text style={s.boss}>♥♥♥ Boss level: 3 hearts and the clock speeds up. Lose all hearts and you retry.</Text> : null}
          {level.bpm ? <Text style={ui.small}>Metronome: {level.bpm} BPM. Turn the sound up.</Text> : null}
          {level.usesMic ? (
            progress.settings.guitarMode && !tapMode ? (
              <View style={{ gap: 6 }}>
                <Text style={ui.small}>🎸 Grab your guitar. This level listens through the microphone.</Text>
                <MicPanel onUseTaps={() => setTapMode(true)} />
              </View>
            ) : (
              <Text style={ui.small}>Tap mode: you answer by tapping the fret on the board. Turn on Guitar mode in Settings to play.</Text>
            )
          ) : null}
          <Stars n={progress.levels[level.id]?.stars ?? 0} size={22} />
          <Button title={mic.status === 'starting' ? 'Starting mic…' : 'Start'} onPress={start} testID="start" disabled={mic.status === 'starting'} />
        </Card>
      )}

      {phase === 'play' &&
        (wantsMic && !micOn ? (
          <Card style={{ gap: 12 }}>
            <MicPanel onUseTaps={() => setTapMode(true)} />
            <Button title="Back" kind="secondary" onPress={() => setPhase('intro')} />
          </Card>
        ) : isRhythmLevel(level) ? (
          <RhythmPlayer key={runKey} level={level} micOn={micOn} onDone={onDone} />
        ) : (
          <QuizPlayer key={runKey} level={level} micOn={micOn} onDone={onDone} />
        ))}

      {phase === 'done' && summary && (
        <View>
          <Card style={{ gap: 12, alignItems: 'center' }}>
            <Text style={[ui.h1, { color: summary.passed ? C.good : C.bad }]} testID="result-title">
              {summary.passed ? (summary.stars === 3 ? 'Perfect!' : 'Level clear!') : 'Not yet'}
            </Text>
            <Stars n={summary.stars} size={40} />
            {summary.reason && !summary.passed ? <Text style={ui.body}>{summary.reason}</Text> : null}
            <View style={s.stats}>
              <Stat label="Correct" value={`${Math.round(summary.accuracy * 100)}%`} />
              <Stat label="Avg time" value={`${summary.avgSeconds.toFixed(1)} s`} />
              <Stat label="Best combo" value={String(summary.bestStreak)} />
              <Stat label="XP" value={`+${summary.points}`} />
            </View>
            {extra?.newBest && summary.points > 0 ? <Text style={s.best}>New best score!</Text> : null}
            {plAfter.level > plBefore.level ? <Text style={s.best}>Player level up: {plAfter.title}!</Text> : null}
            {extra?.unlockedNext && next ? <Text style={s.unlock}>Unlocked: {next.title}</Text> : null}
            <Text style={ui.small}>★ pass · ★★ fast · ★★★ fast with no mistakes or hints</Text>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button title="Retry" kind="secondary" onPress={start} testID="retry" />
              {summary.passed && next && isUnlocked(progress, next.id) ? (
                <Button title="Next level" onPress={() => router.replace(`/level/${next.id}`)} testID="next" />
              ) : null}
              <Button title="Map" kind="secondary" onPress={() => router.replace('/')} testID="map" />
            </View>
          </Card>
          {summary.stars === 3 ? <Confetti /> : null}
        </View>
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', minWidth: 70 }}>
      <Text style={{ color: C.text, fontSize: 20, fontWeight: '800' }}>{value}</Text>
      <Text style={ui.small}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  kicker: { color: C.accent, fontWeight: '800', letterSpacing: 1.2, fontSize: 12 },
  goal: { color: C.text, fontWeight: '700' },
  boss: { color: C.bad, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  best: { color: C.accent2, fontWeight: '800' },
  unlock: { color: C.good, fontWeight: '800' },
});
