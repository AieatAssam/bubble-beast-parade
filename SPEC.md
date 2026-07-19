# Build Prompt: "Bubble Beast Parade" — complete browser 3D game

Build a complete, playable, browser-only 3D game called **Bubble Beast Parade**.

This is a private local prototype. Implement the game now, in full, in a single session. Do not reply with only a design, plan, pseudocode, or placeholders. Keep it reliably runnable at every stage — after each major system lands, the project must still `npm run dev` into a colourful playable scene.

---

## 0. Non-negotiable engine and asset rules

**Use existing engines and libraries. Do not build your own renderer, physics engine, animation system, or asset pipeline.**

- **Rendering / scene / animation / loading / raycasting / post-processing:** Three.js (latest stable). Use its built-in facilities — `GLTFLoader`, `AnimationMixer`, `WebGLRenderer`, `Raycaster`, `EffectComposer`/post-processing, `PMREMGenerator` for HDRI — rather than reimplementing any of them.
- **Physics:** Rapier 3D, WASM build, via npm (`@dimforge/rapier3d` or `@dimforge/rapier3d-compat`). Use Rapier **only** for lightweight bubble drift/separation and decorative knockback. Do **not** build a heavy simulation — no stacking, ragdolls, or complex constraints.
- **Build tooling:** TypeScript (strict) + Vite. Must run with `npm install` && `npm run dev`, and build cleanly with `npm run build`.
- **No** backend, accounts, runtime external API, ads, payment, premium currency, daily streak, timed shop, or login.
- **Persistence:** IndexedDB with a small typed wrapper. LocalStorage only as a safe fallback.
- **Leaderboard:** genuine device-local only. Label it exactly **"This Device Leaderboard"**. No misleading "global" label.
- Support **desktop mouse and touch**.
- Visible **loading screen** with clear loading/error fallback if optional art assets fail to fetch or decode.
- **WebGL** is the reliable default. Attempt WebGPU only if it is a stable enhancement and never at the cost of broad compatibility.

If a choice is ever between "more features" and "reliably runnable + polished", choose reliably runnable + polished.

---

## 1. Assets and licences — obtain real CC assets during the build

Actively fetch suitable **free, downloadable, license-compatible** 3D assets while building. Download them into `/public/assets/` — never hot-link at runtime.

- Prefer **Poly Haven** (CC0) for HDRIs, textures, and environment assets.
- Use **Sketchfab** models only where the licence is compatible. Prefer **CC0 or CC BY**.
- **Never** use CC BY-NC, non-downloadable, paid, or unknown-licence assets. Never use copyrighted franchise characters or scraped content.
- Prefer **GLB / glTF 2.0** with embedded animations.
- Set up **Draco / Meshopt / KTX2**-ready loaders where practical, but keep the first load reliable.
- Build **attractive procedural fallback geometry** for any asset that is absent or fails to decode — the scene must never look grey, blocky, or empty.
- Create **`/ATTRIBUTIONS.md`**: one entry per external asset — name, creator, source URL, exact licence, and whether it was modified.
- Create an **asset manifest** the loader reads from.

Use a small number of genuinely high-detail assets well:
1. One polished, colourful, **rigged hero mascot** for the title screen and gallery.
2. **6–10 distinct high-poly animated Bubble Beast** GLB creatures.
3. One **ornate high-poly centrepiece** (greenhouse carousel / statue).
4. A dense set of **decorative garden assets**, **instanced** for repeats (flowers, leaves, crystals, lanterns, petals, stars, tiny bubbles).

Optimise everything that isn't a focal object: instancing for repeats, sprites/particles for glitter and distant bubbles, pooling for all bubbles/particles/lights/score popups, limited dynamic shadow-casting lights, selective shadows, fog, bloom, emissive materials, HDRI lighting, colour grading.

---

## 2. Visual direction — the WOW bar

A joyful, visually lavish **magical bubble conservatory**: a shallow angled 3D diorama of a huge glass greenhouse with a central animated parade carousel.

- Extremely colourful, glossy, magical, **premium toy-diorama** look.
- Iridescent refractive bubbles, rainbow-refracted lighting, turquoise glass, giant flowers, jewel leaves, crystal ponds, bright lanterns, glowing mushrooms, floating ribbons, fireflies, confetti petals, soft volumetric-looking fog.
- Palette: cyan, pink, violet, gold, lime, orange, deep midnight-blue shadows.
- Use depth, parallax, reflection/refraction-style bubble materials (env-mapped, Fresnel, thin-film iridescence), bloom, emissive elements, soft shadows, high-quality PBR.
- Deliberately authored, lively, dense — never blocky or low-poly-looking.
- Provide **reduced-motion** and **bloom/effects-quality** settings with sensible defaults.

The central carousel/statue **idles continuously**, subtly reacts to large captures, and performs an **unmistakable grand-finale animation** at the end of each round.

---

## 3. Core interaction — direct pointer wand

The player controls a magical **Bubble Wand** directly via mouse/touch position.

- Convert pointer position to a **world-space raycast** over the garden play area.
- A glowing wand cursor follows the pointer with slight smoothing and trails a **coloured particle ribbon**.
- Click/tap pops the currently targeted eligible bubble.
- Large clear **hover highlight + ring + sound cue**. Input must feel instant and responsive.
- One **90-second** score-attack round, with **instant replay**.

No character movement, combat, free-roam camera, inventory drag/drop, multiplayer, procedural maps, or navigation.

---

## 4. Pop feel — the single most important thing in the game

**Nail this one interaction before layering anything else.** Every successful pop must combine, in one tightly-timed burst:

- **Hit-stop:** ~40–60ms freeze on contact (scaled/skipped under reduced-motion) to give the pop weight.
- **Bubble deformation:** squash-then-burst over ~2–3 frames — the shell stretches, then shatters, never just vanishes.
- **Colour shockwave:** a ring scaled to the bubble's colour that expands outward and fades.
- **Particle burst:** weighted toward the bubble's own colour family; shards, sparkles, a few slow glitter motes.
- **Creature reaction:** the captured beast plays a short capture/emote clip as it's drawn in.
- **Sound:** a layered pop —
  - a bright top sparkle/"pop",
  - a **low-end thunk** underneath for body and weight,
  - **per-pop pitch variation** (±small random) so it never sounds mechanical,
  - **spatialised-style** panning based on screen position.
- **Score popup:** floating number that pops in, drifts up, and fades.

**Chain audio:** each same-colour pop in a chain steps the pop pitch **up one semitone**, so a long chain plays an **ascending musical run** — the player *hears* their skill compounding. Reset the pitch ladder when the chain resets.

Provide **reduced-flash** and **reduced-motion** options that tame hit-stop, screen-shake, bloom spikes, and rapid flashes without gutting the satisfaction. Avoid seizure-risk flashing by default.

Source **satisfying sound assets** (CC0/CC-BY, e.g. Freesound CC0, Kenney audio) for pops, sparkles, thunk layer, chain steps, charge ping, prism reveals, Grand entrance, and UI. Attribute them in `ATTRIBUTIONS.md`. Provide synthesised fallbacks (WebAudio) if a sound asset is missing, so the game is never silent.

---

## 5. Charge economy + triage — the "which bubble do I pop?" decision

The game must **never let the player pop everything**. The core tension is scarcity and triage: the wand is a rationed resource, and the best bubbles are the riskiest to wait for.

**Wand charges:**
- **Three visible charges**, shown as an animated **wand-crystal** UI with immediately readable states (full / spending / regenerating / overcharged).
- Popping a **normal** bubble costs **one charge**.
- Regenerate **one charge every 1.2s**.
- **Keep charges genuinely scarce — do not soften this.** A player who pops every standard bubble on sight should routinely be **empty** when something valuable drifts in. That starvation is the point; it's what forces the decision. The whole decision space collapses if charges feel abundant.

**Value-inverse dissipation — best bubbles last least, dissipate fastest:**
Each valuable bubble has a **visible, honest dissipation window** — a shrinking shimmer ring, fading opacity, and a wobble that intensifies as it nears harmless expiry. The player can always see the window closing and therefore always **owns** the decision to spend or save.

Tier the lifespan **inversely to value**:
- **Standard:** lingers — low stakes, pop freely when you have spare charges.
- **Colour Bond / Chorus:** mid-length windows.
- **Golden:** **fast** dissipation — saving a charge for it is a real bet against the clock.
- **Grand:** appears in the final five seconds with a big signalled entrance and the **tightest window of all**, making the finale a genuine "do I have a charge banked for this?" climax.

**Reward the save, not just the pop:**
- Popping a **Golden** or **Grand** at the right moment **refunds the charge (or grants brief overcharge)** plus bigger score and a louder celebration — so disciplined banking **snowballs** into more options.
- A **perfectly-timed chain pop** also refunds a charge with a bright crystal **ping** and a visible crystal-refill animation.
- The reflex player stays charge-starved; the patient/skilled player builds momentum. That gap **is** the skill gradient.

**Opportunity cost via the player's own greed, not punishment:**
- Don't penalise popping standards — scarcity already does the work.
- Make **Colour Bond chains** tempting enough that chasing a long chain risks leaving you empty for an incoming Golden. Let ambition be the trap.

Never use a real-world timer, daily reset, energy payment, loss streak, forced waiting, or advertisement. All pressure is in-round and transparent.

---

## 6. Bubble types (six, each unmistakable by silhouette, colour, material, sound, VFX, tooltip)

1. **Standard** — transparent iridescent shell, clearly visible beast inside; captures that beast for score.
2. **Colour Bond** — saturated single-colour aura + orbiting ribbon; extends a same-colour chain.
3. **Chorus** — a central bubble with three smaller orbiting bubbles; one well-timed pop captures all.
4. **Prism** — faceted rainbow crystal; starts one temporary event from the **disclosed** pool (§7).
5. **Golden** — ornate gold filigree, heavy sparkles, slow majestic movement; enhanced creature variant + high score; **fast dissipation**.
6. **Grand** — huge ornate finale bubble in the final five seconds after a clearly signalled entrance; showcase capture; **tightest window**.

Bubbles drift along **hand-authored looping paths** and gently repel each other (this is the Rapier job). Paths must be **readable and graceful** — never chaotic or impossible to target.

---

## 7. Variable rewards — rich but fully transparent

Implement a rich variable-reward system with **clear rules**, never tied to payment or to removing player content.

**All Prism outcomes are shown in the in-game help screen with exact odds:**
- **Rainbow Draft — 25%:** nearby bubbles orbit the cursor for 7s.
- **Bubble Bloom — 20%:** each popped eligible bubble splits into several low-value mini-bubbles for 8s.
- **Parade Line — 20%:** beasts form a slow predictable line across the playfield for 8s.
- **Mirror Pop — 15%:** the next three valid pops echo to nearby eligible bubbles.
- **Crystal Rain — 12%:** the centre fountain releases high-value crystal bubbles.
- **Colour Carnival — 8%:** a clearly shown target colour gives **3× score** for 8s and recolours the conservatory.

For every outcome: reveal it after a short **0.5–1.0s** celebratory animation; give it a unique icon, animation, sound, colour treatment, and effect. The pre-reveal beat is honest anticipation, **not** a spinning reel.

**Explicitly forbidden:** fake near-misses, reel-spin teases, "almost rare" messaging, concealed odds, paid keys, premium currency, duplicate-conversion pressure, forced waiting, loss-based prompts. Every score change must have an **obvious, disclosed reason**.

---

## 8. Creature collection — Bubble Beast Library

A persistent 3D **Bubble Beast Library**, rendered in-scene or as a dedicated gallery.

At least **10 named creatures**: 3 Common, 3 Uncommon, 2 Rare, 1 Epic, 1 Mythic. Use the best legitimate high-poly animated GLB models available.

Each creature: unique name, colour family, rarity, score value, flavour text; idle + capture/release reaction (more clips if present); **large 3D inspect view with turntable rotation** and showcase background; stats — first-capture timestamp, total captures, best chain at capture, total points earned; an obvious **visual** rarity treatment (not text only).

Rarity visual language:
- **Common:** clear bright bubble, simple ring, compact card.
- **Uncommon:** dual-colour trail, small accessory/halo.
- **Rare:** emissive details, motes, animated card frame.
- **Epic:** distinct silhouette, companion particles, elaborate display stand.
- **Mythic:** dramatic dedicated plinth, custom aura/soundscape, **cinematic intro on first capture**.

All creatures remain obtainable **indefinitely** — no calendar-locked species.

**First-capture payoff:** a new beast earns a real moment — card frame animating in, plinth reveal, and for Mythic the cinematic intro. Rarity is *felt* through escalating production value. This long-arc reward gives the 90-second rounds a reason to accumulate.

---

## 9. Scoring, chains, pacing

- Base score driven by capture rarity and bubble type.
- Colour matching builds a **visible chain multiplier**.
- Chain resets only by a clearly communicated **short in-round timeout** or a **mismatched capture** — never by real-world absence.
- HUD shows: floating score numbers, current chain, max chain, capture count, wand charges, colour target, timer, pause.

**Round intensity curve:** calm opening → escalating bubble density and layered music → **signalled Grand Bubble finale** with the carousel's grand animation → clean results screen that **counts the score up with satisfying tick sounds** and celebrates new captures. End on a high.

---

## 10. Persistence and data controls (IndexedDB)

Persist: player profile (name, theme, settings); captures (creature ID, rarity, variant/colour, first-capture time, count, best chain, points); runs (score, duration, capture count, max chain, effects triggered, timestamp); unlocks (themes, wand trails, achievements); leaderboard records.

Implement: auto-save after each capture and at run end; **export** save as JSON; **import** valid JSON with confirmation; **"Reset all local data"** with a clear confirmation dialog; a **privacy note** that data lives only in this browser/device for this prototype.

---

## 11. Device-local leaderboard

Attractive board titled exactly **"This Device Leaderboard"**:
- Top 10 total scores, Top 10 max chains, Top 10 most beasts in one run, Latest 20 runs.
- Each row: name, date, score, max chain, captured count, selected mascot/rarity badge.
- Include a **future-ready leaderboard service interface** (typed seam) but **no** server, auth, or pretend online scores.

---

## 12. Screens

1. **Title** — mascot animation, greenhouse showcase, Play / Library / Leaderboard / Settings / Credits.
2. **Gameplay HUD** — timer, score, chain, charges, colour target, pause.
3. **Pause / Help** — controls, every bubble type, every Prism outcome + exact odds.
4. **Results** — score breakdown, best records, new captures, instant replay.
5. **Bubble Beast Library.**
6. **This Device Leaderboard.**
7. **Settings** — volume, mute, reduced motion, reduced flash, bloom/effects quality, reset/export/import.
8. **Credits** + `ATTRIBUTIONS.md` acknowledgement.

All screens polished and animated. All interactions work with **mouse and touch**.

---

## 13. Code quality and validation

- Coherent modular structure: `systems/`, `rendering/`, `input/`, `entities/`, `ui/`, `persistence/`, `assets/`, `data/` (tables for bubbles, creatures, prism odds, scoring). **No monolithic script.**
- **Strict TypeScript.**
- Clear **README** with setup and browser requirements; asset manifest; `ATTRIBUTIONS.md`.
- Object pooling for bubbles, particles, lights, score popups.
- Confirm `npm run build` succeeds.
- **Definition of done:** opens to a colourful playable scene, supports a full 90-second loop with responsive pointer popping, enforces charge scarcity and value-inverse dissipation so the player must triage, delivers the full pop-feel stack, saves captures to IndexedDB, and renders the This Device Leaderboard.

Prefer reliable, polished interaction and visual/audio feedback over feature count. Do not finish until the definition of done is met.
