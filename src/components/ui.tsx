import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { C } from '../theme/colors';

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  style,
  testID,
  small,
}: {
  title: string;
  onPress?: () => void;
  kind?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
  small?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        kind === 'primary' && { backgroundColor: C.accent },
        kind === 'secondary' && { backgroundColor: C.panel2, borderColor: C.border, borderWidth: 1 },
        kind === 'ghost' && { backgroundColor: 'transparent' },
        pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Text style={[styles.btnText, small && { fontSize: 14 }, kind === 'primary' ? { color: C.onAccent } : { color: C.text }]}>
        {title}
      </Text>
    </Pressable>
  );
}

export function Stars({ n, size = 16, total = 3 }: { n: number; size?: number; total?: number }) {
  return (
    <Text style={{ fontSize: size, letterSpacing: 1 }} accessibilityLabel={`${n} of ${total} stars`}>
      {Array.from({ length: total }, (_, i) => (
        <Text key={i} style={{ color: i < n ? C.star : C.locked }}>
          ★
        </Text>
      ))}
    </Text>
  );
}

export function Hearts({ n, total = 3 }: { n: number; total?: number }) {
  return (
    <Text style={{ fontSize: 18 }} accessibilityLabel={`${n} hearts left`} testID="hearts">
      {Array.from({ length: total }, (_, i) => (
        <Text key={i} style={{ color: i < n ? C.bad : C.locked }}>
          ♥
        </Text>
      ))}
    </Text>
  );
}

export function ProgressBar({ value, color = C.accent, height = 6 }: { value: number; color?: string; height?: number }) {
  return (
    <View style={{ height, backgroundColor: C.panel2, borderRadius: height, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height, backgroundColor: color }} />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Shakes on `shakeKey` change, pops on `popKey` change. */
export function Juicy({ children, shakeKey, popKey }: { children: ReactNode; shakeKey: number; popKey: number }) {
  const x = useRef(new Animated.Value(0)).current;
  const s = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!shakeKey) return;
    Animated.sequence(
      [10, -10, 7, -7, 3, 0].map((v) => Animated.timing(x, { toValue: v, duration: 45, useNativeDriver: true })),
    ).start();
  }, [shakeKey, x]);
  useEffect(() => {
    if (!popKey) return;
    Animated.sequence([
      Animated.timing(s, { toValue: 1.04, duration: 90, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      Animated.timing(s, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
  }, [popKey, s]);
  return <Animated.View style={{ transform: [{ translateX: x }, { scale: s }] }}>{children}</Animated.View>;
}

const CONFETTI_COLORS = [C.accent, C.star, C.good, C.hint, C.bad, '#c77dff'];

export function Confetti({ count = 40 }: { count?: number }) {
  const pieces = useRef(
    Array.from({ length: count }, (_, i) => ({
      x: Math.random(),
      delay: Math.random() * 400,
      drift: (Math.random() - 0.5) * 80,
      rot: Math.random() * 360,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      v: new Animated.Value(0),
    })),
  ).current;
  useEffect(() => {
    Animated.parallel(
      pieces.map((p) =>
        Animated.timing(p.v, { toValue: 1, duration: 1800, delay: p.delay, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
      ),
    ).start();
  }, [pieces]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x * 100}%`,
            top: -20,
            width: 8,
            height: 14,
            borderRadius: 2,
            backgroundColor: p.color,
            opacity: p.v.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, 700] }) },
              { translateX: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: [`${p.rot}deg`, `${p.rot + 540}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  btnText: { fontSize: 17, fontWeight: '700' },
  card: {
    backgroundColor: C.panel,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  h1: { color: C.text, fontSize: 26, fontWeight: '800' },
  h2: { color: C.text, fontSize: 20, fontWeight: '700' },
  body: { color: C.dim, fontSize: 15, lineHeight: 21 },
  small: { color: C.faint, fontSize: 13 },
});
