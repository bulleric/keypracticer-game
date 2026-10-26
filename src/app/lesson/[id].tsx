import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { getLevel, isLevelOpen } from '../../practice/game';
import { LessonHome } from '../../practice/LessonHome';
import { useProgress } from '../../store/progress';
import { C } from '../../theme/colors';

/** The start screen of any open lesson (picked on the path). */
export default function Lesson() {
  const { progress, loaded, setPentaCurrent } = useProgress();
  const { id } = useLocalSearchParams<{ id: string }>();
  const level = getLevel(Number(id));
  const open = !!level && isLevelOpen(progress.penta, level.id);
  useEffect(() => {
    if (loaded && level && open) setPentaCurrent(level.id);
  }, [loaded, level, open, setPentaCurrent]);
  if (!loaded) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (!level || !open) return <Redirect href="/" />;
  return <LessonHome level={level} />;
}
