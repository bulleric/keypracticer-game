import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CmdButton } from '../../components/CmdButton';
import { MiniNeck } from '../../components/MiniNeck';
import { useCommands } from '../../engine/useCommands';
import { getLevel, toExercise } from '../../practice/game';
import { playHear } from '../../practice/hear';
import { theoryFor } from '../../practice/lessons';
import { buildExercise } from '../../practice/theory';
import { useProgress } from '../../store/progress';
import { C } from '../../theme/colors';

/** Learn: the lesson's theory cards. One idea, one picture, one sound. */
export default function Learn() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const level = getLevel(Number(id));
  const { progress, markRung, addPracticeTime } = useProgress();
  const cards = level ? theoryFor(level.id) : [];
  const [k, setK] = useState(0);
  const exercise = useMemo(() => (level ? buildExercise(toExercise(level.setup)) : null), [level]);
  const card = cards[k];

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const gotIt = () => {
    if (!level) return leave();
    if (k < cards.length - 1) return setK(k + 1);
    markRung(level.id, 'learn');
    addPracticeTime(30);
    // Walk up the ladder: Listen next, unless already done.
    if (!progress.rungs[level.id]?.listen) router.replace(`/play/${level.id}?view=listen`);
    else router.replace(`/play/${level.id}`);
  };
  const hear = () => card && exercise && playHear(card.hear, exercise);
  useCommands({ ENTER: gotIt, DEMO: hear, BACK: leave });

  if (!level || !card || !exercise) {
    return (
      <View style={[s.page, { paddingTop: insets.top + 20 }]}>
        <Text style={s.title}>No theory for this lesson yet</Text>
        <CmdButton title="Back" onPress={leave} />
      </View>
    );
  }
  const dots = exercise.box.map((n) => ({
    string: n.string,
    fret: n.fret,
    label: n.interval,
    state: card.emphasize.length === 0 ? ('normal' as const) : card.emphasize.includes(n.interval) ? ('big' as const) : ('faint' as const),
  }));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerShown: false, title: 'Learn' }} />
      <ScrollView contentContainerStyle={[s.page, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24 }]}>
        <View style={s.top}>
          <Pressable onPress={leave} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" testID="learn-back">
            <Text style={s.back}>‹</Text>
          </Pressable>
          <Text style={s.kicker}>
            LEARN · {k + 1} OF {cards.length} · LESSON {level.id}
          </Text>
        </View>
        <Text style={s.title} accessibilityRole="header" testID="learn-title">
          {card.title}
        </Text>
        <MiniNeck dots={dots} />
        <Text style={s.body}>{card.body}</Text>
        <View style={s.listen}>
          <Text style={s.kicker}>LISTEN FOR</Text>
          <Text style={s.listenText}>{card.listenFor}</Text>
        </View>
        <View style={{ flexGrow: 1 }} />
        <CmdButton title={card.hearLabel} icon="🔊" cmd="DEMO" kind="secondary" onPress={hear} testID="learn-hear" />
        <CmdButton title={k < cards.length - 1 ? 'Next' : 'Got it'} cmd="ENTER" onPress={gotIt} testID="learn-next" />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 18, gap: 14, backgroundColor: C.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { color: C.text, fontSize: 34, fontWeight: '300', marginTop: -6 },
  kicker: { color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: C.text, fontSize: 26, fontWeight: '900' },
  body: { color: C.dim, fontSize: 17, lineHeight: 25 },
  listen: { backgroundColor: C.panel, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, gap: 4 },
  listenText: { color: C.text, fontSize: 16, fontWeight: '700' },
});
