import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ProgressProvider } from '../store/progress';
import { C } from '../theme/colors';

export default function RootLayout() {
  return (
    <ProgressProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: C.bg },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false, title: 'NoteTrainer' }} />
        <Stack.Screen name="level/[id]" options={{ title: '' }} />
        <Stack.Screen name="tuner" options={{ title: 'Tuner' }} />
        <Stack.Screen name="rush" options={{ title: 'Note Rush' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </ProgressProvider>
  );
}
