import { Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Button, Card, styles as ui } from '../components/ui';
import { useProgress, type Settings } from '../store/progress';
import type { StringStyle } from '../quiz/types';
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
          <Text style={[s.chipText, value === o.v && { color: '#1d140a' }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function SettingsScreen() {
  const { progress, updateSettings, reset } = useProgress();
  const st = progress.settings;
  const confirmReset = () => {
    if (Platform.OS === 'web') {
      if ((globalThis as any).confirm?.('Reset all stars and XP?')) reset();
      return;
    }
    Alert.alert('Reset progress?', 'All stars and XP will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: reset },
    ]);
  };
  return (
    <Screen>
      <Card style={{ gap: 4 }}>
        <Row label="🎸 Guitar mode" sub="Answer play-it levels on your guitar through the mic. Off: tap the fret instead.">
          <Toggle k="guitarMode" settings={st} update={updateSettings} />
        </Row>
        <Row label="Voice prompts" sub='Say prompts out loud, like "G on the D string".'>
          <Toggle k="voice" settings={st} update={updateSettings} />
        </Row>
        <Row label="Call strings by">
          <Choice<StringStyle>
            value={st.stringStyle}
            onChange={(v) => updateSettings({ stringStyle: v })}
            options={[
              { v: 'name', label: 'Name' },
              { v: 'number', label: 'Number' },
              { v: 'mixed', label: 'Both' },
            ]}
          />
        </Row>
      </Card>
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
        <Row label="Forgive octave jumps" sub="Worlds 1-2: accept the right note one octave off.">
          <Toggle k="forgiveOctave" settings={st} update={updateSettings} />
        </Row>
        <Row label="Timing offset" sub="If the beat drill always says late, move this left.">
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
        <Text style={ui.h2}>Progress</Text>
        <Row label="Practice mode" sub="Open every level without unlocking it.">
          <Toggle k="unlockAll" settings={st} update={updateSettings} />
        </Row>
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
