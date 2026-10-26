# Keypracticer Game

A guitar practice game: play pentatonic boxes on your real guitar, the mic
checks every note, and you score points, stars and badges. It uses the same
layout and colours as the Keypracticer videos. Built with Expo (web, iOS,
Android).

This started as the Live Practice part of NoteTrainer and was copied out on
2026-10-26 (the git history comes along with it).

## First launch

A two minute onboarding (`/welcome`): how well you know the pentatonic (places
you on the path), a daily goal and a practice-spot checklist, the mic with a
tuning check, the sound remote (let the open low E ring to continue), your
first three notes, then sign-up or "Later" to play as a guest. The step is
saved, so closing the app half way is fine. Saying no to the mic skips the
remote and leaves every lesson playable in Listen mode.

## Pentatonic Path

Home is the start of your current lesson. Each lesson is a small ladder:

- **Learn:** one theory card (two at most): the idea, the box on a small neck
  with the important notes bigger, a Hear button and one thing to listen for.
  Written for all 20 lessons in `src/practice/lessons.ts`.
- **Listen:** the app plays the exercise with the reel moving, at any tempo, on
  a loop. Works without a mic.
- **Play** (each note waits for you) or **On the beat** (metronome: 4 clicks
  count in, every note is graded PERFECT, GREAT, GOOD, WRONG NOTE or MISS).
  Stars come from this step.

The first time the big button walks you up the ladder; after a star it plays.

- **The coach:** a wrong note says what you played and how to fix it ("You
  played C#: one fret too high. Go to fret 5."). After 6 s without a right note
  it says where the note is and which finger. Stop playing for 10 s (Play) or
  two bars (On the beat) and the run pauses or stops.
- **Sound remote:** between runs, open strings are buttons, and the letter of
  the string is the first letter of the action: **E**nter, **A**gain,
  **D**emo, **G**uide, **B**ack. A string must ring for half a second. During a
  run every note is an answer, so commands are off. Buttons show the letter;
  on the web the keyboard works too (Enter, Esc, a, d, g, b). Settings can turn
  it off.
- **20 lessons in 4 worlds** (Box 1, Boxes 2 and 3, Boxes 4 and 5, Major and new
  keys), each with a boss. 1 to 3 stars; a star opens the next lesson.
- **Game layer:** combo multiplier (x2/x3/x4 after 8/16/32), speed bonus,
  pop-ups, shake and pop, XP and player level, daily streak, daily practice
  goal, 12 badges, confetti on 3 stars.
- **In the session:** switch Listen, Play and On the beat, change key, minor or
  major, box, pattern, tempo. Changing them on a lesson switches to free play.
- `/FPS2UD80` opens a Keypracticer video code in free play.

## Accounts

Sign-up with Apple, Google or an email code, through Supabase. Guests play
without an account; signing in merges the device's progress into the account.
Setup steps for the Supabase project: [docs/ACCOUNTS.md](docs/ACCOUNTS.md).
Without the two `EXPO_PUBLIC_SUPABASE_*` variables the app runs as a guest only.

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
that plays whatever the game asks for. It walks through onboarding (tuning
check, the sound remote with a ringing low E, the first notes), Learn and
Listen, plays lesson 1 in Play mode and lesson 2 on the beat, uses guitar
commands on the results, pause and lesson screens, and checks the no-mic path.
Screenshots land in `e2e/out/`.

## Layout

```
src/app/            screens (expo-router): index (lesson home), welcome (onboarding), lesson/[id],
                    learn/[id] (theory cards), play/[id] (Listen, Play, On the beat), path,
                    account, settings, [code] (free play from a video code)
src/engine/         commands (sound remote), useCommands (one bus for touch, keys and guitar),
                    flow (every state's main action and way out, tested), coach, timeline
src/practice/       theory.ts (Keypracticer port), session.ts (play + beat rules), game.ts (levels,
                    badges, streak), lessons.ts (theory per lesson, the ladder), PracticeGame, LessonHome, ReelView
src/account/        Supabase client, auth (Apple, Google, email code), sync, SignIn
src/pitch/          tracker (pitchy), mic.ts (web), mic.native.ts (phones), MicService, guitarSynth
src/audio/          shared AudioContext, clock, metronome, notePlayer, haptics
src/components/     CmdButton (button + string letter), MiniNeck, MicPanel, Screen, UI bits
src/store/          model.ts (profile v2, migration, merge), progress.tsx (AsyncStorage)
supabase/           database migration for accounts
```
