import * as THREE from "three";

/**
 * Hand-authored looping drift paths (SPEC §6): readable, graceful closed
 * curves through the play volume. Bubbles follow a path with an individual
 * phase offset; Rapier adds gentle separation on top.
 */
export interface DriftPath {
  curve: THREE.CatmullRomCurve3;
  /** Seconds for a full loop. */
  period: number;
}

function loop(points: [number, number, number][], period: number): DriftPath {
  return {
    curve: new THREE.CatmullRomCurve3(
      points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      true,
      "catmullrom",
      0.6,
    ),
    period,
  };
}

/** Play volume spans roughly x ∈ [-9, 9], y ∈ [1.5, 7], z ∈ [-2, 5]. */
export const DRIFT_PATHS: DriftPath[] = [
  // Wide figure-of-eight, front field
  loop(
    [
      [-8, 3, 3], [-4, 4.5, 1], [0, 3.2, 3.5], [4, 4.5, 1], [8, 3, 3],
      [4, 2.2, 4.5], [0, 4, 2], [-4, 2.2, 4.5],
    ],
    46,
  ),
  // High lazy oval, drifting over the carousel
  loop(
    [
      [-6.5, 5.5, 0], [0, 6.5, -1.5], [6.5, 5.5, 0], [7, 4.5, 2.5], [0, 5, 4], [-7, 4.5, 2.5],
    ],
    40,
  ),
  // Low meander among the flowers
  loop(
    [
      [-7.5, 2, 4.5], [-3, 1.8, 2.5], [1, 2.4, 4.8], [5, 1.8, 3], [8, 2.4, 4],
      [5, 3, 5], [-2, 2.6, 5.2], [-6, 2.8, 5],
    ],
    38,
  ),
  // Diagonal ribbon, left rise
  loop(
    [
      [-8.5, 2, 1], [-5, 3.5, -0.5], [-1, 5, 0.5], [3, 6, -1], [7, 5, 0.5],
      [8, 3.5, 2.5], [3, 3, 3.5], [-3, 2.5, 2.8],
    ],
    44,
  ),
  // Small circle, right pocket
  loop(
    [
      [4.5, 3.5, 2.5], [6.5, 4.2, 1], [8, 3.5, 2.5], [6.5, 2.8, 4],
    ],
    26,
  ),
  // Small circle, left pocket
  loop(
    [
      [-4.5, 4.2, 2], [-6.5, 5, 0.8], [-8, 4.2, 2], [-6.5, 3.4, 3.4],
    ],
    28,
  ),
];

export function randomPath(rng: () => number = Math.random): DriftPath {
  return DRIFT_PATHS[Math.floor(rng() * DRIFT_PATHS.length)]!;
}

/** Grand bubble entrance path: sweeps from above centre down to a showcase spot. */
export const GRAND_PATH = loop(
  [
    [0, 8.5, -2], [1.5, 6.5, 1], [0, 4.5, 3.2], [-1.5, 5, 1.5],
  ],
  16,
);
