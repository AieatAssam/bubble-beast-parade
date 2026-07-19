import * as THREE from "three";
import type { Bubble } from "../entities/bubble";

/**
 * Direct pointer wand (SPEC §3): pointer → world raycast over the play area,
 * glowing wand cursor with smoothing + particle ribbon, hover highlight.
 */
export interface PointerWand {
  group: THREE.Group;
  /** Current smoothed world position of the wand tip. */
  worldPos: THREE.Vector3;
  /** Screen-space pointer in pixels. */
  screen: { x: number; y: number };
  /** Currently hovered bubble (idle only). */
  hovered: Bubble | null;
  /** Set by consumer each frame with poppable bubbles. */
  update(dt: number, t: number, bubbles: Bubble[]): void;
  /** Register tap/click handler. */
  onPop(cb: (b: Bubble | null) => void): void;
  setReducedMotion(v: boolean): void;
}

const RIBBON_LEN = 26;

export function createPointerWand(
  dom: HTMLElement,
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
): PointerWand {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2(0, 0);
  const screen = { x: innerWidth / 2, y: innerHeight / 2 };
  // Wand moves on a plane z = 2.5 (mid play volume)
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -2.5);
  const targetPos = new THREE.Vector3(0, 3, 2.5);
  const worldPos = new THREE.Vector3(0, 3, 2.5);

  const group = new THREE.Group();
  // Glowing wand tip
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xaee8ff,
      emissiveIntensity: 3,
      roughness: 0.1,
    }),
  );
  group.add(tip);
  const tipLight = new THREE.PointLight(0x9fe8ff, 12, 8);
  group.add(tipLight);
  // Hover ring
  const hoverRing = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.05, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
  );
  scene.add(hoverRing);

  // Particle ribbon trail
  const ribbonGeo = new THREE.BufferGeometry();
  const ribbonPos = new Float32Array(RIBBON_LEN * 3);
  const ribbonCol = new Float32Array(RIBBON_LEN * 3);
  for (let i = 0; i < RIBBON_LEN; i++) {
    const hue = i / RIBBON_LEN;
    const c = new THREE.Color().setHSL(hue, 0.9, 0.65);
    ribbonCol[i * 3] = c.r;
    ribbonCol[i * 3 + 1] = c.g;
    ribbonCol[i * 3 + 2] = c.b;
  }
  ribbonGeo.setAttribute("position", new THREE.BufferAttribute(ribbonPos, 3));
  ribbonGeo.setAttribute("color", new THREE.BufferAttribute(ribbonCol, 3));
  const ribbon = new THREE.Points(
    ribbonGeo,
    new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  scene.add(ribbon);
  const trail: THREE.Vector3[] = [];
  for (let i = 0; i < RIBBON_LEN; i++) trail.push(worldPos.clone());

  scene.add(group);

  let hovered: Bubble | null = null;
  let popCb: ((b: Bubble | null) => void) | null = null;
  let reducedMotion = false;

  function updatePointer(clientX: number, clientY: number): void {
    screen.x = clientX;
    screen.y = clientY;
    const rect = dom.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, hit)) targetPos.copy(hit);
  }

  dom.addEventListener("pointermove", (e) => updatePointer(e.clientX, e.clientY));
  dom.addEventListener(
    "pointerdown",
    (e) => {
      updatePointer(e.clientX, e.clientY);
      pickHover(true);
      popCb?.(hovered);
    },
    { passive: true },
  );

  const sphere = new THREE.Sphere();
  let candidates: Bubble[] = [];

  function pickHover(force = false): void {
    void force;
    hovered = null;
    let best = Infinity;
    for (const b of candidates) {
      if (b.state !== "idle") continue;
      // Generous hit sphere for fast targeting
      sphere.set(b.pos, b.radius * 1.45);
      if (raycaster.ray.intersectsSphere(sphere)) {
        const d = b.pos.distanceTo(raycaster.ray.origin);
        if (d < best) {
          best = d;
          hovered = b;
        }
      }
    }
  }

  return {
    group,
    worldPos,
    screen,
    get hovered() {
      return hovered;
    },
    update(dt, t, bubbles) {
      candidates = bubbles;
      // Smooth follow
      const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 14);
      worldPos.lerp(targetPos, k);
      group.position.copy(worldPos);
      tip.scale.setScalar(1 + Math.sin(t * 6) * 0.12);

      pickHover();
      if (hovered) {
        hoverRing.visible = true;
        hoverRing.position.copy(hovered.pos);
        hoverRing.quaternion.copy(camera.quaternion);
        hoverRing.scale.setScalar(hovered.radius * 1.5 + Math.sin(t * 8) * 0.06);
        const m = hoverRing.material as THREE.MeshBasicMaterial;
        m.opacity = 0.85;
      } else {
        (hoverRing.material as THREE.MeshBasicMaterial).opacity *= 0.85;
        if ((hoverRing.material as THREE.MeshBasicMaterial).opacity < 0.02)
          hoverRing.visible = false;
      }

      // Ribbon trail
      trail.pop();
      trail.unshift(worldPos.clone());
      const pa = ribbon.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < RIBBON_LEN; i++) {
        const p = trail[i]!;
        const jig = reducedMotion ? 0 : Math.sin(t * 10 + i) * 0.02 * i * 0.1;
        pa.setXYZ(i, p.x + jig, p.y + jig, p.z);
      }
      pa.needsUpdate = true;
    },
    onPop(cb) {
      popCb = cb;
    },
    setReducedMotion(v) {
      reducedMotion = v;
      ribbon.visible = !v ? true : true; // trail kept, just un-jittered
    },
  };
}
