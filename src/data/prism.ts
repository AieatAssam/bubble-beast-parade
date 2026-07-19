/** Prism outcome pool — fully disclosed odds (SPEC §7). Must sum to 100. */
export type PrismOutcomeId =
  | "rainbowDraft"
  | "bubbleBloom"
  | "paradeLine"
  | "mirrorPop"
  | "crystalRain"
  | "colorCarnival";

export interface PrismOutcomeDef {
  id: PrismOutcomeId;
  label: string;
  /** Exact disclosed percentage. */
  odds: number;
  /** Effect duration in seconds (0 = count-based). */
  duration: number;
  icon: string;
  help: string;
}

export const PRISM_OUTCOMES: PrismOutcomeDef[] = [
  {
    id: "rainbowDraft", label: "Rainbow Draft", odds: 25, duration: 7, icon: "🌈",
    help: "Nearby bubbles orbit the cursor for 7 seconds.",
  },
  {
    id: "bubbleBloom", label: "Bubble Bloom", odds: 20, duration: 8, icon: "🫧",
    help: "Each popped eligible bubble splits into several low-value mini-bubbles for 8 seconds.",
  },
  {
    id: "paradeLine", label: "Parade Line", odds: 20, duration: 8, icon: "🎠",
    help: "Beasts form a slow, predictable line across the playfield for 8 seconds.",
  },
  {
    id: "mirrorPop", label: "Mirror Pop", odds: 15, duration: 0, icon: "🪞",
    help: "The next three valid pops echo to nearby eligible bubbles.",
  },
  {
    id: "crystalRain", label: "Crystal Rain", odds: 12, duration: 6, icon: "💎",
    help: "The centre fountain releases high-value crystal bubbles.",
  },
  {
    id: "colorCarnival", label: "Colour Carnival", odds: 8, duration: 8, icon: "🎪",
    help: "A clearly shown target colour scores 3× for 8 seconds and recolours the conservatory.",
  },
];

{
  const total = PRISM_OUTCOMES.reduce((a, o) => a + o.odds, 0);
  if (total !== 100) throw new Error(`Prism odds must sum to 100, got ${total}`);
}

export function rollPrism(rng: () => number): PrismOutcomeDef {
  let roll = rng() * 100;
  for (const o of PRISM_OUTCOMES) {
    roll -= o.odds;
    if (roll <= 0) return o;
  }
  return PRISM_OUTCOMES[PRISM_OUTCOMES.length - 1]!;
}
