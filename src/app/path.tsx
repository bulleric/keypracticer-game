import { router } from 'expo-router';
import { Screen } from '../components/Screen';
import { useCommands } from '../engine/useCommands';
import { getLevel, startLevel } from '../practice/game';
import { LevelsPanel } from '../practice/PracticeGame';
import { useProgress } from '../store/progress';

/** The whole Pentatonic Path: worlds, lessons, stars and badges. */
export default function Path() {
  const { progress } = useProgress();
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  useCommands({
    ENTER: () => router.push(`/lesson/${getLevel(startLevel(progress.penta))?.id ?? 1}`),
    BACK: leave,
  });
  return (
    <Screen>
      <LevelsPanel current={progress.penta.current} onPick={(l) => router.push(`/lesson/${l.id}`)} />
    </Screen>
  );
}
