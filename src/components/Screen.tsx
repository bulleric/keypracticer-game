import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme/colors';

/** Scrolling page with a max width, so it looks right on phones and desktop browsers. */
export function Screen({ children, scroll = true, top = false }: { children: ReactNode; scroll?: boolean; top?: boolean }) {
  const insets = useSafeAreaInsets();
  const inner = (
    <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: 16, paddingTop: top ? insets.top + 12 : 12, paddingBottom: insets.bottom + 24, gap: 16 }}>
      {children}
    </View>
  );
  if (!scroll) return <View style={{ flex: 1, backgroundColor: C.bg }}>{inner}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ flexGrow: 1 }}>
      {inner}
    </ScrollView>
  );
}
