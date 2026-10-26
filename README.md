# Keypracticer Game

A guitar practice game: play pentatonic boxes on your real guitar, the mic
checks every note, and you score points, stars and badges. It uses the same
layout and colours as the Keypracticer videos. Built with Expo (web, iOS,
Android).

This started as the Live Practice part of NoteTrainer and was copied out on
2026-10-26 (the git history comes along with it).

## Pentatonic Path

The app opens straight into your current
level, ready to play, in the Keypracticer reel layout: title, fretboard with
the whole box, note names, staff, tab and the red playhead.

- **20 levels in 4 worlds** (Box 1, Boxes 2 and 3, Boxes 4 and 5, Major and new
  keys), each with a boss. 1 to 3 stars; a star opens the next level.
- **Two modes, switchable any time.** Detect: the note waits until the mic
  hears it. Metronome: 4 clicks count in, the notes run on the beat and every
  note is graded PERFECT (within 50 ms), GREAT (100 ms), GOOD, WRONG NOTE or MISS.
- **Practice tools** in Detect: back, hear the note, skip, listen to the phrase,
  restart. The app ignores the mic while it plays its own notes.
- **Settings in the session:** mode, key, minor or major, box, pattern, tempo,
  quarters or eighths. Changing them on a level switches to free play.
- **Game layer:** combo multiplier (x2/x3/x4 after 8/16/32), speed bonus,
  pop-ups, shake and pop, XP and player level, daily streak, 12 badges,
  confetti on 3 stars. Stars: 70% accuracy passes, 90% (Detect) or 85%
  (Metronome) for 2 stars, 95% for 3.
- **Theory panel:** what a pentatonic is, the notes and intervals of the
  current scale in their colours, where the roots are in the box, relative
  major and minor, the five boxes, practice tips, and "hear the box".
- `/FPS2UD80` opens a Keypracticer video code in free play.

The app uses the Keypracticer light theme (`src/theme/colors.ts`).
The exercises come from a TypeScript port of Keypracticer's `theory.py`
(`src/practice/theory.ts`). A test checks it against a fixture made by the
Python code (`scripts/keypracticer-fixture.py`), so the notes match the videos.

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
pins the octave) and trusts the string. Octave jumps are forgiven by default
(a setting). Wrong notes only count when they start with a new pluck, so a
ringing string drifting does not cost a mistake. The settings screen
(`/settings`, linked from the in game Settings sheet) also has mic sensitivity
and a timing offset for Metronome mode.

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
npm test                    # unit tests: note math, pitch tracker, theory port, game rules and scoring
npm run typecheck
npm run build:web && npm run e2e   # headless Chromium, needs a global `playwright` + chromium
```

The e2e run replaces the mic with a synthetic guitar (`e2e/fake-guitar.js`)
that plays whatever the game asks for. It plays level 1 in Detect and
Metronome mode, opens the panels and level 2, a video code and settings.
Screenshots land in `e2e/out/`.

## Layout

```
src/app/            screens (expo-router): index (the game), [code] (free play from a video code), settings
src/practice/       theory.ts (Keypracticer port), session.ts (detect + metronome rules),
                    game.ts (levels, badges, streak), PracticeGame, ReelView, reel.ts, TheoryPanel
src/pitch/          tracker (pitchy), mic.ts (web), mic.native.ts (phones), MicService, guitarSynth
src/audio/          shared AudioContext, clock, metronome, notePlayer, haptics
src/components/     MicPanel, Screen, UI bits
src/music/notes.ts  note names and pitch math
src/game/xp.ts      player levels and titles
src/store/          progress and settings (AsyncStorage)
```
