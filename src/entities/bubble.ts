import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { BUBBLE_TYPES, type BubbleKind } from "../data/bubbleTypes";
import { COLOR_DEFS, type ColorFamily } from "../data/colors";
import { pickCreature, type CreatureDef } from "../data/creatures";
import { buildCreatureMesh, animateCreature } from "../rendering/creatureMesh";
import type { DriftPath } from "../systems/paths";
import type { PhysicsWorld } from "../systems/physics";

export type BubbleState = "idle" | "popping" | "expiring" | "dead";

export interface Bubble {
  id: number;
  kind: BubbleKind;
  color: ColorFamily;
  creature: CreatureDef;
  state: BubbleState;
  /** Seconds alive. */
  age: number;
  lifespan: number;
  group: THREE.Group;
  shell: THREE.Mesh;
  warnRing: THREE.Mesh;
  beast: THREE.Group;
  body: RAPIER.RigidBody | null;
  path: DriftPath;
  pathPhase: number;
  radius: number;
  /** Score value override for mini bloom bubbles. */
  miniValue: boolean;
  /** World position cache. */
  pos: THREE.Vector3;
}

const shellGeo = new THREE.SphereGeometry(1, 28, 22);
const ringGeo = new THREE.TorusGeometry(1.25, 0.035, 8, 48);
const orbiterGeo = new THREE.SphereGeometry(0.28, 14, 10);
const prismGeo = new THREE.IcosahedronGeometry(1, 0);

function makeShellMaterial(kind: BubbleKind, color: ColorFamily): THREE.MeshPhysicalMaterial {
  const c = COLOR_DEFS[color];
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.02,
    metalness: 0,
    transmission: 0.85,
    thickness: 0.3,
    transparent: true,
    opacity: 0.75,
    iridescence: 1,
    iridescenceIOR: 1.4,
    iridescenceThicknessRange: [120, 500],
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    side: THREE.FrontSide,
    depthWrite: false,
  });
  switch (kind) {
    case "colorBond":
      mat.color.setHex(c.hex);
      mat.opacity = 0.85;
      mat.emissive = new THREE.Color(c.emissive);
      mat.emissiveIntensity = 0.35;
      break;
    case "chorus":
      mat.iridescenceThicknessRange = [200, 700];
      mat.emissive = new THREE.Color(c.emissive);
      mat.emissiveIntensity = 0.2;
      break;
    case "prism":
      mat.color.setHex(0xffffff);
      mat.transmission = 0.7;
      mat.roughness = 0.0;
      mat.iridescence = 1;
      mat.emissive = new THREE.Color(0x8866ff);
      mat.emissiveIntensity = 0.4;
      break;
    case "golden":
    case "grand":
      mat.color.setHex(0xffd980);
      mat.emissive = new THREE.Color(0xffaa22);
      mat.emissiveIntensity = 1.1;
      mat.metalness = 0.3;
      mat.opacity = 0.9;
      mat.iridescence = 1;
      mat.iridescenceThicknessRange = [300, 900];
      break;
    default:
      break;
  }
  return mat;
}

let nextId = 1;

/** Pooled bubble factory + per-frame lifecycle. */
export class BubblePool {
  readonly active: Bubble[] = [];
  private free: Bubble[] = [];
  private container: THREE.Group;
  private physics: PhysicsWorld;
  private target = new THREE.Vector3();

  constructor(container: THREE.Group, physics: PhysicsWorld) {
    this.container = container;
    this.physics = physics;
  }

  spawn(
    kind: BubbleKind,
    color: ColorFamily,
    path: DriftPath,
    opts: { mini?: boolean; biasUp?: number; creature?: CreatureDef } = {},
  ): Bubble {
    const def = BUBBLE_TYPES[kind];
    const radius = def.radius * (opts.mini ? 0.55 : 1);
    const creature =
      opts.creature ??
      pickCreature(Math.random, kind === "golden" ? 1.4 : kind === "grand" ? 2.2 : 0);

    let b = this.free.pop();
    if (!b) {
      const group = new THREE.Group();
      const shell = new THREE.Mesh(shellGeo, makeShellMaterial(kind, color));
      const warnRing = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
      );
      warnRing.rotation.x = Math.PI / 2;
      group.add(shell, warnRing);
      b = {
        id: 0, kind, color, creature, state: "dead", age: 0, lifespan: 0,
        group, shell, warnRing, beast: new THREE.Group(), body: null,
        path, pathPhase: 0, radius, miniValue: false, pos: new THREE.Vector3(),
      };
    }

    b.id = nextId++;
    b.kind = kind;
    b.color = color;
    b.creature = creature;
    b.state = "idle";
    b.age = 0;
    b.lifespan = def.lifespan * (opts.mini ? 0.6 : 1);
    b.path = path;
    b.pathPhase = Math.random();
    b.radius = radius;
    b.miniValue = opts.mini ?? false;

    // Rebuild kind-specific visuals
    b.shell.material = makeShellMaterial(kind, color);
    b.shell.geometry = kind === "prism" ? prismGeo : shellGeo;
    b.shell.scale.setScalar(1);
    b.group.scale.setScalar(radius);
    (b.warnRing.material as THREE.MeshBasicMaterial).opacity = 0;
    (b.warnRing.material as THREE.MeshBasicMaterial).color.setHex(COLOR_DEFS[color].emissive);

    // Clear previous extras (beast, orbiters, filigree)
    for (const child of [...b.group.children]) {
      if (child !== b.shell && child !== b.warnRing) b.group.remove(child);
    }

    // Beast inside (not for prism)
    if (kind !== "prism") {
      b.beast = buildCreatureMesh(creature);
      b.beast.scale.setScalar(1.1);
      b.beast.position.y = -0.15;
      b.group.add(b.beast);
    }

    if (kind === "chorus") {
      for (let i = 0; i < 3; i++) {
        const orb = new THREE.Mesh(orbiterGeo, b.shell.material);
        orb.name = `orbiter${i}`;
        b.group.add(orb);
      }
    }
    if (kind === "colorBond") {
      const ribbon = new THREE.Mesh(
        new THREE.TorusGeometry(1.15, 0.05, 6, 40),
        new THREE.MeshStandardMaterial({
          color: COLOR_DEFS[color].hex,
          emissive: COLOR_DEFS[color].emissive,
          emissiveIntensity: 1.6,
          transparent: true,
          opacity: 0.85,
        }),
      );
      ribbon.name = "ribbon";
      ribbon.rotation.x = Math.PI / 3;
      b.group.add(ribbon);
    }
    if (kind === "golden" || kind === "grand") {
      const filigree = new THREE.Mesh(
        new THREE.TorusKnotGeometry(1.05, 0.035, 64, 8, 2, 3),
        new THREE.MeshStandardMaterial({
          color: 0xffc23a,
          emissive: 0xffcc44,
          emissiveIntensity: 2.6,
          metalness: 0.9,
          roughness: 0.15,
        }),
      );
      filigree.name = "filigree";
      b.group.add(filigree);
      // Sparkle halo: orbiting golden motes make the prize unmissable
      const HALO = 18;
      const hgeo = new THREE.BufferGeometry();
      const hpos = new Float32Array(HALO * 3);
      for (let i = 0; i < HALO; i++) {
        const a = (i / HALO) * Math.PI * 2;
        hpos[i * 3] = Math.cos(a) * 1.5;
        hpos[i * 3 + 1] = Math.sin(a * 3) * 0.35;
        hpos[i * 3 + 2] = Math.sin(a) * 1.5;
      }
      hgeo.setAttribute("position", new THREE.BufferAttribute(hpos, 3));
      const halo = new THREE.Points(
        hgeo,
        new THREE.PointsMaterial({
          color: 0xffe08a,
          size: kind === "grand" ? 0.22 : 0.15,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      halo.name = "sparkleHalo";
      b.group.add(halo);
    }

    // Start at the path point for our phase
    const p0 = b.path.curve.getPointAt(b.pathPhase);
    b.group.position.copy(p0);
    b.pos.copy(p0);
    b.body = this.physics.createBubbleBody(p0.x, p0.y, p0.z, radius);

    this.container.add(b.group);
    this.active.push(b);
    return b;
  }

  /** Advance drift, dissipation, and visuals. Returns bubbles that expired this frame. */
  update(dt: number, t: number, timeScale: number): Bubble[] {
    const expired: Bubble[] = [];
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i]!;
      if (b.state === "dead") continue;
      b.age += dt * timeScale;

      if (b.state === "idle") {
        // Path-following spring force via Rapier
        const u = (b.pathPhase + b.age / b.path.period) % 1;
        b.path.curve.getPointAt(u, this.target);
        if (b.body) {
          const tr = b.body.translation();
          const k = 2.6; // spring gain
          b.body.applyImpulse(
            {
              x: (this.target.x - tr.x) * k * dt * b.body.mass() * 10,
              y: (this.target.y - tr.y) * k * dt * b.body.mass() * 10,
              z: (this.target.z - tr.z) * k * dt * b.body.mass() * 10,
            },
            true,
          );
          b.group.position.set(tr.x, tr.y, tr.z);
          b.pos.set(tr.x, tr.y, tr.z);
        }

        // End-of-life warning: shrink shimmer ring, wobble, fade
        const def = BUBBLE_TYPES[b.kind];
        const remaining = b.lifespan - b.age;
        if (remaining < def.warnWindow) {
          const w = 1 - remaining / def.warnWindow; // 0→1 as expiry nears
          const ring = b.warnRing.material as THREE.MeshBasicMaterial;
          ring.opacity = 0.4 + w * 0.5;
          b.warnRing.scale.setScalar(1.3 - w * 0.55);
          b.warnRing.rotation.z = t * 2;
          const wob = Math.sin(t * (8 + w * 14)) * 0.06 * w;
          b.shell.scale.set(1 + wob, 1 - wob, 1 + wob);
          const m = b.shell.material as THREE.MeshPhysicalMaterial;
          m.opacity = Math.max(0.25, 0.75 - w * 0.4);
        }
        if (b.age >= b.lifespan) {
          b.state = "expiring";
          b.age = 0;
        }

        // Idle kind-specific animation
        for (const child of b.group.children) {
          if (child.name.startsWith("orbiter")) {
            const idx = Number(child.name.slice(7));
            const a = t * 1.6 + (idx * Math.PI * 2) / 3;
            child.position.set(Math.cos(a) * 1.5, Math.sin(t * 2 + idx) * 0.3, Math.sin(a) * 1.5);
          } else if (child.name === "ribbon") {
            child.rotation.z = t * 1.2;
          } else if (child.name === "filigree") {
            child.rotation.y = t * 0.9;
            child.rotation.x = Math.sin(t * 1.3) * 0.4;
            const fm = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
            fm.emissiveIntensity = 2.2 + Math.sin(t * 5) * 1.2;
          } else if (child.name === "sparkleHalo") {
            child.rotation.y = -t * 1.6;
            child.rotation.z = Math.sin(t * 0.9) * 0.5;
            (child as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>).material.opacity =
              0.7 + Math.sin(t * 6) * 0.3;
          }
        }
        if (b.kind !== "prism") animateCreature(b.beast, t + b.id);
        if (b.kind === "prism") b.shell.rotation.y = t * 0.8;
      } else if (b.state === "expiring") {
        // Harmless dissipation: gentle shrink + fade, no reward
        const k = b.age / 0.5;
        b.group.scale.setScalar(b.radius * Math.max(0.001, 1 - k));
        const m = b.shell.material as THREE.MeshPhysicalMaterial;
        m.opacity = Math.max(0, 0.6 * (1 - k));
        if (k >= 1) {
          expired.push(b);
          this.despawn(b);
        }
      }
      // "popping" state is animated externally by the pop system.
    }
    return expired;
  }

  despawn(b: Bubble): void {
    if (b.state === "dead") return;
    b.state = "dead";
    if (b.body) {
      this.physics.removeBody(b.body);
      b.body = null;
    }
    this.container.remove(b.group);
    const idx = this.active.indexOf(b);
    if (idx >= 0) this.active.splice(idx, 1);
    this.free.push(b);
  }

  clear(): void {
    for (const b of [...this.active]) this.despawn(b);
  }
}
