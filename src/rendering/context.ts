import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { TIME_OF_DAY, TIME_OF_DAY_IDS, type TimeOfDayDef, type TimeOfDayId } from "../data/timeOfDay";

export interface RenderContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  /** Set bloom quality: 0 off, 1 low, 2 full. */
  setEffectsQuality(q: 0 | 1 | 2): void;
  render(): void;
  resize(): void;
}

/** Camera frames a shallow angled diorama: looking slightly down into the greenhouse. */
export function createRenderContext(container: HTMLElement): RenderContext {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1035);
  scene.fog = new THREE.FogExp2(0x141a4a, 0.028);

  const camera = new THREE.PerspectiveCamera(
    46,
    container.clientWidth / container.clientHeight,
    0.1,
    120,
  );
  camera.position.set(0, 7.2, 15.5);
  camera.lookAt(0, 2.2, 0);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(container.clientWidth, container.clientHeight),
    0.3, // strength
    0.5, // radius
    0.88, // threshold
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let effectsQuality: 0 | 1 | 2 = 2;

  const ctx: RenderContext = {
    renderer,
    scene,
    camera,
    composer,
    bloom,
    setEffectsQuality(q) {
      effectsQuality = q;
      bloom.enabled = q > 0;
      bloom.strength = q === 2 ? 0.3 : 0.18;
    },
    render() {
      if (effectsQuality > 0) composer.render();
      else renderer.render(scene, camera);
    },
    resize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    },
  };
  window.addEventListener("resize", () => ctx.resize());
  return ctx;
}

interface AssetManifest {
  hdri?: Record<string, { path: string }>;
  sfx?: Record<string, { path: string }>;
}

/** Load the asset manifest; a missing manifest simply means "all fallbacks". */
export async function loadManifest(): Promise<AssetManifest> {
  try {
    const res = await fetch("assets/manifest.json");
    if (!res.ok) return {};
    return (await res.json()) as AssetManifest;
  } catch {
    return {};
  }
}

export interface SkyboxEntry {
  /** Background texture — the HDRI rendered directly as sky. */
  background: THREE.Texture;
  /** PMREM-processed texture for reflections/IBL. */
  environment: THREE.Texture;
}

export type SkyboxSet = Map<TimeOfDayId, SkyboxEntry>;

/**
 * Preload every time-of-day HDRI once (during the loading screen) so
 * switching skybox between rounds is instant with no reload jank. A kind
 * that fails to fetch/decode is simply absent from the returned map —
 * applyTimeOfDay falls back to a procedural gradient sky for it.
 */
export async function loadSkyboxSet(ctx: RenderContext): Promise<SkyboxSet> {
  const pmrem = new THREE.PMREMGenerator(ctx.renderer);
  const set: SkyboxSet = new Map();
  await Promise.all(
    TIME_OF_DAY_IDS.map(async (id) => {
      try {
        const def = TIME_OF_DAY[id];
        const tex = await new RGBELoader().loadAsync(def.hdriPath);
        tex.mapping = THREE.EquirectangularReflectionMapping;
        const envMap = pmrem.fromEquirectangular(tex).texture;
        set.set(id, { background: tex, environment: envMap });
      } catch {
        // Absent from the set — applyTimeOfDay uses the procedural fallback.
      }
    }),
  );
  pmrem.dispose();
  return set;
}

/** Apply a time-of-day preset's skybox + fog/exposure to the render context. */
export function applyTimeOfDay(ctx: RenderContext, def: TimeOfDayDef, skyboxes: SkyboxSet): boolean {
  const entry = skyboxes.get(def.id);
  ctx.renderer.toneMappingExposure = def.toneMappingExposure;
  if (ctx.scene.fog instanceof THREE.FogExp2) {
    ctx.scene.fog.color.setHex(def.fogColor);
    ctx.scene.fog.density = def.fogDensity;
  }
  if (entry) {
    ctx.scene.environment = entry.environment;
    ctx.scene.background = entry.background;
    ctx.scene.backgroundBlurriness = def.backgroundBlurriness;
    ctx.scene.backgroundIntensity = def.backgroundIntensity;
    ctx.scene.environmentIntensity = def.environmentIntensity;
    return true;
  }
  // Procedural fallback: soft gradient room so materials still get reflections.
  const pmrem = new THREE.PMREMGenerator(ctx.renderer);
  const envScene = new THREE.Scene();
  const grad = new THREE.Mesh(
    new THREE.SphereGeometry(10, 16, 16),
    new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }),
  );
  const geo = grad.geometry;
  const colors: number[] = [];
  const pos = geo.getAttribute("position");
  const cTop = new THREE.Color(def.sunColor);
  const cBottom = new THREE.Color(def.fogColor);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) / 10 + 1) / 2;
    const c = cBottom.clone().lerp(cTop, t);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  envScene.add(grad);
  ctx.scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  ctx.scene.background = new THREE.Color(def.fogColor);
  ctx.scene.environmentIntensity = def.environmentIntensity;
  pmrem.dispose();
  return false;
}
