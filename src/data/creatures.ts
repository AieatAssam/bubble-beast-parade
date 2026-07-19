import type { ColorFamily } from "./colors";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "mythic";

export interface CreatureDef {
  id: string;
  name: string;
  rarity: Rarity;
  color: ColorFamily;
  /** Score value added on capture. */
  score: number;
  flavor: string;
  /** Procedural body archetype used by the fallback mesh builder. */
  body: "blob" | "axolotl" | "jelly" | "sprite" | "moth" | "snail" | "koi" | "dragonet" | "seraph" | "fawn";
}

export const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "mythic"];

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  mythic: "Mythic",
};

export const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 58,
  uncommon: 27,
  rare: 10,
  epic: 4,
  mythic: 1,
};

export const CREATURES: CreatureDef[] = [
  {
    id: "bloop", name: "Bloop", rarity: "common", color: "cyan", score: 50, body: "blob",
    flavor: "A cheerful droplet who hums off-key and considers every bubble a personal friend.",
  },
  {
    id: "pip", name: "Pip Petal", rarity: "common", color: "pink", score: 50, body: "sprite",
    flavor: "Sleeps inside tulips and wakes only for parades and pastries.",
  },
  {
    id: "moss", name: "Mossle", rarity: "common", color: "lime", score: 50, body: "snail",
    flavor: "Carries a tiny garden on its shell and waters it with morning dew.",
  },
  {
    id: "twizzle", name: "Twizzle", rarity: "uncommon", color: "orange", score: 110, body: "moth",
    flavor: "Leaves a trail of warm sparks when excited, which is always.",
  },
  {
    id: "plume", name: "Plume", rarity: "uncommon", color: "violet", score: 110, body: "jelly",
    flavor: "Drifts upside-down on purpose. Insists it is the sky that is wrong.",
  },
  {
    id: "glimmer", name: "Glimmer", rarity: "uncommon", color: "cyan", score: 110, body: "koi",
    flavor: "Swims through air as if it were water, scattering little lens flares.",
  },
  {
    id: "lanterna", name: "Lanterna", rarity: "rare", color: "gold", score: 260, body: "axolotl",
    flavor: "Its gills glow like festival lanterns; moths write it fan letters.",
  },
  {
    id: "orchid", name: "Orchidra", rarity: "rare", color: "pink", score: 260, body: "dragonet",
    flavor: "A palm-sized dragon that smells of orchids and hoards buttons.",
  },
  {
    id: "aurorin", name: "Aurorin", rarity: "epic", color: "violet", score: 600, body: "seraph",
    flavor: "Trails a private aurora. Appears only when the conservatory sings in tune.",
  },
  {
    id: "solstice", name: "Solstice", rarity: "mythic", color: "gold", score: 1500, body: "fawn",
    flavor: "The parade's oldest secret: a golden fawn who remembers every bubble ever blown.",
  },
];

export const CREATURES_BY_ID = new Map(CREATURES.map((c) => [c.id, c]));

/** Pick a creature for a capture, weighted by rarity; golden/grand bias upward. */
export function pickCreature(rng: () => number, biasUp = 0): CreatureDef {
  const weights = CREATURES.map((c) => {
    let w = RARITY_WEIGHT[c.rarity];
    if (biasUp > 0) {
      // Shift weight toward rarer entries: raise rare weights, damp common ones.
      const rank = RARITY_ORDER.indexOf(c.rarity);
      w = w * (1 + rank * biasUp);
      if (c.rarity === "common") w *= Math.max(0.15, 1 - biasUp);
    }
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < CREATURES.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return CREATURES[i]!;
  }
  return CREATURES[CREATURES.length - 1]!;
}
