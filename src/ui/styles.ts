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
  --gb-chip-alpha: 12%;
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
  --gb-chip-alpha: 18%;
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
.gb-seg { display: inline-flex; padding: 2px; border-radius: 8px; background: var(--gb-muted); gap: 2px; }
.gb-seg button { height: 28px; padding: 0 10px; border: 0; border-radius: 6px; background: transparent; color: var(--gb-muted-fg); display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; }
.gb-seg button.is-on { background: var(--gb-bg); color: var(--gb-fg); box-shadow: 0 0 0 1px var(--gb-border); }
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
.gb-tip { position: fixed; z-index: 1100; background: var(--gb-popover); box-shadow: var(--gb-shadow-pop); border-radius: 8px; padding: 6px 9px; font-size: 12px; pointer-events: none; white-space: nowrap; }

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
.gb-waiting { border-color: color-mix(in srgb, var(--gb-fg) 62%, transparent) !important; box-shadow: 0 0 0 1px color-mix(in srgb, var(--gb-fg) 22%, transparent); }
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

/* ---------- Cabecera (§3.1) ---------- */
.gb-head { display: flex; align-items: center; gap: 12px; flex: none; }
.gb-head h1 { margin: 0; font-size: 20px; line-height: 28px; font-weight: 600; letter-spacing: -.01em; }
.gb-head .gb-sub { color: var(--gb-muted-fg); font-size: 13px; line-height: 20px; }
.gb-head .gb-upd { font-size: 12px; color: var(--gb-muted-fg); display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }

/* ---------- Contadores (§3.2) ---------- */
.gb-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)) minmax(0, 2.4fr); gap: 8px; margin-top: 12px; flex: none; }
.gb-kpi { text-align: left; border: 1px solid var(--gb-border); background: var(--gb-card); border-radius: 10px; padding: 10px 12px 11px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
button.gb-kpi:hover { border-color: var(--gb-border-strong); }
button.gb-kpi:disabled { cursor: default; }
.gb-kpi.is-on { border-color: var(--gb-fg); box-shadow: inset 0 0 0 1px var(--gb-fg); }
.gb-kpi .gb-lab { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--gb-muted-fg); white-space: nowrap; }
.gb-kpi .gb-val { font-size: 26px; line-height: 32px; font-weight: 600; letter-spacing: -.02em; color: var(--gb-fg); }
.gb-kpi .gb-brk { margin-top: auto; padding-top: 6px; font: 500 10.5px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--gb-muted-fg); display: flex; gap: 8px; white-space: nowrap; overflow: hidden; }
.gb-kpi .gb-brk b { color: var(--cfg); font-weight: 600; margin-right: 2px; }
.gb-kpi .gb-brk .gb-crit { color: var(--gb-pr-critical); font-family: inherit; font-size: 11.5px; display: inline-flex; gap: 3px; align-items: center; }
.gb-kpi.is-alert { border-color: color-mix(in srgb, var(--gb-st-blocked) 45%, var(--gb-border)); background: color-mix(in srgb, var(--gb-st-blocked) 6%, var(--gb-card)); }
.gb-kpi.is-alert .gb-val { color: var(--gb-danger-fg); }
.gb-kpi.is-alert.is-on { border-color: var(--gb-st-blocked); box-shadow: inset 0 0 0 1px var(--gb-st-blocked); }
.gb-kpi.is-toca { border-color: color-mix(in srgb, var(--gb-fg) 45%, var(--gb-border)); background: color-mix(in srgb, var(--gb-fg) 5%, var(--gb-card)); }
.gb-kpi.is-toca .gb-lab { color: var(--gb-fg); font-weight: 500; }
.gb-kpi.is-toca.is-on { border-color: var(--gb-fg); box-shadow: inset 0 0 0 1px var(--gb-fg); }

/* «Abiertas por empresa» (§3.3): barras apiladas y filtro de empresa */
.gb-dist { padding: 9px 12px 8px; gap: 5px; }
.gb-dist .gb-lab { width: 100%; }
.gb-dist .gb-hint { margin-left: auto; font-size: 11px; color: var(--gb-subtle-fg); }
.gb-dist .gb-all { margin-left: auto; height: 18px; padding: 0 4px; font-size: 11.5px; color: var(--gb-fg); text-decoration: underline; }
.gb-dist .gb-rows { display: flex; flex-direction: column; gap: 5px; margin-top: 2px; }
.gb-corow { display: grid; grid-template-columns: 14px 34px minmax(0, 1fr) 84px; gap: 8px; align-items: center; width: calc(100% + 8px); margin: 0 -4px; padding: 0 4px; height: 18px; border: 0; border-radius: 4px; background: transparent; text-align: left; }
button.gb-corow:hover { background: var(--gb-hover-strong); }
button.gb-corow:hover .gb-bar { filter: brightness(1.15); }
.gb-corow.is-on { background: color-mix(in srgb, var(--cc) 12%, transparent); }
.gb-corow.is-dim { opacity: .45; }
.gb-check { width: 12px; height: 12px; border-radius: 3px; border: 1px solid var(--gb-border-strong); display: grid; place-items: center; color: transparent; }
.gb-check svg.gb-i { width: 10px; height: 10px; stroke-width: 3; }
.gb-corow.is-on .gb-check { background: var(--cc); border-color: var(--cc); color: var(--con); }
.gb-bar { display: flex; gap: 2px; height: 8px; align-items: center; }
.gb-bar .gb-sk { width: 100%; height: 8px; }
.gb-seg-s { height: 100%; background: var(--sc); }
.gb-seg-s:first-child { border-radius: 4px 0 0 4px; } .gb-seg-s:last-child { border-radius: 0 4px 4px 0; } .gb-seg-s:only-child { border-radius: 4px; }
.gb-tot { font-size: 11.5px; color: var(--gb-muted-fg); text-align: right; white-space: nowrap; overflow: hidden; }
.gb-tot b { color: var(--gb-fg); font-weight: 600; }
.gb-legend { display: flex; gap: 8px; font-size: 10.5px; color: var(--gb-muted-fg); margin-top: 2px; white-space: nowrap; overflow: hidden; }
.gb-legend span { display: inline-flex; gap: 4px; align-items: center; }
.gb-err, .gb-ok, .gb-wait { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; white-space: nowrap; }
.gb-err { color: var(--gb-st-blocked); }
.gb-err .gb-linkbtn { height: 16px; padding: 0 4px; font-size: 11.5px; color: var(--gb-fg); text-decoration: underline; }
.gb-ok { color: var(--gb-st-done); }
.gb-wait svg { animation: gb-spin 1s linear infinite; }

/* ---------- Filtros (§3.4) ---------- */
.gb-filters { display: flex; align-items: center; gap: 8px; margin-top: 12px; flex: none; }
.gb-filters.is-off { opacity: .6; pointer-events: none; }
.gb-filters .gb-search { width: 150px; }
.gb-chips { display: flex; align-items: center; gap: 6px; margin-top: 8px; flex-wrap: wrap; font-size: 12px; color: var(--gb-muted-fg); flex: none; }

/* ---------- Kanban (§3.5–3.8) ---------- */
.gb-board { flex: 1; min-height: 0; display: flex; gap: 10px; margin-top: 12px; padding-bottom: 12px; overflow-x: auto; }
.gb-col { flex: 1 1 0; min-width: 214px; display: flex; flex-direction: column; min-height: 0; }
.gb-col.is-fixed { flex: 0 0 240px; }
.gb-colh { display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 6px; flex: none; }
.gb-colh .gb-name { font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--hc); white-space: nowrap; }
.gb-colh .gb-cnt { margin-left: auto; font-size: 12px; color: var(--gb-muted-fg); }
.gb-colh .gb-hot { margin-left: auto; display: inline-flex; align-items: center; gap: 2px; font-size: 11px; color: var(--gb-pr-high-text); }
.gb-colh .gb-hot + .gb-cnt { margin-left: 6px; }
.gb-body { flex: 1; min-height: 0; overflow-y: auto; border-radius: 10px; padding: 6px; display: flex; flex-direction: column; gap: 6px; background: var(--tint); box-shadow: inset 0 0 0 1px var(--tint-ring); }
.gb-col[data-s="backlog"] { --tint: color-mix(in srgb, var(--gb-muted) 30%, transparent); --tint-ring: color-mix(in srgb, var(--gb-border) 50%, transparent); --hc: var(--gb-muted-fg); }
.gb-col[data-s="todo"] { --tint: color-mix(in srgb, #f59e0b 5%, transparent); --tint-ring: color-mix(in srgb, #f59e0b 14%, transparent); --hc: var(--gb-st-todo-text); }
.gb-col[data-s="in_progress"] { --tint: color-mix(in srgb, #3b82f6 5%, transparent); --tint-ring: color-mix(in srgb, #3b82f6 14%, transparent); --hc: var(--gb-st-in_progress); }
.gb-col[data-s="in_review"] { --tint: color-mix(in srgb, #8b5cf6 5%, transparent); --tint-ring: color-mix(in srgb, #8b5cf6 14%, transparent); --hc: var(--gb-st-in_review); }
.gb-col[data-s="blocked"] { --tint: color-mix(in srgb, #ef4444 6%, transparent); --tint-ring: color-mix(in srgb, #ef4444 18%, transparent); --hc: var(--gb-st-blocked); }
.gb-col[data-s="done"] { --tint: color-mix(in srgb, #22c55e 4%, transparent); --tint-ring: color-mix(in srgb, #22c55e 12%, transparent); --hc: var(--gb-st-done-text); }
.gb-col[data-s="cancelled"] { --tint: color-mix(in srgb, var(--gb-muted) 25%, transparent); --tint-ring: color-mix(in srgb, var(--gb-border) 50%, transparent); --hc: var(--gb-muted-fg); }
.gb-col.is-skel { --tint: transparent; --tint-ring: var(--gb-border); }
.gb-grp-k { display: flex; flex-direction: column; gap: 6px; }
.gb-grp-k + .gb-grp-k { border-top: 1px dashed var(--gb-border); padding-top: 6px; }
.gb-subh { display: flex; align-items: center; gap: 6px; height: 24px; padding: 0 4px; border: 0; width: 100%; font-size: 12px; font-weight: 600; color: var(--gb-fg); border-radius: 6px; text-align: left; flex: none; }
.gb-subh:hover { background: var(--gb-hover-strong); }
.gb-subh .gb-n { color: var(--gb-muted-fg); font-weight: 400; margin-left: auto; }
.gb-subh .gb-chev { color: var(--gb-muted-fg); display: inline-flex; transition: transform .15s; }
.gb-grp-k.is-closed .gb-chev { transform: rotate(-90deg); }
.gb-subh .gb-toca { margin-left: 2px; }

.gb-card { position: relative; background: var(--gb-card); border: 1px solid var(--gb-border); border-radius: 8px; padding: 9px 10px; cursor: grab; flex: none; display: block; }
/* Enlace que cubre la tarjeta o la fila (§5): clic central, menú contextual y URL al pasar. Lo interactivo queda encima. */
.gb-cover::after { content: ""; position: absolute; inset: 0; }
.gb-cover:focus-visible { outline: 0; }
.gb-cover:focus-visible::after { outline: 2px solid var(--gb-ring); outline-offset: 1px; }
.gb-card .gb-cover { cursor: inherit; }
.gb-card .gb-cover::after { border-radius: 7px; }
.gb-subt, .gb-kid, .gb-kidsmore, .gb-row > .gb-st, .gb-row .gb-cotag { position: relative; z-index: 1; }
.gb-card:hover { border-color: var(--gb-border-strong); }
.gb-card .gb-r1 { display: flex; align-items: center; gap: 6px; height: 18px; }
.gb-card .gb-id { font: 500 11.5px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--gb-muted-fg); white-space: nowrap; }
.gb-card .gb-t { font-size: 13px; line-height: 18px; font-weight: 500; margin: 5px 0 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.gb-card .gb-r3 { display: flex; align-items: center; gap: 6px; font-size: 12px; line-height: 16px; color: var(--gb-muted-fg); min-width: 0; }
.gb-card .gb-r3 .gb-prj { display: inline-flex; gap: 4px; align-items: center; min-width: 0; overflow: hidden; flex: 1; }
.gb-card .gb-r3 .gb-prj span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gb-card .gb-r3 .gb-who { display: inline-flex; gap: 5px; align-items: center; max-width: 52%; min-width: 0; }
.gb-card .gb-r3 .gb-who span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gb-prio { margin-left: auto; display: inline-flex; align-items: center; gap: 3px; height: 18px; padding: 0 6px 0 4px; border-radius: 9px; font-size: 11px; font-weight: 500; white-space: nowrap; color: var(--prt, var(--prc)); background: color-mix(in srgb, var(--prc) 14%, transparent); flex: none; }
.gb-prio-ic { margin-left: auto; display: inline-flex; color: var(--gb-subtle-fg); }
.gb-card.is-crit { border-color: color-mix(in srgb, var(--gb-pr-critical) 55%, transparent); }
.gb-card.is-blocked { border-left: 3px solid var(--gb-st-blocked); padding-left: 8px; }
.gb-more { flex: none; height: 28px; border: 1px dashed var(--gb-border-strong); border-radius: 6px; background: transparent; color: var(--gb-muted-fg); font-size: 12px; }
.gb-more:hover { color: var(--gb-fg); }
.gb-colempty { display: grid; place-items: center; color: var(--gb-subtle-fg); font-size: 12px; border: 1px dashed var(--gb-border); border-radius: 8px; min-height: 72px; }
.gb-closedtoggle { flex: 0 0 auto; align-self: flex-start; margin-top: 30px; writing-mode: vertical-rl; transform: rotate(180deg); border: 1px dashed var(--gb-border-strong); background: transparent; border-radius: 8px; padding: 12px 6px; font-size: 12px; color: var(--gb-muted-fg); display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.gb-closedtoggle:hover { color: var(--gb-fg); }

/* Subtareas dentro de la tarjeta (§3.8) */
.gb-subt { display: flex; align-items: center; gap: 5px; width: calc(100% + 20px); margin: 8px -10px -9px; padding: 0 10px; height: 28px; border: 0; border-top: 1px solid var(--gb-border); background: transparent; color: var(--gb-muted-fg); font-size: 11.5px; border-radius: 0 0 8px 8px; }
.gb-subt:hover { color: var(--gb-fg); background: var(--gb-hover); }
.gb-subt > svg:first-child { transition: transform .15s; }
.gb-subt.is-open { margin-bottom: 0; border-radius: 0; color: var(--gb-fg); }
.gb-subt.is-open > svg:first-child { transform: rotate(90deg); }
.gb-kids { margin: 0 -10px -9px; padding: 2px 10px 6px; border-top: 1px solid var(--gb-border); background: color-mix(in srgb, var(--gb-muted) 35%, transparent); border-radius: 0 0 8px 8px; }
.gb-card.is-blocked .gb-subt, .gb-card.is-blocked .gb-kids { margin-left: -8px; padding-left: 8px; width: calc(100% + 18px); }
.gb-kid { display: flex; align-items: center; gap: 6px; height: 22px; font-size: 11.5px; padding-left: calc(var(--d) * 16px); min-width: 0; border-radius: 4px; cursor: pointer; }
.gb-kid:hover { background: var(--gb-hover-strong); }
.gb-kid .gb-kidid { font-size: 10.5px; color: var(--gb-muted-fg); flex: none; }
.gb-kid .gb-tt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
.gb-kid.is-closed .gb-tt { color: var(--gb-muted-fg); }
.gb-kidsmore { display: flex; align-items: center; height: 22px; padding: 0 0 0 18px; border: 0; background: transparent; color: var(--gb-muted-fg); font-size: 11.5px; }
.gb-kidsmore:hover { color: var(--gb-fg); text-decoration: underline; }

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
   «A · Pestañas», «Contadores en una línea», «Carriles» y «Arrastre».
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
/* En las celdas de carril la barra de avance no cabe; queda «2/8» */
.gb-lanes .gb-cell .gb-prog { display: none; }

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

/* ---------- Contadores en una línea (con carriles, §4.5) ---------- */
.gb-kline { display: flex; align-items: center; gap: 4px; margin-top: 12px; flex: none; min-width: 0; overflow: hidden; }
.gb-kl { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border: 1px solid var(--gb-border); border-radius: 8px; background: var(--gb-card); font-size: 12.5px; color: var(--gb-muted-fg); white-space: nowrap; }
.gb-kl:hover { border-color: var(--gb-border-strong); }
.gb-kl:disabled { cursor: default; }
.gb-kl b { margin-left: 2px; font-size: 13px; font-weight: 600; color: var(--gb-fg); }
.gb-kl.is-toca { border-color: color-mix(in srgb, var(--gb-fg) 45%, var(--gb-border)); background: color-mix(in srgb, var(--gb-fg) 5%, var(--gb-card)); color: var(--gb-fg); font-weight: 500; }
.gb-kl.is-alert { border-color: color-mix(in srgb, var(--gb-st-blocked) 45%, var(--gb-border)); background: color-mix(in srgb, var(--gb-st-blocked) 6%, var(--gb-card)); }
.gb-kl.is-alert b { color: var(--gb-danger-fg); }
.gb-kl.is-on { border-color: var(--gb-fg); box-shadow: inset 0 0 0 1px var(--gb-fg); }
.gb-kl.is-alert.is-on { border-color: var(--gb-st-blocked); box-shadow: inset 0 0 0 1px var(--gb-st-blocked); }
.gb-vsep { flex: none; width: 1px; height: 18px; margin: 0 6px; background: var(--gb-border-strong); }
.gb-klab { flex: none; font-size: 12.5px; color: var(--gb-muted-fg); margin-right: 2px; }
.gb-kc { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 6px 0 5px; border: 1px solid transparent; border-radius: 8px; background: transparent; font-size: 12.5px; }
.gb-kc:hover { background: var(--gb-hover-strong); }
.gb-kc b { font-weight: 600; }
.gb-kc.is-on { background: color-mix(in srgb, var(--cc) 12%, transparent); border-color: color-mix(in srgb, var(--cc) 40%, transparent); }
.gb-kc.is-on .gb-check { background: var(--cc); border-color: var(--cc); color: var(--con); }
.gb-kc.is-dim { opacity: .45; }
.gb-kline.is-compact .gb-kc .gb-check { display: none; }
.gb-kline.is-two { flex-wrap: wrap; row-gap: 0; }
.gb-kline.is-two .gb-vsep { flex-basis: 100%; height: 6px; margin: 0; background: none; }
.gb-kopen { display: inline-flex; align-items: center; gap: 4px; flex: none; }
.gb-dist .gb-kfold { margin-left: 8px; height: 18px; padding: 0 2px; font-size: 11.5px; display: inline-flex; align-items: center; gap: 3px; color: var(--gb-muted-fg); }
.gb-dist .gb-hint + .gb-kfold, .gb-dist .gb-all + .gb-kfold { margin-left: 8px; }

/* ---------- Carriles (§4.2–4.3) ---------- */
.gb-lanewrap { flex: 1; min-height: 0; display: flex; gap: 10px; margin-top: 12px; padding-bottom: 12px; }
.gb-lanes { flex: 1; min-width: 0; min-height: 0; overflow: auto; position: relative; }
.gb-grid { display: grid; grid-template-columns: var(--gcols); column-gap: 10px; min-width: min-content; }
.gb-lhead { position: sticky; top: 0; z-index: 6; height: 36px; align-items: center; background: var(--gb-bg); border-bottom: 1px solid var(--gb-border); }
.gb-lhead .gb-colh { min-width: 0; }
.gb-lhead .gb-colh .gb-name { overflow: hidden; text-overflow: ellipsis; }
.gb-corner { position: sticky; left: 0; z-index: 1; display: flex; align-items: center; gap: 6px; height: 100%; min-width: 0; overflow: hidden; padding-left: 2px; background: var(--gb-bg); font-size: 11.5px; color: var(--gb-muted-fg); white-space: nowrap; }
/* Tintes de estado de las celdas (los mismos de las columnas de D) */
.gb-lanes [data-s="backlog"] { --tint: color-mix(in srgb, var(--gb-muted) 30%, transparent); --tint-ring: color-mix(in srgb, var(--gb-border) 50%, transparent); --hc: var(--gb-muted-fg); }
.gb-lanes [data-s="todo"] { --tint: color-mix(in srgb, #f59e0b 5%, transparent); --tint-ring: color-mix(in srgb, #f59e0b 14%, transparent); --hc: var(--gb-st-todo-text); }
.gb-lanes [data-s="in_progress"] { --tint: color-mix(in srgb, #3b82f6 5%, transparent); --tint-ring: color-mix(in srgb, #3b82f6 14%, transparent); --hc: var(--gb-st-in_progress); }
.gb-lanes [data-s="in_review"] { --tint: color-mix(in srgb, #8b5cf6 5%, transparent); --tint-ring: color-mix(in srgb, #8b5cf6 14%, transparent); --hc: var(--gb-st-in_review); }
.gb-lanes [data-s="blocked"] { --tint: color-mix(in srgb, #ef4444 6%, transparent); --tint-ring: color-mix(in srgb, #ef4444 18%, transparent); --hc: var(--gb-st-blocked); }
.gb-lanes [data-s="done"] { --tint: color-mix(in srgb, #22c55e 4%, transparent); --tint-ring: color-mix(in srgb, #22c55e 12%, transparent); --hc: var(--gb-st-done-text); }
.gb-lanes [data-s="cancelled"] { --tint: color-mix(in srgb, var(--gb-muted) 25%, transparent); --tint-ring: color-mix(in srgb, var(--gb-border) 50%, transparent); --hc: var(--gb-muted-fg); }
/* Con .gb-lanes delante: la Lista usa .gb-cell en sus filas (.gb-row .gb-cell, JST-31) */
.gb-lanes .gb-cell { min-width: 0; min-height: 56px; display: flex; flex-direction: column; gap: 6px; padding: 6px; border-radius: 10px; background: var(--tint); box-shadow: inset 0 0 0 1px var(--tint-ring); }
.gb-lane { padding: 8px 0; border-bottom: 1px solid var(--gb-border); }
.gb-lane.is-nocol { --cc: var(--gb-border-strong); }
/* Etiqueta de carril: 170 px, borde de 3 px con el color de la empresa; queda fija al bajar dentro del carril */
.gb-llabel { position: sticky; left: 0; top: 44px; z-index: 3; align-self: start; min-width: 0; display: flex; flex-direction: column; gap: 4px; padding: 4px 6px 5px 8px; border: 0; border-left: 3px solid var(--cc); border-radius: 0 6px 6px 0; background: var(--gb-bg); color: var(--gb-fg); text-align: left; }
.gb-llabel:hover { background: color-mix(in srgb, var(--gb-fg) 5%, var(--gb-bg)); }
.gb-llabel .gb-nm { display: flex; align-items: flex-start; gap: 6px; min-width: 0; font-size: 13px; line-height: 18px; font-weight: 600; }
.gb-llabel .gb-nm > .gb-cotag, .gb-llabel .gb-nm > .gb-avatar, .gb-llabel .gb-nm > .gb-noic { margin-top: 1px; flex: none; }
.gb-llabel .gb-nm .gb-t { min-width: 0; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.gb-llabel .gb-chev { display: inline-flex; flex: none; margin-top: 3px; color: var(--gb-muted-fg); transition: transform .15s; }
.gb-lane.is-closed .gb-llabel .gb-chev { transform: rotate(-90deg); }
.gb-llabel .gb-meta { display: flex; align-items: center; gap: 6px; padding-left: 18px; font-size: 12px; font-weight: 400; color: var(--gb-muted-fg); flex-wrap: wrap; }
.gb-noic { width: 18px; height: 18px; display: inline-grid; place-items: center; border-radius: 4px; border: 1px dashed var(--gb-border-strong); color: var(--gb-muted-fg); }
/* Carril plegado = una fila de conteos */
.gb-lane.is-closed { padding: 6px 0; }
.gb-lane.is-closed .gb-llabel { position: static; }
.gb-lcnt { min-width: 0; height: 32px; display: flex; align-items: center; gap: 6px; padding: 0 10px; border-radius: 8px; background: var(--tint); box-shadow: inset 0 0 0 1px var(--tint-ring); font-size: 12.5px; }
.gb-lcnt b { font-weight: 600; }
.gb-zero { color: var(--gb-subtle-fg); }
.gb-lnote { display: flex; align-items: center; gap: 6px; padding: 10px 2px 2px; font-size: 12px; color: var(--gb-subtle-fg); position: sticky; left: 0; width: max-content; }

/* ---------- Arrastre con carriles (§4.4) ---------- */
.gb-lanes.is-dragging .gb-cell.is-ok { box-shadow: inset 0 0 0 1px var(--gb-ring); }
.gb-lanes.is-dragging .gb-cell.is-ok:empty::after { content: "Suelta aquí"; margin: auto; font-size: 12px; color: var(--gb-muted-fg); }
.gb-lanes.is-dragging .gb-cell.is-nodrop { opacity: .35; cursor: not-allowed; background-image: repeating-linear-gradient(135deg, transparent 0 7px, color-mix(in srgb, var(--gb-fg) 8%, transparent) 7px 8px); }
.gb-lanes.is-dragging .gb-lane.is-src .gb-llabel { background: color-mix(in srgb, var(--cc) 14%, var(--gb-bg)); }
.gb-draghint { position: fixed; left: 50%; bottom: 22px; z-index: 1150; transform: translateX(-50%); display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 14px 0 12px; border: 1px solid var(--gb-border-strong); border-radius: 10px; background: var(--gb-popover); box-shadow: var(--gb-shadow-pop); font-size: 13px; color: var(--gb-fg); white-space: nowrap; pointer-events: none; }
.gb-draghint svg { color: var(--gb-muted-fg); }
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
