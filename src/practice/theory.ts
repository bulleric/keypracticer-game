/**
 * Scale and arpeggio exercises, ported from Keypracticer's theory.py
 * (keypracticer-content-gen). Same boxes, same note order, same spelling, so an
 * exercise here matches the video with the same settings. Timing is left out:
 * Live Practice waits for each note instead of following a tempo.
 */

/** Standard tuning, string 1 = high E. */
export const OPEN: Record<number, number> = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
export const ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
export const COMMON_KEYS = ['E', 'A', 'G', 'C', 'D'];
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const LETTER_PCS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const ACCIDENTAL_TEXT: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' };
const PITCH_CLASS_NAMES: Record<string, number> = {
  C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3,
  E: 4, Fb: 4, 'E#': 5, F: 5, 'F#': 6, Gb: 6, G: 7,
  'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11,
};

type Formula = [number, string][];

export const SCALES: Record<string, Formula> = {
  'Minor Pentatonic': [[0, 'R'], [3, 'b3'], [5, '4'], [7, '5'], [10, 'b7']],
  'Major Pentatonic': [[0, 'R'], [2, '2'], [4, '3'], [7, '5'], [9, '6']],
  Blues: [[0, 'R'], [3, 'b3'], [5, '4'], [6, 'b5'], [7, '5'], [10, 'b7']],
  'Major (Ionian)': [[0, 'R'], [2, '2'], [4, '3'], [5, '4'], [7, '5'], [9, '6'], [11, '7']],
  'Natural Minor (Aeolian)': [[0, 'R'], [2, '2'], [3, 'b3'], [5, '4'], [7, '5'], [8, 'b6'], [10, 'b7']],
  Dorian: [[0, 'R'], [2, '2'], [3, 'b3'], [5, '4'], [7, '5'], [9, '6'], [10, 'b7']],
  Mixolydian: [[0, 'R'], [2, '2'], [4, '3'], [5, '4'], [7, '5'], [9, '6'], [10, 'b7']],
  'Harmonic Minor': [[0, 'R'], [2, '2'], [3, 'b3'], [5, '4'], [7, '5'], [8, 'b6'], [11, '7']],
};

const QUALITIES: Record<string, Formula> = {
  maj: [[0, 'R'], [4, '3'], [7, '5']],
  m: [[0, 'R'], [3, 'b3'], [7, '5']],
  dim: [[0, 'R'], [3, 'b3'], [6, 'b5']],
  aug: [[0, 'R'], [4, '3'], [8, '#5']],
  maj7: [[0, 'R'], [4, '3'], [7, '5'], [11, '7']],
  m7: [[0, 'R'], [3, 'b3'], [7, '5'], [10, 'b7']],
  '7': [[0, 'R'], [4, '3'], [7, '5'], [10, 'b7']],
  m7b5: [[0, 'R'], [3, 'b3'], [6, 'b5'], [10, 'b7']],
};

export const ARPEGGIOS: Record<string, string> = {
  Major: 'maj', Minor: 'm', Diminished: 'dim', Augmented: 'aug',
  'Major 7': 'maj7', 'Minor 7': 'm7', 'Dominant 7': '7', 'Half diminished (m7b5)': 'm7b5',
};

export const PATTERNS = ['Up & down', 'Up', 'Groups of 3', 'Thirds', 'Groups of 4'] as const;
export type Pattern = (typeof PATTERNS)[number];

export type SF = [string: number, fret: number];

export function keyPitchClass(root: string): number {
  const pc = PITCH_CLASS_NAMES[root];
  if (pc === undefined) throw new Error(`Unsupported key spelling: ${root}`);
  return pc;
}

function spellDegree(root: string, degree: number, targetPc: number): string {
  const rootIndex = LETTERS.indexOf(root[0]);
  const letter = LETTERS[(rootIndex + degree - 1) % 7];
  const delta = ((((targetPc - LETTER_PCS[letter] + 6) % 12) + 12) % 12) - 6;
  if (delta < -2 || delta > 2) throw new Error(`Cannot spell ${targetPc} as degree ${degree} from ${root}`);
  return letter + ACCIDENTAL_TEXT[delta];
}

function spelling(root: string, minorish: boolean): string[] {
  const flat =
    ['F', 'Bb', 'Eb', 'Ab', 'Db'].includes(root) || (minorish && ['D', 'G', 'C', 'F', 'Bb', 'Eb'].includes(root));
  return flat ? FLATS : SHARPS;
}

const mod12 = (n: number) => ((n % 12) + 12) % 12;
const pitch = ([s, f]: SF) => OPEN[s] + f;

// ---------------------------------------------------------------- positions
function positionAnchors(rootPc: number, semis: number[]): number[] {
  const rf = mod12(rootPc - 4); // root fret on low E
  return [...new Set(semis.map((s) => (rf + s) % 12))].sort((a, b) => a - b);
}

function boxPositionAnchors(rootPc: number, semis: number[]): number[] {
  const rf = mod12(rootPc - 4);
  return [...semis].sort((a, b) => a - b).map((s) => (rf + s) % 12);
}

function windowBox(rootPc: number, semis: number[], anchor: number, span = 4, maxPerString?: number): SF[] {
  const pcs = new Set(semis.map((s) => (rootPc + s) % 12));
  const low = Math.max(0, anchor - 1);
  const high = low + span;
  const notes: SF[] = [];
  for (const s of [6, 5, 4, 3, 2, 1]) {
    let count = 0;
    for (let f = low; f <= high; f++) {
      if (pcs.has((OPEN[s] + f) % 12)) {
        notes.push([s, f]);
        count++;
        if (maxPerString !== undefined && count >= maxPerString) break;
      }
    }
  }
  return notes;
}

function threeNps(rootPc: number, semis: number[], anchor: number): SF[] {
  const pcs = new Set(semis.map((s) => (rootPc + s) % 12));
  const notes: SF[] = [];
  const low = Math.max(0, anchor);
  for (const s of [6, 5, 4, 3, 2, 1]) {
    const found: SF[] = [];
    for (let f = low; f < low + 13; f++) {
      if (pcs.has((OPEN[s] + f) % 12)) found.push([s, f]);
      if (found.length === 3) break;
    }
    if (found.length !== 3) throw new Error(`Cannot build 3NPS position on string ${s}`);
    notes.push(...found);
  }
  return notes;
}

function scaleBox(rootPc: number, name: string, position: number): { box: SF[]; count: number } {
  const semis = SCALES[name].map(([s]) => s);
  if (semis.length === 7) {
    const anchors = positionAnchors(rootPc, semis);
    return { box: threeNps(rootPc, semis, anchors[(position - 1) % 7]), count: 7 };
  }
  const base = name === 'Blues' ? semis.filter((s) => s !== 6) : semis;
  const anchors = boxPositionAnchors(rootPc, base);
  const anchor = anchors[(position - 1) % anchors.length];
  return { box: windowBox(rootPc, semis, anchor, 4, name !== 'Blues' ? 2 : undefined), count: anchors.length };
}

function arpeggioBox(rootPc: number, quality: string, position: number): { box: SF[]; count: number } {
  const semis = QUALITIES[quality].map(([s]) => s);
  const anchors = boxPositionAnchors(rootPc, semis);
  return { box: windowBox(rootPc, semis, anchors[(position - 1) % anchors.length]), count: anchors.length };
}

// ---------------------------------------------------------------- phrases
function concatNoDup(left: SF[], right: SF[]): SF[] {
  const a = left[left.length - 1];
  const b = right[0];
  if (a && b && a[0] === b[0] && a[1] === b[1]) return [...left, ...right.slice(1)];
  return [...left, ...right];
}

function groups(seq: SF[], size: number, steps: number[]): SF[] {
  const n = seq.length;
  const up: SF[] = [];
  for (let i = 0; i < n - (size - 1); i++) for (const k of steps) up.push(seq[i + k]);
  const down: SF[] = [];
  for (let i = n - 1; i > size - 2; i--) for (const k of steps) down.push(seq[i - k]);
  return concatNoDup(up, down);
}

function applyPattern(seq: SF[], pattern: Pattern): SF[] {
  switch (pattern) {
    case 'Up':
      return [...seq];
    case 'Groups of 3':
      return groups(seq, 3, [0, 1, 2]);
    case 'Thirds':
      return groups(seq, 3, [0, 2]);
    case 'Groups of 4':
      return groups(seq, 4, [0, 1, 2, 3]);
    default:
      return concatNoDup([...seq], [...seq].reverse().slice(1));
  }
}

function rootAlignedPhrase(box: SF[], rootPc: number, pattern: Pattern): SF[] {
  let ordered = [...box].sort((a, b) => pitch(a) - pitch(b) || a[0] - b[0]);
  if (!ordered.length) return [];
  const roots = ordered.map((sf, i) => (pitch(sf) % 12 === rootPc ? i : -1)).filter((i) => i >= 0);
  if (pattern === 'Up & down' && roots.length) {
    // root, up to the top, down to the bottom, back up to the root
    const r = roots[0];
    const n = ordered.length;
    const phrase: SF[] = [];
    for (let i = r; i < n; i++) phrase.push(ordered[i]);
    for (let i = n - 2; i >= 0; i--) phrase.push(ordered[i]);
    for (let i = 1; i <= r; i++) phrase.push(ordered[i]);
    return phrase;
  }
  if (roots.length) ordered = [...ordered.slice(roots[0]), ...ordered.slice(0, roots[0])];
  const phrase = applyPattern(ordered, pattern);
  const last = phrase[phrase.length - 1];
  if (last && pitch(last) % 12 !== rootPc) {
    let best: SF | null = null;
    for (const sf of ordered) {
      if (pitch(sf) % 12 !== rootPc) continue;
      if (!best || Math.abs(pitch(sf) - pitch(last)) < Math.abs(pitch(best) - pitch(last))) best = sf;
    }
    if (best) phrase.push(best);
  }
  return phrase;
}

function intervalLabel(semi: number, formula: Formula): string {
  for (const [s, lab] of formula) if (s === semi) return lab;
  return ['R', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'][semi];
}

const DEGREE: Record<string, number> = {
  R: 1, '2': 2, b2: 2, b3: 3, '3': 3, '4': 4, b5: 5, '5': 5, b6: 6, '6': 6, b7: 7, '7': 7, '#5': 5,
};

function noteName(midi: number, formula: Formula, key: string, names: string[]): string {
  const target = midi % 12;
  const rootPc = keyPitchClass(key);
  const hit = formula.find(([semi]) => (rootPc + semi) % 12 === target);
  if (hit) return spellDegree(key, DEGREE[hit[1]], target);
  return names[target];
}

// ---------------------------------------------------------------- exercise
export interface ExerciseConfig {
  mode: 'scale' | 'arpeggio';
  key: string;
  /** Scale name (mode scale) or arpeggio name (mode arpeggio). */
  name: string;
  position: number;
  pattern: Pattern;
}

export interface ExNote {
  string: number;
  fret: number;
  midi: number;
  name: string;
  interval: string;
}

export interface Exercise {
  config: ExerciseConfig;
  title: string;
  subtitle: string;
  keyRootPc: number;
  /** Scale name used for the key signature (null for arpeggios). */
  scale: string | null;
  /** The notes to play, in order. */
  notes: ExNote[];
  /** Every note of the box, shown as dots on the fretboard. */
  box: ExNote[];
  positions: number;
  /** The code printed on the video, without BPM. Not unique: Blues, Major and Mixolydian share one. */
  code: string;
  /** Unique id, used for saved best scores. */
  id: string;
}

export function buildExercise(cfg: ExerciseConfig): Exercise {
  const root = keyPitchClass(cfg.key);
  let formula: Formula;
  let found: { box: SF[]; count: number };
  let title: string;
  let kind: string;
  if (cfg.mode === 'scale') {
    formula = SCALES[cfg.name];
    found = scaleBox(root, cfg.name, cfg.position);
    title = `${cfg.key} ${cfg.name}`;
    kind = 'Scale';
  } else {
    const quality = ARPEGGIOS[cfg.name];
    formula = QUALITIES[quality];
    found = arpeggioBox(root, quality, cfg.position);
    title = `${cfg.key} ${cfg.name} Arpeggio`;
    kind = 'Arpeggio';
  }
  if (!formula) throw new Error(`Unknown ${cfg.mode}: ${cfg.name}`);
  const minorish = formula.some(([s]) => s === 3) && !formula.some(([s]) => s === 4);
  const names = spelling(cfg.key, minorish);
  const toNote = ([s, f]: SF): ExNote => {
    const midi = OPEN[s] + f;
    return { string: s, fret: f, midi, name: noteName(midi, formula, cfg.key, names), interval: intervalLabel(mod12(midi - root), formula) };
  };
  const phrase = rootAlignedPhrase(found.box, root, cfg.pattern);
  return {
    config: cfg,
    title,
    subtitle: `${kind} | Box ${cfg.position} | ${cfg.pattern}`,
    keyRootPc: root,
    scale: cfg.mode === 'scale' ? cfg.name : null,
    notes: phrase.map(toNote),
    box: found.box.map(toNote),
    positions: found.count,
    code: practiceCode(cfg),
    id: `${cfg.mode}|${cfg.key}|${cfg.name}|${cfg.position}|${cfg.pattern}`,
  };
}

export function positionCount(cfg: Pick<ExerciseConfig, 'mode' | 'key' | 'name'>): number {
  const root = keyPitchClass(cfg.key);
  return cfg.mode === 'scale' ? scaleBox(root, cfg.name, 1).count : arpeggioBox(root, ARPEGGIOS[cfg.name], 1).count;
}

// ---------------------------------------------------------------- practice codes
const PATTERN_CODES: Record<string, string> = { 'Up & down': 'UD', Up: 'U', 'Groups of 3': 'G3', 'Groups of 4': 'G4', Thirds: 'T' };

/** The code printed on Keypracticer videos, without the BPM (e.g. "FPS2UD"). */
export function practiceCode(cfg: ExerciseConfig): string {
  const key = cfg.key.replace('#', 's').replace('b', 'f');
  const lower = cfg.name.toLowerCase();
  const quality = lower.includes('minor') ? 'M' : '';
  const pent = lower.includes('pentatonic') ? 'P' : '';
  return `${key}${quality}${pent}${cfg.mode === 'scale' ? 'S' : 'A'}${cfg.position}${PATTERN_CODES[cfg.pattern] ?? 'P'}`;
}

/** Every exercise the picker offers. */
export function allConfigs(): ExerciseConfig[] {
  const out: ExerciseConfig[] = [];
  for (const key of ROOTS)
    for (const [mode, list] of [['scale', Object.keys(SCALES)], ['arpeggio', Object.keys(ARPEGGIOS)]] as const)
      for (const name of list) {
        const n = positionCount({ mode, key, name });
        for (let position = 1; position <= n; position++)
          for (const pattern of PATTERNS) out.push({ mode, key, name, position, pattern });
      }
  return out;
}

/**
 * Find the exercise for a code from a video, e.g. "FPS2UD80". The BPM at the
 * end is ignored. Some codes fit more than one scale (Blues, Major and
 * Mixolydian share one); `preferName` picks between them, else the first match wins.
 */
export function configFromCode(code: string, preferName?: string): ExerciseConfig | null {
  const c = code.trim().toLowerCase();
  let first: ExerciseConfig | null = null;
  for (const cfg of allConfigs()) {
    const base = practiceCode(cfg).toLowerCase();
    if (!c.startsWith(base) || !/^\d*(-\d+)?$/.test(c.slice(base.length))) continue;
    if (!preferName || cfg.name === preferName) return cfg;
    first ??= cfg;
  }
  return first;
}

/** Route to Live Practice for an exercise. */
export function practiceHref(cfg: ExerciseConfig, reps = 1): string {
  return `/practice/${practiceCode(cfg)}?name=${encodeURIComponent(cfg.name)}&reps=${reps}`;
}
