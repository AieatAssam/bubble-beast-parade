/** Static design table for the six bubble types (SPEC §5, §6). */
export type BubbleKind = "standard" | "colorBond" | "chorus" | "prism" | "golden" | "grand";

export interface BubbleTypeDef {
  kind: BubbleKind;
  label: string;
  /** Base score before rarity/chain multipliers. */
  baseScore: number;
  /** Seconds the bubble stays alive before harmless dissipation. Value-inverse. */
  lifespan: number;
  /** Seconds of the end-of-life warning phase (shimmer ring shrink + wobble). */
  warnWindow: number;
  /** Wand charges required to pop. */
  chargeCost: number;
  /** World radius. */
  radius: number;
  /** Relative spawn weight during normal play (grand is scripted, weight 0). */
  spawnWeight: number;
  /** Short help text shown in tooltips + help screen. */
  help: string;
  /**
   * Collision fragility (new): bubbles spawn immortal to bumps. After
   * `collisionImmuneSeconds` alive, fragility ramps 0→1 over
   * `collisionRampSeconds`, and each physical contact rolls a shatter
   * chance of `fragility * collisionMaxPopChance`. Value-inverse — the
   * more valuable the bubble, the sooner and harder it can break on a
   * bump, layering real-time risk on top of the dissipation timer.
   * A shatter scores nothing and never touches the chain (bad luck, not
   * a punishment). Set collisionImmuneSeconds very high to opt a kind out.
   */
  collisionImmuneSeconds: number;
  collisionRampSeconds: number;
  collisionMaxPopChance: number;
}

export const BUBBLE_TYPES: Record<BubbleKind, BubbleTypeDef> = {
  standard: {
    kind: "standard",
    label: "Standard",
    baseScore: 100,
    lifespan: 14,
    warnWindow: 3,
    chargeCost: 1,
    radius: 0.55,
    spawnWeight: 58,
    help: "Iridescent shell with a beast inside. Lingers a long time — pop freely with spare charges.",
    collisionImmuneSeconds: 999,
    collisionRampSeconds: 1,
    collisionMaxPopChance: 0,
  },
  colorBond: {
    kind: "colorBond",
    label: "Colour Bond",
    baseScore: 160,
    lifespan: 9,
    warnWindow: 2.5,
    chargeCost: 1,
    radius: 0.58,
    spawnWeight: 20,
    help: "Saturated aura with an orbiting ribbon. Extends a same-colour chain for multiplying score.",
    collisionImmuneSeconds: 5,
    collisionRampSeconds: 4,
    collisionMaxPopChance: 0.25,
  },
  chorus: {
    kind: "chorus",
    label: "Chorus",
    baseScore: 220,
    lifespan: 8,
    warnWindow: 2.5,
    chargeCost: 1,
    radius: 0.62,
    spawnWeight: 10,
    help: "A central bubble with three orbiters. One well-timed pop captures all four.",
    collisionImmuneSeconds: 4.5,
    collisionRampSeconds: 3.5,
    collisionMaxPopChance: 0.25,
  },
  prism: {
    kind: "prism",
    label: "Prism",
    baseScore: 120,
    lifespan: 7.5,
    warnWindow: 2,
    chargeCost: 1,
    radius: 0.5,
    spawnWeight: 8,
    help: "Faceted rainbow crystal. Starts one temporary event from the disclosed pool — exact odds in Help.",
    // Exempt: a prism's reward is a disclosed, guaranteed event — never lost to a random bump.
    collisionImmuneSeconds: 999,
    collisionRampSeconds: 1,
    collisionMaxPopChance: 0,
  },
  golden: {
    kind: "golden",
    label: "Golden",
    baseScore: 600,
    lifespan: 4.5,
    warnWindow: 2,
    chargeCost: 1,
    radius: 0.66,
    spawnWeight: 4,
    help: "Ornate gold filigree, slow and majestic — but dissipates fast. Popping it refunds the charge.",
    collisionImmuneSeconds: 1.2,
    collisionRampSeconds: 1.3,
    collisionMaxPopChance: 0.45,
  },
  grand: {
    kind: "grand",
    label: "Grand",
    baseScore: 1500,
    lifespan: 3.5,
    warnWindow: 1.8,
    chargeCost: 1,
    radius: 1.05,
    spawnWeight: 0,
    help: "Huge finale bubble in the last five seconds. Tightest window of all. Popping it refunds the charge.",
    collisionImmuneSeconds: 0.6,
    collisionRampSeconds: 1.0,
    collisionMaxPopChance: 0.55,
  },
};

/** Fragility 0..1 for a bubble of this kind at this age (SPEC extension: collision risk). */
export function collisionFragility(kind: BubbleKind, age: number): number {
  const def = BUBBLE_TYPES[kind];
  const t = age - def.collisionImmuneSeconds;
  if (t <= 0) return 0;
  return Math.min(1, t / def.collisionRampSeconds);
}

/** Charge economy constants (SPEC §5). */
export const CHARGE_MAX = 3;
export const CHARGE_OVERCHARGE_MAX = 4;
export const CHARGE_REGEN_SECONDS = 2.0;

/** Round length in seconds. */
export const ROUND_SECONDS = 90;
/** Grand bubble entrance time (seconds remaining). */
export const GRAND_ENTRANCE_AT = 5;

/** Chain rules (SPEC §9). */
export const CHAIN_TIMEOUT_SECONDS = 4;
export const CHAIN_MULT_STEP = 0.5;
export const CHAIN_MULT_MAX = 5;
/** Popping within this window after the previous pop counts as "perfectly timed" and refunds a charge. */
export const PERFECT_CHAIN_WINDOW = 0.9;
