import * as THREE from "three";
import { COLOR_DEFS, type ColorFamily } from "../data/colors";

/**
 * Pop-feel VFX (SPEC §4): squash-burst is driven here for popping bubbles,
 * plus pooled colour shockwave rings, particle bursts, and score popups.
 */

const RING_POOL = 12;
const BURST_POOL = 10;
const BURST_PARTICLES = 42;
const POPUP_POOL = 14;

interface Ring {
  mesh: THREE.Mesh;
  age: number;
  active: boolean;
  scaleMax: number;
}

interface Burst {
  points: THREE.Points;
  vel: Float32Array;
  age: number;
  active: boolean;
}

interface Popup {
  el: HTMLDivElement;
  age: number;
  active: boolean;
  x: number;
  y: number;
}

export class PopFX {
  private rings: Ring[] = [];
  private bursts: Burst[] = [];
  private popups: Popup[] = [];
  private scene: THREE.Scene;
  private hud: HTMLElement;
  reducedMotion = false;
  reducedFlash = false;

  constructor(scene: THREE.Scene, hudLayer: HTMLElement) {
    this.scene = scene;
    this.hud = hudLayer;
    const ringGeo = new THREE.TorusGeometry(1, 0.06, 8, 48);
    for (let i = 0; i < RING_POOL; i++) {
      const mesh = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      mesh.visible = false;
      this.scene.add(mesh);
      this.rings.push({ mesh, age: 0, active: false, scaleMax: 3 });
    }
    for (let i = 0; i < BURST_POOL; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(BURST_PARTICLES * 3), 3));
      geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(BURST_PARTICLES * 3), 3));
      const points = new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          size: 0.14,
          vertexColors: true,
          transparent: true,
          opacity: 1,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      points.visible = false;
      this.scene.add(points);
      this.bursts.push({ points, vel: new Float32Array(BURST_PARTICLES * 3), age: 0, active: false });
    }
    for (let i = 0; i < POPUP_POOL; i++) {
      const el = document.createElement("div");
      el.style.cssText =
        "position:absolute;pointer-events:none;font-weight:900;font-size:26px;" +
        "text-shadow:0 2px 8px rgba(0,0,0,.6);transform:translate(-50%,-50%);display:none;z-index:30;";
      this.hud.appendChild(el);
      this.popups.push({ el, age: 0, active: false, x: 0, y: 0 });
    }
  }

  /** Colour shockwave ring at world position, facing camera. */
  shockwave(pos: THREE.Vector3, color: ColorFamily, camera: THREE.Camera, big = false): void {
    const r = this.rings.find((x) => !x.active);
    if (!r) return;
    r.active = true;
    r.age = 0;
    r.scaleMax = big ? 6 : 3;
    r.mesh.visible = true;
    r.mesh.position.copy(pos);
    r.mesh.quaternion.copy(camera.quaternion);
    const m = r.mesh.material as THREE.MeshBasicMaterial;
    m.color.setHex(COLOR_DEFS[color].emissive);
    m.opacity = this.reducedFlash ? 0.45 : 0.85;
    r.mesh.scale.setScalar(0.2);
  }

  /** Particle burst weighted toward the bubble's colour family. */
  burst(pos: THREE.Vector3, color: ColorFamily, big = false): void {
    const b = this.bursts.find((x) => !x.active);
    if (!b) return;
    b.active = true;
    b.age = 0;
    b.points.visible = true;
    const posAttr = b.points.geometry.getAttribute("position") as THREE.BufferAttribute;
    const colAttr = b.points.geometry.getAttribute("color") as THREE.BufferAttribute;
    const main = new THREE.Color(COLOR_DEFS[color].emissive);
    const white = new THREE.Color(0xffffff);
    const speed = big ? 5.5 : 3.5;
    for (let i = 0; i < BURST_PARTICLES; i++) {
      posAttr.setXYZ(i, pos.x, pos.y, pos.z);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const v = speed * (0.3 + Math.random() * 0.7);
      // A few slow glitter motes
      const slow = i % 7 === 0 ? 0.15 : 1;
      b.vel[i * 3] = Math.sin(phi) * Math.cos(theta) * v * slow;
      b.vel[i * 3 + 1] = Math.cos(phi) * v * slow + 0.5;
      b.vel[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * v * slow;
      const c = Math.random() > 0.25 ? main : white;
      colAttr.setXYZ(i, c.r, c.g, c.b);
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    (b.points.material as THREE.PointsMaterial).opacity = 1;
  }

  /** Floating score number at screen position. */
  scorePopup(screenX: number, screenY: number, text: string, color: ColorFamily, big = false): void {
    const p = this.popups.find((x) => !x.active);
    if (!p) return;
    p.active = true;
    p.age = 0;
    p.x = screenX;
    p.y = screenY;
    p.el.textContent = text;
    p.el.style.display = "block";
    p.el.style.color = COLOR_DEFS[color].css;
    p.el.style.fontSize = big ? "40px" : "26px";
    p.el.style.left = `${screenX}px`;
    p.el.style.top = `${screenY}px`;
  }

  update(dt: number): void {
    const motion = this.reducedMotion ? 0.6 : 1;
    for (const r of this.rings) {
      if (!r.active) continue;
      r.age += dt;
      const k = r.age / 0.55;
      if (k >= 1) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      r.mesh.scale.setScalar(0.2 + k * r.scaleMax * motion);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity =
        (this.reducedFlash ? 0.45 : 0.85) * (1 - k);
    }
    for (const b of this.bursts) {
      if (!b.active) continue;
      b.age += dt;
      const life = 0.9;
      if (b.age >= life) {
        b.active = false;
        b.points.visible = false;
        continue;
      }
      const posAttr = b.points.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < BURST_PARTICLES; i++) {
        posAttr.setXYZ(
          i,
          posAttr.getX(i) + b.vel[i * 3]! * dt * motion,
          posAttr.getY(i) + b.vel[i * 3 + 1]! * dt * motion,
          posAttr.getZ(i) + b.vel[i * 3 + 2]! * dt * motion,
        );
        b.vel[i * 3 + 1]! -= dt * 2.4; // soft gravity
      }
      posAttr.needsUpdate = true;
      (b.points.material as THREE.PointsMaterial).opacity = 1 - b.age / life;
    }
    for (const p of this.popups) {
      if (!p.active) continue;
      p.age += dt;
      const life = 1.1;
      if (p.age >= life) {
        p.active = false;
        p.el.style.display = "none";
        continue;
      }
      const k = p.age / life;
      const popIn = Math.min(p.age / 0.12, 1);
      p.el.style.top = `${p.y - k * 70}px`;
      p.el.style.opacity = String(1 - k * k);
      p.el.style.transform = `translate(-50%,-50%) scale(${0.4 + popIn * 0.8})`;
    }
  }
}
