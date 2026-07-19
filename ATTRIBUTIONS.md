# Attributions

One entry per external asset used by Bubble Beast Parade.

## 3D / Environment

### Rosendal Park Sunset (HDRI)
- **Creator:** Greg Zaal / Poly Haven
- **Source:** https://polyhaven.com/a/rosendal_park_sunset
- **File:** `public/assets/hdri/rosendal_park_sunset_1k.hdr`
- **Licence:** CC0 (public domain)
- **Modified:** No (used as-is, 1K resolution download)
- **Use:** Image-based environment lighting and reflections for the conservatory scene.

## 3D Models (all Poly Haven, CC0, 1k-texture glTF)

All models below were downloaded from Poly Haven, converted to meshopt-compressed
GLB with WebP textures via `@gltf-transform/cli`, and mesh-simplified for
real-time use (**Modified: Yes** — decimation + compression only, no authorship
changes). Files live in `public/assets/models/`.

| Asset | Source | Use in game |
|---|---|---|
| Jacaranda Tree | https://polyhaven.com/a/jacaranda_tree | Large flowering garden trees |
| Island Tree 02 | https://polyhaven.com/a/island_tree_02 | Mid-size garden trees |
| Fern 02 | https://polyhaven.com/a/fern_02 | Ground flora |
| Flower Gazania | https://polyhaven.com/a/flower_gazania | Ground flora |
| Flower Empodium | https://polyhaven.com/a/flower_empodium | Ground flora |
| Crystalline Iceplant | https://polyhaven.com/a/crystalline_iceplant | Ground flora |
| Coast Rocks 05 | https://polyhaven.com/a/coast_rocks_05 | Rock formations |
| Lantern 01 | https://polyhaven.com/a/Lantern_01 | Hanging garden lanterns |
| Horse Statue 01 | https://polyhaven.com/a/horse_statue_01 | Carousel mounts |
| Gothic Statue | https://polyhaven.com/a/gothic_statue | Garden centrepiece statue |
| Garden Gnome | https://polyhaven.com/a/garden_gnome | Pond-side decoration |

Poly Haven assets are CC0 (public domain): https://polyhaven.com/license

## 3D Models (Polygonal Mind, CC0)

From the Polygonal Mind Open Source Initiative "Crystal Crossroads" pack, GLB
conversions by ToxSam: https://github.com/ToxSam/cc0-models-Polygonal-Mind

| Asset | File | Use in game |
|---|---|---|
| Crystal_Small_01 | `public/assets/models/crystal_small.glb` | Wand-charge gem HUD |
| Crystal_Cluster | `public/assets/models/crystal_cluster.glb` | Garden crystal formations |

**Modified:** No (used as-is; recoloured at runtime via materials).

## Everything else

All creatures, garden decorations, the greenhouse, the carousel centrepiece,
bubbles, particles, and UI art are **procedural originals** generated in code
(Three.js primitives and materials) for this project.

All sound is **synthesised at runtime** with the Web Audio API (oscillators and
noise bursts) — no external audio recordings are used. The audio engine also
supports optional CC0 sample files at `public/assets/sfx/pop.ogg` and
`public/assets/sfx/thunk.ogg` (none are currently bundled); if you add samples
there, record their source and licence here.

## Libraries

- **Three.js** — MIT — https://threejs.org
- **Rapier 3D** (`@dimforge/rapier3d-compat`) — Apache-2.0 — https://rapier.rs
- **Vite** — MIT — https://vitejs.dev
- **TypeScript** — Apache-2.0 — https://www.typescriptlang.org
