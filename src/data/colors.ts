/** Colour families used across bubbles, beasts, VFX, and UI. */
export type ColorFamily = "cyan" | "pink" | "violet" | "gold" | "lime" | "orange";

export interface ColorDef {
  family: ColorFamily;
  /** Main hue as hex. */
  hex: number;
  /** Brighter emissive companion. */
  emissive: number;
  /** CSS string for HUD/UI. */
  css: string;
}

export const COLOR_DEFS: Record<ColorFamily, ColorDef> = {
  cyan:   { family: "cyan",   hex: 0x35d7e8, emissive: 0x7cf4ff, css: "#35d7e8" },
  pink:   { family: "pink",   hex: 0xff5fa8, emissive: 0xff9fce, css: "#ff5fa8" },
  violet: { family: "violet", hex: 0x9a5bff, emissive: 0xc79bff, css: "#9a5bff" },
  gold:   { family: "gold",   hex: 0xffc23a, emissive: 0xffe08a, css: "#ffc23a" },
  lime:   { family: "lime",   hex: 0x8ce840, emissive: 0xc2ff8a, css: "#8ce840" },
  orange: { family: "orange", hex: 0xff8c3a, emissive: 0xffb27c, css: "#ff8c3a" },
};

export const COLOR_FAMILIES: ColorFamily[] = ["cyan", "pink", "violet", "gold", "lime", "orange"];

export function randomColorFamily(rng: () => number = Math.random): ColorFamily {
  return COLOR_FAMILIES[Math.floor(rng() * COLOR_FAMILIES.length)]!;
}
