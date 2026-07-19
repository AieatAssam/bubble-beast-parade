/** Injected UI stylesheet: HUD + screens, mouse and touch friendly. */
export function injectStyles(): void {
  const css = `
  #ui-layer { position: fixed; inset: 0; pointer-events: none; z-index: 10; color: #fff; }
  .screen {
    position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 18px;
    background: radial-gradient(ellipse at 50% 30%, rgba(28,20,80,.88), rgba(8,6,32,.94));
    pointer-events: auto; opacity: 0; transition: opacity .35s ease; z-index: 20;
    overflow-y: auto; padding: 24px; box-sizing: border-box;
  }
  .screen.visible { opacity: 1; }
  .screen h1 {
    font-size: clamp(34px, 7vw, 64px); margin: 0; text-align: center;
    background: linear-gradient(90deg,#35d7e8,#ff5fa8,#ffc23a,#8ce840);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    filter: drop-shadow(0 3px 12px rgba(154,91,255,.6));
  }
  .screen h2 { font-size: clamp(22px, 4vw, 34px); margin: 0; color: #ffe08a; }
  .btn {
    font: inherit; font-size: 20px; font-weight: 800; color: #fff;
    background: linear-gradient(135deg,#7b3fe0,#e0409a); border: 2px solid rgba(255,255,255,.35);
    border-radius: 999px; padding: 12px 34px; cursor: pointer; min-width: 220px;
    box-shadow: 0 4px 24px rgba(154,91,255,.45); transition: transform .12s, box-shadow .12s;
    touch-action: manipulation;
  }
  .btn:hover, .btn:focus-visible { transform: scale(1.05); box-shadow: 0 6px 32px rgba(255,95,168,.6); }
  .btn.secondary { background: linear-gradient(135deg,#1e6f8a,#35d7e8); min-width: 160px; font-size: 17px; padding: 10px 24px; }
  .btn.danger { background: linear-gradient(135deg,#a02040,#e04040); }
  .hud-top {
    position: absolute; top: 0; left: 0; right: 0; display: flex;
    justify-content: space-between; align-items: flex-start; padding: 14px 18px;
    pointer-events: none; font-weight: 800;
  }
  .hud-pill {
    background: rgba(16,10,48,.72); border: 1.5px solid rgba(255,255,255,.22);
    border-radius: 16px; padding: 8px 16px; backdrop-filter: blur(6px);
    text-shadow: 0 1px 4px #000; font-size: 18px;
  }
  #hud-timer { font-size: 26px; color: #ffe08a; min-width: 90px; text-align: center; }
  #hud-timer.low { color: #ff6a6a; animation: pulse .5s infinite alternate; }
  @keyframes pulse { from { transform: scale(1);} to { transform: scale(1.12);} }
  #hud-chain { color: #8ce840; transition: transform .15s; }
  #hud-chain.bump { transform: scale(1.3); }
  #charges { display: flex; gap: 8px; align-items: center; }
  .crystal {
    width: 26px; height: 34px; clip-path: polygon(50% 0, 100% 30%, 80% 100%, 20% 100%, 0 30%);
    background: linear-gradient(180deg,#9fe8ff,#2f8fd8); opacity: .25; transition: opacity .2s, transform .2s;
    position: relative;
  }
  .crystal.full { opacity: 1; box-shadow: 0 0 14px #7cf4ff; }
  .crystal.over { background: linear-gradient(180deg,#ffe08a,#ffaa22); opacity: 1; box-shadow: 0 0 18px #ffc23a; animation: pulse .4s infinite alternate; }
  .crystal.regen { opacity: .55; }
  #effect-banner {
    position: absolute; top: 74px; left: 50%; transform: translateX(-50%);
    display: flex; flex-direction: column; gap: 6px; align-items: center; pointer-events: none;
  }
  .effect-chip {
    background: rgba(60,20,110,.85); border: 1.5px solid #c79bff; border-radius: 999px;
    padding: 6px 18px; font-weight: 800; font-size: 16px; text-shadow: 0 1px 3px #000;
    animation: chipIn .4s ease;
  }
  @keyframes chipIn { from { transform: scale(.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .card-grid { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; max-width: 960px; }
  .beast-card {
    width: 150px; background: rgba(22,14,60,.85); border-radius: 14px; padding: 12px;
    border: 2px solid rgba(255,255,255,.18); text-align: center; cursor: pointer;
    transition: transform .15s; position: relative; overflow: hidden;
  }
  .beast-card:hover { transform: translateY(-4px) scale(1.04); }
  .beast-card.locked { filter: grayscale(1) brightness(.5); }
  .beast-card .rarity { font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
  .beast-card.rare { border-color: #7cf4ff; box-shadow: 0 0 14px rgba(124,244,255,.35); }
  .beast-card.epic { border-color: #c79bff; box-shadow: 0 0 18px rgba(199,155,255,.5); }
  .beast-card.mythic { border-color: #ffe08a; box-shadow: 0 0 24px rgba(255,224,138,.65); animation: mythicGlow 2s infinite alternate; }
  @keyframes mythicGlow { from { box-shadow: 0 0 16px rgba(255,224,138,.4);} to { box-shadow: 0 0 34px rgba(255,224,138,.85);} }
  table.board { border-collapse: collapse; min-width: min(640px, 92vw); background: rgba(16,10,48,.8); border-radius: 12px; overflow: hidden; }
  table.board th, table.board td { padding: 8px 14px; text-align: left; border-bottom: 1px solid rgba(255,255,255,.12); font-size: 15px; }
  table.board th { background: rgba(123,63,224,.5); }
  .settings-row { display: flex; align-items: center; gap: 14px; min-width: min(420px, 88vw); justify-content: space-between; font-size: 18px; font-weight: 700; }
  .settings-row input[type=range] { width: 180px; }
  .tabs { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .tab { font: inherit; font-weight: 800; color: #fff; background: rgba(255,255,255,.12); border: 1.5px solid rgba(255,255,255,.3); border-radius: 999px; padding: 8px 20px; cursor: pointer; }
  .tab.active { background: linear-gradient(135deg,#7b3fe0,#e0409a); }
  .help-block { max-width: 720px; background: rgba(16,10,48,.8); border-radius: 14px; padding: 16px 22px; font-size: 15.5px; line-height: 1.55; }
  .help-block b { color: #ffe08a; }
  #loading-screen {
    position: fixed; inset: 0; z-index: 100; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 22px;
    background: radial-gradient(ellipse at 50% 40%, #241a6e, #0a0828);
    color: #fff; transition: opacity .5s;
  }
  #loading-bar { width: min(340px, 70vw); height: 12px; border-radius: 999px; background: rgba(255,255,255,.15); overflow: hidden; }
  #loading-fill { height: 100%; width: 0%; border-radius: 999px; background: linear-gradient(90deg,#35d7e8,#ff5fa8,#ffc23a); transition: width .3s; }
  .bubble-loader { width: 74px; height: 74px; border-radius: 50%; border: 3px solid rgba(255,255,255,.5);
    background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.85), rgba(154,91,255,.25) 55%, rgba(53,215,232,.3));
    animation: bob 1.6s infinite ease-in-out; box-shadow: 0 0 34px rgba(124,244,255,.5); }
  @keyframes bob { 0%,100% { transform: translateY(0) scale(1);} 50% { transform: translateY(-14px) scale(1.06);} }
  #inspect-view { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  #inspect-canvas { width: min(420px, 88vw); height: 320px; border-radius: 16px; background: radial-gradient(circle at 50% 35%, #3a2a7e, #140f3a); border: 2px solid rgba(255,255,255,.25); }
  .privacy-note { font-size: 13px; opacity: .75; max-width: 520px; text-align: center; line-height: 1.5; }
  .footer-note { font-size: 12.5px; opacity: .6; }
  @media (max-width: 640px) {
    .hud-pill { font-size: 15px; padding: 6px 10px; }
    #hud-timer { font-size: 20px; min-width: 64px; }
    .btn { font-size: 17px; min-width: 180px; }
  }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}
