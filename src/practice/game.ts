/**
 * Pentatonic Path: the levels, badges and daily streak around Live Practice.
 * Plain data and pure functions; the store saves a PentaProfile.
 */
import type { ExerciseConfig, Pattern } from './theory';

export type PracticeMode = 'detect' | 'metronome';
export type PentaScale = 'Minor Pentatonic' | 'Major Pentatonic';

/** Everything that defines a run. Levels fix it; free play lets you change it mid-session. */
export interface RunSetup {
  key: string;
  scale: PentaScale;
  position: number;
  pattern: Pattern;
  mode: PracticeMode;
  bpm: number;
  /** Notes per beat in metronome mode: 1 = quarters, 2 = eighths. */
  perBeat: 1 | 2;
}

export function toExercise(s: RunSetup): ExerciseConfig {
  return { mode: 'scale', key: s.key, name: s.scale, position: s.position, pattern: s.pattern };
}

export interface Level {
  id: number;
  world: number;
  title: string;
  setup: RunSetup;
  boss?: boolean;
  /** One line shown before you play. */
  tip: string;
}

export const WORLDS = [
  { id: 1, name: 'Box 1', subtitle: 'The shape every guitarist knows' },
  { id: 2, name: 'Boxes 2 and 3', subtitle: 'Climb up the neck' },
  { id: 3, name: 'Boxes 4 and 5', subtitle: 'Complete the map' },
  { id: 4, name: 'Major and new keys', subtitle: 'Same shapes, new sounds' },
];

const L = (
  id: number,
  world: number,
  title: string,
  key: string,
  scale: PentaScale,
  position: number,
  pattern: Pattern,
  mode: PracticeMode,
  bpm: number,
  perBeat: 1 | 2,
  tip: string,
  boss = false,
): Level => ({ id, world, title, setup: { key, scale, position, pattern, mode, bpm, perBeat }, tip, boss });

const AM = 'Minor Pentatonic' as const;
const MAJ = 'Major Pentatonic' as const;

export const LEVELS: Level[] = [
  L(1, 1, 'First climb', 'A', AM, 1, 'Up', 'detect', 60, 1, 'Start on the root (R) on the low E string, 5th fret. Take your time: each note waits for you.'),
  L(2, 1, 'Up and back down', 'A', AM, 1, 'Up & down', 'detect', 60, 1, 'Go to the top and come back. Index finger on fret 5, ring or pinky on fret 7 or 8.'),
  L(3, 1, 'Meet the metronome', 'A', AM, 1, 'Up & down', 'metronome', 60, 1, 'One note per click. Play right on the click for PERFECT.'),
  L(4, 1, 'Groups of three', 'A', AM, 1, 'Groups of 3', 'detect', 60, 1, 'Three notes forward, one step back. A classic lick builder.'),
  L(5, 1, 'Boss: Box 1 in eighths', 'A', AM, 1, 'Up & down', 'metronome', 60, 2, 'Two notes per click. Keep the combo alive!', true),
  L(6, 2, 'Box 2', 'A', AM, 2, 'Up & down', 'detect', 60, 1, 'Box 2 starts where box 1 ends: its lowest notes are the top notes of box 1.'),
  L(7, 2, 'Box 2 on the beat', 'A', AM, 2, 'Up & down', 'metronome', 70, 1, 'Same shape, now with the click.'),
  L(8, 2, 'Box 3', 'A', AM, 3, 'Up & down', 'detect', 60, 1, 'Box 3 has the root on the A string (fret 12) and the B string (fret 10).'),
  L(9, 2, 'Box 3 on the beat', 'A', AM, 3, 'Up & down', 'metronome', 70, 1, 'Watch the stretch between the G and B strings.'),
  L(10, 2, 'Boss: thirds in box 1', 'A', AM, 1, 'Thirds', 'metronome', 70, 1, 'Skip a note each time. Thirds make scales sound like melodies.', true),
  L(11, 3, 'Box 4', 'A', AM, 4, 'Up & down', 'detect', 60, 1, 'Box 4 sits at the nut and uses open strings.'),
  L(12, 3, 'Box 4 on the beat', 'A', AM, 4, 'Up & down', 'metronome', 70, 1, 'Open strings keep ringing: lift or mute them after each note.'),
  L(13, 3, 'Box 5', 'A', AM, 5, 'Up & down', 'detect', 60, 1, 'Box 5 sits around frets 2 to 6, between box 4 and box 1.'),
  L(14, 3, 'Box 5 on the beat', 'A', AM, 5, 'Up & down', 'metronome', 80, 1, 'Five boxes done: you can play A minor pentatonic all over the neck.'),
  L(15, 3, 'Boss: groups of 3 in box 5', 'A', AM, 5, 'Groups of 3', 'metronome', 70, 2, 'Eighths in groups of three. Breathe and count.', true),
  L(16, 4, 'C major: same shape!', 'C', MAJ, 5, 'Up & down', 'detect', 60, 1, 'This is the box 1 shape from A minor: same frets, same notes. Now C is the root, so the colours move.'),
  L(17, 4, 'E minor, box 1', 'E', AM, 1, 'Up & down', 'metronome', 70, 1, 'Box 1 moved to the open position: the root is the open low E.'),
  L(18, 4, 'G major, box 1', 'G', MAJ, 1, 'Up & down', 'detect', 60, 1, 'Major pentatonic: R 2 3 5 6. Bright and happy, think country and pop.'),
  L(19, 4, 'D minor in eighths', 'D', AM, 1, 'Up & down', 'metronome', 70, 2, 'D minor box 1 starts at fret 10.'),
  L(20, 4, 'Final boss: F major pentatonic', 'F', MAJ, 2, 'Up & down', 'metronome', 80, 2, 'The exercise from the Keypracticer video, at full speed.', true),
];

export function getLevel(id: number): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}

export interface LevelRecord {
  stars: number;
  best: number;
}

export interface PentaProfile {
  levels: Record<number, LevelRecord>;
  badges: string[];
  streak: { count: number; last: string | null };
  runs: number;
  /** Boxes (1-5) finished at least once. */
  boxes: number[];
  /** Last level played. */
  current: number;
}

export const EMPTY_PROFILE: PentaProfile = { levels: {}, badges: [], streak: { count: 0, last: null }, runs: 0, boxes: [], current: 1 };

export function isLevelOpen(p: PentaProfile, id: number): boolean {
  return id === 1 || (p.levels[id - 1]?.stars ?? 0) >= 1;
}

/** The level to open on: the last one played, or the first one not yet passed. */
export function startLevel(p: PentaProfile): number {
  if (getLevel(p.current) && isLevelOpen(p, p.current) && !(p.levels[p.current]?.stars >= 1)) return p.current;
  const open = LEVELS.find((l) => isLevelOpen(p, l.id) && !(p.levels[l.id]?.stars >= 1));
  return open?.id ?? p.current;
}

export function totalPentaStars(p: PentaProfile): number {
  return Object.values(p.levels).reduce((a, l) => a + l.stars, 0);
}

// ---- daily streak
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function bumpStreak(streak: PentaProfile['streak'], today: Date): PentaProfile['streak'] {
  const t = dayKey(today);
  if (streak.last === t) return streak;
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  return { count: streak.last === dayKey(y) ? streak.count + 1 : 1, last: t };
}

// ---- badges
export interface RunSummary {
  levelId: number | null;
  setup: RunSetup;
  score: number;
  stars: number;
  accuracy: number;
  bestCombo: number;
  /** Most PERFECTs in a row (metronome mode). */
  perfectRun: number;
}

export interface Badge {
  id: string;
  icon: string;
  title: string;
  text: string;
  earned: (r: RunSummary, p: PentaProfile) => boolean;
}

export const BADGES: Badge[] = [
  { id: 'first', icon: '🎸', title: 'First run', text: 'Finish your first run.', earned: () => true },
  { id: 'combo25', icon: '🔥', title: 'On fire', text: 'Reach a 25 note combo.', earned: (r) => r.bestCombo >= 25 },
  { id: 'combo50', icon: '☄️', title: 'Unstoppable', text: 'Reach a 50 note combo.', earned: (r) => r.bestCombo >= 50 },
  { id: 'flawless', icon: '💎', title: 'Flawless', text: 'Get 3 stars on a run.', earned: (r) => r.stars === 3 },
  { id: 'perfect10', icon: '🎯', title: 'Sharpshooter', text: '10 PERFECTs in a row with the metronome.', earned: (r) => r.perfectRun >= 10 },
  { id: 'tempo90', icon: '⚡', title: 'Speedy', text: 'Finish a metronome run at 90 notes a minute or faster.', earned: (r) => r.setup.mode === 'metronome' && r.setup.bpm * r.setup.perBeat >= 90 && r.stars >= 1 },
  { id: 'boxes', icon: '🗺️', title: 'Map maker', text: 'Finish all 5 boxes.', earned: (_r, p) => [1, 2, 3, 4, 5].every((b) => p.boxes.includes(b)) },
  { id: 'major', icon: '☀️', title: 'Bright side', text: 'Finish a major pentatonic run.', earned: (r) => r.setup.scale === MAJ && r.stars >= 1 },
  { id: 'boss', icon: '👑', title: 'Boss slayer', text: 'Beat a boss level.', earned: (r) => !!(r.levelId && getLevel(r.levelId)?.boss && r.stars >= 1) },
  { id: 'streak3', icon: '📅', title: 'Habit', text: 'Practice 3 days in a row.', earned: (_r, p) => p.streak.count >= 3 },
  { id: 'streak7', icon: '🏆', title: 'Dedicated', text: 'Practice 7 days in a row.', earned: (_r, p) => p.streak.count >= 7 },
  { id: 'champion', icon: '🌟', title: 'Pentatonic champion', text: 'Beat the final boss.', earned: (r) => r.levelId === 20 && r.stars >= 1 },
];

/** Adds a finished run to the profile. Returns the new profile and the badges earned just now. */
export function applyRun(p: PentaProfile, r: RunSummary, today = new Date()): { profile: PentaProfile; newBadges: Badge[]; newBest: boolean; unlocked: number | null } {
  const levels = { ...p.levels };
  let newBest = false;
  let unlocked: number | null = null;
  if (r.levelId) {
    const prev = levels[r.levelId] ?? { stars: 0, best: 0 };
    newBest = r.score > prev.best;
    levels[r.levelId] = { stars: Math.max(prev.stars, r.stars), best: Math.max(prev.best, r.score) };
    const next = r.levelId + 1;
    if (getLevel(next) && !isLevelOpen(p, next) && isLevelOpen({ ...p, levels }, next)) unlocked = next;
  }
  const boxes = r.stars >= 1 && !p.boxes.includes(r.setup.position) ? [...p.boxes, r.setup.position].sort() : p.boxes;
  const profile: PentaProfile = { ...p, levels, boxes, runs: p.runs + 1, streak: bumpStreak(p.streak, today) };
  const newBadges = BADGES.filter((b) => !p.badges.includes(b.id) && b.earned(r, profile));
  profile.badges = [...p.badges, ...newBadges.map((b) => b.id)];
  return { profile, newBadges, newBest, unlocked };
}
