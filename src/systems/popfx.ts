import * as THREE from "three";
import { COLOR_DEFS, type ColorFamily } from "../data/colors";

/** Soft radial glow sprite — turns square points into round glowing motes. */
export function makeGlowTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.8)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const glowTexture = makeGlowTexture();

/**
 * Pop-feel VFX (SPEC §4): squash-burst is driven here for popping bubbles,
 * plus pooled colour shockwave rings, particle bursts, and score popups.
 */

const RING_POOL = 12;
const BURST_POOL = 10;
const BURST_PARTICLES = 42;
const POPUP_POOL = 14;
const SHARD_POOL = 8;
const SHARDS_PER_POP = 12;

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

interface ShardSet {
  mesh: THREE.InstancedMesh;
  vel: Float32Array;
  rot: Float32Array;
  age: number;
  active: boolean;
}

interface Confetti {
  mesh: THREE.InstancedMesh;
  vel: Float32Array;
  spin: Float32Array;
  age: number;
  life: number;
  active: boolean;
}

export class PopFX {
  private rings: Ring[] = [];
  private bursts: Burst[] = [];
  private popups: Popup[] = [];
  private shards: ShardSet[] = [];
  private confetti: Confetti[] = [];
  private vignette: HTMLDivElement;
  private banner: HTMLDivElement;
  private fever!: HTMLDivElement;
  private feverHue = 0;
  private scene: THREE.Scene;
  private hud: HTMLElement;
  reducedMotion = false;
  reducedFlash = false;
  /** Decaying camera-shake energy, consumed by the main loop. */
  shakeEnergy = 0;

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
          size: 0.2,
          map: glowTexture,
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
    // Shell shard debris: instanced curved triangles, physics-lite (gravity + spin + drag)
    const shardGeo = new THREE.TetrahedronGeometry(0.09, 0);
    for (let i = 0; i < SHARD_POOL; i++) {
      const mesh = new THREE.InstancedMesh(
        shardGeo,
        new THREE.MeshPhysicalMaterial({
          roughness: 0.05,
          metalness: 0.1,
          transmission: 0.5,
          thickness: 0.1,
          transparent: true,
          opacity: 0.9,
          iridescence: 1,
          side: THREE.DoubleSide,
        }),
        SHARDS_PER_POP,
      );
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.shards.push({
        mesh,
        vel: new Float32Array(SHARDS_PER_POP * 3),
        rot: new Float32Array(SHARDS_PER_POP * 4), // axis xyz + speed
        age: 0,
        active: false,
      });
    }
    // Confetti petals: coloured tumbling quads for celebrations
    const confGeo = new THREE.PlaneGeometry(0.14, 0.2);
    for (let c = 0; c < 4; c++) {
      const COUNT = 36;
      const mesh = new THREE.InstancedMesh(
        confGeo,
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 1 }),
        COUNT,
      );
      mesh.visible = false;
      mesh.frustumCulled = false;
      for (let i = 0; i < COUNT; i++) {
        mesh.setColorAt(i, new THREE.Color().setHSL(Math.random(), 0.85, 0.65));
      }
      this.scene.add(mesh);
      this.confetti.push({
        mesh,
        vel: new Float32Array(COUNT * 3),
        spin: new Float32Array(COUNT * 4),
        age: 0,
        life: 2.2,
        active: false,
      });
    }

    // Screen-edge vignette flash for milestone moments
    this.vignette = document.createElement("div");
    this.vignette.style.cssText =
      "position:absolute;inset:0;pointer-events:none;opacity:0;z-index:25;" +
      "transition:opacity .12s ease-out;";
    this.hud.appendChild(this.vignette);

    // Fever-mode rainbow edge glow (persistent while fever active)
    this.fever = document.createElement("div");
    this.fever.style.cssText =
      "position:absolute;inset:0;pointer-events:none;opacity:0;z-index:24;transition:opacity .4s;" +
      "box-shadow:inset 0 0 90px 24px rgba(255,95,168,.5), inset 0 0 40px 10px rgba(53,215,232,.5);";
    this.hud.appendChild(this.fever);

    // Combo milestone banner
    this.banner = document.createElement("div");
    this.banner.style.cssText =
      "position:absolute;left:50%;top:32%;transform:translate(-50%,-50%) scale(0);" +
      "font-size:54px;font-weight:900;pointer-events:none;z-index:26;" +
      "text-shadow:0 4px 18px rgba(0,0,0,.7);transition:transform .18s cubic-bezier(.2,2.4,.4,1),opacity .4s;opacity:0;";
    this.hud.appendChild(this.banner);

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

  /** Glass-shell shards flung from the burst point; adds physical weight to the pop. */
  shellShards(pos: THREE.Vector3, color: ColorFamily, radius: number, big = false): void {
    const s = this.shards.find((x) => !x.active);
    if (!s) return;
    s.active = true;
    s.age = 0;
    s.mesh.visible = true;
    const mat = s.mesh.material as THREE.MeshPhysicalMaterial;
    mat.color.setHex(COLOR_DEFS[color].emissive);
    mat.opacity = 0.9;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const speed = big ? 6.5 : 4.2;
    for (let i = 0; i < SHARDS_PER_POP; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      );
      // Shards start on the shell surface, flying outward
      const start = pos.clone().addScaledVector(dir, radius * 0.8);
      const v = speed * (0.5 + Math.random() * 0.5);
      s.vel[i * 3] = dir.x * v;
      s.vel[i * 3 + 1] = dir.y * v + 1.2;
      s.vel[i * 3 + 2] = dir.z * v;
      s.rot[i * 4] = Math.random() - 0.5;
      s.rot[i * 4 + 1] = Math.random() - 0.5;
      s.rot[i * 4 + 2] = Math.random() - 0.5;
      s.rot[i * 4 + 3] = 6 + Math.random() * 14; // spin speed rad/s
      q.setFromAxisAngle(dir, Math.random() * Math.PI * 2);
      m.compose(start, q, new THREE.Vector3(1, 1, 1).multiplyScalar(0.7 + Math.random() * 0.8));
      s.mesh.setMatrixAt(i, m);
    }
    s.mesh.instanceMatrix.needsUpdate = true;
    this.shakeEnergy = Math.min(this.shakeEnergy + (big ? 0.6 : 0.22), 1);
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

  /** Confetti burst at a world position (or across the sky for fireworks). */
  confettiBurst(pos: THREE.Vector3, big = false): void {
    const c = this.confetti.find((x) => !x.active);
    if (!c) return;
    c.active = true;
    c.age = 0;
    c.life = big ? 2.6 : 1.8;
    c.mesh.visible = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const count = c.mesh.count;
    const speed = big ? 7 : 4.5;
    for (let i = 0; i < count; i++) {
      const th = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.9 + 0.4;
      c.vel[i * 3] = Math.cos(th) * speed * (0.3 + Math.random() * 0.7);
      c.vel[i * 3 + 1] = up * speed * 0.9;
      c.vel[i * 3 + 2] = Math.sin(th) * speed * (0.3 + Math.random() * 0.7);
      c.spin[i * 4] = Math.random() - 0.5;
      c.spin[i * 4 + 1] = Math.random() - 0.5;
      c.spin[i * 4 + 2] = Math.random() - 0.5;
      c.spin[i * 4 + 3] = 4 + Math.random() * 10;
      q.setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, 0));
      m.compose(pos, q, new THREE.Vector3(1, 1, 1));
      c.mesh.setMatrixAt(i, m);
    }
    c.mesh.instanceMatrix.needsUpdate = true;
    (c.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
  }

  /** Colour flash around the screen edge (suppressed by reduced-flash). */
  vignetteFlash(css: string): void {
    if (this.reducedFlash) return;
    this.vignette.style.background =
      `radial-gradient(ellipse at center, transparent 55%, ${css} 130%)`;
    this.vignette.style.opacity = "0.85";
    setTimeout(() => (this.vignette.style.opacity = "0"), 160);
  }

  /** Big combo/milestone banner with punch-in scale. */
  showBanner(text: string, css: string): void {
    this.banner.textContent = text;
    this.banner.style.color = css;
    this.banner.style.opacity = "1";
    this.banner.style.transform = "translate(-50%,-50%) scale(1)";
    setTimeout(() => {
      this.banner.style.opacity = "0";
      this.banner.style.transform = "translate(-50%,-50%) scale(0.6)";
    }, 900);
  }

  /** Toggle the persistent fever rainbow edge. */
  setFever(on: boolean): void {
    this.fever.style.opacity = on && !this.reducedFlash ? "1" : "0";
  }

  /** Glowing motes that fly from a pop to the score HUD (pure DOM, cheap). */
  scoreMotes(x: number, y: number, css: string, count = 4): void {
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      const size = 8 + Math.random() * 8;
      el.style.cssText =
        `position:absolute;left:${x + (Math.random() - 0.5) * 40}px;top:${y + (Math.random() - 0.5) * 40}px;` +
        `width:${size}px;height:${size}px;border-radius:50%;pointer-events:none;z-index:28;` +
        `background:radial-gradient(circle,#fff, ${css});box-shadow:0 0 12px ${css};` +
        `transition:all ${0.5 + Math.random() * 0.25}s cubic-bezier(.4,0,.8,.4);opacity:1;`;
      this.hud.appendChild(el);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          el.style.left = "70px";
          el.style.top = "34px";
          el.style.opacity = "0.2";
          el.style.transform = "scale(0.4)";
        }),
      );
      setTimeout(() => el.remove(), 850);
    }
  }

  update(dt: number): void {
    const motion = this.reducedMotion ? 0.6 : 1;
    // Fever edge slowly cycles hue
    if (this.fever.style.opacity === "1") {
      this.feverHue = (this.feverHue + dt * 90) % 360;
      const a = `hsla(${this.feverHue},90%,65%,.55)`;
      const b = `hsla(${(this.feverHue + 140) % 360},90%,65%,.5)`;
      this.fever.style.boxShadow = `inset 0 0 90px 24px ${a}, inset 0 0 40px 10px ${b}`;
    }
    this.shakeEnergy = Math.max(0, this.shakeEnergy - dt * 2.2);

    const tmpM = new THREE.Matrix4();
    const tmpP = new THREE.Vector3();
    const tmpQ = new THREE.Quaternion();
    const tmpS = new THREE.Vector3();
    const spinQ = new THREE.Quaternion();
    const axis = new THREE.Vector3();
    for (const s of this.shards) {
      if (!s.active) continue;
      s.age += dt;
      const life = 0.85;
      if (s.age >= life) {
        s.active = false;
        s.mesh.visible = false;
        continue;
      }
      for (let i = 0; i < SHARDS_PER_POP; i++) {
        s.mesh.getMatrixAt(i, tmpM);
        tmpM.decompose(tmpP, tmpQ, tmpS);
        tmpP.x += s.vel[i * 3]! * dt * motion;
        tmpP.y += s.vel[i * 3 + 1]! * dt * motion;
        tmpP.z += s.vel[i * 3 + 2]! * dt * motion;
        s.vel[i * 3 + 1]! -= dt * 6.5; // shard gravity — heavier than glitter
        s.vel[i * 3]! *= 1 - dt * 1.2; // air drag
        s.vel[i * 3 + 2]! *= 1 - dt * 1.2;
        axis.set(s.rot[i * 4]!, s.rot[i * 4 + 1]!, s.rot[i * 4 + 2]!).normalize();
        spinQ.setFromAxisAngle(axis, s.rot[i * 4 + 3]! * dt * motion);
        tmpQ.multiply(spinQ);
        const shrink = 1 - (s.age / life) * 0.5;
        tmpM.compose(tmpP, tmpQ, tmpS.setScalar(Math.max(0.01, tmpS.x * (shrink > 0.5 ? 1 : 0.97))));
        s.mesh.setMatrixAt(i, tmpM);
      }
      s.mesh.instanceMatrix.needsUpdate = true;
      (s.mesh.material as THREE.MeshPhysicalMaterial).opacity = 0.9 * (1 - s.age / life);
    }
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
    const cm = new THREE.Matrix4();
    const cp = new THREE.Vector3();
    const cq = new THREE.Quaternion();
    const cs = new THREE.Vector3();
    const cAxis = new THREE.Vector3();
    const cSpin = new THREE.Quaternion();
    for (const c of this.confetti) {
      if (!c.active) continue;
      c.age += dt;
      if (c.age >= c.life) {
        c.active = false;
        c.mesh.visible = false;
        continue;
      }
      for (let i = 0; i < c.mesh.count; i++) {
        c.mesh.getMatrixAt(i, cm);
        cm.decompose(cp, cq, cs);
        cp.x += c.vel[i * 3]! * dt * motion;
        cp.y += c.vel[i * 3 + 1]! * dt * motion;
        cp.z += c.vel[i * 3 + 2]! * dt * motion;
        c.vel[i * 3 + 1]! -= dt * 3.2; // flutter-light gravity
        c.vel[i * 3]! *= 1 - dt * 0.6;
        c.vel[i * 3 + 2]! *= 1 - dt * 0.6;
        cAxis.set(c.spin[i * 4]!, c.spin[i * 4 + 1]!, c.spin[i * 4 + 2]!).normalize();
        cSpin.setFromAxisAngle(cAxis, c.spin[i * 4 + 3]! * dt);
        cq.multiply(cSpin);
        cm.compose(cp, cq, cs);
        c.mesh.setMatrixAt(i, cm);
      }
      c.mesh.instanceMatrix.needsUpdate = true;
      (c.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, (c.life - c.age) / 0.6);
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
