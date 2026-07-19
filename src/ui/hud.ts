import { CHARGE_OVERCHARGE_MAX, CHARGE_MAX } from "../data/bubbleTypes";
import { COLOR_DEFS } from "../data/colors";
import type { Game } from "../systems/game";

/** Gameplay HUD: timer, score, chain, wand crystals, colour target, pause. */
export class Hud {
  root: HTMLDivElement;
  private timerEl: HTMLDivElement;
  private scoreEl: HTMLDivElement;
  private chainEl: HTMLDivElement;
  private chargesEl: HTMLDivElement;
  private targetEl: HTMLDivElement;
  private effectBanner: HTMLDivElement;
  private crystals: HTMLDivElement[] = [];
  private lastChain = 0;

  constructor(layer: HTMLElement, onPause: () => void) {
    this.root = document.createElement("div");
    this.root.className = "hud-top";
    this.root.style.display = "none";

    const left = document.createElement("div");
    left.style.cssText = "display:flex;flex-direction:column;gap:8px;align-items:flex-start;";
    this.scoreEl = pill("Score 0");
    this.chainEl = pill("");
    this.chainEl.id = "hud-chain";
    this.targetEl = pill("");
    this.targetEl.style.display = "none";
    left.append(this.scoreEl, this.chainEl, this.targetEl);

    const mid = document.createElement("div");
    this.timerEl = pill("90");
    this.timerEl.id = "hud-timer";
    mid.append(this.timerEl);

    const right = document.createElement("div");
    right.style.cssText = "display:flex;flex-direction:column;gap:8px;align-items:flex-end;pointer-events:auto;";
    this.chargesEl = document.createElement("div");
    this.chargesEl.id = "charges";
    this.chargesEl.className = "hud-pill";
    for (let i = 0; i < CHARGE_OVERCHARGE_MAX; i++) {
      const c = document.createElement("div");
      c.className = "crystal";
      this.crystals.push(c);
      this.chargesEl.appendChild(c);
    }
    const pauseBtn = document.createElement("button");
    pauseBtn.className = "btn secondary";
    pauseBtn.textContent = "⏸ Pause";
    pauseBtn.style.minWidth = "0";
    pauseBtn.addEventListener("click", onPause);
    right.append(this.chargesEl, pauseBtn);

    this.root.append(left, mid, right);
    layer.appendChild(this.root);

    this.effectBanner = document.createElement("div");
    this.effectBanner.id = "effect-banner";
    layer.appendChild(this.effectBanner);
  }

  show(v: boolean): void {
    this.root.style.display = v ? "flex" : "none";
    this.effectBanner.style.display = v ? "flex" : "none";
  }

  announce(text: string, ms = 2600): void {
    const chip = document.createElement("div");
    chip.className = "effect-chip";
    chip.textContent = text;
    this.effectBanner.appendChild(chip);
    setTimeout(() => chip.remove(), ms);
  }

  update(game: Game): void {
    this.scoreEl.textContent = `Score ${game.score.toLocaleString()}`;
    const secs = Math.max(0, Math.ceil(game.timeLeft));
    this.timerEl.textContent = String(secs);
    this.timerEl.classList.toggle("low", secs <= 10);

    if (game.chain > 1 && game.chainColor) {
      this.chainEl.style.display = "block";
      this.chainEl.textContent = `Chain ×${game.chainMultiplier.toFixed(1)} (${game.chain})`;
      this.chainEl.style.color = COLOR_DEFS[game.chainColor].css;
      if (game.chain !== this.lastChain) {
        this.chainEl.classList.remove("bump");
        void this.chainEl.offsetWidth;
        this.chainEl.classList.add("bump");
      }
    } else {
      this.chainEl.style.display = "none";
    }
    this.lastChain = game.chain;

    if (game.carnivalColor) {
      this.targetEl.style.display = "block";
      this.targetEl.textContent = `🎪 3× colour: ${game.carnivalColor.toUpperCase()}`;
      this.targetEl.style.color = COLOR_DEFS[game.carnivalColor].css;
    } else {
      this.targetEl.style.display = "none";
    }

    for (let i = 0; i < this.crystals.length; i++) {
      const c = this.crystals[i]!;
      c.classList.remove("full", "regen", "over");
      if (i < game.charges) c.classList.add(i >= CHARGE_MAX ? "over" : "full");
      else if (i === game.charges && game.chargeProgress > 0) {
        c.classList.add("regen");
        c.style.opacity = String(0.25 + game.chargeProgress * 0.5);
      }
      if (i === CHARGE_MAX) c.style.display = game.charges > CHARGE_MAX ? "block" : "none";
    }
  }
}

function pill(text: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "hud-pill";
  el.textContent = text;
  return el;
}
