import { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { CmdButton } from '../components/CmdButton';
import { C } from '../theme/colors';
import { useAuth, type Provider } from './auth';

/**
 * Sign up or sign in: Apple, Google, or a 6 digit code by email. No passwords.
 * The screen around it reacts to the new session (useAuth().session).
 */
export function SignIn() {
  const auth = useAuth();
  const [step, setStep] = useState<'choose' | 'email' | 'code'>('choose');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!auth.enabled) {
    return (
      <View style={s.note} testID="accounts-off">
        <Text style={s.noteText}>Accounts are not switched on in this version yet. Your progress is saved on this device, and moves into your account when sign-up arrives.</Text>
      </View>
    );
  }

  const run = async (fn: () => Promise<void>, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      after?.();
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') setError(e?.message ?? 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const provider = (p: Provider) => run(() => auth.signInWith(p));
  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  return (
    <View style={{ gap: 10 }} testID="sign-in">
      {step === 'choose' ? (
        <>
          {Platform.OS !== 'android' ? (
            <CmdButton title="Continue with Apple" kind="primary" style={{ backgroundColor: '#16181D' }} onPress={() => provider('apple')} disabled={busy} testID="signin-apple" />
          ) : null}
          <CmdButton title="Continue with Google" kind="secondary" onPress={() => provider('google')} disabled={busy} testID="signin-google" />
          <CmdButton title="✉  Continue with email" kind="secondary" onPress={() => setStep('email')} disabled={busy} testID="signin-email" />
          <Text style={s.small}>No password. With email you get a 6 digit code.</Text>
        </>
      ) : null}

      {step === 'email' ? (
        <>
          <Text style={s.label}>Your email</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={C.faint}
            accessibilityLabel="Email"
            testID="email-input"
            onSubmitEditing={() => validEmail && run(() => auth.sendEmailCode(email), () => setStep('code'))}
          />
          <CmdButton title="Send me a code" onPress={() => run(() => auth.sendEmailCode(email), () => setStep('code'))} disabled={busy || !validEmail} testID="email-send" />
          <CmdButton title="Other ways to sign in" kind="ghost" small onPress={() => setStep('choose')} />
        </>
      ) : null}

      {step === 'code' ? (
        <>
          <Text style={s.label}>Enter the 6 digit code we sent to {email.trim()}</Text>
          <TextInput
            style={[s.input, s.codeInput]}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            placeholder="123456"
            placeholderTextColor={C.faint}
            accessibilityLabel="Code from the email"
            testID="code-input"
          />
          <CmdButton title="Sign in" onPress={() => run(() => auth.verifyEmailCode(email, code))} disabled={busy || code.length !== 6} testID="code-verify" />
          <CmdButton title="Send a new code" kind="ghost" small onPress={() => run(() => auth.sendEmailCode(email))} disabled={busy} />
        </>
      ) : null}

      {busy ? <ActivityIndicator color={C.accent} /> : null}
      {error ? (
        <Text style={s.error} accessibilityLiveRegion="polite" testID="signin-error">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  note: { backgroundColor: C.panel, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14 },
  noteText: { color: C.dim, fontSize: 15, lineHeight: 21 },
  small: { color: C.faint, fontSize: 13, textAlign: 'center' },
  label: { color: C.text, fontSize: 15, fontWeight: '700' },
  input: { backgroundColor: C.panel, borderColor: C.border, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, color: C.text },
  codeInput: { fontSize: 26, letterSpacing: 8, textAlign: 'center', fontWeight: '800' },
  error: { color: C.bad, fontSize: 14, fontWeight: '600' },
});
