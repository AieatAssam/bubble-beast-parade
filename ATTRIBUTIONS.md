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
