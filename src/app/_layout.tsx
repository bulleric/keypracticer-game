import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../account/auth';
import { SyncBridge } from '../account/sync';
import { ProgressProvider } from '../store/progress';
import { C } from '../theme/colors';

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProgressProvider>
        <SyncBridge />
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
          <Stack.Screen name="welcome" options={{ headerShown: false, title: 'Welcome', gestureEnabled: false }} />
          <Stack.Screen name="lesson/[id]" options={{ headerShown: false, title: 'Lesson' }} />
          <Stack.Screen name="learn/[id]" options={{ headerShown: false, title: 'Learn' }} />
          <Stack.Screen name="play/[id]" options={{ headerShown: false, title: 'Play' }} />
          <Stack.Screen name="path" options={{ title: 'Pentatonic Path' }} />
          <Stack.Screen name="account" options={{ title: 'Account' }} />
          <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
          <Stack.Screen name="[code]" options={{ headerShown: false, title: 'Free play' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        </Stack>
      </ProgressProvider>
    </AuthProvider>
  );
}
