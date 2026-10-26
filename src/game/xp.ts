/** Player levels and titles. XP is the sum of points earned in rounds. */
export const PLAYER_TITLES: { xp: number; title: string }[] = [
  { xp: 0, title: 'Open Strummer' },
  { xp: 300, title: 'String Counter' },
  { xp: 800, title: 'Fret Finder' },
  { xp: 1600, title: 'Note Hunter' },
  { xp: 3000, title: 'Riff Rider' },
  { xp: 5000, title: 'Neck Ninja' },
  { xp: 8000, title: 'Fretboard Wizard' },
];

export interface PlayerLevel {
  level: number;
  title: string;
  xpIntoLevel: number;
  xpForNext: number | null;
}

export function playerLevel(xp: number): PlayerLevel {
  let i = 0;
  while (i + 1 < PLAYER_TITLES.length && xp >= PLAYER_TITLES[i + 1].xp) i++;
  const next = PLAYER_TITLES[i + 1];
  return {
    level: i + 1,
    title: PLAYER_TITLES[i].title,
    xpIntoLevel: xp - PLAYER_TITLES[i].xp,
    xpForNext: next ? next.xp - PLAYER_TITLES[i].xp : null,
  };
}
