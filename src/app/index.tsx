import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ProgressBar, Stars, styles as ui } from '../components/ui';
import { Screen } from '../components/Screen';
import { playerLevel, STARS_TO_UNLOCK_WORLD } from '../game/xp';
import { LEVELS, WORLDS } from '../quiz/levels';
import { isUnlocked, totalStars, useProgress, worldStars } from '../store/progress';
import { C } from '../theme/colors';

/** The world map: 10 worlds of 10 levels. Worlds 1-4 are the MVP. */
export default function MapScreen() {
  const { progress, loaded } = useProgress();
  const pl = playerLevel(progress.xp);
  const stars = totalStars(progress);
  if (!loaded) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  return (
    <Screen top>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={ui.h1}>NoteTrainer</Text>
          <Text style={s.title} testID="player-title">
            Lv {pl.level} · {pl.title}
          </Text>
          <View style={{ marginTop: 6, maxWidth: 260 }}>
            <ProgressBar value={pl.xpForNext ? pl.xpIntoLevel / pl.xpForNext : 1} color={C.hint} />
            <Text style={ui.small}>
              {progress.xp} XP{pl.xpForNext ? ` · ${pl.xpForNext - pl.xpIntoLevel} to next title` : ''}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.starTotal} testID="star-total">
            ★ {stars}
          </Text>
          <Text style={ui.small}>of 120</Text>
        </View>
      </View>

      <View style={s.quick}>
        <Button small title="🎸 Live Practice" onPress={() => router.push('/practice')} testID="go-practice" />
        <Button small kind="secondary" title="🎵 Tuner" onPress={() => router.push('/tuner')} testID="go-tuner" />
        <Button small kind="secondary" title="⚡ Note Rush" onPress={() => router.push('/rush')} testID="go-rush" />
        <Button small kind="secondary" title="⚙ Settings" onPress={() => router.push('/settings')} testID="go-settings" />
      </View>

      {WORLDS.map((w) => {
        const levels = LEVELS.filter((l) => l.world === w.id);
        const available = levels.length > 0;
        const ws = worldStars(progress, w.id);
        const open = available && isUnlocked(progress, levels[0].id);
        return (
          <Card key={w.id} style={!available ? { opacity: 0.5 } : undefined}>
            <View style={s.worldHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.worldNo}>WORLD {w.id}</Text>
                <Text style={ui.h2}>{w.name}</Text>
                <Text style={ui.small}>{w.subtitle}</Text>
              </View>
              {available ? (
                <Text style={s.worldStars}>
                  ★ {ws}/{levels.length * 3}
                </Text>
              ) : (
                <Text style={s.soon}>Soon</Text>
              )}
            </View>
            {available && !open && w.id > 1 ? (
              <Text style={[ui.small, { marginTop: 8 }]}>
                Beat the World {w.id - 1} boss and collect {STARS_TO_UNLOCK_WORLD} stars there to open.
              </Text>
            ) : null}
            {available ? (
              <View style={s.path}>
                {levels.map((l, i) => {
                  const unlocked = isUnlocked(progress, l.id);
                  const lp = progress.levels[l.id];
                  const offset = Math.sin((i / 9) * Math.PI * 2) * 30;
                  return (
                    <Pressable
                      key={l.id}
                      testID={`level-${l.id}`}
                      disabled={!unlocked}
                      onPress={() => router.push(`/level/${l.id}`)}
                      style={({ pressed }) => [s.node, { transform: [{ translateY: offset }, { scale: pressed ? 0.94 : 1 }] }]}
                      accessibilityLabel={`Level ${l.id}: ${l.title}${unlocked ? '' : ', locked'}`}
                    >
                      <View
                        style={[
                          s.circle,
                          l.boss && s.boss,
                          !unlocked && { backgroundColor: C.locked, borderColor: C.locked },
                          lp?.passed && { borderColor: C.good },
                        ]}
                      >
                        <Text style={[s.nodeText, !unlocked && { color: C.faint }]}>
                          {unlocked ? (l.boss ? '👑' : l.id) : '🔒'}
                        </Text>
                      </View>
                      <Stars n={lp?.stars ?? 0} size={11} />
                      <Text style={s.nodeLabel} numberOfLines={2}>
                        {l.usesMic ? '🎸 ' : ''}
                        {l.title.replace('Boss: ', '')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </Card>
        );
      })}
      <Text style={[ui.small, { textAlign: 'center' }]}>🎸 = played on your guitar (mic). Worlds 5 to 10 are on the way.</Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { color: C.accent2, fontWeight: '700', marginTop: 2 },
  starTotal: { color: C.star, fontSize: 22, fontWeight: '800' },
  quick: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  worldHead: { flexDirection: 'row', alignItems: 'center' },
  worldNo: { color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  worldStars: { color: C.star, fontWeight: '800', fontSize: 16 },
  soon: { color: C.faint, fontWeight: '700' },
  path: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingTop: 34, paddingBottom: 30, rowGap: 56 },
  node: { width: '19%', alignItems: 'center', gap: 2 },
  circle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: C.accent2,
  },
  boss: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#b5452f', borderColor: C.star },
  nodeText: { color: '#1d140a', fontWeight: '900', fontSize: 17 },
  nodeLabel: { color: C.dim, fontSize: 10, textAlign: 'center', marginTop: 2 },
});
