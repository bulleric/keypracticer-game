import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme/colors';

export function AnswerPad({
  options,
  onAnswer,
  good,
  bad,
  disabled,
}: {
  options: string[];
  onAnswer: (v: string) => void;
  good?: string | null;
  bad?: string[];
  disabled?: boolean;
}) {
  const cols = options.length > 7 ? 6 : options.length;
  return (
    <View style={styles.wrap}>
      {options.map((o) => {
        const isGood = good === o;
        const isBad = bad?.includes(o);
        return (
          <Pressable
            key={o}
            testID={`pad-${o}`}
            accessibilityRole="button"
            accessibilityLabel={o}
            disabled={disabled}
            onPress={() => onAnswer(o)}
            style={({ pressed }) => [
              styles.key,
              { flexBasis: `${100 / cols - 2}%` },
              isGood && { backgroundColor: C.good, borderColor: C.good },
              isBad && { backgroundColor: C.bad, borderColor: C.bad },
              pressed && { transform: [{ scale: 0.95 }] },
            ]}
          >
            <Text style={[styles.label, (isGood || isBad) && { color: '#fff' }]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  key: {
    minWidth: 44,
    flexGrow: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.panel2,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  label: { color: C.text, fontSize: 20, fontWeight: '700' },
});
