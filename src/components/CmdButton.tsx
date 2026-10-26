import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { COMMANDS, type Command } from '../engine/commands';
import { soundControlOn, useCommandHold } from '../engine/useCommands';
import { C } from '../theme/colors';

/**
 * A button that also answers to an open guitar string. The letter chip shows
 * which string; while that string rings, the chip fills up.
 */
export function CmdButton({
  title,
  cmd,
  onPress,
  kind = 'primary',
  disabled,
  style,
  testID,
  small,
  icon,
}: {
  title: string;
  cmd?: Command;
  onPress?: () => void;
  kind?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
  small?: boolean;
  icon?: string;
}) {
  const primary = kind === 'primary';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={cmd && soundControlOn() ? `Or let the open ${COMMANDS[cmd].letter} string ring` : undefined}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        small && s.small,
        primary && { backgroundColor: C.accent },
        kind === 'secondary' && { backgroundColor: C.panel, borderColor: C.border, borderWidth: 1.5 },
        kind === 'ghost' && { backgroundColor: 'transparent' },
        pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      {icon ? <Text style={[s.text, small && s.smallText, { color: primary ? C.onAccent : C.text }]}>{icon}</Text> : null}
      <Text style={[s.text, small && s.smallText, { color: primary ? C.onAccent : kind === 'ghost' ? C.dim : C.text }]}>{title}</Text>
      {cmd ? <CmdChip cmd={cmd} light={primary} /> : null}
    </Pressable>
  );
}

export function CmdChip({ cmd, light }: { cmd: Command; light?: boolean }) {
  const hold = useCommandHold();
  if (!soundControlOn()) return null;
  const active = hold.cmd === cmd;
  return (
    <View style={[s.chip, light ? s.chipLight : s.chipDark]} accessibilityElementsHidden importantForAccessibility="no" testID={`chip-${cmd}`}>
      {active ? <View style={[s.fill, { width: `${Math.round(hold.progress * 100)}%`, backgroundColor: light ? 'rgba(255,255,255,0.55)' : C.accent }]} /> : null}
      <Text style={[s.chipText, { color: light ? C.onAccent : C.text }]}>{COMMANDS[cmd].letter}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14, minHeight: 50 },
  small: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 11, minHeight: 44, gap: 8 },
  text: { fontSize: 17, fontWeight: '800' },
  smallText: { fontSize: 14 },
  chip: { minWidth: 26, height: 24, paddingHorizontal: 6, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  chipLight: { borderColor: 'rgba(255,255,255,0.7)', backgroundColor: 'rgba(255,255,255,0.18)' },
  chipDark: { borderColor: C.border, backgroundColor: C.panel2 },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  chipText: { fontSize: 13, fontWeight: '900' },
});
