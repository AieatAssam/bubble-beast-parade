# Bubble Beast Parade 🫧

A complete, playable, browser-only 3D game: a magical bubble conservatory where
you pop bubbles with a wand to capture Bubble Beasts across 90-second
score-attack rounds. Private local prototype — no backend, no accounts, no ads.

## Setup

```bash
npm install
npm run dev      # open http://localhost:5173
npm run build    # typecheck + production build into dist/
npm run preview  # serve the production build
```

## Browser requirements

- A desktop or mobile browser with **WebGL 2** (Chrome, Edge, Firefox, Safari 16+).
- Mouse **or** touch input.
- IndexedDB for saves (falls back to localStorage automatically).
- WebAssembly (for the Rapier physics engine).

## How to play

- Move the pointer to steer the glowing wand; **click / tap** the highlighted
  bubble to pop it.
- Popping costs one **wand crystal** (3 max, one regenerates every 1.2 s) —
  crystals are deliberately scarce, so choose which bubbles deserve them.
- The most valuable bubbles (**Golden**, **Grand**) dissipate fastest; their
  shrinking shimmer ring shows the window closing. Popping them **refunds** the
  crystal — banking charges for them is the core skill.
- Same-colour pops build a **chain multiplier**; each chain pop rises one
  semitone, and perfectly-timed chain pops also refund a crystal.
- **Prism** bubbles trigger one of six disclosed events — exact odds are in the
  in-game Help (pause) screen.
- Captured beasts persist in the **Bubble Beast Library**; records go to the
  **This Device Leaderboard** (device-local only, by design).

## Project layout

```
src/
  audio/         WebAudio engine (synth pops, chain semitone ladder, music)
  data/          Design tables: bubbles, creatures, prism odds, colours
  entities/      Bubble pool + per-kind visuals
  input/         Pointer wand (raycast, hover ring, ribbon trail)
  persistence/   Typed IndexedDB wrapper, save export/import, leaderboard seam
  rendering/     Renderer/bloom context, procedural conservatory, creatures
  systems/       Game round controller, spawner paths, Rapier physics, pop VFX
  ui/            HUD + all screens (title/pause/results/library/board/settings/credits)
public/assets/   Downloaded assets + manifest.json (all optional at runtime)
```

Every external asset is listed in [ATTRIBUTIONS.md](ATTRIBUTIONS.md). Missing
assets always fall back to procedural geometry / synthesised audio, so the game
runs from a clean checkout with no extra downloads.

## Data & privacy

All data (settings, captures, runs, leaderboard) lives in this browser's
IndexedDB only. Settings screen offers JSON export/import and a full reset.
