import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { getLevel, startLevel } from '../practice/game';
import { LessonHome } from '../practice/LessonHome';
import { useProgress } from '../store/progress';
import { C } from '../theme/colors';

/** Home: onboarding the first time, then the start of your current lesson. */
export default function Home() {
  const { progress, loaded } = useProgress();
  if (!loaded) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (!progress.onboarding.done) return <Redirect href="/welcome" />;
  const level = getLevel(startLevel(progress.penta)) ?? getLevel(1)!;
  return <LessonHome level={level} />;
}
