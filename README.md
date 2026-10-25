# NoteTrainer

Learn every note on the guitar fretboard by playing it. The app calls a note,
you play it on your guitar, and the microphone checks it. Built with Expo and
React Native for web, iOS and Android.

The MVP covers steps 1 to 40 of the
[100-step curriculum](https://claude.ai/artifact/AhsDjDXMMaJ1Jo7toZDPxh):

| World | Levels | What you learn |
| --- | --- | --- |
| 1 Orientation | 1-10 | String numbers and names, mic setup and tuner, fret numbers, the musical alphabet, half steps |
| 2 Low E and A | 11-20 | Natural notes on the two bass strings: name it, then play it |
| 3 The whole neck | 21-30 | D, G, B and high e, then any natural note anywhere |
| 4 Fret Play | 31-40 | Spoken prompts ("G on the D string"), metronome, play on the beat, tempo ramps |

Game layer: world map, 1 to 3 stars per level, combo multiplier (x2 to x4),
XP and player titles, boss levels with 3 hearts and a clock that speeds up,
hints after two misses (cap the level at 2 stars), Note Rush (60-second time
attack), haptics, shake/pop animations and confetti.

## How the mic works

`src/pitch/tracker.ts` takes mic samples in chunks, runs
[pitchy](https://github.com/ianprime0509/pitchy) (McLeod pitch method) on a
2048-sample window every ~12 ms, and reports a note once the same pitch holds
for 150 ms. Loudness jumps mark a new pluck (onset), so the same note can count
again and rhythm drills get a timestamp for the attack.

- **Web** (`src/pitch/mic.ts`): `getUserMedia` + Web Audio. Needs https (or
  localhost) and a tap on Start.
- **iOS / Android** (`src/pitch/mic.native.ts`):
  [react-native-audio-api](https://docs.swmansion.com/react-native-audio-api/)
  `AudioRecorder.onAudioReady`. This is a native module, so it needs a
  **development build**, not Expo Go.

The mic hears a pitch, not a string, so the app checks the exact pitch (which
pins the octave) and trusts the string. Worlds 1-2 forgive octave jumps (a
setting). Wrong notes only count when they start with a new pluck, so a ringing
string drifting does not cost a mistake. Settings also has mic sensitivity, a
timing offset for the beat drills, and Guitar mode off (tap the fret instead
of playing).

## Run it

```bash
npm install
npm run web                 # web at http://localhost:8081
```

Phones (mic needs a development build):

```bash
npx expo run:android        # or: npx expo run:ios  (local Android Studio / Xcode)
# or in the cloud:
npx eas-cli@latest build --profile development --platform android
npx expo start --dev-client
```

## Tests

```bash
npm test                    # unit tests: note math, pitch tracker on synthetic plucks, levels, scoring
npm run typecheck
npm run build:web && npm run e2e   # headless Chromium, needs a global `playwright` + chromium
```

The e2e run first feeds a WAV of the six open strings into Chromium's fake
microphone and checks the tuner, then replaces the mic with a synthetic guitar
(`e2e/fake-guitar.js`) that plays whatever the app asks for, and plays levels
1-4, 8, 10-12, 20, 28, 30-32, 34, 36-40, a tap-mode level and Note Rush.
Screenshots land in `e2e/out/`.

## Layout

```
src/app/            screens (expo-router): map, level/[id], tuner, rush, settings
src/components/     Fretboard (SVG), AnswerPad, QuizPlayer, RhythmPlayer, Tuner, UI bits
src/pitch/          tracker (pitchy), mic.ts (web), mic.native.ts (phones), MicService
src/audio/          shared AudioContext, metronome, speech (expo-speech), haptics
src/quiz/           levels.ts (the 40 steps as data), generate.ts, round.ts (scoring, stars)
src/game/xp.ts      player levels and titles
src/store/          progress and settings (AsyncStorage)
```

Levels are data: each row in `src/quiz/levels.ts` names a drill type, strings,
fret range, pass rule and options, so adding steps 41-100 is mostly new rows
plus a few new drill types.
