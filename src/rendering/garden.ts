import * as THREE from "three";
import { COLOR_DEFS, COLOR_FAMILIES } from "../data/colors";
import { cloneModel, type ModelLibrary } from "../assets/models";

/**
 * Procedural magical conservatory diorama: glass greenhouse shell, ground,
 * instanced flowers/crystals/lanterns/mushrooms, crystal pond, fireflies,
 * and the animated carousel centrepiece.
 */
export interface Garden {
  group: THREE.Group;
  carousel: THREE.Group;
  /** Per-frame animation. energy 0..1 raises the carousel's excitement. */
  update(dt: number, t: number, energy: number): void;
  /** Trigger the grand finale animation. */
  playFinale(): void;
  /** Recolour accent lights (Colour Carnival). null restores defaults. */
  setCarnivalColor(hex: number | null): void;
}

const tmpMat = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function createGarden(models: ModelLibrary): Garden {
  const group = new THREE.Group();
  const rng = seededRandom(20260719);
  /** Animated real-model registry: gentle sway/swing/bob per archetype. */
  const swayers: { obj: THREE.Object3D; kind: "tree" | "lantern" | "flower" | "horse"; phase: number }[] = [];

  const place = (
    name: Parameters<typeof cloneModel>[1],
    x: number,
    z: number,
    ry: number,
    scale = 1,
    anim?: "tree" | "lantern" | "flower",
  ): THREE.Group | null => {
    const m = cloneModel(models, name);
    if (!m) return null;
    m.position.set(x, 0, z);
    m.rotation.y = ry;
    m.scale.multiplyScalar(scale);
    group.add(m);
    if (anim) swayers.push({ obj: m, kind: anim, phase: rng() * Math.PI * 2 });
    return m;
  };

  // ---------- Real photoscanned flora (Poly Haven CC0) ----------
  const hasTrees = Boolean(models.get("jacaranda_tree"));
  place("jacaranda_tree", -12.5, -5, 0.4, 1, "tree");
  place("jacaranda_tree", 12.8, -6.5, 2.4, 0.85, "tree");
  place("island_tree_02", -11.8, 3.2, 1.2, 1, "tree");
  place("island_tree_02", 11, 4.6, -0.6, 0.8, "tree");
  for (let i = 0; i < 10; i++) {
    const a = rng() * Math.PI * 2;
    const r = 4.2 + rng() * 9;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.hypot(x + 6.5, z - 2.5) < 3.8) continue; // keep the pond clear
    const pick = (["fern_02", "flower_gazania", "flower_empodium", "crystalline_iceplant"] as const)[
      i % 4
    ]!;
    place(pick, x, z, rng() * Math.PI * 2, 0.8 + rng() * 0.6, "flower");
  }
  place("coast_rocks_05", -4.2, 5.2, 0.7, 1);
  place("coast_rocks_05", 8.6, 5.6, 2.1, 0.7);
  place("coast_rocks_05", -8.9, -1.5, 3.6, 0.85);
  place("gothic_statue", 6.8, 1.6, -0.5, 1);
  place("garden_gnome", -4.6, 4.3, 2.6, 1);

  // ---------- Ground: soft mossy disc with gentle radial tint ----------
  const groundGeo = new THREE.CircleGeometry(16, 64);
  const gPos = groundGeo.getAttribute("position");
  const gCol: number[] = [];
  const inner = new THREE.Color(0x2c7a5c);
  const outer = new THREE.Color(0x173a5e);
  for (let i = 0; i < gPos.count; i++) {
    const r = Math.hypot(gPos.getX(i), gPos.getY(i)) / 16;
    const c = inner.clone().lerp(outer, r * r);
    gCol.push(c.r, c.g, c.b);
  }
  groundGeo.setAttribute("color", new THREE.Float32BufferAttribute(gCol, 3));
  const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // ---------- Crystal pond ----------
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 48),
    new THREE.MeshPhysicalMaterial({
      color: 0x2fd8e8,
      roughness: 0.05,
      metalness: 0.1,
      transmission: 0.55,
      thickness: 0.6,
      emissive: 0x0a5c72,
      emissiveIntensity: 0.5,
    }),
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(-6.5, 0.02, 2.5);
  group.add(pond);

  // ---------- Greenhouse shell: turquoise glass ribs + panels ----------
  const shell = new THREE.Group();
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x9be8de,
    roughness: 0.06,
    metalness: 0,
    transmission: 0.92,
    thickness: 0.15,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ribMat = new THREE.MeshStandardMaterial({
    color: 0x1f6e6a,
    roughness: 0.35,
    metalness: 0.7,
    emissive: 0x0a3c3a,
    emissiveIntensity: 0.35,
  });
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(19, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.15),
    glassMat,
  );
  dome.position.y = 0.1;
  shell.add(dome);
  // Ribs: vertical arcs
  const ribGeo = new THREE.TorusGeometry(19, 0.09, 6, 48, Math.PI / 1.08);
  for (let i = 0; i < 8; i++) {
    const rib = new THREE.Mesh(ribGeo, ribMat);
    rib.rotation.z = Math.PI / 2 + (Math.PI / 1.08 - Math.PI) / -2;
    rib.rotation.y = (i / 8) * Math.PI * 2;
    rib.position.y = 0.1;
    shell.add(rib);
  }
  // Horizontal ring ribs
  for (const [ry, rr] of [
    [5.5, 18.1],
    [10.5, 15.7],
    [14.5, 12.1],
  ] as const) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.07, 6, 64), ribMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = ry;
    shell.add(ring);
  }
  // Crown finial
  const finial = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 1.6, 8),
    new THREE.MeshStandardMaterial({
      color: 0xffc23a,
      emissive: 0xff9a1a,
      emissiveIntensity: 1.2,
      metalness: 0.8,
      roughness: 0.25,
    }),
  );
  finial.position.y = 17.9;
  shell.add(finial);
  group.add(shell);

  // ---------- Instanced decorations ----------
  const decorations: { mesh: THREE.InstancedMesh; sway: number }[] = [];

  function scatterInstanced(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    count: number,
    place: (i: number) => { p: THREE.Vector3; s: number; ry: number },
    colorize?: (i: number) => THREE.Color,
    sway = 0,
  ): THREE.InstancedMesh {
    const m = new THREE.InstancedMesh(geo, mat, count);
    for (let i = 0; i < count; i++) {
      const { p, s, ry } = place(i);
      tmpQuat.setFromEuler(new THREE.Euler(0, ry, 0));
      tmpMat.compose(p, tmpQuat, tmpScale.setScalar(s));
      m.setMatrixAt(i, tmpMat);
      if (colorize) m.setColorAt(i, colorize(i));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.castShadow = false;
    m.receiveShadow = false;
    group.add(m);
    decorations.push({ mesh: m, sway });
    return m;
  }

  const ringPlace = (rMin: number, rMax: number, avoidCenter = 2.8) => (): {
    p: THREE.Vector3;
    s: number;
    ry: number;
  } => {
    let x = 0;
    let z = 0;
    for (let tries = 0; tries < 12; tries++) {
      const a = rng() * Math.PI * 2;
      const r = rMin + rng() * (rMax - rMin);
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      if (Math.hypot(x, z) > avoidCenter && !(Math.hypot(x + 6.5, z - 2.5) < 3.8)) break;
    }
    return { p: new THREE.Vector3(x, 0, z), s: 0.6 + rng() * 0.9, ry: rng() * Math.PI * 2 };
  };

  const familyColor = (): THREE.Color => {
    const f = COLOR_FAMILIES[Math.floor(rng() * COLOR_FAMILIES.length)]!;
    return new THREE.Color(COLOR_DEFS[f].hex);
  };

  // Flowers: real Polygonal Mind / Poly Haven models when loaded, primitives otherwise
  const scatterModels = (
    names: Parameters<typeof cloneModel>[1][],
    count: number,
    rMin: number,
    rMax: number,
    sMin: number,
    sMax: number,
    anim?: "flower",
    glow = false,
  ): boolean => {
    if (!names.some((n) => models.get(n))) return false;
    for (let i = 0; i < count; i++) {
      const spot = ringPlace(rMin, rMax)();
      const name = names[i % names.length]!;
      const m = place(name, spot.p.x, spot.p.z, spot.ry, sMin + rng() * (sMax - sMin), anim);
      if (m && glow) {
        // Tint pale mushroom caps into the palette so they glow violet, not white
        const tint = new THREE.Color([0xd88fe0, 0x8fd8e0, 0xe0b88f][i % 3]!);
        m.traverse((o) => {
          if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
            const mat = o.material.clone();
            mat.color.multiply(tint);
            o.material = mat;
          }
        });
        const picks = [0x35d7e8, 0x9a5bff, 0xff5fa8];
        const light = new THREE.Mesh(
          new THREE.SphereGeometry(0.07, 8, 6),
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: picks[Math.floor(rng() * picks.length)]!,
            emissiveIntensity: 2.4,
          }),
        );
        light.position.y = 0.32;
        m.add(light);
      }
    }
    return true;
  };

  if (
    !scatterModels(["flower_a", "flower_b", "flower_c", "flower_d"], 44, 3.4, 13.5, 1.0, 2.0, "flower")
  ) {
    const bloomGeo = new THREE.IcosahedronGeometry(0.42, 1);
    scatterInstanced(
      bloomGeo,
      new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.1, emissiveIntensity: 0.4 }),
      90,
      () => {
        const base = ringPlace(3.4, 13.5)();
        base.p.y = 0.55 + rng() * 0.9;
        return base;
      },
      familyColor,
      0.35,
    );
  }

  // Bushes replace the old jewel-leaf octahedra
  if (!scatterModels(["fern_02", "flower_gazania", "crystalline_iceplant"], 18, 4.5, 13.5, 1.2, 2.0)) {
    scatterInstanced(
      new THREE.OctahedronGeometry(0.3, 0),
      new THREE.MeshPhysicalMaterial({
        roughness: 0.15,
        metalness: 0.2,
        transmission: 0.5,
        thickness: 0.4,
      }),
      70,
      () => {
        const b = ringPlace(4, 14)();
        b.p.y = 0.25 + rng() * 0.4;
        return b;
      },
      familyColor,
      0.5,
    );
  }

  // Crystal formations: real crystal model clones
  if (!scatterModels(["fern_02", "crystalline_iceplant"], 12, 5, 13.8, 1.0, 1.8)) {
    scatterInstanced(
      new THREE.OctahedronGeometry(0.35, 0),
      new THREE.MeshPhysicalMaterial({
        roughness: 0.05,
        metalness: 0.1,
        transmission: 0.7,
        thickness: 0.8,
        emissiveIntensity: 0.8,
      }),
      40,
      () => {
        const b = ringPlace(5, 13.8)();
        b.p.y = 0.5;
        b.s *= 1.6;
        return b;
      },
      () => familyColor(),
    );
  }

  // Glowing mushrooms: real models with a light core tucked under the cap
  if (!scatterModels(["mushroom_a", "mushroom_b"], 22, 3.2, 14.5, 0.9, 1.8, undefined, true)) {
    scatterInstanced(
      new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ emissiveIntensity: 1.6, roughness: 0.5 }),
      55,
      () => {
        const b = ringPlace(3.2, 14.5)();
        b.p.y = 0.16;
        return b;
      },
      () => {
        const picks = [0x35d7e8, 0x9a5bff, 0xff5fa8];
        return new THREE.Color(picks[Math.floor(rng() * picks.length)]!);
      },
    );
  }

  // Park fountain beside the crystal pond, tinted to dusk stone
  const fountain = place("fountain", -6.5, 2.5, 0.6, 1);
  fountain?.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
      const m = o.material.clone();
      m.color.multiply(new THREE.Color(0x7888b0));
      m.roughness = 0.85;
      o.material = m;
    }
  });

  // Butterflies: slow figure-eight flights above the flowers
  const butterflies: { obj: THREE.Group; phase: number; r: number; h: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const b = cloneModel(models, "butterfly");
    if (!b) break;
    group.add(b);
    butterflies.push({ obj: b, phase: rng() * Math.PI * 2, r: 4.5 + rng() * 6, h: 1.4 + rng() * 2 });
  }

  // Lanterns: real Poly Haven lantern model when present, emissive boxes otherwise
  if (models.get("Lantern_01")) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + rng() * 0.4;
      const r = 5.5 + rng() * 7;
      const m = place("Lantern_01", Math.cos(a) * r, Math.sin(a) * r, rng() * Math.PI * 2, 0.9, "lantern");
      if (m) {
        m.position.y = 2 + rng() * 3.2;
        // Warm glow core inside each hanging lantern
        const glow = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 8, 6),
          new THREE.MeshStandardMaterial({
            color: 0xffc23a,
            emissive: rng() > 0.5 ? 0xffc23a : 0xff8c3a,
            emissiveIntensity: 3,
          }),
        );
        glow.position.y = 0.35;
        m.add(glow);
      }
    }
  } else {
    scatterInstanced(
      new THREE.BoxGeometry(0.28, 0.4, 0.28),
      new THREE.MeshStandardMaterial({ emissiveIntensity: 2.2, roughness: 0.4, metalness: 0.3 }),
      26,
      () => {
        const b = ringPlace(4.5, 13)();
        b.p.y = 2.2 + rng() * 3.5;
        b.s = 0.8 + rng() * 0.5;
        return b;
      },
      () => new THREE.Color(rng() > 0.5 ? 0xffc23a : 0xff8c3a),
      0.25,
    );
  }

  // ---------- Fireflies + glitter: points ----------
  const flyCount = 220;
  const flyPos = new Float32Array(flyCount * 3);
  const flyCol = new Float32Array(flyCount * 3);
  const flySeed = new Float32Array(flyCount);
  for (let i = 0; i < flyCount; i++) {
    const a = rng() * Math.PI * 2;
    const r = 2 + rng() * 12;
    flyPos[i * 3] = Math.cos(a) * r;
    flyPos[i * 3 + 1] = 0.5 + rng() * 8;
    flyPos[i * 3 + 2] = Math.sin(a) * r;
    const c = familyColor();
    flyCol[i * 3] = c.r;
    flyCol[i * 3 + 1] = c.g;
    flyCol[i * 3 + 2] = c.b;
    flySeed[i] = rng() * 100;
  }
  const flyGeo = new THREE.BufferGeometry();
  flyGeo.setAttribute("position", new THREE.BufferAttribute(flyPos, 3));
  flyGeo.setAttribute("color", new THREE.BufferAttribute(flyCol, 3));
  const flies = new THREE.Points(
    flyGeo,
    new THREE.PointsMaterial({
      size: 0.09,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(flies);

  // ---------- Lights ----------
  const hemi = new THREE.HemisphereLight(0xbfe8ff, 0x3a2a6e, 0.7);
  group.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a8, 2.2);
  sun.position.set(8, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  group.add(sun);
  const accentA = new THREE.PointLight(0x35d7e8, 30, 18);
  accentA.position.set(-6, 4, 3);
  group.add(accentA);
  const accentB = new THREE.PointLight(0xff5fa8, 30, 18);
  accentB.position.set(6, 4, -2);
  group.add(accentB);
  const accentC = new THREE.PointLight(0x9a5bff, 24, 16);
  accentC.position.set(0, 6, 6);
  group.add(accentC);
  const defaultAccents: [THREE.PointLight, number][] = [
    [accentA, 0x35d7e8],
    [accentB, 0xff5fa8],
    [accentC, 0x9a5bff],
  ];

  // ---------- Carousel centrepiece ----------
  const carousel = new THREE.Group();
  carousel.position.set(0, 0, -3.5);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0xb8a8d8,
    roughness: 0.55,
    metalness: 0.25,
    emissive: 0x241838,
    emissiveIntensity: 0.15,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffc23a,
    roughness: 0.22,
    metalness: 0.85,
    emissive: 0x7a4d00,
    emissiveIntensity: 0.5,
  });
  const basePlinth = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3, 0.5, 24), baseMat);
  basePlinth.position.y = 0.25;
  basePlinth.castShadow = true;
  basePlinth.receiveShadow = true;
  carousel.add(basePlinth);
  const platter = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.25, 24), goldMat);
  platter.position.y = 0.62;
  carousel.add(platter);
  const spinner = new THREE.Group();
  spinner.position.y = 0.75;
  carousel.add(spinner);
  // Carousel mounts: real horse statues when the model loaded, spheres otherwise
  const hasHorse = Boolean(models.get("horse_statue_01"));
  const mountGeo = new THREE.SphereGeometry(0.32, 12, 10);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const fam = COLOR_FAMILIES[i % COLOR_FAMILIES.length]!;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8), goldMat);
    pole.position.set(Math.cos(a) * 1.7, 1.1, Math.sin(a) * 1.7);
    spinner.add(pole);
    let mount: THREE.Object3D;
    if (hasHorse) {
      const horse = cloneModel(models, "horse_statue_01")!;
      horse.rotation.y = -a + Math.PI / 2; // face direction of travel
      // Jewel-tone tint so each mount matches a colour family
      horse.traverse((o) => {
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
          const mat = o.material.clone();
          mat.color.lerp(new THREE.Color(COLOR_DEFS[fam].hex), 0.35);
          mat.emissive = new THREE.Color(COLOR_DEFS[fam].emissive);
          mat.emissiveIntensity = 0.12;
          o.material = mat;
        }
      });
      mount = horse;
      mount.position.set(Math.cos(a) * 1.7, 0.55, Math.sin(a) * 1.7);
      mount.userData.baseY = 0.55;
    } else {
      const sphere = new THREE.Mesh(
        mountGeo,
        new THREE.MeshStandardMaterial({
          color: COLOR_DEFS[fam].hex,
          emissive: COLOR_DEFS[fam].emissive,
          emissiveIntensity: 0.45,
          roughness: 0.3,
          metalness: 0.2,
        }),
      );
      sphere.scale.set(1, 0.8, 1.4);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), sphere.material);
      head.position.set(0, 0.28, 0.5);
      sphere.add(head);
      mount = sphere;
      mount.position.set(Math.cos(a) * 1.7, 1.1, Math.sin(a) * 1.7);
      mount.userData.baseY = 1.1;
    }
    mount.userData.phase = i;
    spinner.add(mount);
  }
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.5, 1.3, 12), baseMat);
  canopy.position.y = 3.3;
  carousel.add(canopy);
  const canopyTrim = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.08, 8, 32), goldMat);
  canopyTrim.rotation.x = Math.PI / 2;
  canopyTrim.position.y = 2.72;
  carousel.add(canopyTrim);
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffe08a,
      emissiveIntensity: 1.1,
      roughness: 0.1,
    }),
  );
  orb.position.y = 4.3;
  carousel.add(orb);
  const carouselLight = new THREE.PointLight(0xffe08a, 6, 10);
  carouselLight.position.y = 4.3;
  carousel.add(carouselLight);
  group.add(carousel);

  // ---------- Animation state ----------
  let finaleT = -1; // >=0 while finale playing
  let carnival: number | null = null;

  function update(dt: number, t: number, energy: number): void {
    const spinBoost = finaleT >= 0 ? 4 : 1 + energy * 1.5;
    spinner.rotation.y += dt * 0.35 * spinBoost;
    for (const child of spinner.children) {
      if (child.userData.baseY !== undefined) {
        child.position.y =
          child.userData.baseY + Math.sin(t * 2.2 + child.userData.phase * 1.3) * 0.18 * spinBoost;
      }
    }
    orb.rotation.y += dt;
    const orbPulse = 1.1 + Math.sin(t * 3) * 0.3 + energy * 0.8;
    (orb.material as THREE.MeshStandardMaterial).emissiveIntensity = orbPulse;

    if (finaleT >= 0) {
      finaleT += dt;
      const k = Math.min(finaleT / 1.2, 1);
      carousel.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.18);
      carouselLight.intensity = 10 + Math.sin(finaleT * 10) * 8 + 18 * (1 - k);
      if (finaleT > 4) {
        finaleT = -1;
        carousel.scale.setScalar(1);
        carouselLight.intensity = 10;
      }
    }

    // Firefly drift
    const fp = flies.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < flyCount; i++) {
      const s = flySeed[i]!;
      fp.setY(i, fp.getY(i) + Math.sin(t * 0.8 + s) * dt * 0.15);
      fp.setX(i, fp.getX(i) + Math.cos(t * 0.5 + s * 2) * dt * 0.1);
    }
    fp.needsUpdate = true;

    // Decoration sway
    for (const d of decorations) {
      if (d.sway > 0) d.mesh.rotation.y = Math.sin(t * 0.4) * 0.02 * d.sway;
    }

    // Real-model animations: trees breathe, lanterns swing, flowers shiver, horses gallop
    for (const s of swayers) {
      switch (s.kind) {
        case "tree":
          s.obj.rotation.z = Math.sin(t * 0.45 + s.phase) * 0.012;
          s.obj.rotation.x = Math.cos(t * 0.32 + s.phase) * 0.008;
          break;
        case "lantern":
          s.obj.rotation.z = Math.sin(t * 1.1 + s.phase) * 0.14;
          s.obj.rotation.x = Math.cos(t * 0.9 + s.phase) * 0.1;
          break;
        case "flower":
          s.obj.rotation.z = Math.sin(t * 1.6 + s.phase) * 0.03;
          break;
        case "horse":
          break;
      }
    }
    void hasTrees;

    // Butterfly flights: lazy tilted circles with wing-beat bob
    for (const bf of butterflies) {
      const a = t * 0.35 + bf.phase;
      bf.obj.position.set(
        Math.cos(a) * bf.r,
        bf.h + Math.sin(t * 7 + bf.phase) * 0.12 + Math.sin(a * 2) * 0.4,
        Math.sin(a * 1.3) * bf.r * 0.7 + 1,
      );
      bf.obj.rotation.y = -a + Math.PI / 2;
      bf.obj.rotation.z = Math.sin(t * 7 + bf.phase) * 0.25;
    }

    // Accent light gentle pulse
    accentA.intensity = 30 + Math.sin(t * 1.3) * 8;
    accentB.intensity = 30 + Math.sin(t * 1.1 + 2) * 8;
  }

  return {
    group,
    carousel,
    update,
    playFinale() {
      finaleT = 0;
    },
    setCarnivalColor(hex) {
      carnival = hex;
      for (const [light, orig] of defaultAccents) {
        light.color.setHex(carnival ?? orig);
      }
    },
  };
}
