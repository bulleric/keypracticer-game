import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export function buzz(kind: 'good' | 'bad' | 'win') {
  if (Platform.OS === 'web') return;
  try {
    if (kind === 'good') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (kind === 'bad') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}
