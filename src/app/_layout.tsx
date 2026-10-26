import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ProgressProvider } from '../store/progress';
import { C } from '../theme/colors';

export default function RootLayout() {
  return (
    <ProgressProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: C.bg },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false, title: 'Keypracticer Game' }} />
        <Stack.Screen name="[code]" options={{ headerShown: false, title: 'Free play' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </ProgressProvider>
  );
}
