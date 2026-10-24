import { Platform, StyleSheet, Text, View } from 'react-native';
import { MicService, useMicFrame, useMicState } from '../pitch/MicService';
import { C } from '../theme/colors';
import { Button, ProgressBar } from './ui';

/** Mic status, a level meter, and what to do when the mic is not available. */
export function MicPanel({ onUseTaps }: { onUseTaps?: () => void }) {
  const st = useMicState();
  const frame = useMicFrame(15);
  if (st.status === 'on') {
    const level = frame ? Math.min(1, Math.sqrt(frame.rms) * 3) : 0;
    return (
      <View style={s.row} testID="mic-on">
        <Text style={s.on}>● Mic on</Text>
        <View style={{ flex: 1 }}>
          <ProgressBar value={level} color={C.good} />
        </View>
        <Text style={s.heard}>{frame?.note ? `${frame.note.name}${frame.note.octave}` : ''}</Text>
      </View>
    );
  }
  if (st.status === 'error') {
    const tip =
      st.errorCode === 'denied'
        ? Platform.OS === 'web'
          ? 'Allow the microphone in your browser (the icon left of the address bar), then try again.'
          : 'Allow the microphone for NoteTrainer in your phone settings, then try again.'
        : st.error;
    return (
      <View style={{ gap: 8 }} testID="mic-error">
        <Text style={s.err}>Microphone not available. {tip}</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button small kind="secondary" title="Try again" onPress={() => MicService.start()} />
          {onUseTaps ? <Button small kind="secondary" title="Tap the board instead" onPress={onUseTaps} testID="use-taps" /> : null}
        </View>
      </View>
    );
  }
  return (
    <Text style={s.off}>{st.status === 'starting' ? 'Starting the mic…' : 'The mic starts when you press Start.'}</Text>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  on: { color: C.good, fontWeight: '700' },
  heard: { color: C.dim, width: 40, textAlign: 'right' },
  err: { color: C.bad },
  off: { color: C.faint },
});
