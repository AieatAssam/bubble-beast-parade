import * as THREE from "three";
import { createRenderContext, applyEnvironment } from "./rendering/context";
import { createGarden } from "./rendering/garden";
import { createPhysicsWorld } from "./systems/physics";
import { BubblePool } from "./entities/bubble";
import { PopFX } from "./systems/popfx";
import { createPointerWand } from "./input/pointer";
import { Game } from "./systems/game";
import { Hud } from "./ui/hud";
import { Screens } from "./ui/screens";
import { injectStyles } from "./ui/style";
import { sound } from "./audio/sound";
import { CREATURES_BY_ID, RARITY_LABEL, RARITY_ORDER, type Rarity } from "./data/creatures";
import {
  loadProfile, saveProfile, loadCaptures, saveCapture, localLeaderboard,
  type CaptureRecord, type ProfileRecord,
} from "./persistence/db";

// ---------------- Loading screen ----------------
const loadingEl = document.createElement("div");
loadingEl.id = "loading-screen";
loadingEl.innerHTML =
  `<div class="bubble-loader"></div><h2 style="margin:0">Bubble Beast Parade</h2>` +
  `<div id="loading-bar"><div id="loading-fill"></div></div>` +
  `<div id="loading-status" style="opacity:.8">Warming up the conservatory…</div>`;
document.body.appendChild(loadingEl);
const setProgress = (pct: number, status: string): void => {
  const fill = document.getElementById("loading-fill");
  const st = document.getElementById("loading-status");
  if (fill) fill.style.width = `${pct}%`;
  if (st) st.textContent = status;
};

async function boot(): Promise<void> {
  injectStyles();
  const app = document.getElementById("app")!;
  const uiLayer = document.createElement("div");
  uiLayer.id = "ui-layer";
  document.body.appendChild(uiLayer);

  setProgress(10, "Raising the glass dome…");
  const ctx = createRenderContext(app);

  setProgress(30, "Catching the sunset…");
  const envOk = await applyEnvironment(ctx);
  if (!envOk) console.warn("[bbp] HDRI failed to load — using procedural environment");

  setProgress(50, "Planting the jewel garden…");
  const garden = createGarden();
  ctx.scene.add(garden.group);

  setProgress(65, "Waking the physics fairies…");
  const physics = await createPhysicsWorld();

  setProgress(80, "Blowing the first bubbles…");
  const bubbleContainer = new THREE.Group();
  ctx.scene.add(bubbleContainer);
  const pool = new BubblePool(bubbleContainer, physics);
  const fx = new PopFX(ctx.scene, uiLayer);
  const wand = createPointerWand(ctx.renderer.domElement, ctx.camera, ctx.scene);

  // ---------------- Persistence ----------------
  let profile: ProfileRecord = await loadProfile();
  let captures: CaptureRecord[] = await loadCaptures();
  const captureMap = new Map(captures.map((c) => [c.creatureId, c]));

  const applySettings = (): void => {
    sound.setVolume(profile.settings.volume);
    sound.setMuted(profile.settings.muted);
    fx.reducedMotion = profile.settings.reducedMotion;
    fx.reducedFlash = profile.settings.reducedFlash;
    game.reducedMotion = profile.settings.reducedMotion;
    wand.setReducedMotion(profile.settings.reducedMotion);
    ctx.setEffectsQuality(profile.settings.effectsQuality);
  };

  // ---------------- Screens + HUD ----------------
  const screens = new Screens(uiLayer);
  const hud = new Hud(uiLayer, () => {
    if (game.running && !game.paused) {
      game.paused = true;
      screens.showPause();
    }
  });

  const newCaptureDefs: typeof captures = [];
  let newCreaturesThisRun: string[] = [];

  const game: Game = new Game(pool, fx, wand, garden, ctx.camera, {
    onCapture(e) {
      if (e.bubble.kind === "prism") return;
      const def = e.bubble.creature;
      const now = Date.now();
      let rec = captureMap.get(def.id);
      if (!rec) {
        rec = {
          creatureId: def.id, rarity: def.rarity, color: def.color,
          firstCaptureAt: now, count: 0, bestChain: 0, totalPoints: 0,
        };
        captureMap.set(def.id, rec);
        newCreaturesThisRun.push(def.id);
        // First-capture payoff: banner (Mythic gets extra fanfare)
        hud.announce(`✨ NEW: ${def.name} (${RARITY_LABEL[def.rarity]})`, 3200);
        if (def.rarity === "mythic") {
          sound.fanfare();
          hud.announce("🌟 A MYTHIC joins the parade! 🌟", 4200);
        }
      }
      rec.count++;
      rec.bestChain = Math.max(rec.bestChain, e.chain);
      rec.totalPoints += e.score;
      void saveCapture(rec); // auto-save after each capture
    },
    onRoundEnd() {
      void (async () => {
        captures = [...captureMap.values()];
        screens.setCaptures(captures);
        const bestRarity = bestRarityOfRun(newCreaturesThisRun, captures);
        await localLeaderboard.submitRun({
          at: Date.now(),
          score: game.score,
          durationSeconds: 90,
          captureCount: game.captureCount,
          maxChain: game.maxChain,
          effectsTriggered: [...game.effectsTriggered],
          playerName: profile.name,
          bestRarity,
        });
        const best = (await localLeaderboard.topScores(1))[0]?.score ?? 0;
        hud.show(false);
        screens.showResults(
          {
            score: game.score,
            maxChain: game.maxChain,
            captureCount: game.captureCount,
            newCaptures: newCreaturesThisRun
              .map((id) => CREATURES_BY_ID.get(id))
              .filter((x): x is NonNullable<typeof x> => Boolean(x)),
            bestScoreEver: best,
          },
          startRun,
        );
      })();
    },
    onPrism(outcome) {
      hud.announce(`${outcome.icon} ${outcome.label}! ${outcome.help}`, 3200);
    },
    onGrandEntrance() {
      hud.announce("👑 THE GRAND BUBBLE ARRIVES!", 3000);
    },
  });

  function bestRarityOfRun(ids: string[], caps: CaptureRecord[]): Rarity {
    let best: Rarity = "common";
    for (const c of caps) {
      if (RARITY_ORDER.indexOf(c.rarity) > RARITY_ORDER.indexOf(best)) best = c.rarity;
    }
    void ids;
    return best;
  }

  function startRun(): void {
    newCreaturesThisRun = [];
    screens.show(null);
    hud.show(true);
    sound.ensure();
    game.startRound();
  }

  screens.onPlay = startRun;
  screens.onResume = () => {
    game.paused = false;
    screens.show(null);
  };
  screens.onQuitToTitle = () => {
    game.running = false;
    game.paused = false;
    pool.clear();
    hud.show(false);
    sound.stopMusic();
    screens.show("title");
  };
  screens.getProfile = () => profile;
  screens.onSettingsChanged = (p) => {
    profile = p;
    applySettings();
    void saveProfile(p);
  };
  screens.setCaptures(captures);

  wand.onPop((b) => {
    sound.ensure();
    game.tryPop(b);
  });

  // Keyboard: escape pauses
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && game.running) {
      if (game.paused) screens.onResume();
      else {
        game.paused = true;
        screens.showPause();
      }
    }
  });

  applySettings();
  void newCaptureDefs;

  // Local debug handle for playtesting (private prototype, no secrets)
  (window as unknown as Record<string, unknown>).__bbp = { game, pool };

  // ---------------- Main loop ----------------
  const clock = new THREE.Clock();
  let t = 0;
  function frame(): void {
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;

    if (!game.paused) {
      physics.step(dt);
      game.update(dt, t);
      const timeScale = game.hitStop > 0 && !game.reducedMotion ? 0 : 1;
      pool.update(dt, t, timeScale);
      wand.update(dt, t, pool.active);
      fx.update(dt);
      garden.update(dt, t, game.intensity);
      hud.update(game);
    }

    ctx.render();
    requestAnimationFrame(frame);
  }

  setProgress(100, "Ready!");
  screens.buildTitle();
  frame();
  loadingEl.style.opacity = "0";
  setTimeout(() => loadingEl.remove(), 600);
}

boot().catch((err: unknown) => {
  console.error("[bbp] boot failed", err);
  setProgress(100, "Something went wrong while loading. Please refresh to try again.");
  const st = document.getElementById("loading-status");
  if (st) (st as HTMLElement).style.color = "#ff8a8a";
});
