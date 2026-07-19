import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

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
    0.55, // strength
    0.6, // radius
    0.82, // threshold
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
      bloom.strength = q === 2 ? 0.55 : 0.32;
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

/** Load the Poly Haven HDRI as environment; resolves even on failure (fallback env). */
export async function applyEnvironment(ctx: RenderContext, manifest: AssetManifest): Promise<boolean> {
  const pmrem = new THREE.PMREMGenerator(ctx.renderer);
  try {
    const path = manifest.hdri?.environment?.path;
    if (!path) throw new Error("no hdri in manifest");
    const tex = await new RGBELoader().loadAsync(path);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    ctx.scene.environment = pmrem.fromEquirectangular(tex).texture;
    // Real sky: the HDRI itself as background (kept, not disposed)
    ctx.scene.background = tex;
    ctx.scene.backgroundBlurriness = 0.09;
    ctx.scene.backgroundIntensity = 0.38; // dusk: keep the sky readable but let the garden glow lead
    ctx.scene.environmentIntensity = 0.5; // stop bright-sky IBL from washing out pale materials
    if (ctx.scene.fog instanceof THREE.FogExp2) {
      ctx.scene.fog.color.setHex(0x4a3560); // warm sunset haze to match the HDRI horizon
      ctx.scene.fog.density = 0.016;
    }
    pmrem.dispose();
    return true;
  } catch {
    // Procedural fallback: soft gradient room so materials still get reflections.
    const envScene = new THREE.Scene();
    const grad = new THREE.Mesh(
      new THREE.SphereGeometry(10, 16, 16),
      new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }),
    );
    const geo = grad.geometry;
    const colors: number[] = [];
    const pos = geo.getAttribute("position");
    const cTop = new THREE.Color(0xffd9a0);
    const cBottom = new THREE.Color(0x2a1a5e);
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) / 10 + 1) / 2;
      const c = cBottom.clone().lerp(cTop, t);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    envScene.add(grad);
    ctx.scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();
    return false;
  }
}
