import {
  ALPHABET,
  NATURALS,
  NOTE_NAMES,
  STRINGS_LOW_TO_HIGH,
  STRING_NAMES,
  fretsForNote,
  isNatural,
  midiAt,
  nextNatural,
  nextSemitone,
  noteAt,
  spokenNote,
  stringLabel,
  type NoteName,
  type StringNumber,
} from '../music/notes';
import type { BoardMark, DrillKind, Level, Question, Range, StringStyle } from './types';

export type Rng = () => number;

const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

/** Landmark frets used for hints: the open string and the dot frets. */
const LANDMARKS = [0, 3, 5, 7, 9, 12];

export function nearestLandmark(string: StringNumber, fret: number): BoardMark {
  let best = 0;
  for (const l of LANDMARKS) if (l !== fret && Math.abs(l - fret) < Math.abs(best - fret)) best = l;
  if (best === fret) best = fret === 0 ? 3 : 0;
  return { string, fret: best, label: noteAt(string, best), tone: 'hint' };
}

function stringText(s: StringNumber, style: StringStyle, rng: Rng): string {
  const st = style === 'mixed' ? (rng() < 0.5 ? 'name' : 'number') : style;
  return stringLabel(s, st);
}

/** Natural notes available on a string inside a fret range. */
function naturalsInRange(s: StringNumber, range: Range): NoteName[] {
  const set = new Set<NoteName>();
  for (let f = range.minFret; f <= range.maxFret; f++) {
    const n = noteAt(s, f);
    if (isNatural(n)) set.add(n);
  }
  return [...set];
}

function naturalFretsInRange(s: StringNumber, range: Range): number[] {
  const out: number[] = [];
  for (let f = range.minFret; f <= range.maxFret; f++) if (isNatural(noteAt(s, f))) out.push(f);
  return out;
}

export interface GenContext {
  level: Level;
  index: number;
  rng: Rng;
  prev?: Question;
  /** For sequences: shared state across the round (e.g. the note for step 28). */
  seq: { note?: NoteName };
  stringStyle: StringStyle;
}

let qid = 0;
const id = () => `q${++qid}`;

function playNoteQuestion(
  s: StringNumber,
  note: NoteName,
  range: Range,
  ctx: GenContext,
  input: 'mic' | 'board' = 'mic',
): Question {
  const frets = fretsForNote(s, note, range.minFret, range.maxFret);
  const where = stringText(s, ctx.level.stringStyle ?? ctx.stringStyle, ctx.rng);
  const nearest = nearestLandmark(s, frets[0]);
  return {
    id: id(),
    prompt: `${note} on ${where.replace(/^the /, 'the ')}`,
    sub: input === 'mic' ? 'Play it on your guitar' : 'Tap the fret',
    speak: `${spokenNote(note)} on ${where}`,
    input,
    acceptMidis: frets.map((f) => midiAt(s, f)),
    string: s,
    highlightString: undefined,
    target: note,
    reveal: `${note} is at fret ${frets.join(' and ')} on the ${STRING_NAMES[s]} string`,
    hint: `Start from ${nearest.label} at fret ${nearest.fret}`,
    hintMark: nearest,
  };
}

function gen(kind: DrillKind, ctx: GenContext): Question {
  const { level, rng, index } = ctx;
  const range = level.range ?? { strings: STRINGS_LOW_TO_HIGH, minFret: 0, maxFret: 12 };
  switch (kind) {
    case 'stringNumber': {
      const s = pick(rng, STRINGS_LOW_TO_HIGH);
      return {
        id: id(),
        prompt: 'Which string number is this?',
        sub: '1 is the thin high e, 6 is the thick low E',
        input: 'pad',
        padOptions: ['1', '2', '3', '4', '5', '6'],
        correctPad: String(s),
        highlightString: s,
        reveal: `That's string ${s}, the ${STRING_NAMES[s]} string`,
        hint: 'Count from the thinnest string at the top: 1, 2, 3...',
      };
    }
    case 'openStringName': {
      const s = pick(rng, STRINGS_LOW_TO_HIGH);
      return {
        id: id(),
        prompt: 'Name this open string',
        sub: 'Eddie Ate Dynamite, Good Bye Eddie',
        input: 'pad',
        padOptions: ['E', 'A', 'D', 'G', 'B'],
        correctPad: noteAt(s, 0),
        highlightString: s,
        target: noteAt(s, 0),
        reveal: `String ${s} is ${noteAt(s, 0)}`,
        hint: 'From thick to thin: E A D G B E',
      };
    }
    case 'tuner':
    case 'playOpen': {
      const s = kind === 'tuner' ? STRINGS_LOW_TO_HIGH[index % 6] : pick(rng, STRINGS_LOW_TO_HIGH);
      const n = noteAt(s, 0);
      return {
        id: id(),
        prompt: kind === 'tuner' ? `Play the open ${STRING_NAMES[s]} string` : `Play the ${STRING_NAMES[s]} string`,
        sub: kind === 'tuner' ? `String ${s}. Tune it until the needle is centered.` : `String ${s}, open`,
        input: 'mic',
        acceptMidis: [midiAt(s, 0)],
        string: s,
        highlightString: s,
        tuner: kind === 'tuner',
        target: n,
        reveal: `Open string ${s} is ${n}`,
      };
    }
    case 'fretNumber': {
      const f = 1 + Math.floor(rng() * 12);
      return {
        id: id(),
        prompt: 'Which fret is lit?',
        sub: 'Dots are at 3, 5, 7, 9 and 12',
        input: 'pad',
        padOptions: Array.from({ length: 12 }, (_, i) => String(i + 1)),
        correctPad: String(f),
        highlightFret: { fret: f },
        reveal: `That's fret ${f}`,
        hint: 'Find the nearest dot (3, 5, 7, 9, 12) and count from it',
      };
    }
    case 'alphabet': {
      const n = pick(rng, NATURALS);
      const after = rng() < 0.65;
      const ans = nextNatural(n, after ? 1 : -1);
      return {
        id: id(),
        prompt: `Which letter comes ${after ? 'after' : 'before'} ${n}?`,
        sub: 'The musical alphabet goes A to G, then starts again',
        input: 'pad',
        padOptions: [...ALPHABET],
        correctPad: ans,
        reveal: `${after ? `${n}, ${ans}` : `${ans}, ${n}`}`,
        hint: 'A B C D E F G A B C ...',
      };
    }
    case 'halfStep': {
      const n = pick(rng, NOTE_NAMES);
      const ans = nextSemitone(n);
      return {
        id: id(),
        prompt: `One fret up from ${n} is...`,
        sub: 'Only B-C and E-F have no note between them',
        input: 'pad',
        padOptions: [...NOTE_NAMES],
        correctPad: ans,
        target: ans,
        reveal: `${n} → ${ans}`,
        hint: 'Every letter has a sharp after it, except B and E',
      };
    }
    case 'playFret': {
      const fret = level.fret ?? (pick(rng, [0, 1, 12]) as number);
      // Steps 8 and 9 go string by string, low to high; the boss picks at random.
      const s = level.drill === 'playFret' ? STRINGS_LOW_TO_HIGH[index % 6] : pick(rng, STRINGS_LOW_TO_HIGH);
      const n = noteAt(s, fret);
      return {
        id: id(),
        prompt: fret === 0 ? `Play the open ${STRING_NAMES[s]} string` : `Play fret ${fret} on the ${STRING_NAMES[s]} string`,
        sub: fret === 12 ? 'Fret 12 has the same name as the open string' : `String ${s}`,
        input: 'mic',
        acceptMidis: [midiAt(s, fret)],
        string: s,
        highlightFret: { string: s, fret },
        target: n,
        reveal: `Fret ${fret} on ${STRING_NAMES[s]} is ${n}`,
      };
    }
    case 'nameFret': {
      let s: StringNumber, f: number;
      let guard = 0;
      do {
        s = pick(rng, range.strings);
        f = pick(rng, naturalFretsInRange(s, range));
      } while (
        guard++ < 10 &&
        ctx.prev?.highlightFret?.fret === f &&
        ctx.prev?.highlightFret?.string === s
      );
      const n = noteAt(s, f);
      return {
        id: id(),
        prompt: 'Name this note',
        sub: `${STRING_NAMES[s]} string, fret ${f}`,
        input: 'pad',
        padOptions: [...ALPHABET],
        correctPad: n,
        acceptMidis: [midiAt(s, f)],
        highlightFret: { string: s, fret: f },
        target: n,
        reveal: `Fret ${f} on ${STRING_NAMES[s]} is ${n}`,
        hint: `Count up from ${nearestLandmark(s, f).label} at fret ${nearestLandmark(s, f).fret}`,
        hintMark: nearestLandmark(s, f),
      };
    }
    case 'playNote':
    case 'spokenTap': {
      let s: StringNumber, note: NoteName;
      let guard = 0;
      do {
        s = pick(rng, range.strings);
        note = pick(rng, naturalsInRange(s, range));
      } while (guard++ < 10 && ctx.prev?.target === note && ctx.prev?.string === s);
      return playNoteQuestion(s, note, range, ctx, kind === 'spokenTap' ? 'board' : 'mic');
    }
    case 'oneNoteAllStrings': {
      if (!ctx.seq.note) ctx.seq.note = pick(rng, NATURALS);
      const s = STRINGS_LOW_TO_HIGH[index % 6];
      const q = playNoteQuestion(s, ctx.seq.note, range, ctx);
      q.prompt = `${ctx.seq.note} on string ${s}`;
      q.sub = `${index + 1} of 6, low to high`;
      return q;
    }
    default:
      throw new Error(`No generator for ${kind}`);
  }
}

export function makeQuestion(ctx: GenContext): Question {
  const { level, index } = ctx;
  const kind = level.drill === 'mixed' && level.mix ? level.mix[index % level.mix.length] : level.drill;
  return gen(kind, ctx);
}

/** Targets for a beat sequence level: one note per beat. */
export function beatSequenceTargets(level: Level, rng: Rng): { label: string; string: StringNumber; midis: number[]; note: NoteName }[] {
  if (level.sequence === 'alphabet') {
    const s = (level.range?.strings[0] ?? 5) as StringNumber;
    const start: NoteName = noteAt(s, 0);
    const notes: NoteName[] = [];
    let n = start as (typeof ALPHABET)[number];
    for (let i = 0; i < 7; i++) {
      notes.push(n);
      n = nextNatural(n);
    }
    return notes.map((note) => ({
      label: note,
      note,
      string: s,
      midis: fretsForNote(s, note, 0, 12).filter((f) => f < 12 || note !== start).map((f) => midiAt(s, f)),
    }));
  }
  const note = pick(rng, NATURALS);
  return STRINGS_LOW_TO_HIGH.map((s) => ({
    label: `${note} · ${s}`,
    note,
    string: s,
    midis: fretsForNote(s, note, 0, 12).map((f) => midiAt(s, f)),
  }));
}
