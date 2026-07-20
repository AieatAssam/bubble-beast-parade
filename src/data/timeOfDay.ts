/**
 * Time-of-day presets: different Poly Haven CC0 skyboxes and matching scene
 * lighting/fog. One is chosen per round (novelty across replays) so the
 * conservatory never looks quite the same twice.
 */
export type TimeOfDayId = "dawn" | "day" | "night";

export interface TimeOfDayDef {
  id: TimeOfDayId;
  label: string;
  hdriPath: string;
  /** How visible the sky itself is behind the garden. */
  backgroundIntensity: number;
  backgroundBlurriness: number;
  /** Scales the HDRI's contribution to material reflections/lighting. */
  environmentIntensity: number;
  toneMappingExposure: number;
  fogColor: number;
  fogDensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  sunColor: number;
  sunIntensity: number;
  sunPos: [number, number, number];
  /** Extra multiplier applied to lantern/mote/glow emissives — night reads magical, day stays natural. */
  glowBoost: number;
}

export const TIME_OF_DAY: Record<TimeOfDayId, TimeOfDayDef> = {
  dawn: {
    id: "dawn",
    label: "Sunset Hour",
    hdriPath: "assets/hdri/rosendal_park_sunset_1k.hdr",
    backgroundIntensity: 0.38,
    backgroundBlurriness: 0.09,
    environmentIntensity: 0.5,
    toneMappingExposure: 1.1,
    fogColor: 0x4a3560,
    fogDensity: 0.016,
    hemiSky: 0xd8b8e0,
    hemiGround: 0x2a2048,
    hemiIntensity: 0.55,
    sunColor: 0xff9a58,
    sunIntensity: 1.7,
    sunPos: [14, 5.5, 9],
    glowBoost: 1.15,
  },
  day: {
    id: "day",
    label: "Bright Morning",
    hdriPath: "assets/hdri/kloofendal_partly_cloudy_1k.hdr",
    backgroundIntensity: 0.55,
    backgroundBlurriness: 0.06,
    environmentIntensity: 0.65,
    toneMappingExposure: 1.2,
    fogColor: 0xaed4e8,
    fogDensity: 0.01,
    hemiSky: 0xeaf6ff,
    hemiGround: 0x4a7050,
    hemiIntensity: 0.85,
    sunColor: 0xfff2d0,
    sunIntensity: 2.4,
    sunPos: [10, 16, 8],
    glowBoost: 0.85,
  },
  night: {
    id: "night",
    label: "Moonlit Conservatory",
    hdriPath: "assets/hdri/moonless_golf_1k.hdr",
    backgroundIntensity: 0.3,
    backgroundBlurriness: 0.12,
    environmentIntensity: 0.32,
    toneMappingExposure: 0.95,
    fogColor: 0x0c1030,
    fogDensity: 0.022,
    hemiSky: 0x384a8c,
    hemiGround: 0x0a0a1e,
    hemiIntensity: 0.32,
    sunColor: 0x8fa8ff,
    sunIntensity: 0.65,
    sunPos: [-8, 12, -6],
    glowBoost: 1.6,
  },
};

export const TIME_OF_DAY_IDS: TimeOfDayId[] = ["dawn", "day", "night"];

export function randomTimeOfDay(rng: () => number = Math.random): TimeOfDayDef {
  return TIME_OF_DAY[TIME_OF_DAY_IDS[Math.floor(rng() * TIME_OF_DAY_IDS.length)]!];
}
