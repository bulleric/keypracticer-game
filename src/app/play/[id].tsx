import { Redirect, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { getLevel } from '../../practice/game';
import { PracticeGame } from '../../practice/PracticeGame';
import { useProgress } from '../../store/progress';
import { C } from '../../theme/colors';

/** A lesson's run (Play or On the beat), or its Listen view with ?view=listen. */
export default function Play() {
  const { loaded } = useProgress();
  const { id, view } = useLocalSearchParams<{ id: string; view?: string }>();
  const level = getLevel(Number(id));
  if (!loaded) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (!level) return <Redirect href="/" />;
  return <PracticeGame key={`${level.id}-${view}`} levelId={level.id} setup={level.setup} initialView={view === 'listen' ? 'listen' : 'run'} />;
}
