import * as THREE from "three";
import { COLOR_DEFS } from "../data/colors";
import type { CreatureDef } from "../data/creatures";

/**
 * Procedural beast builder — the guaranteed-attractive fallback for every
 * creature (SPEC §1). Each archetype is a distinct silhouette built from
 * primitives with emissive accents so nothing ever looks grey or blocky.
 */
export function buildCreatureMesh(
  def: CreatureDef,
  detail = 1,
  colorOverride?: import("../data/colors").ColorFamily,
): THREE.Group {
  const g = new THREE.Group();
  const col = COLOR_DEFS[colorOverride ?? def.color];
  const bodyMat = new THREE.MeshStandardMaterial({
    color: col.hex,
    roughness: 0.35,
    metalness: 0.15,
    emissive: col.emissive,
    emissiveIntensity: 0.25,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: col.emissive,
    emissiveIntensity: 1.8,
    roughness: 0.2,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1030, roughness: 0.4 });
  const seg = Math.max(6, Math.round(10 * detail));

  const eye = (x: number, y: number, z: number, s = 0.05): THREE.Mesh => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), darkMat);
    e.position.set(x, y, z);
    return e;
  };

  switch (def.body) {
    case "blob": {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, seg, seg), bodyMat);
      body.scale.set(1, 0.85, 1);
      g.add(body, eye(-0.1, 0.08, 0.26), eye(0.1, 0.08, 0.26));
      const drop = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 8), glowMat);
      drop.position.y = 0.34;
      g.add(drop);
      break;
    }
    case "sprite": {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, seg, seg), bodyMat);
      g.add(body, eye(-0.08, 0.05, 0.19, 0.04), eye(0.08, 0.05, 0.19, 0.04));
      const petalGeo = new THREE.ConeGeometry(0.09, 0.3, 6);
      for (let i = 0; i < 5; i++) {
        const p = new THREE.Mesh(petalGeo, glowMat);
        const a = (i / 5) * Math.PI * 2;
        p.position.set(Math.cos(a) * 0.16, 0.28, Math.sin(a) * 0.16);
        p.rotation.z = Math.cos(a) * 0.5;
        p.rotation.x = -Math.sin(a) * 0.5;
        g.add(p);
      }
      break;
    }
    case "snail": {
      const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.35, 4, 8), bodyMat);
      foot.rotation.z = Math.PI / 2;
      foot.position.y = 0.1;
      const shellMat = new THREE.MeshPhysicalMaterial({
        color: col.hex,
        roughness: 0.15,
        metalness: 0.2,
        transmission: 0.4,
        thickness: 0.5,
        emissive: col.emissive,
        emissiveIntensity: 0.4,
      });
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.2, seg, seg), shellMat);
      shell.position.set(-0.05, 0.28, 0);
      const s1 = eye(0.24, 0.28, 0.06, 0.03);
      const s2 = eye(0.24, 0.28, -0.06, 0.03);
      g.add(foot, shell, s1, s2);
      break;
    }
    case "moth": {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.25, 4, 8), bodyMat);
      g.add(body, eye(-0.05, 0.18, 0.05, 0.03), eye(0.05, 0.18, 0.05, 0.03));
      const wingGeo = new THREE.CircleGeometry(0.24, 12);
      const wingMat = new THREE.MeshStandardMaterial({
        color: col.hex,
        emissive: col.emissive,
        emissiveIntensity: 0.9,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      for (const side of [-1, 1]) {
        const w = new THREE.Mesh(wingGeo, wingMat);
        w.position.set(side * 0.2, 0.05, 0);
        w.rotation.y = side * 0.6;
        w.name = side < 0 ? "wingL" : "wingR";
        g.add(w);
      }
      break;
    }
    case "jelly": {
      const bell = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, seg, seg, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshPhysicalMaterial({
          color: col.hex,
          roughness: 0.1,
          transmission: 0.6,
          thickness: 0.4,
          emissive: col.emissive,
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.9,
        }),
      );
      g.add(bell);
      for (let i = 0; i < 5; i++) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.008, 0.35, 5), glowMat);
        const a = (i / 5) * Math.PI * 2;
        t.position.set(Math.cos(a) * 0.13, -0.18, Math.sin(a) * 0.13);
        g.add(t);
      }
      break;
    }
    case "koi": {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, seg, seg), bodyMat);
      body.scale.set(1.5, 0.8, 0.7);
      g.add(body, eye(0.25, 0.06, 0.1, 0.035), eye(0.25, 0.06, -0.1, 0.035));
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 8), glowMat);
      tail.rotation.z = Math.PI / 2;
      tail.position.x = -0.42;
      tail.name = "tail";
      g.add(tail);
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 6), glowMat);
      fin.position.set(0, 0.24, 0);
      g.add(fin);
      break;
    }
    case "axolotl": {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.4, 6, seg), bodyMat);
      body.rotation.z = Math.PI / 2;
      g.add(body, eye(0.28, 0.08, 0.09, 0.035), eye(0.28, 0.08, -0.09, 0.035));
      // Lantern gills — three glowing branches per side
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const gill = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), glowMat);
          gill.position.set(0.2 + i * 0.06, 0.16 + i * 0.03, side * (0.14 + i * 0.02));
          g.add(gill);
        }
      }
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 8), bodyMat);
      tail.rotation.z = Math.PI / 2;
      tail.position.x = -0.42;
      tail.name = "tail";
      g.add(tail);
      break;
    }
    case "dragonet": {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.3, 6, seg), bodyMat);
      body.rotation.z = Math.PI / 2 - 0.5;
      g.add(body, eye(0.16, 0.24, 0.08, 0.035), eye(0.16, 0.24, -0.08, 0.035));
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, seg, seg), bodyMat);
      head.position.set(0.14, 0.24, 0);
      g.add(head);
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(
          new THREE.ConeGeometry(0.12, 0.34, 4),
          new THREE.MeshStandardMaterial({
            color: col.hex,
            emissive: col.emissive,
            emissiveIntensity: 1,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85,
          }),
        );
        wing.position.set(-0.08, 0.12, side * 0.16);
        wing.rotation.x = side * 1.1;
        wing.name = side < 0 ? "wingL" : "wingR";
        g.add(wing);
      }
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 6), glowMat);
      horn.position.set(0.16, 0.38, 0);
      g.add(horn);
      break;
    }
    case "seraph": {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, seg, seg), bodyMat);
      body.scale.set(0.9, 1.3, 0.9);
      g.add(body, eye(-0.07, 0.12, 0.17, 0.03), eye(0.07, 0.12, 0.17, 0.03));
      // Aurora ribbons — three arcs
      for (let i = 0; i < 3; i++) {
        const arc = new THREE.Mesh(
          new THREE.TorusGeometry(0.3 + i * 0.09, 0.015, 6, 32, Math.PI * 1.4),
          new THREE.MeshStandardMaterial({
            color: col.hex,
            emissive: col.emissive,
            emissiveIntensity: 2.2 - i * 0.4,
            transparent: true,
            opacity: 0.8,
          }),
        );
        arc.rotation.x = 0.5 + i * 0.3;
        arc.rotation.y = i * 1.1;
        arc.name = `aura${i}`;
        g.add(arc);
      }
      break;
    }
    case "fawn": {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.28, 6, seg), bodyMat);
      body.rotation.z = Math.PI / 2;
      body.position.y = 0.24;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, seg, seg), bodyMat);
      head.position.set(0.24, 0.42, 0);
      g.add(head, eye(0.31, 0.44, 0.05, 0.025), eye(0.31, 0.44, -0.05, 0.025));
      // Golden antlers
      for (const side of [-1, 1]) {
        const antler = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.2, 5), glowMat);
        antler.position.set(0.2, 0.56, side * 0.06);
        antler.rotation.z = -0.3;
        antler.rotation.x = side * 0.4;
        g.add(antler);
      }
      // Legs
      const legGeo = new THREE.CylinderGeometry(0.025, 0.02, 0.24, 6);
      for (const [lx, lz] of [
        [0.12, 0.07],
        [0.12, -0.07],
        [-0.12, 0.07],
        [-0.12, -0.07],
      ] as const) {
        const leg = new THREE.Mesh(legGeo, bodyMat);
        leg.position.set(lx, 0.1, lz);
        g.add(leg);
      }
      // Star mote halo
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.2, 0.012, 6, 24),
        new THREE.MeshStandardMaterial({
          color: 0xffe08a,
          emissive: 0xffe08a,
          emissiveIntensity: 2.5,
        }),
      );
      halo.position.set(0.24, 0.62, 0);
      halo.rotation.x = Math.PI / 2.4;
      halo.name = "halo";
      g.add(halo);
      break;
    }
  }
  return g;
}

/** Simple idle wiggle applied per frame; distinct per archetype via names. */
export function animateCreature(mesh: THREE.Group, t: number): void {
  mesh.rotation.y = Math.sin(t * 1.4) * 0.25;
  mesh.position.y = Math.sin(t * 2.1) * 0.03;
  for (const child of mesh.children) {
    if (child.name === "wingL") child.rotation.y = -0.6 - Math.abs(Math.sin(t * 8)) * 0.7;
    else if (child.name === "wingR") child.rotation.y = 0.6 + Math.abs(Math.sin(t * 8)) * 0.7;
    else if (child.name === "tail") child.rotation.y = Math.sin(t * 6) * 0.4;
    else if (child.name === "halo") child.rotation.z = t;
    else if (child.name.startsWith("aura")) child.rotation.y += 0.01;
  }
}
