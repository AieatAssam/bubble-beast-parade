import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

/**
 * Real CC0 model library (Poly Haven, meshopt-compressed GLBs).
 * Every entry is optional: a missing/failed file simply yields null and the
 * garden keeps its procedural fallback for that slot.
 */
export type ModelName =
  | "jacaranda_tree"
  | "island_tree_02"
  | "fern_02"
  | "flower_gazania"
  | "flower_empodium"
  | "crystalline_iceplant"
  | "coast_rocks_05"
  | "Lantern_01"
  | "horse_statue_01"
  | "gothic_statue"
  | "garden_gnome"
  | "crystal_cluster"
  | "crystal_small"
  | "flower_a"
  | "flower_b"
  | "flower_c"
  | "flower_d"
  | "mushroom_a"
  | "mushroom_b"
  | "fountain"
  | "butterfly";

/** Target world height (m) each model is normalised to. */
const TARGET_HEIGHT: Record<ModelName, number> = {
  jacaranda_tree: 9.5,
  island_tree_02: 6.5,
  fern_02: 0.85,
  flower_gazania: 0.5,
  flower_empodium: 0.55,
  crystalline_iceplant: 0.45,
  coast_rocks_05: 1.4,
  Lantern_01: 0.75,
  horse_statue_01: 1.05,
  gothic_statue: 2.4,
  garden_gnome: 0.85,
  crystal_cluster: 1.3,
  crystal_small: 0.7,
  flower_a: 1.1,
  flower_b: 1.2,
  flower_c: 1.0,
  flower_d: 0.9,
  mushroom_a: 0.9,
  mushroom_b: 0.75,
  fountain: 2.4,
  butterfly: 0.28,
};

export type ModelLibrary = Map<ModelName, THREE.Group>;

export async function loadModels(
  onProgress?: (loaded: number, total: number) => void,
): Promise<ModelLibrary> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const names = Object.keys(TARGET_HEIGHT) as ModelName[];
  const lib: ModelLibrary = new Map();
  let done = 0;
  await Promise.all(
    names.map(async (name) => {
      try {
        const gltf = await loader.loadAsync(`assets/models/${name}.glb`);
        const root = gltf.scene;
        // Normalise: sit on y=0, scale to target height
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        // Normalise by the largest dimension so flat/wide models don't explode
        const maxDim = Math.max(size.x, size.y, size.z, 1e-4);
        root.scale.setScalar(TARGET_HEIGHT[name] / maxDim);
        const box2 = new THREE.Box3().setFromObject(root);
        root.position.y -= box2.min.y;
        const wrapper = new THREE.Group();
        wrapper.add(root);
        wrapper.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.castShadow = false;
            o.receiveShadow = true;
            // Some packs ship unlit materials that render fullbright and blow
            // out under bloom — convert them to lit standard materials.
            const mat = o.material as THREE.Material;
            if (mat instanceof THREE.MeshBasicMaterial) {
              const std = new THREE.MeshStandardMaterial({
                map: mat.map ?? null,
                color: mat.color,
                roughness: 0.75,
                metalness: 0.05,
                transparent: mat.transparent,
                opacity: mat.opacity,
                side: mat.side,
                alphaTest: mat.alphaTest,
              });
              o.material = std;
            }
          }
        });
        lib.set(name, wrapper);
      } catch (err) {
        console.warn(`[bbp] model ${name} failed to load — procedural fallback`, err);
      } finally {
        done++;
        onProgress?.(done, names.length);
      }
    }),
  );
  return lib;
}

/** Cheap clone that shares geometry/materials. */
export function cloneModel(lib: ModelLibrary, name: ModelName): THREE.Group | null {
  const src = lib.get(name);
  return src ? (src.clone(true) as THREE.Group) : null;
}
