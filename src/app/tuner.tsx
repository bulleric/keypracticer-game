import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { resumeAudio } from '../audio/context';
import { MicPanel } from '../components/MicPanel';
import { Screen } from '../components/Screen';
import { TunerGauge } from '../components/Tuner';
import { Button, Card, styles as ui } from '../components/ui';
import { MicService, useMicFrame, useMicState } from '../pitch/MicService';
import { STRINGS_LOW_TO_HIGH, STRING_NAMES, midiAt, noteLabel } from '../music/notes';
import { C } from '../theme/colors';

export default function TunerScreen() {
  const mic = useMicState();
  const frame = useMicFrame(20);
  useEffect(() => {
    // On phones the mic can start right away; browsers need a tap first.
    if (mic.status === 'off') MicService.start().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const heard = frame?.note?.midi;
  return (
    <Screen>
      <Card style={{ alignItems: 'center', gap: 12 }}>
        {mic.status === 'on' ? (
          <TunerGauge frame={frame} />
        ) : (
          <Button
            title="Start the mic"
            onPress={async () => {
              await resumeAudio().catch(() => {});
              await MicService.start();
            }}
            testID="start-mic"
          />
        )}
        <MicPanel />
      </Card>
      <Card style={{ gap: 8 }}>
        <Text style={ui.h2}>Standard tuning</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {STRINGS_LOW_TO_HIGH.map((s) => {
            const m = midiAt(s, 0);
            const close = heard !== undefined && Math.abs(heard - m) <= 1;
            return (
              <View key={s} style={{ alignItems: 'center', padding: 6, borderRadius: 10, backgroundColor: close ? C.panel2 : 'transparent' }}>
                <Text style={{ color: close ? C.accent2 : C.text, fontSize: 20, fontWeight: '800' }}>{noteLabel(m)}</Text>
                <Text style={ui.small}>
                  {s} · {STRING_NAMES[s]}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={ui.small}>Tip: a quiet room works best. An unplugged electric is quiet, so play close to the mic.</Text>
      </Card>
    </Screen>
  );
}
