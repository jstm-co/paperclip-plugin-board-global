// Hoja del Dashboard global, portada del CSS de referencia de la propuesta C
// (JST-11: dash.css y c.css) con el prefijo `gb-`. Usa los tokens y las
// primitivas de `styles.ts` (Board global), que se cargan antes.
const CSS = /* css */ `
.gb, .gb-layer { --gb-live: #2563eb; }
.dark .gb, .dark .gb-layer { --gb-live: #3b82f6; }

/* La página hace scroll en el contenedor del host (a diferencia del Board global). */
.gb.gb-dash { display: block; overflow: visible; min-height: 0; padding-bottom: 32px; }
.gb-dash.is-refreshing > :not(.gb-dhead) { opacity: .55; transition: opacity .15s; }
.gb-dash .gb-btn:disabled { opacity: .5; }
.gb-dash .gb-btn.is-busy svg { animation: gb-spin .9s linear infinite; }
.gb-spin { display: inline-flex; animation: gb-spin 1s linear infinite; }

/* ---------- Cabecera (§3.1) ---------- */
.gb-dhead { display: flex; align-items: center; gap: 12px; min-height: 48px; }
.gb-dhead h1 { margin: 0; font-size: 20px; line-height: 28px; font-weight: 600; letter-spacing: -.01em; }
.gb-dhead .gb-sub { color: var(--gb-muted-fg); font-size: 13px; line-height: 20px; }
.gb-dhead .gb-upd { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--gb-muted-fg); white-space: nowrap; }

/* Filtro de empresas (§3.2): botones que se prenden y apagan; «Todas» = sin filtro */
.gb-cof { display: inline-flex; align-items: center; gap: 4px; }
.gb-cof .gb-lbl { font-size: 12.5px; color: var(--gb-muted-fg); margin-right: 4px; }
.gb-cof button { height: 28px; padding: 0 9px; border-radius: 8px; border: 1px solid var(--gb-input); background: transparent; color: var(--gb-fg); font-size: 12.5px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; }
.gb-cof button:hover:not(:disabled) { background: var(--gb-hover-strong); }
.gb-cof button:disabled { cursor: default; }
.gb-cof .gb-p { font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .02em; }
.gb-cof .gb-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--cc); flex: none; }
.gb-cof .gb-all.is-on { background: var(--gb-muted); border-color: var(--gb-border-strong); }
.gb-cof .gb-cob.is-on { background: color-mix(in srgb, var(--cc) 16%, transparent); border-color: color-mix(in srgb, var(--cc) 70%, transparent); }
.gb-cof .gb-cob.is-on .gb-p { color: var(--cfg); }
.gb-cof .gb-cob.is-off { color: var(--gb-muted-fg); }
.gb-cof .gb-cob.is-off .gb-dot { background: transparent; box-shadow: inset 0 0 0 1.5px var(--cc); }
.gb-cof .gb-alert { display: inline-flex; color: var(--gb-st-blocked); }
.gb-cof .gb-spin { color: var(--gb-muted-fg); }

/* ---------- Secciones (§3.5) ---------- */
.gb-dsec { display: flex; align-items: center; gap: 10px; height: 28px; margin: 22px 0 8px; min-width: 0; }
.gb-dsec h2 { margin: 0; font-size: 12.5px; line-height: 16px; font-weight: 600; color: var(--gb-muted-fg); text-transform: uppercase; letter-spacing: .05em; white-space: nowrap; }
.gb-dsec .gb-meta { font-size: 12px; color: var(--gb-muted-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gb-dsec .gb-scale { font-size: 11.5px; color: var(--gb-muted-fg); white-space: nowrap; }

/* ---------- Avisos (§3.4 y §4.2) ---------- */
.gb-dash .gb-banner { margin-top: 16px; }
.gb-budget { display: flex; align-items: flex-start; gap: 10px; margin-top: 16px; padding: 10px 14px; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--gb-st-blocked) 35%, transparent); background: linear-gradient(90deg, color-mix(in srgb, var(--gb-st-blocked) 9%, transparent), color-mix(in srgb, var(--gb-st-blocked) 3%, transparent)); font-size: 13px; }
.gb-budget > svg { color: var(--gb-st-blocked); margin-top: 2px; }
.gb-budget .gb-txt { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.gb-budget .gb-line { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--gb-muted-fg); }
.gb-budget .gb-line a { margin-left: auto; color: var(--gb-fg); text-decoration: underline; text-underline-offset: 2px; white-space: nowrap; }
.gb-dash .gb-empty { min-height: 360px; }

/* ---------- Contadores (§3.3): informan, no filtran ---------- */
.gb-dkpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 14px; }
.gb-dk { border: 1px solid var(--gb-border); background: var(--gb-card); border-radius: 10px; padding: 10px 12px 11px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.gb-dk .gb-lab { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--gb-muted-fg); white-space: nowrap; }
.gb-dk .gb-val { font-size: 26px; line-height: 32px; font-weight: 600; letter-spacing: -.02em; }
.gb-dk .gb-desc { font-size: 12px; color: var(--gb-muted-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gb-dash .gb-bad { color: var(--gb-danger-fg); font-weight: 500; }
.gb-dbrk { margin-top: 6px; display: flex; gap: 10px; font: 500 10.5px/14px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--gb-muted-fg); white-space: nowrap; overflow: hidden; }
.gb-dbrk b { color: var(--cfg); font-weight: 600; margin-right: 3px; }
.gb-dbrk a:hover { color: var(--gb-fg); text-decoration: underline; }

/* ---------- Tabla comparativa (§3.6) ---------- */
.gb-ctab { border: 1px solid var(--gb-border); border-radius: 10px; background: var(--gb-card); overflow: hidden; }
.gb-ctr { display: grid; grid-template-columns: 150px 92px 64px 64px 56px 150px 52px repeat(3, minmax(0, 1fr)) 20px; column-gap: 10px; align-items: center; padding: 0 12px; }
.gb-cg { height: 28px; align-items: end; }
.gb-cg .gb-g { font-size: 10.5px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--gb-muted-fg); border-bottom: 1px solid var(--gb-border); padding-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gb-cth { height: 32px; border-bottom: 1px solid var(--gb-border); font-size: 11.5px; color: var(--gb-muted-fg); font-weight: 500; }
.gb-cth .gb-r { display: flex; justify-content: flex-end; }
.gb-csort { border: 0; background: transparent; color: var(--gb-muted-fg); font-size: 11.5px; font-weight: 500; display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0; white-space: nowrap; }
.gb-csort:hover, .gb-csort.is-on { color: var(--gb-fg); }
.gb-csorti { display: inline-flex; opacity: 0; }
.gb-csort:hover .gb-csorti, .gb-csort:focus-visible .gb-csorti { opacity: .7; }
.gb-crow { height: 54px; border-bottom: 1px solid color-mix(in srgb, var(--gb-border) 70%, transparent); font-size: 13px; }
a.gb-crow:hover { background: var(--gb-hover); }
a.gb-crow:hover .gb-cgo { color: var(--gb-fg); }
a.gb-crow:focus-visible { outline: 2px solid var(--gb-ring); outline-offset: -2px; }
.gb-crow.is-inc { box-shadow: inset 3px 0 0 var(--gb-st-blocked); }
.gb-ctr .gb-r { text-align: right; font-variant-numeric: tabular-nums; }
.gb-ctr .gb-r .gb-sk { margin-left: auto; }
.gb-crow b { font-weight: 500; }
.gb-ctr small { display: block; font-size: 11.5px; color: var(--gb-muted-fg); white-space: nowrap; }
.gb-cname { display: flex; align-items: center; gap: 8px; min-width: 0; }
.gb-cname .gb-cotag.is-solid { height: 20px; line-height: 20px; font-size: 11px; padding: 0 5px; }
.gb-cname b { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gb-cname .gb-spin { color: var(--gb-muted-fg); }
.gb-live { width: 8px; height: 8px; border-radius: 50%; background: var(--gb-live); box-shadow: 0 0 0 3px color-mix(in srgb, var(--gb-live) 22%, transparent); flex: none; }
.gb-cag { display: flex; flex-direction: column; align-items: flex-end; line-height: 16px; }
.gb-cspend { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.gb-cspend .gb-top { display: flex; align-items: baseline; gap: 6px; }
.gb-cspend .gb-top b { font-variant-numeric: tabular-nums; }
.gb-ctr .gb-cspend .gb-top small { display: inline; }
.gb-ctr small.gb-cinc { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; }
.gb-meter { display: block; height: 4px; border-radius: 2px; background: var(--gb-muted); overflow: hidden; width: 100%; }
.gb-meter i { display: block; height: 100%; background: var(--gb-muted-fg); border-radius: 2px; }
.gb-meter.is-hot i { background: var(--gb-st-blocked); }
.gb-meter.is-none { background: repeating-linear-gradient(90deg, var(--gb-muted) 0 4px, transparent 4px 7px); }
.gb-ccell { display: flex; align-items: flex-end; gap: 8px; min-width: 0; height: 30px; }
.gb-ccell .gb-n { width: 34px; flex: none; text-align: right; font-size: 12px; line-height: 14px; font-variant-numeric: tabular-nums; }
.gb-nodata { font-size: 11.5px; line-height: 16px; color: var(--gb-muted-fg); align-self: center; border: 1px dashed var(--gb-border); border-radius: 6px; padding: 3px 8px; white-space: nowrap; }
.gb-cgo { color: var(--gb-muted-fg); display: inline-flex; justify-content: flex-end; }
.gb-cerr { grid-column: 2 / 11; display: flex; align-items: center; gap: 8px; color: var(--gb-danger-fg); font-size: 12.5px; }
.gb-cerr .gb-linkbtn { color: var(--gb-fg); text-decoration: underline; height: 24px; font-size: 12.5px; }
.gb-ctot { height: 50px; background: color-mix(in srgb, var(--gb-muted) 40%, var(--gb-card)); font-size: 13px; }
.gb-ctot b { font-weight: 600; }
.gb-ctot .gb-cname { flex-direction: column; align-items: flex-start; gap: 0; line-height: 16px; }

/* Minigráficos: 14 barras, misma escala en todas las filas */
.gb-spark { flex: 1; min-width: 0; height: 26px; display: flex; align-items: flex-end; gap: 2px; border-bottom: 1px solid var(--gb-border); }
.gb-scol { flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; border-radius: 3px; }
.gb-scol:hover { background: var(--gb-hover); }
.gb-scol:hover > * { filter: brightness(1.18); }
.gb-bar1 { display: block; width: 100%; max-width: 24px; border-radius: 4px 4px 0 0; background: var(--cc); }
.gb-zero { display: block; width: 100%; max-width: 24px; height: 2px; border-radius: 1px; background: color-mix(in srgb, var(--gb-muted) 70%, transparent); }
.gb-stack { width: 100%; max-width: 24px; display: flex; flex-direction: column-reverse; gap: 2px; border-radius: 4px 4px 0 0; overflow: hidden; }
.gb-stack i { display: block; min-height: 2px; background: var(--cc); }
.gb-spark-sk { flex: 1; min-width: 0; height: 26px; display: flex; align-items: flex-end; gap: 2px; }
.gb-spark-sk .gb-sk { flex: 1; border-radius: 2px; }

/* Tooltip de los gráficos: el valor primero, la serie después */
.gb-dtip { position: fixed; z-index: 1100; background: var(--gb-popover); box-shadow: var(--gb-shadow-pop); border-radius: 8px; padding: 8px 10px; font-size: 12px; pointer-events: none; min-width: 140px; }
.gb-dtip .gb-h { color: var(--gb-muted-fg); font-size: 11.5px; margin-bottom: 4px; white-space: nowrap; }
.gb-dtip .gb-h b { color: var(--gb-fg); font-weight: 600; }
.gb-dtip .gb-tr { display: flex; align-items: center; gap: 8px; height: 18px; white-space: nowrap; }
.gb-dtip .gb-k { width: 10px; height: 2px; border-radius: 1px; flex: none; background: var(--cc); }
.gb-dtip .gb-tr b { font-weight: 600; min-width: 18px; text-align: right; font-variant-numeric: tabular-nums; }
.gb-dtip .gb-l { color: var(--gb-muted-fg); }

/* ---------- Bloque inferior (§3.7) ---------- */
.gb-cbottom { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; align-items: start; }
.gb-cbottom > div { min-width: 0; }
.gb-feed { border: 1px solid var(--gb-border); border-radius: 10px; background: var(--gb-card); overflow: hidden; min-width: 0; }
.gb-feed > * { border-bottom: 1px solid color-mix(in srgb, var(--gb-border) 70%, transparent); }
.gb-feed > :last-child { border-bottom: 0; }
.gb-subhd { font-size: 10.5px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--gb-muted-fg); padding: 8px 14px 4px; background: color-mix(in srgb, var(--gb-muted) 30%, transparent); }
.gb-fempty { padding: 18px 14px; font-size: 12.5px; color: var(--gb-muted-fg); text-align: center; }
.gb-mempty { display: flex; align-items: flex-start; gap: 8px; color: var(--gb-muted-fg); font-size: 12.5px; line-height: 17px; padding: 10px 14px; }
.gb-mempty svg { margin-top: 1px; }
.gb-mempty b { display: block; color: var(--gb-fg); font-weight: 500; }
.gb-mempty span { display: block; }
.gb-skrow { display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 14px; }
a.gb-lrow:hover, a.gb-arow:hover, a.gb-trow:hover { background: var(--gb-hover); }
.gb-when { flex: none; font-size: 12px; color: var(--gb-muted-fg); white-space: nowrap; }
.gb-id { font: 500 11px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--gb-muted-fg); }

/* Agentes en vivo */
.gb-lrow { display: grid; grid-template-columns: 8px 20px minmax(0, 1fr); grid-template-rows: auto auto; column-gap: 8px; row-gap: 1px; align-items: center; padding: 8px 14px; }
.gb-lrow > .gb-rdot, .gb-lrow > .gb-avatar { grid-row: 1 / 3; }
.gb-rdot { width: 8px; height: 8px; border-radius: 50%; background: var(--gb-subtle-fg); }
.gb-rdot.is-live { background: var(--gb-live); box-shadow: 0 0 0 3px color-mix(in srgb, var(--gb-live) 22%, transparent); }
.gb-rdot.is-fail { background: var(--gb-st-blocked); }
.gb-lrow .gb-l1 { display: flex; align-items: center; gap: 6px; font-size: 13px; min-width: 0; }
.gb-lrow .gb-l1 b { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gb-lrow .gb-l2 { font-size: 12px; color: var(--gb-muted-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gb-lrow .gb-when { font-size: 11.5px; }
.gb-lrow .gb-when.is-live { color: var(--gb-live); font-weight: 500; }
.dark .gb-lrow .gb-when.is-live { color: #7fb0ff; }
.gb-lrow .gb-when.is-fail { color: var(--gb-danger-fg); }

/* Actividad y tareas recientes */
.gb-arow, .gb-trow { display: flex; flex-direction: column; gap: 2px; padding: 8px 14px; font-size: 13px; min-width: 0; }
.gb-arow .gb-l1, .gb-trow .gb-l1 { display: flex; align-items: center; gap: 6px; min-width: 0; }
.gb-arow .gb-txt { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; }
.gb-arow .gb-txt b { font-weight: 500; }
.gb-arow .gb-v { color: var(--gb-muted-fg); }
.gb-arow .gb-ent { font: 600 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
.gb-arow .gb-l2 { font-size: 12px; color: var(--gb-muted-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-left: 2px; }
.gb-trow .gb-id { font-size: 11.5px; flex: none; }
.gb-trow .gb-who { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; max-width: 130px; min-width: 0; font-size: 12px; color: var(--gb-muted-fg); }
.gb-trow .gb-who span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gb-trow .gb-l2 { font-size: 12.5px; color: var(--gb-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-left: 2px; }
`;

const STYLE_ID = "jstm-dashboard-global-styles";

/** Inserta (o actualiza tras un upgrade del plugin) la hoja del Dashboard una sola vez. */
export function ensureDashboardStyles(): void {
  if (typeof document === "undefined") return;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  if (style.textContent !== CSS) style.textContent = CSS;
}
