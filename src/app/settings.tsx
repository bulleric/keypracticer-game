import { router } from 'expo-router';
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useAuth } from '../account/auth';
import { MicService } from '../pitch/MicService';
import { Screen } from '../components/Screen';
import { Button, Card, styles as ui } from '../components/ui';
import { useProgress, type Settings } from '../store/progress';
import { C } from '../theme/colors';

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{label}</Text>
        {sub ? <Text style={ui.small}>{sub}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Toggle({ k, settings, update }: { k: keyof Settings; settings: Settings; update: (s: Partial<Settings>) => void }) {
  return (
    <Switch
      testID={`toggle-${k}`}
      value={settings[k] as boolean}
      onValueChange={(v) => update({ [k]: v } as Partial<Settings>)}
      trackColor={{ true: C.accent, false: C.border }}
      thumbColor="#fff"
    />
  );
}

function Choice<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {options.map((o) => (
        <Pressable
          key={String(o.v)}
          onPress={() => onChange(o.v)}
          style={[s.chip, value === o.v && { backgroundColor: C.accent, borderColor: C.accent }]}
        >
          <Text style={[s.chipText, value === o.v && { color: C.onAccent }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function SettingsScreen() {
  const { progress, updateSettings, updateOnboarding, reset } = useProgress();
  const auth = useAuth();
  const st = progress.settings;
  const micOff = progress.onboarding.mic === 'denied';
  const confirmReset = () => {
    if (Platform.OS === 'web') {
      if ((globalThis as any).confirm?.('Reset all stars, badges and XP?')) reset();
      return;
    }
    Alert.alert('Reset progress?', 'All stars, badges and XP will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: reset },
    ]);
  };
  return (
    <Screen>
      <Card style={{ gap: 4 }}>
        <Text style={ui.h2}>Microphone</Text>
        <Row label="Sensitivity" sub="Raise it for a quiet guitar, lower it in a noisy room.">
          <Choice<number>
            value={st.sensitivity}
            onChange={(v) => updateSettings({ sensitivity: v })}
            options={[
              { v: 0.2, label: 'Low' },
              { v: 0.5, label: 'Mid' },
              { v: 0.8, label: 'High' },
            ]}
          />
        </Row>
        <Row label="Forgive octave jumps" sub="Accept the right note one octave off (the mic sometimes hears the octave).">
          <Toggle k="forgiveOctave" settings={st} update={updateSettings} />
        </Row>
        <Row label="Timing offset" sub="If Metronome mode always says late, move this left.">
          <Choice<number>
            value={st.latencyMs}
            onChange={(v) => updateSettings({ latencyMs: v })}
            options={[
              { v: -50, label: '-50' },
              { v: 0, label: '0' },
              { v: 50, label: '+50' },
              { v: 100, label: '+100' },
            ]}
          />
        </Row>
      </Card>
      <Card style={{ gap: 4 }}>
        <Text style={ui.h2}>Sound control</Text>
        <Row label="Guitar as a remote" sub="Between runs, open strings work as buttons: E Enter, A Again, D Demo, G Guide, B Back.">
          <Toggle k="soundControl" settings={st} update={updateSettings} />
        </Row>
        {micOff ? (
          <Row label="The mic is off" sub="You said no to the mic. Turn it on to play lessons and use sound control.">
            <Button
              small
              title="Turn on"
              onPress={() => {
                updateOnboarding({ mic: 'granted' });
                MicService.start();
              }}
              testID="settings-mic-on"
            />
          </Row>
        ) : null}
      </Card>
      <Card style={{ gap: 4 }}>
        <Text style={ui.h2}>Account</Text>
        <Row label={auth.session ? auth.email ?? 'Signed in' : 'Playing as a guest'} sub={auth.session ? 'Your progress is saved to your account.' : 'Sign in to keep your progress on every device.'}>
          <Button small kind="secondary" title={auth.session ? 'Manage' : 'Sign in'} onPress={() => router.push('/account')} testID="settings-account" />
        </Row>
        <Row label="Intro" sub="Go through the welcome screens again: level, daily goal, mic and tuning.">
          <Button
            small
            kind="secondary"
            title="Replay"
            onPress={() => {
              updateOnboarding({ done: false, step: 1 });
              router.replace('/welcome');
            }}
            testID="settings-replay-intro"
          />
        </Row>
      </Card>
      <Card style={{ gap: 4 }}>
        <Text style={ui.h2}>Progress</Text>
        <Button title="Reset progress" kind="secondary" onPress={confirmReset} style={{ marginTop: 8 }} />
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  label: { color: C.text, fontSize: 16, fontWeight: '600' },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.panel2 },
  chipText: { color: C.text, fontWeight: '700', fontSize: 13 },
});
