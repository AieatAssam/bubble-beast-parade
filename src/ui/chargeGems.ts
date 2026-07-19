import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CHARGE_MAX, CHARGE_OVERCHARGE_MAX } from "../data/bubbleTypes";

/**
 * Wand-charge HUD: real crystal models (Polygonal Mind CC0) in a small
 * transparent WebGL overlay.
 *
 * State language:
 * - EMPTY: dark smoky husk, shrunken, barely visible.
 * - FILLING: glowing liquid rises inside the husk (clipping-plane fill),
 *   matching regen progress exactly.
 * - FULL: bright cyan crystal, full size, gentle pulse + slow spin.
 * - OVERCHARGE (4th slot): golden crystal with stronger pulse.
 */

const SLOT_W = 64;
const CANVAS_H = 84;

interface GemSlot {
  root: THREE.Group;
  husk: THREE.Group;
  core: THREE.Group;
  clip: THREE.Plane;
  coreMats: THREE.MeshPhysicalMaterial[];
  huskMats: THREE.MeshPhysicalMaterial[];
  /** Displayed fill 0..1 (smoothed toward target). */
  shown: number;
  gold: boolean;
}

export class ChargeGems {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private slots: GemSlot[] = [];
  private ready = false;
  private popT = new Array<number>(CHARGE_OVERCHARGE_MAX).fill(1); // full-pop bounce timer
  private lastFull = new Array<boolean>(CHARGE_OVERCHARGE_MAX).fill(true);

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = `width:${SLOT_W * CHARGE_OVERCHARGE_MAX}px;height:${CANVAS_H}px;display:block;`;
    parent.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(SLOT_W * CHARGE_OVERCHARGE_MAX, CANVAS_H, false);
    this.renderer.localClippingEnabled = true;
    this.renderer.toneMapping = THREE.NoToneMapping; // keep gem hues saturated

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, (SLOT_W * CHARGE_OVERCHARGE_MAX) / CANVAS_H, 0.1, 50);
    this.camera.position.set(0, 0.1, 7.6);
    this.camera.lookAt(0, -0.05, 0);
    this.scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x334, 3.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(2, 4, 5);
    this.scene.add(key);

    void this.build();
  }

  private async loadCrystal(): Promise<THREE.Group | null> {
    try {
      const gltf = await new GLTFLoader().loadAsync("assets/models/crystal_small.glb");
      return gltf.scene;
    } catch {
      return null;
    }
  }

  private async build(): Promise<void> {
    const src = await this.loadCrystal();
    const proto = new THREE.Group();
    if (src) {
      // Normalise the model to unit height, centred
      const box = new THREE.Box3().setFromObject(src);
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      src.position.sub(centre);
      src.scale.setScalar(1.9 / Math.max(size.y, 1e-4));
      proto.add(src);
    } else {
      // Procedural fallback gem: stretched octahedron
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), new THREE.MeshPhysicalMaterial());
      gem.scale.set(0.7, 1.15, 0.7);
      proto.add(gem);
    }

    const totalW = CHARGE_OVERCHARGE_MAX * 1.85;
    for (let i = 0; i < CHARGE_OVERCHARGE_MAX; i++) {
      const gold = i >= CHARGE_MAX;
      const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), -1.2); // hides core above constant
      const root = new THREE.Group();
      root.position.x = -totalW / 2 + 1.85 * (i + 0.5);

      const mkMats = (isCore: boolean): { group: THREE.Group; mats: THREE.MeshPhysicalMaterial[] } => {
        const group = proto.clone(true);
        const mats: THREE.MeshPhysicalMaterial[] = [];
        group.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            const m = new THREE.MeshPhysicalMaterial(
              isCore
                ? {
                    color: gold ? 0xffc23a : 0x18c8ff,
                    emissive: gold ? 0xff9a00 : 0x18b8ff,
                    emissiveIntensity: 0.8,
                    roughness: 0.05,
                    metalness: 0.05,
                    transmission: 0.12,
                    thickness: 0.6,
                    clippingPlanes: [clip],
                  }
                : {
                    color: 0x10182c,
                    emissive: 0x060a16,
                    emissiveIntensity: 0.2,
                    roughness: 0.4,
                    metalness: 0.1,
                    transparent: true,
                    opacity: 0.5,
                  },
            );
            o.material = m;
            mats.push(m);
          }
        });
        return { group, mats };
      };

      const huskR = mkMats(false);
      const coreR = mkMats(true);
      coreR.group.scale.multiplyScalar(0.995); // core sits just inside the husk
      root.add(huskR.group, coreR.group);
      this.scene.add(root);
      this.slots.push({
        root,
        husk: huskR.group,
        core: coreR.group,
        clip,
        coreMats: coreR.mats,
        huskMats: huskR.mats,
        shown: 1,
        gold,
      });
    }
    this.ready = true;
  }

  /**
   * charges: whole crystals available; progress: 0..1 regen of the next one.
   * Renders every frame from the HUD update.
   */
  update(dt: number, t: number, charges: number, progress: number): void {
    if (!this.ready) return;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i]!;
      const target = i < charges ? 1 : i === charges ? progress : 0;

      // Smooth fill so the liquid visibly rises
      s.shown += (target - s.shown) * Math.min(1, dt * 8);
      const fill = s.shown;

      // Clip plane: -1.2 (empty, core fully hidden) → +1.2 (full)
      s.clip.constant = -1.15 + fill * 2.3;

      const isFull = target >= 1;
      // Bounce when a crystal completes
      if (isFull && !this.lastFull[i]) this.popT[i] = 0;
      this.lastFull[i] = isFull;
      this.popT[i] = Math.min(this.popT[i]! + dt * 3, 1);
      const bounce = 1 + Math.sin(Math.min(this.popT[i]!, 1) * Math.PI) * 0.28;

      // Scale + motion: full crystals large and alive, empty husks small and still
      const baseScale = 0.55 + fill * 0.45;
      const pulse = isFull ? 1 + Math.sin(t * 3.2 + i) * 0.05 : 1;
      s.root.scale.setScalar(baseScale * pulse * bounce);
      s.root.rotation.y = isFull ? t * 0.9 + i : Math.sin(t * 0.6 + i) * 0.15;

      // Core glow strength follows fill; husk darkens when drained
      for (const m of s.coreMats) {
        m.emissiveIntensity = 0.35 + fill * (s.gold ? 0.9 : 0.65) + (isFull ? Math.sin(t * 3.2 + i) * 0.12 : 0);
      }
      for (const m of s.huskMats) {
        m.opacity = 0.3 + (1 - fill) * 0.3;
      }

      // Overcharge slot: tiny dim socket until earned, golden crystal when held
      if (s.gold && charges <= CHARGE_MAX) {
        s.root.visible = true;
        s.root.scale.setScalar(0.2);
        s.core.visible = false;
        for (const m of s.huskMats) m.opacity = 0.22;
      } else {
        s.root.visible = true;
        s.core.visible = true;
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
}
