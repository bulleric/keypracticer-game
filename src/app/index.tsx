import { View } from 'react-native';
import { getLevel, startLevel } from '../practice/game';
import { PracticeGame } from '../practice/PracticeGame';
import { useProgress } from '../store/progress';
import { C } from '../theme/colors';

/** Live Practice opens straight into your current Pentatonic Path level. */
export default function PracticeScreen() {
  const { progress, loaded } = useProgress();
  if (!loaded) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  const level = getLevel(startLevel(progress.penta)) ?? getLevel(1)!;
  return <PracticeGame levelId={level.id} setup={level.setup} />;
}
