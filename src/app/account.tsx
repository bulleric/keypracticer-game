import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../account/auth';
import { SignIn } from '../account/SignIn';
import { useSyncStatus } from '../account/sync';
import { CmdButton } from '../components/CmdButton';
import { Screen } from '../components/Screen';
import { Card, styles as ui } from '../components/ui';
import { useCommands } from '../engine/useCommands';
import { totalPentaStars } from '../practice/game';
import { useProgress } from '../store/progress';
import { C } from '../theme/colors';

/** Sign up or sign in; when signed in: sync status, sign out, delete the account. */
export default function Account() {
  const auth = useAuth();
  const sync = useSyncStatus();
  const { progress } = useProgress();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  useCommands({ BACK: leave });

  if (!auth.session) {
    return (
      <Screen>
        <Text style={ui.h1}>Save your progress</Text>
        <Text style={ui.body}>
          Sign in to keep your {totalPentaStars(progress.penta)} stars, your streak and your settings on every device. Everything you did as a guest moves into the
          account.
        </Text>
        <SignIn />
      </Screen>
    );
  }

  const del = async () => {
    setBusy(true);
    setError(null);
    try {
      await auth.deleteAccount();
      setConfirm(false);
    } catch (e: any) {
      setError(e?.message ?? 'The account could not be deleted. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card style={{ gap: 6 }}>
        <Text style={ui.small}>SIGNED IN AS</Text>
        <Text style={s.name} testID="account-email">
          {auth.name ?? auth.email ?? 'Player'}
        </Text>
        {auth.name && auth.email ? <Text style={ui.body}>{auth.email}</Text> : null}
        <Text style={[s.sync, { color: sync === 'error' ? C.bad : C.good }]}>
          {sync === 'syncing' ? 'Saving…' : sync === 'error' ? 'Could not save to your account. We will try again.' : '✓ Progress saved to your account'}
        </Text>
      </Card>
      <CmdButton title="Sign out" kind="secondary" onPress={() => auth.signOut()} testID="sign-out" />
      <Text style={ui.small}>Signing out keeps your progress on this device.</Text>
      <Card style={{ gap: 8 }}>
        <Text style={ui.h2}>Delete account</Text>
        <Text style={ui.body}>Deletes your account and the progress saved in it. The progress on this device stays.</Text>
        {confirm ? (
          <View style={{ gap: 8 }}>
            <Text style={[ui.body, { color: C.bad, fontWeight: '700' }]}>This cannot be undone. Delete the account?</Text>
            <CmdButton title="Yes, delete my account" style={{ backgroundColor: C.bad }} onPress={del} disabled={busy} testID="delete-confirm" />
            <CmdButton title="Keep my account" kind="secondary" onPress={() => setConfirm(false)} />
          </View>
        ) : (
          <CmdButton title="Delete account" kind="secondary" onPress={() => setConfirm(true)} testID="delete-account" />
        )}
        {error ? <Text style={{ color: C.bad }}>{error}</Text> : null}
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  name: { color: C.text, fontSize: 22, fontWeight: '900' },
  sync: { fontSize: 14, fontWeight: '700' },
});
