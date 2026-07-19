import * as THREE from "three";
import {
  BUBBLE_TYPES, CHAIN_MULT_MAX, CHAIN_MULT_STEP, CHAIN_TIMEOUT_SECONDS,
  CHARGE_MAX, CHARGE_OVERCHARGE_MAX, CHARGE_REGEN_SECONDS, GRAND_ENTRANCE_AT,
  PERFECT_CHAIN_WINDOW, ROUND_SECONDS, type BubbleKind,
} from "../data/bubbleTypes";
import { randomColorFamily, type ColorFamily } from "../data/colors";
import { rollPrism, type PrismOutcomeDef } from "../data/prism";
import type { Bubble, BubblePool } from "../entities/bubble";
import { randomPath, GRAND_PATH, DRIFT_PATHS } from "./paths";
import type { PopFX } from "./popfx";
import { sound } from "../audio/sound";
import type { PointerWand } from "../input/pointer";
import type { Garden } from "../rendering/garden";

export interface CaptureEvent {
  bubble: Bubble;
  score: number;
  chain: number;
  isNewCreature: boolean;
}

export interface GameEvents {
  onCapture(e: CaptureEvent): void;
  onRoundEnd(): void;
  onPrism(outcome: PrismOutcomeDef): void;
  onGrandEntrance(): void;
}

export type ActiveEffect = { outcome: PrismOutcomeDef; remaining: number; usesLeft: number };

/** Central 90-second round controller: spawner, charges, chains, prism, scoring. */
export class Game {
  // Round state
  running = false;
  paused = false;
  timeLeft = ROUND_SECONDS;
  score = 0;
  captureCount = 0;
  chain = 0;
  maxChain = 0;
  chainColor: ColorFamily | null = null;
  chainTimer = 0;
  charges = CHARGE_MAX;
  chargeProgress = 0;
  effects: ActiveEffect[] = [];
  effectsTriggered: string[] = [];
  carnivalColor: ColorFamily | null = null;
  hitStop = 0;
  lastPopAt = -99;
  grandSpawned = false;
  capturedIds = new Set<string>();
  reducedMotion = false;

  private spawnTimer = 0;
  private pool: BubblePool;
  private fx: PopFX;
  private wand: PointerWand;
  private garden: Garden;
  private camera: THREE.PerspectiveCamera;
  private events: GameEvents;
  private elapsed = 0;

  constructor(
    pool: BubblePool,
    fx: PopFX,
    wand: PointerWand,
    garden: Garden,
    camera: THREE.PerspectiveCamera,
    events: GameEvents,
  ) {
    this.pool = pool;
    this.fx = fx;
    this.wand = wand;
    this.garden = garden;
    this.camera = camera;
    this.events = events;
  }

  startRound(): void {
    this.pool.clear();
    this.running = true;
    this.paused = false;
    this.timeLeft = ROUND_SECONDS;
    this.score = 0;
    this.captureCount = 0;
    this.chain = 0;
    this.maxChain = 0;
    this.chainColor = null;
    this.chainTimer = 0;
    this.charges = CHARGE_MAX;
    this.chargeProgress = 0;
    this.effects = [];
    this.effectsTriggered = [];
    this.carnivalColor = null;
    this.hitStop = 0;
    this.grandSpawned = false;
    this.elapsed = 0;
    this.spawnTimer = 0.5;
    sound.startMusic();
    sound.setMusicIntensity(0);
    // Opening pocket of standards so the field is alive immediately
    for (let i = 0; i < 5; i++) this.spawnBubble("standard");
  }

  endRound(): void {
    this.running = false;
    sound.setMusicIntensity(0);
    this.garden.playFinale();
    sound.fanfare();
    this.events.onRoundEnd();
  }

  /** Intensity 0..1 for music + carousel energy. */
  get intensity(): number {
    return this.running ? Math.min(1, this.elapsed / ROUND_SECONDS) : 0;
  }

  private spawnBubble(kind: BubbleKind, opts: { mini?: boolean; color?: ColorFamily } = {}): Bubble {
    const color = opts.color ?? randomColorFamily();
    const path = kind === "grand" ? GRAND_PATH : randomPath();
    const spawnOpts: { mini?: boolean } = {};
    if (opts.mini !== undefined) spawnOpts.mini = opts.mini;
    return this.pool.spawn(kind, color, path, spawnOpts);
  }

  private pickSpawnKind(): BubbleKind {
    const kinds = Object.values(BUBBLE_TYPES).filter((d) => d.spawnWeight > 0);
    const total = kinds.reduce((a, d) => a + d.spawnWeight, 0);
    let roll = Math.random() * total;
    for (const d of kinds) {
      roll -= d.spawnWeight;
      if (roll <= 0) return d.kind;
    }
    return "standard";
  }

  update(dt: number, t: number): void {
    if (!this.running || this.paused) return;

    // Hit-stop: freeze gameplay time briefly
    let timeScale = 1;
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      timeScale = this.reducedMotion ? 0.6 : 0;
    }
    const gdt = dt * timeScale;

    this.elapsed += gdt;
    this.timeLeft -= gdt;
    sound.setMusicIntensity(this.intensity);

    if (this.timeLeft <= GRAND_ENTRANCE_AT && !this.grandSpawned) {
      this.grandSpawned = true;
      const b = this.spawnBubble("grand");
      b.lifespan = GRAND_ENTRANCE_AT - 0.3;
      sound.grandEntrance();
      this.garden.playFinale();
      this.events.onGrandEntrance();
    }

    if (this.timeLeft <= 0) {
      this.endRound();
      return;
    }

    // Charge regen
    if (this.charges < CHARGE_MAX) {
      this.chargeProgress += gdt / CHARGE_REGEN_SECONDS;
      if (this.chargeProgress >= 1) {
        this.chargeProgress = 0;
        this.charges++;
      }
    } else {
      this.chargeProgress = 0;
    }

    // Chain timeout
    if (this.chain > 0) {
      this.chainTimer -= gdt;
      if (this.chainTimer <= 0) this.resetChain();
    }

    // Spawner: escalating density (calm opening → busy finale)
    this.spawnTimer -= gdt;
    const density = 1 + this.intensity * 1.6;
    const activeCount = this.pool.active.length;
    const cap = Math.round(8 + this.intensity * 8);
    if (this.spawnTimer <= 0 && activeCount < cap) {
      this.spawnTimer = (1.6 - this.intensity * 0.9) / density + Math.random() * 0.5;
      const kind = this.pickSpawnKind();
      // Crystal Rain: bias spawns to high-value from centre fountain
      const rain = this.effects.find((e) => e.outcome.id === "crystalRain");
      if (rain && Math.random() < 0.6) {
        const b = this.spawnBubble(Math.random() < 0.5 ? "golden" : "colorBond");
        if (b.body) {
          b.body.setTranslation({ x: 0, y: 2, z: -1 }, true);
          b.body.applyImpulse({ x: (Math.random() - 0.5) * 3, y: 4, z: 1.5 }, true);
        }
      } else {
        this.spawnBubble(kind);
      }
    }

    // Active effects tick
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i]!;
      if (e.outcome.duration > 0) {
        e.remaining -= gdt;
        if (e.remaining <= 0) this.removeEffect(i);
      } else if (e.usesLeft <= 0) {
        this.removeEffect(i);
      }
    }

    // Rainbow Draft: pull nearby bubbles toward wand
    const draft = this.effects.find((e) => e.outcome.id === "rainbowDraft");
    if (draft) {
      for (const b of this.pool.active) {
        if (b.state !== "idle" || !b.body) continue;
        const d = b.pos.distanceTo(this.wand.worldPos);
        if (d < 5 && d > 1.2) {
          const pull = 6 * gdt * b.body.mass();
          b.body.applyImpulse(
            {
              x: ((this.wand.worldPos.x - b.pos.x) / d) * pull,
              y: ((this.wand.worldPos.y - b.pos.y) / d) * pull,
              z: 0,
            },
            true,
          );
        }
      }
    }

    // Parade Line: pull beasts toward a slow horizontal line
    const parade = this.effects.find((e) => e.outcome.id === "paradeLine");
    if (parade) {
      const lineY = 3.5;
      const speed = 1.2;
      for (const b of this.pool.active) {
        if (b.state !== "idle" || !b.body) continue;
        const targetX = ((t * speed + b.id * 1.7) % 20) - 10;
        const f = 3 * gdt * b.body.mass();
        b.body.applyImpulse(
          { x: (targetX - b.pos.x) * f, y: (lineY - b.pos.y) * f, z: (2.5 - b.pos.z) * f },
          true,
        );
      }
    }

    void t;
  }

  private removeEffect(i: number): void {
    const e = this.effects[i]!;
    if (e.outcome.id === "colorCarnival") {
      this.carnivalColor = null;
      this.garden.setCarnivalColor(null);
    }
    this.effects.splice(i, 1);
  }

  private resetChain(): void {
    this.chain = 0;
    this.chainColor = null;
    this.chainTimer = 0;
  }

  get chainMultiplier(): number {
    return Math.min(1 + this.chain * CHAIN_MULT_STEP, CHAIN_MULT_MAX);
  }

  /** Attempt to pop a bubble via the wand. Returns false if no charge / invalid. */
  tryPop(b: Bubble | null): boolean {
    if (!this.running || this.paused || !b || b.state !== "idle") return false;
    const def = BUBBLE_TYPES[b.kind];
    if (this.charges < def.chargeCost) {
      sound.ui(220, 0.15); // empty-crystal dull note
      return false;
    }
    this.charges -= def.chargeCost;
    this.performPop(b, true);
    return true;
  }

  /** Pop resolution — also used by chorus orbiters and mirror echoes (no charge). */
  private performPop(b: Bubble, fromPlayer: boolean): void {
    const def = BUBBLE_TYPES[b.kind];
    const now = this.elapsed;

    // Chain logic
    let chained = false;
    if (this.chainColor === b.color || this.chain === 0) {
      if (this.chainColor === b.color) chained = true;
      this.chain++;
      this.chainColor = b.color;
      this.chainTimer = CHAIN_TIMEOUT_SECONDS;
    } else {
      // Mismatched capture: chain resets (clearly communicated in HUD)
      this.resetChain();
      this.chain = 1;
      this.chainColor = b.color;
      this.chainTimer = CHAIN_TIMEOUT_SECONDS;
    }
    this.maxChain = Math.max(this.maxChain, this.chain);

    // Perfect-timing refund
    const perfect = chained && now - this.lastPopAt <= PERFECT_CHAIN_WINDOW && fromPlayer;
    this.lastPopAt = now;

    // Scoring
    let score = def.baseScore + (b.kind !== "prism" ? b.creature.score : 0);
    if (b.miniValue) score = Math.round(score * 0.35);
    score = Math.round(score * this.chainMultiplier);
    const carnival = this.effects.find((e) => e.outcome.id === "colorCarnival");
    if (carnival && this.carnivalColor === b.color) score *= 3;
    this.score += score;
    this.captureCount++;

    // Golden/Grand: refund or overcharge — reward the save
    const big = b.kind === "golden" || b.kind === "grand";
    if (big && fromPlayer) {
      this.charges = Math.min(this.charges + 1, CHARGE_OVERCHARGE_MAX);
      sound.ping();
    } else if (perfect) {
      this.charges = Math.min(this.charges + 1, CHARGE_OVERCHARGE_MAX);
      sound.ping();
    }

    // Hit-stop (~50ms), skipped under reduced motion
    this.hitStop = this.reducedMotion ? 0 : 0.05;

    // FX + audio
    const screen = this.worldToScreen(b.pos);
    const pan = (screen.x / innerWidth) * 2 - 1;
    sound.pop(pan, chained ? this.chain - 1 : 0, big);
    this.fx.shockwave(b.pos, b.color, this.camera, big);
    this.fx.burst(b.pos, b.color, big);
    this.fx.scorePopup(screen.x, screen.y, `+${score}`, b.color, big);

    // Squash-then-burst on the shell before despawn
    b.state = "popping";
    const shell = b.shell;
    const pool = this.pool;
    const squashMs = 90;
    shell.scale.set(1.35, 0.6, 1.35);
    setTimeout(() => {
      shell.scale.set(0.6, 1.4, 0.6);
      setTimeout(() => pool.despawn(b), 50);
    }, squashMs / 2);

    // Capture record + event
    const isNew = b.kind !== "prism" && !this.capturedIds.has(b.creature.id);
    if (b.kind !== "prism") this.capturedIds.add(b.creature.id);
    this.events.onCapture({ bubble: b, score, chain: this.chain, isNewCreature: isNew });

    // Bubble Bloom: split into minis
    const bloom = this.effects.find((e) => e.outcome.id === "bubbleBloom");
    if (bloom && !b.miniValue && b.kind === "standard") {
      for (let i = 0; i < 3; i++) {
        const mini = this.pool.spawn(b.kind, b.color, randomPath(), { mini: true });
        if (mini.body) {
          mini.body.setTranslation({ x: b.pos.x, y: b.pos.y, z: b.pos.z }, true);
          mini.body.applyImpulse(
            { x: (Math.random() - 0.5) * 2, y: Math.random() * 2, z: (Math.random() - 0.5) * 2 },
            true,
          );
        }
      }
    }

    // Mirror Pop: echo to nearest eligible bubble
    const mirror = this.effects.find((e) => e.outcome.id === "mirrorPop");
    if (mirror && fromPlayer && mirror.usesLeft > 0) {
      mirror.usesLeft--;
      let nearest: Bubble | null = null;
      let bd = 4;
      for (const other of this.pool.active) {
        if (other === b || other.state !== "idle") continue;
        const d = other.pos.distanceTo(b.pos);
        if (d < bd) {
          bd = d;
          nearest = other;
        }
      }
      if (nearest) setTimeout(() => {
        if (nearest.state === "idle") this.performPop(nearest, false);
      }, 140);
    }

    // Chorus: capture orbiters too
    if (b.kind === "chorus" && fromPlayer) {
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const mini = this.pool.spawn("standard", b.color, randomPath(), { mini: true });
          if (mini.body) mini.body.setTranslation({ x: b.pos.x + (i - 1) * 0.8, y: b.pos.y, z: b.pos.z }, true);
          this.performPop(mini, false);
        }, 120 + i * 110);
      }
    }

    // Prism: roll disclosed outcome after a short celebratory beat
    if (b.kind === "prism") {
      const outcome = rollPrism(Math.random);
      setTimeout(() => {
        sound.prismReveal();
        this.effectsTriggered.push(outcome.id);
        const eff: ActiveEffect = {
          outcome,
          remaining: outcome.duration,
          usesLeft: outcome.id === "mirrorPop" ? 3 : 0,
        };
        this.effects.push(eff);
        if (outcome.id === "colorCarnival") {
          this.carnivalColor = randomColorFamily();
          this.garden.setCarnivalColor(
            {
              cyan: 0x35d7e8, pink: 0xff5fa8, violet: 0x9a5bff,
              gold: 0xffc23a, lime: 0x8ce840, orange: 0xff8c3a,
            }[this.carnivalColor],
          );
        }
        this.events.onPrism(outcome);
      }, 700);
    }
  }

  private worldToScreen(pos: THREE.Vector3): { x: number; y: number } {
    const v = pos.clone().project(this.camera);
    return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
  }
}

export { DRIFT_PATHS };
