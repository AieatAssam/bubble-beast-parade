import * as THREE from "three";
import { CREATURES, RARITY_LABEL, type CreatureDef } from "../data/creatures";
import { BUBBLE_TYPES, CHARGE_REGEN_SECONDS } from "../data/bubbleTypes";
import { PRISM_OUTCOMES } from "../data/prism";
import { COLOR_DEFS } from "../data/colors";
import { buildCreatureMesh, animateCreature } from "../rendering/creatureMesh";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { COLOR_FAMILIES, type ColorFamily } from "../data/colors";
import {
  exportSave, importSave, validateSave, resetAllData, localLeaderboard,
  type CaptureRecord, type ProfileRecord, type RunRecord,
} from "../persistence/db";
import { sound } from "../audio/sound";

type ScreenName =
  | "title" | "pause" | "results" | "library" | "leaderboard" | "settings" | "credits" | null;

export interface ResultsData {
  score: number;
  maxChain: number;
  captureCount: number;
  newCaptures: CreatureDef[];
  bestScoreEver: number;
}

export class Screens {
  private layer: HTMLElement;
  private screens = new Map<Exclude<ScreenName, null>, HTMLDivElement>();
  current: ScreenName = null;
  onPlay: () => void = () => {};
  onResume: () => void = () => {};
  onQuitToTitle: () => void = () => {};
  getProfile: () => ProfileRecord = () => {
    throw new Error("unset");
  };
  onSettingsChanged: (p: ProfileRecord) => void = () => {};
  private inspectRenderer: THREE.WebGLRenderer | null = null;
  private inspectStop: (() => void) | null = null;
  private captures: CaptureRecord[] = [];

  constructor(layer: HTMLElement) {
    this.layer = layer;
  }

  setCaptures(c: CaptureRecord[]): void {
    this.captures = c;
  }

  private make(name: Exclude<ScreenName, null>): HTMLDivElement {
    let el = this.screens.get(name);
    if (el) {
      el.innerHTML = "";
      return el;
    }
    el = document.createElement("div");
    el.className = "screen";
    el.style.display = "none";
    this.layer.appendChild(el);
    this.screens.set(name, el);
    return el;
  }

  show(name: ScreenName): void {
    this.inspectStop?.();
    for (const [n, el] of this.screens) {
      if (n !== name) {
        el.classList.remove("visible");
        el.style.display = "none";
      }
    }
    this.current = name;
    if (!name) return;
    const el = this.screens.get(name);
    if (el) {
      el.style.display = "flex";
      requestAnimationFrame(() => el.classList.add("visible"));
    }
  }

  private btn(label: string, cb: () => void, cls = "btn"): HTMLButtonElement {
    const b = document.createElement("button");
    b.className = cls;
    b.textContent = label;
    b.addEventListener("click", () => {
      sound.ui();
      cb();
    });
    return b;
  }

  // ---------------- Title ----------------
  buildTitle(): void {
    const el = this.make("title");
    const h1 = document.createElement("h1");
    h1.textContent = "Bubble Beast Parade";
    const sub = document.createElement("div");
    sub.style.cssText = "font-size:18px;opacity:.85;font-weight:700;";
    sub.textContent = "✨ Pop wisely — the best bubbles never wait ✨";
    el.append(h1, sub);
    el.append(
      this.btn("▶ Play", () => this.onPlay()),
      this.btn("📚 Beast Library", () => this.showLibrary()),
      this.btn("🏆 Leaderboard", () => void this.showLeaderboard()),
      this.btn("⚙ Settings", () => this.showSettings()),
      this.btn("💛 Credits", () => this.showCredits()),
    );
    const note = document.createElement("div");
    note.className = "footer-note";
    note.textContent = "A private local prototype — everything stays on this device.";
    el.append(note);
    this.show("title");
  }

  // ---------------- Pause / Help ----------------
  showPause(): void {
    const el = this.make("pause");
    const h = document.createElement("h2");
    h.textContent = "Paused — Field Guide";
    el.append(h);

    const help = document.createElement("div");
    help.className = "help-block";
    help.innerHTML =
      `<b>Controls:</b> move the wand with your mouse or finger; click / tap to pop the highlighted bubble. ` +
      `Each pop costs a wand crystal; crystals refill every ${CHARGE_REGEN_SECONDS}s. Golden &amp; Grand pops refund a crystal — ` +
      `and so do perfectly-timed chain pops.<br><br><b>Bubble types:</b><br>` +
      Object.values(BUBBLE_TYPES)
        .map((d) => `• <b>${d.label}</b> — ${d.help}`)
        .join("<br>") +
      `<br><br><b>Bump risk:</b> bubbles start immortal to collisions, but Colour Bond, Chorus, ` +
      `Golden and Grand bubbles gradually turn brittle the longer they drift (watch for a faint grey ` +
      `crackle) — bump one into another bubble while brittle and it can shatter for nothing. Standard ` +
      `and Prism bubbles never shatter this way.` +
      `<br><br><b>Prism outcomes (exact odds):</b><br>` +
      PRISM_OUTCOMES.map((o) => `• ${o.icon} <b>${o.label} — ${o.odds}%:</b> ${o.help}`).join("<br>");
    el.append(help);
    el.append(
      this.btn("▶ Resume", () => this.onResume()),
      this.btn("🏠 Quit to Title", () => this.onQuitToTitle(), "btn secondary"),
    );
    this.show("pause");
  }

  // ---------------- Results ----------------
  showResults(data: ResultsData, onReplay: () => void): void {
    const el = this.make("results");
    const h = document.createElement("h2");
    h.textContent = "Parade Complete!";
    el.append(h);

    const scoreEl = document.createElement("div");
    scoreEl.style.cssText = "font-size:52px;font-weight:900;color:#ffe08a;text-shadow:0 3px 14px rgba(255,194,58,.6);";
    scoreEl.textContent = "0";
    el.append(scoreEl);

    const stats = document.createElement("div");
    stats.className = "help-block";
    stats.innerHTML =
      `Best chain: <b>×${data.maxChain}</b> &nbsp;•&nbsp; Beasts captured: <b>${data.captureCount}</b>` +
      (data.score >= data.bestScoreEver && data.score > 0
        ? `<br>🌟 <b>New best score on this device!</b>`
        : `<br>Device best: <b>${data.bestScoreEver.toLocaleString()}</b>`);
    el.append(stats);

    if (data.newCaptures.length > 0) {
      const nc = document.createElement("div");
      nc.className = "help-block";
      nc.innerHTML =
        `<b>New beasts joined the parade:</b><br>` +
        data.newCaptures
          .map((c) => `✨ <b style="color:${COLOR_DEFS[c.color].css}">${c.name}</b> (${RARITY_LABEL[c.rarity]})`)
          .join("<br>");
      el.append(nc);
    }

    el.append(
      this.btn("🔁 Play Again", onReplay),
      this.btn("📚 Beast Library", () => this.showLibrary()),
      this.btn("🏠 Title", () => this.onQuitToTitle(), "btn secondary"),
    );
    this.show("results");

    // Count-up with tick sounds
    const target = data.score;
    const dur = Math.min(2200, 600 + target / 3);
    const t0 = performance.now();
    let lastTick = 0;
    const step = (now: number): void => {
      const k = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - k, 3);
      const val = Math.round(target * eased);
      scoreEl.textContent = val.toLocaleString();
      if (val > lastTick + target / 24) {
        lastTick = val;
        sound.tick(Math.round(k * 20));
      }
      if (k < 1 && this.current === "results") requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------------- Library ----------------
  showLibrary(): void {
    const el = this.make("library");
    const h = document.createElement("h2");
    h.textContent = "Bubble Beast Library";
    el.append(h);

    const capMap = new Map(this.captures.map((c) => [c.creatureId, c]));
    const grid = document.createElement("div");
    grid.className = "card-grid";
    for (const def of CREATURES) {
      const cap = capMap.get(def.id);
      const card = document.createElement("div");
      card.className = `beast-card ${def.rarity}${cap ? "" : " locked"}`;
      const swatch = COLOR_DEFS[def.color].css;
      card.innerHTML =
        `<div style="font-size:38px">${cap ? rarityEmoji(def) : "❔"}</div>` +
        `<div style="font-weight:900;color:${swatch}">${cap ? def.name : "???"}</div>` +
        `<div class="rarity" style="color:${swatch}">${RARITY_LABEL[def.rarity]}</div>` +
        (cap
          ? `<div style="font-size:12.5px;opacity:.85">Caught ×${cap.count} · best chain ${cap.bestChain}</div>` +
            `<div style="display:flex;gap:4px;justify-content:center;margin-top:6px">` +
            COLOR_FAMILIES.map((f) => {
              const got = (cap.variants?.[f] ?? 0) > 0;
              return `<span title="${f}" style="width:11px;height:11px;border-radius:50%;` +
                `background:${got ? COLOR_DEFS[f].css : "transparent"};` +
                `border:1.5px solid ${got ? COLOR_DEFS[f].css : "rgba(255,255,255,.25)"};"></span>`;
            }).join("") +
            `</div>`
          : `<div style="font-size:12.5px;opacity:.6">Not yet captured</div>`);
      if (cap) card.addEventListener("click", () => this.showInspect(def, cap));
      grid.append(card);
    }
    el.append(grid);
    el.append(this.btn("← Back", () => this.backHome(), "btn secondary"));
    this.show("library");
  }

  /** Large 3D inspect view with turntable rotation. */
  private showInspect(def: CreatureDef, cap: CaptureRecord): void {
    const el = this.make("library");
    const h = document.createElement("h2");
    h.textContent = def.name;
    h.style.color = COLOR_DEFS[def.color].css;
    el.append(h);

    const wrap = document.createElement("div");
    wrap.id = "inspect-view";
    const canvas = document.createElement("canvas");
    canvas.id = "inspect-canvas";
    wrap.append(canvas);
    const info = document.createElement("div");
    info.className = "help-block";
    info.innerHTML =
      `<b>${RARITY_LABEL[def.rarity]}</b> · worth ${def.score} points<br><i>“${def.flavor}”</i><br><br>` +
      `First captured: <b>${new Date(cap.firstCaptureAt).toLocaleString()}</b><br>` +
      `Total captures: <b>${cap.count}</b> · Best chain at capture: <b>×${cap.bestChain}</b><br>` +
      `Total points earned: <b>${cap.totalPoints.toLocaleString()}</b>`;
    wrap.append(info);
    el.append(wrap);
    el.append(this.btn("← Library", () => this.showLibrary(), "btn secondary"));
    this.show("library");

    // Mini turntable renderer
    this.inspectRenderer?.dispose();
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.inspectRenderer = r;
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    const w = canvas.clientWidth || 420;
    const hpx = canvas.clientHeight || 320;
    r.setSize(w, hpx, false);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(38, w / hpx, 0.1, 20);
    cam.position.set(0, 0.5, 1.9);
    cam.lookAt(0, 0.15, 0);
    scene.add(new THREE.HemisphereLight(0xbfe8ff, 0x3a2a6e, 1.4));
    const key = new THREE.DirectionalLight(0xfff2d8, 2.4);
    key.position.set(2, 3, 2);
    scene.add(key);
    const rim = new THREE.PointLight(COLOR_DEFS[def.color].emissive, 12, 8);
    rim.position.set(-1.5, 1, -1);
    scene.add(rim);
    // Showcase plinth — grander for higher rarity
    const plinthH = { common: 0.06, uncommon: 0.09, rare: 0.12, epic: 0.16, mythic: 0.22 }[def.rarity];
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.6, plinthH, 24),
      new THREE.MeshStandardMaterial({
        color: def.rarity === "mythic" ? 0xffc23a : 0x8877cc,
        metalness: 0.7,
        roughness: 0.25,
        emissive: def.rarity === "mythic" ? 0x7a4d00 : 0x221144,
        emissiveIntensity: 0.6,
      }),
    );
    plinth.position.y = -0.35;
    scene.add(plinth);
    let mesh = buildCreatureMesh(def, 1.4);
    mesh.position.y = -0.28;
    scene.add(mesh);

    // Full 3D viewer: drag to orbit, wheel/pinch to zoom; auto-spins until touched
    const controls = new OrbitControls(cam, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 3;
    controls.minDistance = 0.9;
    controls.maxDistance = 4;
    controls.target.set(0, 0.05, 0);
    controls.addEventListener("start", () => (controls.autoRotate = false));

    // Colour-variant swatches: view every colour you have captured
    const owned = COLOR_FAMILIES.filter((f) => (cap.variants?.[f] ?? 0) > 0);
    if (owned.length > 0) {
      const swatches = document.createElement("div");
      swatches.style.cssText = "display:flex;gap:10px;justify-content:center;margin-top:2px;";
      for (const f of owned) {
        const btn = document.createElement("button");
        btn.title = `${f} variant (×${cap.variants?.[f] ?? 0})`;
        btn.style.cssText =
          `width:26px;height:26px;border-radius:50%;cursor:pointer;background:${COLOR_DEFS[f].css};` +
          `border:2.5px solid rgba(255,255,255,.7);box-shadow:0 0 10px ${COLOR_DEFS[f].css};`;
        btn.addEventListener("click", () => {
          sound.ui();
          scene.remove(mesh);
          mesh = buildCreatureMesh(def, 1.4, f as ColorFamily);
          mesh.position.y = -0.28;
          scene.add(mesh);
          rim.color.setHex(COLOR_DEFS[f].emissive);
        });
        swatches.append(btn);
      }
      wrap.insertBefore(swatches, info);
      const hint = document.createElement("div");
      hint.style.cssText = "font-size:12.5px;opacity:.7;";
      hint.textContent = "Drag to rotate · scroll to zoom · tap a colour to view that variant";
      wrap.insertBefore(hint, info);
    }

    let raf = 0;
    const t0 = performance.now();
    const loop = (): void => {
      const t = (performance.now() - t0) / 1000;
      animateCreature(mesh, t);
      mesh.rotation.y = 0; // orbit controls own the camera; keep the beast steady
      controls.update();
      r.render(scene, cam);
      raf = requestAnimationFrame(loop);
    };
    loop();
    this.inspectStop = () => {
      cancelAnimationFrame(raf);
      controls.dispose();
      r.dispose();
      this.inspectRenderer = null;
      this.inspectStop = null;
    };
  }

  private backHome(): void {
    this.show("title");
  }

  // ---------------- Leaderboard ----------------
  async showLeaderboard(): Promise<void> {
    const [scores, chains, mostBeasts, latest] = await Promise.all([
      localLeaderboard.topScores(10),
      localLeaderboard.topChains(10),
      localLeaderboard.topCaptures(10),
      localLeaderboard.latestRuns(20),
    ]);
    const el = this.make("leaderboard");
    const h = document.createElement("h2");
    h.textContent = "This Device Leaderboard";
    el.append(h);

    const tabs = document.createElement("div");
    tabs.className = "tabs";
    const holder = document.createElement("div");
    const sets: [string, RunRecord[]][] = [
      ["Top Scores", scores],
      ["Top Chains", chains],
      ["Most Beasts", mostBeasts],
      ["Latest Runs", latest],
    ];
    const render = (rows: RunRecord[], idx: number): void => {
      [...tabs.children].forEach((c, i) => c.classList.toggle("active", i === idx));
      holder.innerHTML = "";
      if (rows.length === 0) {
        const p = document.createElement("div");
        p.className = "help-block";
        p.textContent = "No runs yet — play a round!";
        holder.append(p);
        return;
      }
      const table = document.createElement("table");
      table.className = "board";
      table.innerHTML =
        `<tr><th>#</th><th>Name</th><th>Date</th><th>Score</th><th>Chain</th><th>Beasts</th><th>Badge</th></tr>` +
        rows
          .map(
            (r, i) =>
              `<tr><td>${i + 1}</td><td>${escapeHtml(r.playerName)}</td>` +
              `<td>${new Date(r.at).toLocaleDateString()}</td>` +
              `<td><b>${r.score.toLocaleString()}</b></td><td>×${r.maxChain}</td>` +
              `<td>${r.captureCount}</td><td>${rarityBadge(r.bestRarity)}</td></tr>`,
          )
          .join("");
      holder.append(table);
    };
    sets.forEach(([label, rows], i) => {
      const t = document.createElement("button");
      t.className = "tab";
      t.textContent = label;
      t.addEventListener("click", () => render(rows, i));
      tabs.append(t);
    });
    el.append(tabs, holder);
    render(scores, 0);
    el.append(this.btn("← Back", () => this.backHome(), "btn secondary"));
    this.show("leaderboard");
  }

  // ---------------- Settings ----------------
  showSettings(): void {
    const p = this.getProfile();
    const el = this.make("settings");
    const h = document.createElement("h2");
    h.textContent = "Settings";
    el.append(h);

    const row = (label: string, control: HTMLElement): HTMLDivElement => {
      const r = document.createElement("div");
      r.className = "settings-row";
      const l = document.createElement("span");
      l.textContent = label;
      r.append(l, control);
      return r;
    };
    const check = (value: boolean, cb: (v: boolean) => void): HTMLInputElement => {
      const c = document.createElement("input");
      c.type = "checkbox";
      c.checked = value;
      c.style.cssText = "width:24px;height:24px;";
      c.addEventListener("change", () => cb(c.checked));
      return c;
    };

    const vol = document.createElement("input");
    vol.type = "range";
    vol.min = "0";
    vol.max = "1";
    vol.step = "0.05";
    vol.value = String(p.settings.volume);
    vol.addEventListener("input", () => {
      p.settings.volume = Number(vol.value);
      this.onSettingsChanged(p);
    });
    el.append(row("Volume", vol));
    el.append(row("Mute", check(p.settings.muted, (v) => {
      p.settings.muted = v;
      this.onSettingsChanged(p);
    })));
    el.append(row("Reduced motion", check(p.settings.reducedMotion, (v) => {
      p.settings.reducedMotion = v;
      this.onSettingsChanged(p);
    })));
    el.append(row("Reduced flash", check(p.settings.reducedFlash, (v) => {
      p.settings.reducedFlash = v;
      this.onSettingsChanged(p);
    })));
    const q = document.createElement("select");
    q.style.cssText = "font:inherit;font-size:16px;padding:6px 10px;border-radius:8px;";
    for (const [v, label] of [["0", "Off"], ["1", "Low"], ["2", "Full"]] as const) {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = label;
      if (Number(v) === p.settings.effectsQuality) o.selected = true;
      q.append(o);
    }
    q.addEventListener("change", () => {
      p.settings.effectsQuality = Number(q.value) as 0 | 1 | 2;
      this.onSettingsChanged(p);
    });
    el.append(row("Bloom / effects", q));

    const nameIn = document.createElement("input");
    nameIn.type = "text";
    nameIn.maxLength = 20;
    nameIn.value = p.name;
    nameIn.style.cssText = "font:inherit;font-size:16px;padding:6px 10px;border-radius:8px;width:170px;";
    nameIn.addEventListener("change", () => {
      p.name = nameIn.value.trim() || "Bubble Friend";
      this.onSettingsChanged(p);
    });
    el.append(row("Player name", nameIn));

    // Data controls
    el.append(
      this.btn("⬇ Export save (JSON)", async () => {
        const blob = await exportSave();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(
          new Blob([JSON.stringify(blob, null, 2)], { type: "application/json" }),
        );
        a.download = "bubble-beast-parade-save.json";
        a.click();
        URL.revokeObjectURL(a.href);
      }, "btn secondary"),
      this.btn("⬆ Import save…", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json";
        input.addEventListener("change", async () => {
          const f = input.files?.[0];
          if (!f) return;
          try {
            const data: unknown = JSON.parse(await f.text());
            if (!validateSave(data)) throw new Error("invalid");
            if (confirm("Replace ALL local data with this save file? This cannot be undone.")) {
              await importSave(data);
              location.reload();
            }
          } catch {
            alert("That file is not a valid Bubble Beast Parade save.");
          }
        });
        input.click();
      }, "btn secondary"),
      this.btn("🗑 Reset all local data", async () => {
        if (
          confirm(
            "Really erase ALL local data — captures, runs, leaderboard, and settings? This cannot be undone.",
          )
        ) {
          await resetAllData();
          location.reload();
        }
      }, "btn danger"),
    );

    const priv = document.createElement("div");
    priv.className = "privacy-note";
    priv.textContent =
      "Privacy: all data for this prototype lives only in this browser on this device (IndexedDB). Nothing is uploaded anywhere.";
    el.append(priv);
    el.append(this.btn("← Back", () => this.backHome(), "btn secondary"));
    this.show("settings");
  }

  // ---------------- Credits ----------------
  showCredits(): void {
    const el = this.make("credits");
    const h = document.createElement("h2");
    h.textContent = "Credits";
    el.append(h);
    const block = document.createElement("div");
    block.className = "help-block";
    block.innerHTML =
      `<b>Bubble Beast Parade</b> — a local prototype built with:<br>` +
      `• <b>Three.js</b> — rendering, post-processing, loaders (MIT)<br>` +
      `• <b>Rapier 3D</b> (@dimforge/rapier3d-compat) — bubble drift &amp; separation (Apache-2.0)<br>` +
      `• <b>Vite + TypeScript</b> — build tooling (MIT)<br><br>` +
      `<b>Assets:</b><br>` +
      `• “Rosendal Park Sunset” HDRI — Poly Haven, CC0<br>` +
      `• All creatures, garden pieces and sounds are procedural originals.<br><br>` +
      `Full details in <b>ATTRIBUTIONS.md</b> in the project root.`;
    el.append(block);
    el.append(this.btn("← Back", () => this.backHome(), "btn secondary"));
    this.show("credits");
  }
}

function rarityEmoji(def: CreatureDef): string {
  const map = { blob: "💧", sprite: "🌸", snail: "🐌", moth: "🦋", jelly: "🎐", koi: "🐟", axolotl: "🌊", dragonet: "🐉", seraph: "🌌", fawn: "🦌" };
  return map[def.body];
}

function rarityBadge(r: RunRecord["bestRarity"]): string {
  return { common: "⚪", uncommon: "🟢", rare: "🔵", epic: "🟣", mythic: "🟡" }[r];
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
