// Hoja de estilos propia del plugin, portada del CSS de referencia de la
// propuesta D (JST-9: base.css, b.css, c.css y d.css). El CSS del host solo trae
// las clases de Tailwind que usa el núcleo, así que el plugin trae la suya.
//
// - Clases con prefijo `gb-` y tokens `--gb-*`: el host ya define `--card`,
//   `--muted`, `--border`… y clases como `.fixed`; no hay que pisarlas.
// - Los tokens viven en `.gb` (la página) y `.gb-layer` (menús, vista previa y
//   toasts, que van en un portal). El tema sigue la clase `.dark` del host.
const CSS = /* css */ `
.gb, .gb-layer {
  --gb-bg: #ffffff; --gb-fg: #0a0a0a; --gb-card: #ffffff; --gb-popover: #ffffff;
  --gb-muted: #f5f5f5; --gb-muted-fg: #737373; --gb-subtle-fg: #a3a3a3;
  --gb-border: #e5e5e5; --gb-border-strong: #d4d4d4; --gb-input: #e5e5e5; --gb-ring: #a3a3a3;
  --gb-hover: rgba(0,0,0,.04); --gb-hover-strong: rgba(0,0,0,.07);
  --gb-primary: #171717; --gb-primary-fg: #fafafa;
  --gb-shadow-pop: 0 8px 24px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.04);
  --gb-st-backlog: #52585d; --gb-st-todo: #cc7a00; --gb-st-in_progress: #2563eb; --gb-st-in_review: #7c3aed;
  --gb-st-done: #16a34a; --gb-st-blocked: #dc2626; --gb-st-cancelled: #52585d;
  --gb-pr-critical: #dc2626; --gb-pr-high: #ea580c; --gb-pr-medium: #ca8a04; --gb-pr-low: #2563eb;
  --gb-st-todo-text: #b45309; --gb-st-done-text: #15803d; --gb-pr-critical-text: #b91c1c; --gb-pr-high-text: #9a3412;
  --gb-danger-bg: rgba(220,38,38,.07); --gb-danger-border: rgba(220,38,38,.35); --gb-danger-fg: #b91c1c;
  --gb-co-p1: #b07400; --gb-co-p1-fg: #7a5000; --gb-co-p1-on: #0a0a0a;
  --gb-co-p2: #b8459f; --gb-co-p2-fg: #8f2f7b; --gb-co-p2-on: #ffffff;
  --gb-co-p3: #007a00; --gb-co-p3-fg: #006000; --gb-co-p3-on: #ffffff;
  --gb-co-p4: #1f78c0; --gb-co-p4-fg: #155c94; --gb-co-p4-on: #ffffff;
  --gb-new: #2563eb; --gb-wake: #c2410c;
  --gb-chip-alpha: 12%;
  --gb-cell: #f4f4f5; --gb-toca-bg: #fff6db; --gb-toca-border: #ecd9a0;
  --gb-skel: #ededed; --gb-skel-hi: #f6f6f6;
  color: var(--gb-fg);
  font-family: inherit; font-size: 14px; line-height: 20px;
  font-feature-settings: "cv11", "ss01"; -webkit-font-smoothing: antialiased;
}
.dark .gb, .dark .gb-layer {
  --gb-bg: #0a0a0a; --gb-fg: #fafafa; --gb-card: #171717; --gb-popover: #171717;
  --gb-muted: #262626; --gb-muted-fg: #a1a1a1; --gb-subtle-fg: #737373;
  --gb-border: rgba(255,255,255,.10); --gb-border-strong: rgba(255,255,255,.16); --gb-input: rgba(255,255,255,.15); --gb-ring: #737373;
  --gb-hover: rgba(255,255,255,.04); --gb-hover-strong: rgba(255,255,255,.07);
  --gb-primary: #e5e5e5; --gb-primary-fg: #171717;
  --gb-shadow-pop: 0 12px 32px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.08);
  --gb-st-backlog: #9a958a; --gb-st-todo: #fbbf24; --gb-st-in_progress: #3b82f6; --gb-st-in_review: #9474f0;
  --gb-st-done: #34d06f; --gb-st-blocked: #ef4444; --gb-st-cancelled: #9a958a;
  --gb-pr-critical: #f87171; --gb-pr-high: #fb923c; --gb-pr-medium: #facc15; --gb-pr-low: #60a5fa;
  --gb-st-todo-text: var(--gb-st-todo); --gb-st-done-text: var(--gb-st-done); --gb-pr-critical-text: var(--gb-pr-critical); --gb-pr-high-text: var(--gb-pr-high);
  --gb-danger-bg: rgba(239,68,68,.08); --gb-danger-border: rgba(239,68,68,.45); --gb-danger-fg: #fca5a5;
  --gb-co-p1: #c98500; --gb-co-p1-fg: #f2b544; --gb-co-p1-on: #0a0a0a;
  --gb-co-p2: #cc5cc0; --gb-co-p2-fg: #e895de; --gb-co-p2-on: #0a0a0a;
  --gb-co-p3: #008300; --gb-co-p3-fg: #5fd07a; --gb-co-p3-on: #ffffff;
  --gb-co-p4: #2f8fd8; --gb-co-p4-fg: #84bdf2; --gb-co-p4-on: #0a0a0a;
  --gb-new: #60a5fa; --gb-wake: #fb923c;
  --gb-chip-alpha: 18%;
  --gb-cell: rgba(255,255,255,.045); --gb-toca-bg: #2f2812; --gb-toca-border: #5c4c1d;
  --gb-skel: #1f1f1f; --gb-skel-hi: #2a2a2a;
}
/* Reseteos con :where() (especificidad 0) para no pisar el tamaño de letra de los componentes. */
:where(.gb, .gb-layer) * { box-sizing: border-box; }
:where(.gb, .gb-layer) :where(button, input) { font: inherit; color: inherit; letter-spacing: inherit; }
:where(.gb, .gb-layer) :where(button) { cursor: pointer; background: transparent; }
:where(.gb, .gb-layer) :where(a) { color: inherit; text-decoration: none; }
:where(.gb, .gb-layer) :focus-visible { outline: 2px solid var(--gb-ring); outline-offset: 1px; }
.gb ::-webkit-scrollbar { width: 10px; height: 10px; }
.gb ::-webkit-scrollbar-thumb { background: var(--gb-muted); border-radius: 10px; border: 3px solid transparent; background-clip: content-box; }
.gb ::-webkit-scrollbar-track { background: transparent; }
.gb-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.gb-tnum { font-variant-numeric: tabular-nums; }
.gb-muted { color: var(--gb-muted-fg); }
.gb-sp { flex: 1; }
.gb-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
svg.gb-i { display: inline-block; vertical-align: middle; width: 16px; height: 16px; flex: none; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
svg.gb-i.gb-s14 { width: 14px; height: 14px; } svg.gb-i.gb-s12 { width: 12px; height: 12px; } svg.gb-i.gb-s18 { width: 18px; height: 18px; }
.gb-ic { display: inline-flex; flex: none; }
.gb-st { color: var(--stc); } .gb-pr { color: var(--prc); }

/* Raíz de la página: la página no hace scroll; el board y la lista tienen el suyo. */
.gb { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }

/* ---------- Primitivas ---------- */
.gb-btn { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--gb-input); background: transparent; font-size: 13px; font-weight: 500; white-space: nowrap; }
.gb-btn:hover { background: var(--gb-hover-strong); }
.gb-btn:disabled { opacity: .6; cursor: default; }
.gb-btn.is-sm { height: 28px; padding: 0 10px; font-size: 12.5px; }
.gb-btn.is-ghost { border-color: transparent; }
.gb-btn.is-active { border-color: var(--gb-border-strong); background: var(--gb-muted); }
.gb-btn .gb-v { color: var(--gb-fg); }
.gb-btn.is-spinning svg:first-child { animation: gb-spin 1s linear infinite; }
/* Botón de la barra de arriba del host: mismo alto que los demás botones de esa barra. */
.gb-tb { box-sizing: border-box; height: 32px; display: inline-flex; align-items: center; gap: 6px; padding: 0 10px 0 8px; border-radius: 8px; border: 1px solid var(--gb-input); background: transparent; font-size: 13px; line-height: 20px; font-weight: 500; white-space: nowrap; color: var(--gb-fg); text-decoration: none; cursor: pointer; }
.gb-tb:hover { background: var(--gb-hover-strong); }
.gb-tb.is-on { border-color: var(--gb-border-strong); background: var(--gb-muted); }
.gb-tb svg { width: 16px; height: 16px; flex: none; }
/* Enlace a la otra página del plugin, junto al título. */
.gb-title { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.gb-xlink { display: inline-flex; align-items: center; gap: 2px; font-size: 12.5px; line-height: 20px; font-weight: 500; color: var(--gb-muted-fg); white-space: nowrap; }
.gb-xlink:hover { color: var(--gb-fg); text-decoration: underline; }
.gb-seg { display: inline-flex; padding: 2px; border-radius: 8px; background: var(--gb-muted); gap: 2px; }
.gb-seg button { height: 28px; padding: 0 10px; border: 0; border-radius: 6px; background: transparent; color: var(--gb-muted-fg); display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; }
.gb-seg button.is-on { background: var(--gb-bg); color: var(--gb-fg); box-shadow: 0 0 0 1px var(--gb-border); }
.gb-segn { font-size: 11.5px; font-weight: 400; line-height: 18px; padding: 0 6px; border-radius: 9px; background: var(--gb-hover-strong); color: var(--gb-muted-fg); }
.gb-search { display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--gb-input); background: transparent; color: var(--gb-muted-fg); }
.gb-search input { border: 0; outline: 0; background: transparent; flex: 1; min-width: 0; font-size: 13px; color: var(--gb-fg); padding: 0; height: 100%; }
.gb-search input::placeholder { color: var(--gb-muted-fg); }
.gb-search:focus-within { border-color: var(--gb-ring); }
.gb-linkbtn { border: 0; background: transparent; color: var(--gb-muted-fg); font-size: 12.5px; padding: 0 6px; height: 28px; }
.gb-linkbtn:hover { color: var(--gb-fg); text-decoration: underline; }

/* Chip de filtro activo (quitable) */
.gb-fchip { display: inline-flex; align-items: center; height: 28px; border-radius: 8px; border: 1px solid var(--gb-border-strong); background: var(--gb-hover); font-size: 12.5px; overflow: hidden; white-space: nowrap; }
.gb-fchip .gb-k { padding: 0 6px 0 9px; color: var(--gb-muted-fg); }
.gb-fchip .gb-v { padding: 0 4px 0 0; height: 100%; border: 0; color: var(--gb-fg); font-weight: 500; display: inline-flex; gap: 4px; align-items: center; }
.gb-fchip .gb-x { width: 26px; height: 26px; display: grid; place-items: center; border: 0; background: transparent; color: var(--gb-muted-fg); border-left: 1px solid var(--gb-border); }
.gb-fchip .gb-x:hover { color: var(--gb-fg); background: var(--gb-hover-strong); }

/* Empresa: prefijo + color (nunca solo color) */
.gb-cotag { display: inline-flex; align-items: center; flex: none; height: 16px; padding: 0 4px; border-radius: 4px; font: 600 10px/16px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .02em;
  color: var(--cfg); background: color-mix(in srgb, var(--cc) var(--gb-chip-alpha), transparent); }
.gb-cotag.is-solid { background: var(--cc); color: var(--con); }
.gb-cotag.is-lg { height: 20px; line-height: 20px; padding: 0 6px; font-size: 11px; border-radius: 5px; }
.gb-co-p1 { --cc: var(--gb-co-p1); --cfg: var(--gb-co-p1-fg); --con: var(--gb-co-p1-on); }
.gb-co-p2 { --cc: var(--gb-co-p2); --cfg: var(--gb-co-p2-fg); --con: var(--gb-co-p2-on); }
.gb-co-p3 { --cc: var(--gb-co-p3); --cfg: var(--gb-co-p3-fg); --con: var(--gb-co-p3-on); }
.gb-co-p4 { --cc: var(--gb-co-p4); --cfg: var(--gb-co-p4-fg); --con: var(--gb-co-p4-on); }
.gb-co-none { --cc: var(--gb-muted-fg); --cfg: var(--gb-muted-fg); --con: var(--gb-bg); }

.gb-avatar { width: 20px; height: 20px; border-radius: 50%; background: var(--gb-muted); color: var(--gb-muted-fg); font-size: 9px; font-weight: 600; display: inline-grid; place-items: center; flex: none; letter-spacing: .02em; border: 1px solid var(--gb-border); line-height: 1; }
.gb-avatar.is-none { background: transparent; border: 1px dashed var(--gb-border-strong); }

/* Menú / popover */
.gb-menu { position: fixed; z-index: 1000; min-width: 220px; max-width: 320px; background: var(--gb-popover); border-radius: 10px; box-shadow: var(--gb-shadow-pop); padding: 4px; font-size: 13px; }
.gb-menu .gb-mh { padding: 6px 8px 4px; font-size: 11px; color: var(--gb-muted-fg); font-weight: 500; letter-spacing: .02em; }
.gb-menu .gb-ms { margin: 2px 0 4px; display: flex; align-items: center; gap: 6px; padding: 0 8px; height: 32px; border-bottom: 1px solid var(--gb-border); color: var(--gb-muted-fg); }
.gb-menu .gb-ms input { border: 0; outline: 0; background: transparent; flex: 1; font-size: 13px; color: var(--gb-fg); padding: 0; }
.gb-menu .gb-mi { display: flex; align-items: center; gap: 8px; width: 100%; height: 30px; padding: 0 8px; border: 0; border-radius: 6px; background: transparent; cursor: pointer; white-space: nowrap; text-align: left; font-size: 13px; }
.gb-menu .gb-mi:hover, .gb-menu .gb-mi:focus-visible { background: var(--gb-hover-strong); outline: 0; }
.gb-menu .gb-mi .gb-lbl { flex: 1; overflow: hidden; text-overflow: ellipsis; }
.gb-menu .gb-mi .gb-n { color: var(--gb-muted-fg); font-size: 12px; }
.gb-menu .gb-scroll { max-height: 340px; overflow: auto; }
.gb-menu .gb-msep { height: 1px; background: var(--gb-border); margin: 4px 0; }
.gb-cbox { width: 14px; height: 14px; border-radius: 4px; border: 1px solid var(--gb-border-strong); display: grid; place-items: center; flex: none; }
.gb-cbox.is-on { background: var(--gb-primary); border-color: var(--gb-primary); color: var(--gb-primary-fg); }
.gb-cbox svg.gb-i { width: 10px; height: 10px; stroke-width: 3; }
.gb-ldot { width: 8px; height: 8px; border-radius: 50%; background: var(--lc); display: inline-block; flex: none; }

/* Vista previa al pasar (divulgación progresiva) */
.gb-peek { position: fixed; z-index: 900; width: 320px; background: var(--gb-popover); border-radius: 10px; box-shadow: var(--gb-shadow-pop); padding: 12px; font-size: 13px; pointer-events: none; }
.gb-peek .gb-pt { font-weight: 500; margin: 6px 0 8px; line-height: 18px; }
.gb-peek .gb-prow { display: flex; align-items: center; gap: 8px; height: 22px; color: var(--gb-muted-fg); font-size: 12px; min-width: 0; }
.gb-peek .gb-prow b { color: var(--gb-fg); font-weight: 400; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gb-peek .gb-labels { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px; }
.gb-lblpill { display: inline-flex; align-items: center; gap: 4px; height: 18px; padding: 0 6px; border-radius: 9px; border: 1px solid var(--gb-border-strong); font-size: 11px; color: var(--gb-muted-fg); }
.gb-peek .gb-popen { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--gb-border); font-size: 12px; color: var(--gb-muted-fg); display: flex; gap: 6px; align-items: center; }

/* Toast */
.gb-toasts { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 1200; display: flex; flex-direction: column; gap: 8px; align-items: center; }
.gb-toast { display: flex; align-items: center; gap: 12px; background: var(--gb-popover); box-shadow: var(--gb-shadow-pop); border-radius: 10px; padding: 10px 12px 10px 14px; font-size: 13px; animation: gb-tin .16s cubic-bezier(.16,1,.3,1); max-width: 560px; }
.gb-toast.is-error { box-shadow: var(--gb-shadow-pop), inset 3px 0 0 var(--gb-st-blocked); }
.gb-toast button { border: 0; background: var(--gb-muted); border-radius: 6px; height: 26px; padding: 0 10px; font-size: 12.5px; font-weight: 500; flex: none; }
@keyframes gb-tin { from { transform: translateY(8px); opacity: 0; } }
@keyframes gb-spin { to { transform: rotate(360deg); } }

/* Esqueleto de carga (umbral de Doherty) */
.gb-sk { display: block; background: linear-gradient(90deg, var(--gb-skel) 0%, var(--gb-skel-hi) 40%, var(--gb-skel) 80%); background-size: 300% 100%; animation: gb-sk 1.4s ease-in-out infinite; border-radius: 6px; }
@keyframes gb-sk { from { background-position: 100% 0; } to { background-position: -100% 0; } }

/* Arrastre */
.gb-dragging { opacity: .35; }
.gb-drop-on { outline: 2px dashed var(--gb-ring); outline-offset: -2px; background: var(--gb-hover-strong) !important; }

/* Banner de error parcial */
.gb-banner { display: flex; align-items: center; gap: 10px; border: 1px solid var(--gb-danger-border); background: var(--gb-danger-bg); color: var(--gb-fg); border-radius: 8px; padding: 8px 12px; font-size: 13px; margin-top: 10px; flex: none; }
.gb-banner > svg { color: var(--gb-st-blocked); }

/* Estado vacío */
.gb-empty { flex: 1; display: grid; place-items: center; min-height: 0; }
.gb-empty .gb-box { text-align: center; max-width: 420px; }
.gb-empty .gb-eic { width: 44px; height: 44px; border-radius: 12px; background: var(--gb-muted); display: grid; place-items: center; margin: 0 auto 14px; color: var(--gb-muted-fg); }
.gb-empty h3 { font-size: 15px; line-height: 20px; margin: 0 0 6px; font-weight: 600; }
.gb-empty p { margin: 0 0 16px; color: var(--gb-muted-fg); font-size: 13px; line-height: 19px; }
.gb-empty .gb-acts { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }

/* ---------- Te toca ---------- */
.gb-toca { display: inline-flex; align-items: center; gap: 4px; height: 18px; padding: 0 7px 0 5px; border-radius: 9px; background: var(--gb-fg); color: var(--gb-bg); font-size: 11px; font-weight: 600; line-height: 1; white-space: nowrap; flex: none; }
.gb-toca svg.gb-i { stroke-width: 2.5; }
.gb-toca.is-sm { height: 16px; padding: 0 5px 0 4px; font-size: 10.5px; gap: 3px; }
.gb-toca.is-sm svg.gb-i { width: 11px; height: 11px; }
.gb-toca.is-icon { padding: 0 4px; gap: 0; }
.gb-wait-line { display: flex; align-items: center; gap: 6px; margin-top: 8px; min-width: 0; font-size: 11.5px; line-height: 16px; color: var(--gb-fg); }
.gb-wait-line .gb-what { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.gb-wait-line.is-dep { color: var(--gb-muted-fg); }
.gb-wait-line.is-dep b { color: var(--gb-fg); font-weight: 600; font-size: 11px; }
.gb-toca-banner { display: flex; align-items: center; gap: 10px; margin-top: 10px; padding: 8px 12px; border-radius: 8px; border: 1px solid color-mix(in srgb, var(--gb-fg) 30%, transparent); background: color-mix(in srgb, var(--gb-fg) 5%, transparent); font-size: 13px; flex: none; }
.gb-peek-toca { display: flex; gap: 8px; align-items: flex-start; padding: 8px; margin: 0 0 8px; border-radius: 8px; background: color-mix(in srgb, var(--gb-fg) 8%, transparent); font-size: 12px; line-height: 17px; }
.gb-peek-toca.is-dep { background: var(--gb-muted); color: var(--gb-muted-fg); }
.gb-peek-toca.is-dep svg { flex: none; margin-top: 1px; }
.gb-peek-toca b { color: var(--gb-fg); font-weight: 600; }

/* ---------- Árbol ---------- */
.gb-parchip { display: inline-flex; align-items: center; gap: 3px; height: 16px; padding: 0 4px; border-radius: 4px; font: 500 10.5px/16px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--gb-muted-fg); background: transparent; box-shadow: inset 0 0 0 1px var(--gb-border); white-space: nowrap; flex: none; }
.gb-prog { display: inline-block; height: 4px; border-radius: 2px; background: var(--gb-muted); overflow: hidden; flex: none; vertical-align: middle; }
.gb-prog i { display: block; height: 100%; background: var(--gb-st-done); border-radius: 2px; }
.gb-tree { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--gb-border); }
.gb-tree-h { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--gb-muted-fg); font-weight: 500; margin-bottom: 2px; }
.gb-trrow { position: relative; display: flex; align-items: center; gap: 6px; height: 22px; padding-left: calc(var(--d) * 14px); font-size: 12px; min-width: 0; color: var(--gb-fg); }
.gb-trrow.is-nested::before { content: ""; position: absolute; left: calc(var(--d) * 14px - 9px); top: 0; height: 11px; width: 6px; border-left: 1px solid var(--gb-border-strong); border-bottom: 1px solid var(--gb-border-strong); border-bottom-left-radius: 4px; }
.gb-trrow .gb-tid { font-size: 11px; color: var(--gb-muted-fg); flex: none; }
.gb-trrow .gb-tt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
.gb-trrow.is-cur .gb-tt { font-weight: 600; }
.gb-trrow.is-anc .gb-tt, .gb-trrow.is-closed .gb-tt { color: var(--gb-muted-fg); }
.gb-trmore { padding-left: calc(var(--d) * 14px + 18px); font-size: 11.5px; color: var(--gb-muted-fg); height: 20px; display: flex; align-items: center; }
.gb-tcell { position: relative; display: inline-flex; align-items: center; justify-content: flex-end; width: calc(var(--d) * 20px + 18px); flex: none; align-self: stretch; }
.gb-tcell.is-child::before { content: ""; position: absolute; left: calc((var(--d) - 1) * 20px + 9px); top: 0; height: 50%; width: 9px; border-left: 1px solid var(--gb-border-strong); border-bottom: 1px solid var(--gb-border-strong); border-bottom-left-radius: 5px; }
.gb-tcell.is-child:not(.is-last)::after { content: ""; position: absolute; left: calc((var(--d) - 1) * 20px + 9px); top: 50%; bottom: 0; border-left: 1px solid var(--gb-border-strong); }
.gb-tcell .gb-rail { position: absolute; top: 0; bottom: 0; left: calc(var(--l) * 20px + 9px); border-left: 1px solid var(--gb-border-strong); }
.gb-tchev { width: 18px; height: 18px; border: 0; background: transparent; color: var(--gb-muted-fg); border-radius: 4px; display: inline-grid; place-items: center; padding: 0; transition: transform .15s; position: relative; z-index: 1; }
.gb-tchev:hover { background: var(--gb-hover-strong); color: var(--gb-fg); }
.gb-tchev.is-closed { transform: rotate(-90deg); }
.gb-tdot { width: 18px; height: 18px; display: inline-grid; place-items: center; }
.gb-tdot::after { content: ""; width: 4px; height: 4px; border-radius: 50%; background: var(--gb-border-strong); }
.gb-ctx { opacity: .5; }

/* ---------- Cabecera (JST-407, sobre §3.1) ---------- */
.gb-head { display: flex; align-items: center; gap: 8px 12px; flex: none; flex-wrap: wrap; }
.gb-headtx { min-width: 0; }
.gb-head h1 { margin: 0; font-size: 20px; line-height: 28px; font-weight: 600; letter-spacing: -.01em; }
.gb-head .gb-sub { color: var(--gb-muted-fg); font-size: 12.5px; line-height: 18px; }

/* ---------- Filtros (JST-407, sobre §3.4): una sola fila ---------- */
.gb-filters { display: flex; align-items: center; gap: 8px; margin-top: 12px; flex: none; flex-wrap: wrap; }
.gb-filters.is-off { opacity: .6; pointer-events: none; }
.gb-filters .gb-search { width: 170px; }
.gb-chips { display: flex; align-items: center; gap: 6px; margin-top: 8px; flex-wrap: wrap; font-size: 12px; color: var(--gb-muted-fg); flex: none; }
/* Empresas: un botón por empresa, con su prefijo y su color */
.gb-cotogs { display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.gb-cotog { height: 28px; min-width: 40px; padding: 0 8px; border-radius: 6px; border: 1px solid color-mix(in srgb, var(--cc) 30%, transparent); background: color-mix(in srgb, var(--cc) var(--gb-chip-alpha), transparent); color: var(--cfg); font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .02em; }
.gb-cotog:hover { border-color: var(--cc); }
.gb-cotog.is-on { background: var(--cc); border-color: var(--cc); color: var(--con); }
.gb-cotog.is-dim { opacity: .5; }
/* Filtros rápidos */
.gb-quick b { font-weight: 600; color: var(--gb-muted-fg); }
.gb-quick.is-on { background: var(--gb-primary); border-color: var(--gb-primary); color: var(--gb-primary-fg); }
.gb-quick.is-on:hover { background: var(--gb-primary); opacity: .9; }
.gb-quick.is-on b, .gb-quick.is-on .gb-pr { color: inherit; }

/* ---------- Tarjeta (JST-407, sobre §3.7) ---------- */
.gb-colh { display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; min-width: 0; flex: none; }
.gb-colh .gb-name { font-size: 11.5px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--gb-muted-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gb-colh .gb-cnt { font-size: 12px; color: var(--gb-muted-fg); }
.gb-colact { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 7px 0 6px; border: 1px solid var(--gb-border-strong); border-radius: 6px; background: var(--gb-card); font-size: 11.5px; font-weight: 500; white-space: nowrap; flex: none; }
.gb-colact:hover, .gb-colact:focus-visible { background: var(--gb-primary); border-color: var(--gb-primary); color: var(--gb-primary-fg); }
.gb-card { position: relative; background: var(--gb-card); border: 1px solid var(--gb-border); border-radius: 8px; padding: 10px 10px 8px; cursor: grab; flex: none; display: block; box-shadow: 0 1px 1px rgba(0,0,0,.03); }
/* Enlace que cubre la tarjeta o la fila (§5): clic central, menú contextual y URL al pasar. Lo interactivo queda encima. */
.gb-cover::after { content: ""; position: absolute; inset: 0; }
.gb-cover:focus-visible { outline: 0; }
.gb-cover:focus-visible::after { outline: 2px solid var(--gb-ring); outline-offset: 1px; }
.gb-card .gb-cover { cursor: inherit; }
.gb-card .gb-cover::after { border-radius: 7px; }
.gb-row > .gb-st, .gb-row .gb-cotag { position: relative; z-index: 1; }
.gb-card:hover { border-color: var(--gb-border-strong); }
.gb-card .gb-t { font-size: 13px; line-height: 18px; font-weight: 500; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.gb-card .gb-wait-line { margin-top: 6px; }
.gb-card .gb-ctxrow { display: flex; margin-top: 8px; min-width: 0; }
.gb-card .gb-ctxrow:empty { display: none; }
.gb-prjchip { display: inline-flex; align-items: center; gap: 4px; height: 18px; padding: 0 6px; border-radius: 4px; background: var(--gb-muted); font-size: 11px; line-height: 18px; color: var(--gb-muted-fg); min-width: 0; max-width: 100%; }
.gb-prjchip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gb-card .gb-foot { display: flex; align-items: center; gap: 6px; margin-top: 8px; min-height: 20px; min-width: 0; }
.gb-cosq { width: 10px; height: 10px; border-radius: 3px; background: var(--cc); flex: none; display: inline-block; }
.gb-card .gb-id { font: 500 11.5px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--gb-muted-fg); white-space: nowrap; }
.gb-subn { display: inline-flex; align-items: center; gap: 3px; flex: none; font-size: 11.5px; color: var(--gb-muted-fg); white-space: nowrap; }
.gb-closedas { display: inline-flex; align-items: center; gap: 4px; flex: none; font-size: 11.5px; color: var(--gb-muted-fg); white-space: nowrap; }
/* «Te toca»: la tarjeta entera cambia de fondo, además de su línea con la pastilla */
.gb-card.is-toca { background: var(--gb-toca-bg); border-color: var(--gb-toca-border); }
.gb-card.is-toca:hover { border-color: color-mix(in srgb, var(--gb-toca-border) 60%, var(--gb-fg)); }
.gb-confirm { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; height: 28px; margin-top: 8px; border: 1px solid var(--gb-border-strong); border-radius: 6px; background: var(--gb-card); font-size: 12.5px; font-weight: 500; }
.gb-confirm:hover, .gb-confirm:focus-visible { background: var(--gb-primary); border-color: var(--gb-primary); color: var(--gb-primary-fg); }
.gb-prio { margin-left: auto; display: inline-flex; align-items: center; gap: 3px; height: 18px; padding: 0 6px 0 4px; border-radius: 9px; font-size: 11px; font-weight: 500; white-space: nowrap; color: var(--prt, var(--prc)); background: color-mix(in srgb, var(--prc) 14%, transparent); flex: none; }
.gb-prio-ic { margin-left: auto; display: inline-flex; color: var(--gb-subtle-fg); }
.gb-more { flex: none; height: 28px; border: 0; border-radius: 6px; background: transparent; color: var(--gb-muted-fg); font-size: 12px; font-weight: 500; }
.gb-more:hover { color: var(--gb-fg); background: var(--gb-hover-strong); }
.gb-closedtoggle { flex: 0 0 auto; align-self: flex-start; margin-top: 38px; writing-mode: vertical-rl; transform: rotate(180deg); border: 1px dashed var(--gb-border-strong); background: transparent; border-radius: 8px; padding: 12px 6px; font-size: 12px; color: var(--gb-muted-fg); display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.gb-closedtoggle:hover { color: var(--gb-fg); }
.gb-closedtoggle.is-drop { border-style: solid; border-color: var(--gb-st-done); color: var(--gb-fg); background: color-mix(in srgb, var(--gb-st-done) 10%, transparent); }

/* ---------- Lista (§3.11) ---------- */
.gb-list { flex: 1; min-height: 0; overflow: auto; margin-top: 12px; display: flex; flex-direction: column; gap: 10px; padding-bottom: 12px; }
.gb-lgrp { border: 1px solid var(--gb-border); border-radius: 10px; overflow: hidden; flex: none; }
.gb-grph { display: flex; align-items: center; gap: 10px; width: 100%; height: 44px; padding: 0 12px; border: 0; background: color-mix(in srgb, var(--cc, var(--gb-muted)) 7%, var(--gb-card)); border-bottom: 1px solid var(--gb-border); text-align: left; }
.gb-lgrp.is-plain .gb-grph { background: var(--gb-muted); }
.gb-grph .gb-nm { font-weight: 600; font-size: 14px; white-space: nowrap; }
.gb-grph .gb-stc { margin-left: auto; display: flex; gap: 12px; font-size: 12px; color: var(--gb-muted-fg); }
.gb-grph .gb-stc span { display: inline-flex; gap: 4px; align-items: center; }
.gb-grph .gb-chev { color: var(--gb-muted-fg); display: inline-flex; transition: transform .15s; }
.gb-lgrp.is-closed .gb-grph { border-bottom: 0; }
.gb-lgrp.is-closed .gb-grph .gb-chev { transform: rotate(-90deg); }
.gb-row { position: relative; display: grid; grid-template-columns: 20px 92px minmax(0, 1fr) 120px 180px 200px 84px; gap: 10px; align-items: center; height: 38px; padding: 0 12px; border-bottom: 1px solid color-mix(in srgb, var(--gb-border) 60%, transparent); font-size: 13px; cursor: pointer; }
.gb-row:last-child { border-bottom: 0; }
.gb-row:hover { background: var(--gb-hover); }
.gb-row.is-w { box-shadow: inset 3px 0 0 var(--gb-fg); }
.gb-row .gb-rid { display: inline-flex; gap: 6px; align-items: center; min-width: 0; }
.gb-row .gb-rid .gb-mono { font-size: 11.5px; color: var(--gb-muted-fg); white-space: nowrap; }
.gb-row .gb-t { display: flex; align-items: center; gap: 8px; min-width: 0; align-self: stretch; }
.gb-row .gb-t .gb-tt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.gb-row .gb-t .gb-tt.is-root { font-weight: 600; }
.gb-row .gb-pg { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--gb-muted-fg); flex: none; }
.gb-row .gb-cell { display: flex; align-items: center; gap: 6px; color: var(--gb-muted-fg); font-size: 12.5px; min-width: 0; }
.gb-row .gb-cell > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gb-row .gb-cell .gb-prio { margin-left: 0; }
.gb-row .gb-upd { text-align: right; color: var(--gb-muted-fg); font-size: 12px; white-space: nowrap; }
.gb-rowmore { display: flex; align-items: center; height: 38px; padding: 0 12px; }

/* =====================================================================
   Fase 2 (JST-21, A · Pestañas): portado de f2.css — «Comunes»,
   «A · Pestañas». Los carriles y el arrastre se rehicieron en JST-407.
   ===================================================================== */

/* ---------- Comunes ---------- */
.gb-btn.is-icon { width: 32px; padding: 0; justify-content: center; }
.gb-btn.is-primary { background: var(--gb-primary); border-color: var(--gb-primary); color: var(--gb-primary-fg); }
.gb-btn.is-primary:hover { background: var(--gb-primary); opacity: .88; }
.gb-btn.is-danger { background: #dc2626; border-color: #dc2626; color: #fff; }
.gb-btn.is-danger:hover { background: #b91c1c; border-color: #b91c1c; }
.gb-btn:disabled:hover { background: transparent; }
.gb-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--gb-fg); flex: none; display: inline-block; }
.gb-menu .gb-mi.is-danger { color: var(--gb-danger-fg); }
.gb-menu .gb-mi.is-off { opacity: .45; cursor: default; }
.gb-menu .gb-mi.is-off:hover { background: transparent; }
.gb-menu .gb-mi .gb-ck { width: 14px; display: inline-flex; flex: none; }
.gb-kbd { font-size: 11px; color: var(--gb-subtle-fg); }
.gb-mnote { display: flex; gap: 6px; align-items: flex-start; padding: 6px 8px; font-size: 11.5px; line-height: 16px; color: var(--gb-muted-fg); white-space: normal; }
.gb-mnote svg { flex: none; margin-top: 2px; }

/* Formularios en popover: guardar vista y confirmar borrado */
.gb-menu.gb-form { padding: 14px; white-space: normal; max-width: none; }
.gb-form h4 { margin: 0; font-size: 14px; line-height: 20px; font-weight: 600; overflow-wrap: anywhere; }
.gb-dsub { margin: 2px 0 12px; font-size: 12.5px; line-height: 18px; color: var(--gb-muted-fg); }
.gb-dsub b { color: var(--gb-fg); font-weight: 600; }
.gb-field { display: flex; flex-direction: column; gap: 5px; }
.gb-field > label { font-size: 12px; color: var(--gb-muted-fg); font-weight: 500; }
.gb-input { height: 32px; width: 100%; border: 1px solid var(--gb-input); border-radius: 8px; background: transparent; padding: 0 10px; font-size: 13px; color: var(--gb-fg); outline: 0; }
.gb-input:focus { border-color: var(--gb-ring); box-shadow: 0 0 0 3px color-mix(in srgb, var(--gb-ring) 28%, transparent); }
.gb-input.is-bad, .gb-input.is-bad:focus { border-color: var(--gb-st-blocked); box-shadow: 0 0 0 3px color-mix(in srgb, var(--gb-st-blocked) 22%, transparent); }
.gb-help { display: flex; justify-content: space-between; gap: 8px; font-size: 11.5px; color: var(--gb-subtle-fg); min-height: 16px; }
.gb-help .gb-msg { display: inline-flex; align-items: center; gap: 4px; }
.gb-help.is-bad { color: var(--gb-danger-fg); }
.gb-sums { display: flex; flex-wrap: wrap; gap: 4px; }
.gb-sum { display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 7px; border-radius: 6px; background: var(--gb-muted); font-size: 11.5px; color: var(--gb-fg); white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.gb-sum svg { color: var(--gb-muted-fg); }
.gb-count { display: flex; align-items: center; gap: 6px; margin-top: 10px; font-size: 12px; color: var(--gb-muted-fg); }
.gb-count.is-shared { margin-top: 6px; }
.gb-acts { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 14px; }

/* ---------- Pestañas de vistas (§3.1–3.10) ---------- */
.gb-tabs { display: flex; align-items: center; gap: 2px; height: 37px; margin-top: 10px; border-bottom: 1px solid var(--gb-border); flex: none; min-width: 0; position: relative; }
.gb-tab { position: relative; flex: none; display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 6px 0 10px; margin-bottom: -1px; border-bottom: 2px solid transparent; border-radius: 6px 6px 0 0; font-size: 13px; color: var(--gb-muted-fg); white-space: nowrap; cursor: pointer; outline-offset: -2px; user-select: none; }
.gb-tab:hover { color: var(--gb-fg); background: var(--gb-hover); }
.gb-tab.is-on { color: var(--gb-fg); font-weight: 500; border-bottom-color: var(--gb-fg); }
.gb-tab.is-all { padding-right: 10px; }
.gb-tab .gb-nm { max-width: 240px; overflow: hidden; text-overflow: ellipsis; }
.gb-tab .gb-n, .gb-tabmore .gb-n { font-size: 11.5px; font-weight: 400; line-height: 18px; color: var(--gb-muted-fg); background: var(--gb-muted); border-radius: 8px; padding: 0 6px; }
/* «⋯» solo en la pestaña activa: no reserva espacio en las demás */
.gb-tabmenu { width: 20px; height: 20px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--gb-muted-fg); display: grid; place-items: center; }
.gb-tab:not(.is-on) .gb-tabmenu { display: none; }
.gb-tabmenu:hover { background: var(--gb-hover-strong); color: var(--gb-fg); }
.gb-tab.is-editing { padding: 0 4px; cursor: default; }
.gb-tab.is-editing:hover { background: transparent; }
.gb-tabin { height: 26px; width: 250px; padding: 0 8px; border: 1px solid var(--gb-ring); border-radius: 6px; background: var(--gb-bg); color: var(--gb-fg); font-size: 13px; font-weight: 500; outline: 0; box-shadow: 0 0 0 3px color-mix(in srgb, var(--gb-ring) 28%, transparent); }
.gb-tabin.is-bad { border-color: var(--gb-st-blocked); box-shadow: 0 0 0 3px color-mix(in srgb, var(--gb-st-blocked) 22%, transparent); }
.gb-tabtip { position: absolute; top: 40px; left: 4px; z-index: 30; display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 9px; border-radius: 8px; background: var(--gb-popover); box-shadow: var(--gb-shadow-pop); font-size: 12px; font-weight: 400; color: var(--gb-muted-fg); white-space: nowrap; }
.gb-tabtip.is-bad { color: var(--gb-danger-fg); }
.gb-tabmore { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 8px; margin-left: 2px; border: 0; border-radius: 6px; background: transparent; color: var(--gb-muted-fg); font-size: 13px; }
.gb-tabmore:hover { background: var(--gb-hover-strong); color: var(--gb-fg); }
.gb-save { flex: none; margin-left: 6px; }
.gb-save.is-ghost { color: var(--gb-muted-fg); }
.gb-save:disabled { opacity: .45; }
.gb-tabhint { display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; font-size: 12px; color: var(--gb-subtle-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.gb-modbar { flex: none; margin-left: auto; display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--gb-muted-fg); white-space: nowrap; }
.gb-modbar .gb-linkbtn { display: inline-flex; align-items: center; gap: 4px; }
/* Vistas en el servidor: pestañas de esqueleto mientras cargan y aviso si fallan */
.gb-tab.is-ghost { cursor: default; padding: 0 10px; }
.gb-tab.is-ghost:hover { background: transparent; color: var(--gb-muted-fg); }
.gb-tabsmsg { flex: none; display: inline-flex; align-items: center; gap: 6px; margin-left: 10px; font-size: 12.5px; color: var(--gb-muted-fg); white-space: nowrap; }
.gb-tabsmsg > svg { color: var(--gb-st-blocked); }
.gb-tabsmsg .gb-linkbtn { height: 24px; padding: 0 4px; color: var(--gb-fg); text-decoration: underline; }

/* ---------- Board: carriles con la cabecera arriba (JST-407, sobre §4.2–4.3) ---------- */
.gb-lanewrap { flex: 1; min-height: 0; display: flex; gap: 10px; margin-top: 12px; padding-bottom: 12px; }
.gb-lanes { flex: 1; min-width: 0; min-height: 0; overflow: auto; position: relative; }
.gb-grid { display: grid; grid-template-columns: var(--gcols); column-gap: 10px; }
.gb-lhead, .gb-lane { min-width: var(--gminw); }
.gb-lhead { position: sticky; top: 0; z-index: 6; padding-bottom: 6px; background: var(--gb-bg); }
.gb-lhead .gb-colh { border-radius: 8px; background: var(--gb-cell); }
/* Columnas grises neutras: el color queda para lo que importa (empresa, «Te toca», prioridad) */
.gb-lanes .gb-cell { min-width: 0; min-height: 64px; display: flex; flex-direction: column; gap: 6px; padding: 6px; border-radius: 8px; background: var(--gb-cell); }
.gb-lanes [data-s="confirm"] { background: color-mix(in srgb, var(--gb-st-done) 8%, var(--gb-cell)); }
.gb-lane { padding-bottom: 10px; }
.gb-lane.is-nocol { --cc: var(--gb-border-strong); }
.gb-lane.is-closed { padding-bottom: 2px; }
/* Cabecera del carril: a lo ancho, pegada bajo la fila de columnas al bajar */
.gb-lanehead { position: sticky; top: 38px; z-index: 4; padding: 2px 0 4px; background: var(--gb-bg); }
.gb-lanebtn { position: sticky; left: 0; display: inline-flex; align-items: center; gap: 8px; max-width: 100%; height: 30px; padding: 0 10px 0 4px; border: 0; border-radius: 6px; background: transparent; color: var(--gb-fg); font-size: 13px; text-align: left; }
button.gb-lanebtn:hover { background: var(--gb-hover-strong); }
.gb-lanebtn .gb-nm { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.gb-lanebtn .gb-meta { font-size: 12px; color: var(--gb-muted-fg); white-space: nowrap; }
.gb-lanebtn .gb-chev { display: inline-flex; flex: none; color: var(--gb-muted-fg); transition: transform .15s; }
.gb-lane.is-closed .gb-lanebtn .gb-chev { transform: rotate(-90deg); }
.gb-noic { width: 18px; height: 18px; display: inline-grid; place-items: center; flex: none; border-radius: 4px; border: 1px dashed var(--gb-border-strong); color: var(--gb-muted-fg); }
.gb-lnote { display: flex; align-items: center; gap: 6px; padding: 4px 2px 2px; font-size: 12px; color: var(--gb-subtle-fg); position: sticky; left: 0; width: max-content; }

/* ---------- Arrastre en el Board (§4.4) ---------- */
.gb-lanes.is-dragging .gb-cell.is-ok { box-shadow: inset 0 0 0 1px var(--gb-ring); }
.gb-lanes.is-dragging .gb-cell.is-nodrop { opacity: .4; cursor: not-allowed; background-image: repeating-linear-gradient(135deg, transparent 0 7px, color-mix(in srgb, var(--gb-fg) 8%, transparent) 7px 8px); }
.gb-lanes.is-dragging .gb-lane.is-src .gb-lanebtn { background: color-mix(in srgb, var(--cc) 14%, var(--gb-bg)); }
.gb-draghint { position: fixed; left: 50%; bottom: 22px; z-index: 1150; transform: translateX(-50%); display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 6px 14px 6px 12px; border: 1px solid var(--gb-border-strong); border-radius: 10px; background: var(--gb-popover); box-shadow: var(--gb-shadow-pop); font-size: 13px; color: var(--gb-fg); max-width: calc(100vw - 24px); pointer-events: none; }
.gb-draghint svg { color: var(--gb-muted-fg); flex: none; }

/* ---------- Backlog (JST-407): reusa .gb-list, .gb-lgrp, .gb-grph y .gb-row de la Lista ---------- */
.gb-backlog { gap: 12px; }
.gb-bkhead { cursor: default; }
.gb-bkhint { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; min-width: 0; font-size: 12px; color: var(--gb-muted-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gb-bktop.is-target, .gb-bkzone.is-target { outline: 2px dashed var(--gb-border-strong); }
.gb-bktop.is-target { outline-offset: -2px; }
.gb-bkzone.is-target { outline-offset: 4px; }
.gb-bkempty { padding: 14px 12px; font-size: 12.5px; line-height: 18px; color: var(--gb-muted-fg); }
.gb-bkempty.is-box { border: 1px dashed var(--gb-border); border-radius: 10px; }
.gb-bkzone { display: flex; flex-direction: column; gap: 10px; border-radius: 10px; flex: none; }
.gb-bktitle { display: flex; align-items: center; gap: 8px; padding: 2px 2px 0; font-size: 13px; flex-wrap: wrap; }
.gb-bktitle b { font-weight: 600; }
.gb-bktitle .gb-muted { font-size: 12px; }
.gb-row.gb-bkrow { grid-template-columns: 20px 76px minmax(0, 1fr) auto 76px 96px; cursor: grab; }
.gb-bktop .gb-row.gb-bkrow { grid-template-columns: 20px 112px minmax(0, 1fr) auto 76px 96px; }
.gb-bkrow .gb-t .gb-parchip, .gb-bkrow .gb-t .gb-prjchip { flex: none; max-width: 200px; }
.gb-bkmeta { display: inline-flex; align-items: center; justify-content: flex-end; gap: 8px; }
.gb-bkmeta > *, .gb-bkrow .gb-t > :not(.gb-cover) { position: relative; z-index: 1; }
.gb-bkmove { position: relative; z-index: 1; display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 26px; padding: 0 8px; border: 1px solid var(--gb-border-strong); border-radius: 6px; background: var(--gb-card); font-size: 12px; font-weight: 500; white-space: nowrap; opacity: 0; }
.gb-bkrow:hover .gb-bkmove, .gb-bkmove:focus-visible { opacity: 1; }
@media (hover: none) { .gb-bkmove { opacity: 1; } }
.gb-bkmove:hover, .gb-bkmove:focus-visible { background: var(--gb-primary); border-color: var(--gb-primary); color: var(--gb-primary-fg); }
@media (max-width: 760px) {
  .gb-row.gb-bkrow, .gb-bktop .gb-row.gb-bkrow { grid-template-columns: 20px auto minmax(0, 1fr) auto; height: auto; min-height: 40px; }
  .gb-bkrow .gb-bkmeta, .gb-bkrow .gb-upd, .gb-bkhint, .gb-bkrow .gb-t .gb-prjchip { display: none; }
  .gb-bkmove span { display: none; }
}

/* ---------- + Crear tarea (JST-333, opción A · En línea) ---------- */
/* Pie de la columna: pegado abajo con scroll, sin tapar la tarjeta nueva cuando el compositor está abierto. */
.gb-cr-foot { position: sticky; bottom: -6px; margin: 0 -6px -6px; padding: 2px 6px 6px; z-index: 2; flex: none; border-radius: 0 0 10px 10px; background: linear-gradient(var(--tint), var(--tint)), var(--gb-bg); }
.gb-cr-foot.is-open { position: relative; background: none; }
.gb-cr-add { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; height: 32px; flex: none; border-radius: 8px; border: 1px dashed var(--gb-border-strong); background: transparent; color: var(--gb-muted-fg); font-size: 12.5px; font-weight: 500; }
.gb-cr-add:hover, .gb-cr-add:focus-visible { color: var(--gb-fg); background: var(--gb-hover-strong); border-style: solid; }
.gb-cr-add.is-sm { height: 26px; font-size: 12px; opacity: 0; transition: opacity .12s; }
.gb-lane:hover .gb-cr-add.is-sm, .gb-cell:focus-within .gb-cr-add.is-sm, .gb-cr-add.is-sm:focus-visible { opacity: 1; }
@media (hover: none) { .gb-cr-add.is-sm { opacity: 1; } }
.gb-cr-addrow { display: flex; align-items: center; gap: 8px; width: 100%; height: 36px; padding: 0 12px; border: 0; background: transparent; color: var(--gb-muted-fg); font-size: 13px; text-align: left; }
.gb-cr-addrow b { font-weight: 500; }
.gb-cr-addrow:hover, .gb-cr-addrow:focus-visible { background: var(--gb-hover); color: var(--gb-fg); }
.gb-cr-listwrap { padding: 8px 12px 10px; border-top: 1px solid color-mix(in srgb, var(--gb-border) 60%, transparent); }
.gb-cr-listwrap .gb-cr-comp { max-width: 760px; }
.gb-head .gb-cr-headbtn { background: var(--gb-primary); color: var(--gb-primary-fg); border-color: var(--gb-primary); }
.gb-head .gb-cr-headbtn:hover { background: var(--gb-primary); opacity: .9; }
.gb-cr-short { display: none; }
.gb-cr-pop { position: fixed; z-index: 45; width: 420px; max-width: calc(100vw - 16px); background: var(--gb-popover); border-radius: 10px; box-shadow: var(--gb-shadow-pop); padding: 10px; }
.gb-cr-pop .gb-cr-comp { border: 0; box-shadow: none; padding: 0; background: transparent; }

.gb-cr-comp { display: flex; flex-direction: column; gap: 8px; padding: 8px; border-radius: 8px; background: var(--gb-card); border: 1px solid var(--gb-ring); box-shadow: 0 0 0 3px color-mix(in srgb, var(--gb-ring) 22%, transparent); animation: gb-cr-in .14s ease-out; flex: none; cursor: auto; }
@keyframes gb-cr-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.gb-cr-title { display: block; width: 100%; min-height: 38px; padding: 0 2px; border: 0; outline: 0; resize: none; background: transparent; font: inherit; font-size: 13.5px; line-height: 19px; color: var(--gb-fg); }
.gb-cr-title::placeholder { color: var(--gb-subtle-fg); }
.gb-cr-corow { display: flex; flex-direction: column; gap: 6px; padding: 6px; border-radius: 6px; background: var(--gb-muted); }
.gb-cr-colabel { font-size: 12px; font-weight: 500; color: var(--gb-muted-fg); }
.gb-cr-cos { display: flex; flex-wrap: wrap; gap: 6px; }
.gb-cr-co { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 5px; border-radius: 6px; background: var(--gb-card); border: 1px solid var(--gb-border-strong); font-size: 12.5px; }
.gb-cr-co:has(span:not(.gb-cotag)) { padding: 0 8px 0 5px; }
.gb-cr-co:hover, .gb-cr-co:focus-visible { border-color: var(--cc); background: color-mix(in srgb, var(--cc) 10%, var(--gb-card)); }
.gb-cr-corow.is-nudge { background: var(--gb-danger-bg); box-shadow: inset 0 0 0 1px var(--gb-danger-border); }
.gb-cr-corow.is-nudge .gb-cr-colabel { color: var(--gb-danger-fg); }
.gb-cr-corow.is-nudge .gb-cr-co { animation: gb-cr-shake .25s 2; }
@keyframes gb-cr-shake { 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
.gb-cr-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.gb-cr-chip { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 6px; border-radius: 6px; border: 1px solid var(--gb-border); font-size: 12px; max-width: 100%; }
.gb-cr-chip:hover:not(:disabled) { background: var(--gb-hover-strong); }
.gb-cr-chip:disabled { opacity: .5; cursor: not-allowed; }
.gb-cr-chip .gb-cr-v { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gb-cr-chip .gb-cr-chev { color: var(--gb-muted-fg); display: inline-flex; }
.gb-cr-chip > svg:first-child:not(.gb-s12) { color: var(--gb-muted-fg); }
.gb-cr-chip.is-agent { border-color: color-mix(in srgb, var(--gb-wake) 55%, transparent); background: color-mix(in srgb, var(--gb-wake) 10%, transparent); }
.gb-cr-chip.is-quiet { border-color: var(--gb-border-strong); }
.gb-cr-warn, .gb-cr-note, .gb-cr-err, .gb-cr-dup { display: flex; gap: 6px; align-items: flex-start; padding: 6px 8px; border-radius: 6px; font-size: 12px; line-height: 16px; }
.gb-cr-warn { background: color-mix(in srgb, var(--gb-wake) 12%, transparent); }
.gb-cr-warn > svg { color: var(--gb-wake); margin-top: 2px; }
.gb-cr-warn.is-quiet, .gb-cr-note { background: var(--gb-muted); }
.gb-cr-warn.is-quiet > svg, .gb-cr-note > svg { color: var(--gb-muted-fg); }
.gb-cr-note { color: var(--gb-muted-fg); }
.gb-cr-note > svg { margin-top: 2px; }
.gb-cr-err { background: var(--gb-danger-bg); box-shadow: inset 0 0 0 1px var(--gb-danger-border); color: var(--gb-danger-fg); }
.gb-cr-err > svg, .gb-cr-dup > svg { margin-top: 1px; }
.gb-cr-dup { background: color-mix(in srgb, var(--gb-st-todo) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gb-st-todo) 40%, transparent); }
.gb-cr-dup > svg { color: var(--gb-st-todo); }
.gb-cr-lk { border: 0; padding: 0; background: transparent; color: inherit; font-size: inherit; text-decoration: underline; cursor: pointer; }
.gb-cr-footrow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.gb-cr-keys { font-size: 11.5px; color: var(--gb-muted-fg); }
.gb-cr-keys kbd { font: 10.5px/15px ui-monospace, SFMono-Regular, Menlo, monospace; padding: 0 4px; border: 1px solid var(--gb-border-strong); border-bottom-width: 2px; border-radius: 4px; background: var(--gb-muted); }
.gb-cr-go { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; height: 26px; padding: 0 10px; border: 0; border-radius: 6px; background: var(--gb-primary); color: var(--gb-primary-fg); font-size: 12.5px; font-weight: 500; }
.gb-cr-go:disabled { opacity: .7; cursor: progress; }
.gb-cr-go.is-busy svg { animation: gb-spin .8s linear infinite; }
.gb-cr-comp.is-cell .gb-cr-footrow { justify-content: flex-end; }
@media (hover: none) { .gb-cr-keys { display: none; } }
.gb-menu .gb-cr-ck { width: 14px; display: inline-flex; flex: none; }
.gb-menu .gb-mi:disabled { opacity: .5; cursor: not-allowed; }
.gb-menu .gb-cr-mnote { display: flex; gap: 6px; align-items: flex-start; padding: 6px 8px; margin: 2px 0 4px; font-size: 11.5px; line-height: 15px; color: var(--gb-muted-fg); border-bottom: 1px solid var(--gb-border); white-space: normal; }
.gb-menu .gb-cr-mnote svg { color: var(--gb-wake); margin-top: 1px; }

/* Marca de la tarea recién creada o repetida */
.gb-card.is-new, .gb-row.is-new { box-shadow: 0 0 0 2px color-mix(in srgb, var(--gb-new) 75%, transparent); border-color: transparent; animation: gb-cr-flash 1.2s ease-out; }
.gb-card.is-dup, .gb-row.is-dup { box-shadow: 0 0 0 2px color-mix(in srgb, var(--gb-st-todo) 75%, transparent); border-color: transparent; }
@keyframes gb-cr-flash { from { box-shadow: 0 0 0 6px color-mix(in srgb, var(--gb-new) 35%, transparent); } }
.gb-cr-newpill { display: inline-flex; align-items: center; flex: none; height: 16px; padding: 0 6px; border-radius: 8px; font-size: 10.5px; font-weight: 600; white-space: nowrap; background: color-mix(in srgb, var(--gb-new) 16%, transparent); color: var(--gb-new); }
.gb-card .gb-foot .gb-cr-newpill { margin-left: 2px; }
.gb-cr-newpill.is-out { background: var(--gb-muted); color: var(--gb-muted-fg); }
.gb-cr-newpill.is-dup { background: color-mix(in srgb, var(--gb-st-todo) 18%, transparent); color: var(--gb-st-todo-text); }

/* Vista Pedidos: una fila por tarea raíz con el resumen de su subárbol. Reusa .gb-list, .gb-lgrp y .gb-grph de la Lista. */
/* La barra de Pedidos suma un campo: en pantallas medianas baja a una segunda línea en vez de cortarse. */
.gb-filters:has(.gb-hide) { flex-wrap: wrap; }
.gb-filters .gb-search.gb-hide { width: 250px; }
.gb-search.gb-hide.is-active { border-color: var(--gb-border-strong); background: var(--gb-muted); }
.gb-psec { --pc: var(--gb-muted-fg); }
.gb-psec.is-toca { --pc: var(--gb-fg); }
.gb-psec.is-cerrar { --pc: var(--gb-st-done); }
.gb-psec.is-bloqueado { --pc: var(--gb-st-blocked); }
.gb-psec.is-espera, .gb-psec.is-pausa, .gb-psec.is-sueltos { --pc: var(--gb-st-todo); }
.gb-psec.is-trabajando, .gb-psec.is-curso { --pc: var(--gb-st-in_progress); }
.gb-pico { color: var(--pc); }
.gb-grph .gb-pcount { font-size: 12px; white-space: nowrap; }
.gb-grph .gb-phint { margin-left: auto; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.gb-prow { border-bottom: 1px solid color-mix(in srgb, var(--gb-border) 70%, transparent); }
.gb-prow:last-child { border-bottom: 0; }
.gb-prow.is-toca { box-shadow: inset 3px 0 0 var(--gb-fg); }
.gb-pmain { position: relative; display: grid; grid-template-columns: 20px 92px minmax(0, 1fr) minmax(150px, 230px) 190px 76px; grid-template-areas: "exp id body ball prog upd"; gap: 10px; align-items: center; min-height: 52px; padding: 7px 12px; cursor: pointer; }
.gb-pmain:hover, .gb-pkid:hover { background: var(--gb-hover); }
.gb-pexp { grid-area: exp; display: inline-flex; }
.gb-pmain .gb-rid { grid-area: id; display: inline-flex; gap: 6px; align-items: center; min-width: 0; }
.gb-pmain .gb-rid .gb-mono { font-size: 11.5px; color: var(--gb-muted-fg); white-space: nowrap; }
.gb-pbody { grid-area: body; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.gb-ptitle { display: flex; align-items: center; gap: 6px; min-width: 0; }
.gb-pbody .gb-tt { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.gb-pnote { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 12px; line-height: 16px; color: var(--gb-muted-fg); }
.gb-pnote > span:first-of-type { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.gb-pnote b { font-weight: 500; color: var(--gb-fg); }
.gb-pnote svg { flex: none; }
.gb-pnote-at { flex: none; white-space: nowrap; color: var(--gb-subtle-fg); }
.gb-pnote-at::before { content: "· "; }
.gb-pball { grid-area: ball; display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 12.5px; }
.gb-pwhat { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.gb-plink { position: relative; z-index: 1; font-size: 11.5px; text-decoration: underline; text-decoration-color: var(--gb-border-strong); text-underline-offset: 2px; }
.gb-plink:hover { text-decoration-color: currentColor; }
.gb-pexp .gb-tchev, .gb-pmain .gb-st, .gb-pmain .gb-cotag, .gb-pmain .gb-toca, .gb-pmain .gb-prog, .gb-pkid .gb-st, .gb-pkid .gb-toca, .gb-pkid .gb-avatar, .gb-plive { position: relative; z-index: 1; }
.gb-pprog { grid-area: prog; display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--gb-muted-fg); min-width: 0; white-space: nowrap; }
.gb-popen { display: inline-flex; gap: 8px; margin-left: auto; }
.gb-popen > span { display: inline-flex; gap: 3px; align-items: center; }
.gb-pmain .gb-upd { grid-area: upd; text-align: right; color: var(--gb-muted-fg); font-size: 12px; white-space: nowrap; }
.gb-ptree { padding: 2px 12px 8px 42px; border-top: 1px dashed color-mix(in srgb, var(--gb-border) 70%, transparent); background: color-mix(in srgb, var(--gb-muted) 45%, transparent); }
.gb-pkid { position: relative; display: flex; align-items: center; gap: 8px; height: 28px; padding: 0 6px 0 calc(var(--d) * 18px + 6px); font-size: 12.5px; min-width: 0; border-radius: 6px; cursor: pointer; }
.gb-pkid .gb-kidid { font-size: 11px; color: var(--gb-muted-fg); flex: none; }
.gb-pkid .gb-tt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
.gb-pkid.is-closed .gb-tt { color: var(--gb-muted-fg); }
.gb-pkid.is-w .gb-tt { font-weight: 600; }
.gb-plive { display: inline-flex; align-items: center; gap: 3px; flex: none; font-size: 11px; color: var(--gb-st-in_progress); white-space: nowrap; }
.gb-pwho { display: inline-flex; align-items: center; gap: 5px; flex: none; width: 150px; font-size: 11.5px; color: var(--gb-muted-fg); min-width: 0; }
.gb-pwho > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gb-pkid .gb-upd { flex: none; width: 70px; text-align: right; color: var(--gb-muted-fg); font-size: 11.5px; white-space: nowrap; }
.gb-ptree .gb-rowmore { height: 30px; padding: 0; }
@media (max-width: 900px) {
  .gb-pmain { grid-template-columns: 20px minmax(0, 1fr) auto; grid-template-areas: "exp id upd" "exp body body" "exp ball ball" "exp prog prog"; gap: 4px 8px; align-items: start; }
  .gb-pexp { align-self: center; }
  .gb-pbody .gb-tt { white-space: normal; overflow-wrap: anywhere; }
  .gb-popen { margin-left: 8px; }
  .gb-grph .gb-phint, .gb-pwho > span:last-child { display: none; }
  .gb-pwho { width: auto; }
  .gb-ptree { padding-left: 14px; }
  .gb-pkid { padding-left: calc(var(--d) * 10px + 4px); gap: 6px; }
  .gb-pkid .gb-upd { width: auto; }
  .gb-filters .gb-search.gb-hide { width: 100%; }
}

@media (max-width: 640px) {
  .gb-tb { border: 0; padding: 0 6px; }
  .gb-tb .gb-tb-lbl { display: none; }
  /* Cabecera en dos filas: título y botones arriba; las cuatro vistas abajo, a lo ancho y sin iconos. */
  .gb-head .gb-sp { display: none; }
  .gb-headtx { flex: 1 1 0; }
  .gb-head .gb-seg { order: 3; width: 100%; }
  .gb-head .gb-seg button { flex: 1 1 auto; justify-content: center; padding: 0 6px; }
  .gb-head .gb-seg button > svg { display: none; }
  /* Los filtros no bajan de línea: se deslizan hacia el lado, así el board queda más arriba. */
  .gb-filters { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; margin-right: -12px; padding-right: 12px; }
  .gb-filters::-webkit-scrollbar { display: none; }
  .gb-filters > * { flex: none; }
  .gb-filters .gb-search { width: 132px; }
  .gb-cotogs { flex-wrap: nowrap; }
  .gb-cr-long { display: none; } .gb-cr-short { display: inline; }
  .gb-cr-pop { left: 8px !important; right: 8px; bottom: 8px; top: auto !important; width: auto; max-width: none; }
  .gb-toasts { left: 12px; right: 12px; transform: none; align-items: stretch; }
  /* Con un compositor abierto en una columna, celda o grupo, el board deja de ser una ventana de alto fijo (en celular la cabecera se come casi todo el alto y el compositor quedaba recortado): la página crece y hace el scroll (JST-342). */
  .gb:has(.gb-cr-comp:not(.is-head)) { height: auto !important; overflow: visible; }
  .gb:has(.gb-cr-comp:not(.is-head)) :is(.gb-list, .gb-lanewrap) { min-height: 560px; }
  /* En celular la cabecera, los contadores y los filtros se comen el alto y la lista de pedidos quedaba en una ventana de pocas filas: la página crece y hace el scroll, igual que con un compositor abierto. */
  .gb:has(.gb-ped) { height: auto !important; overflow: visible; }
  .gb-ped { overflow: visible; }
}
`;

const STYLE_ID = "jstm-board-global-styles";

/** Inserta (o actualiza tras un upgrade del plugin) la hoja de estilos una sola vez. */
export function ensureStyles(): void {
  if (typeof document === "undefined") return;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  if (style.textContent !== CSS) style.textContent = CSS;
}
