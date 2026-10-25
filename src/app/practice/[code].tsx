import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Button, styles as ui } from '../../components/ui';
import type { PentaScale } from '../../practice/game';
import { PracticeGame } from '../../practice/PracticeGame';
import { configFromCode, PATTERNS } from '../../practice/theory';
import { useProgress } from '../../store/progress';
import { C } from '../../theme/colors';

/** Free play from a Keypracticer video code, e.g. /practice/FPS2UD80 (pentatonic scales only). */
export default function PracticeFromCode() {
  const { loaded } = useProgress();
  const { code } = useLocalSearchParams<{ code: string }>();
  const raw = String(code ?? '');
  const cfg = configFromCode(raw, raw.toUpperCase().includes('MP') ? 'Minor Pentatonic' : 'Major Pentatonic');
  if (!loaded) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (!cfg || !cfg.name.includes('Pentatonic') || !(PATTERNS as readonly string[]).includes(cfg.pattern)) {
    return (
      <Screen>
        <Text style={ui.h2}>Unknown practice code</Text>
        <Text style={ui.body}>"{raw}" is not a pentatonic exercise. Live Practice covers minor and major pentatonic for now.</Text>
        <Button title="Go to Live Practice" onPress={() => router.replace('/practice')} />
      </Screen>
    );
  }
  const bpm = Number(raw.match(/(\d{2,3})(?:-\d+)?$/)?.[1]) || 70;
  return (
    <PracticeGame
      levelId={null}
      setup={{ key: cfg.key, scale: cfg.name as PentaScale, position: cfg.position, pattern: cfg.pattern, mode: 'detect', bpm: bpm >= 40 && bpm <= 200 ? bpm : 70, perBeat: 2 }}
    />
  );
}
