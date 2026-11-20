// Vista «Pedidos»: una fila por tarea raíz que resume todo su subárbol (avance
// completo, quién tiene la pelota y último movimiento). Lógica sin React: la usa
// la UI y la cubren las pruebas.
import {
  companyMatchesQuery,
  matchesFilters,
  normalizeText,
  sortSubtasks,
  updatedWithin,
  type BoardFilters,
  type BoardIndex,
  type BoardQuery,
} from "./board.js";
import { OPEN_STATUSES, isOpenStatus, type BoardIssue, type IssueStatus, type LiveRun } from "./shared.js";

// ---------------------------------------------------------------------------
// Subárbol
// ---------------------------------------------------------------------------

/** Un pedido es una tarea sin padre (o cuyo padre no está en el board). */
export function isPedido(index: BoardIndex, issue: BoardIssue): boolean {
  return !issue.parentId || !index.byId.has(issue.parentId);
}

/** Descendientes de cualquier nivel, sin la raíz. Un ciclo de padres no lo cuelga. */
export function descendantsOf(index: BoardIndex, root: BoardIssue): BoardIssue[] {
  const out: BoardIssue[] = [];
  const seen = new Set([root.id]);
  const queue = [...(index.kids.get(root.id) ?? [])];
  while (queue.length > 0) {
    const issue = queue.shift()!;
    if (seen.has(issue.id)) continue;
    seen.add(issue.id);
    out.push(issue);
    queue.push(...(index.kids.get(issue.id) ?? []));
  }
  return out;
}

/**
 * Avance del pedido completo: descendientes hechas sobre el total, de cualquier
 * nivel y sin las canceladas. `progressOf` cuenta solo las hijas directas.
 */
export function subtreeProgress(index: BoardIndex, root: BoardIssue): { done: number; total: number } {
  const counted = descendantsOf(index, root).filter((issue) => issue.status !== "cancelled");
  return { done: counted.filter((issue) => issue.status === "done").length, total: counted.length };
}

export interface PedidoTreeRow {
  issue: BoardIssue;
  /** 0 = hija directa del pedido. */
  depth: number;
}

/** El subárbol en orden de árbol, con el orden de las subtareas en cada nivel. */
export function pedidoTree(index: BoardIndex, root: BoardIssue): PedidoTreeRow[] {
  const rows: PedidoTreeRow[] = [];
  const seen = new Set([root.id]);
  const walk = (parent: BoardIssue, depth: number) => {
    for (const kid of sortSubtasks(index, index.kids.get(parent.id) ?? [])) {
      if (seen.has(kid.id)) continue;
      seen.add(kid.id);
      rows.push({ issue: kid, depth });
      walk(kid, depth + 1);
    }
  };
  walk(root, 0);
  return rows;
}

// ---------------------------------------------------------------------------
// Quién tiene la pelota
// ---------------------------------------------------------------------------

/** En el orden en que se muestran las secciones: lo que pide algo de ti, arriba. */
export const PEDIDO_STATES = ["toca", "cerrar", "bloqueado", "espera", "pausa", "sueltos", "trabajando", "curso", "nuevo", "cerrado"] as const;
export type PedidoState = (typeof PEDIDO_STATES)[number];

export const PEDIDO_LABELS: Record<PedidoState, string> = {
  toca: "Te toca a ti",
  cerrar: "Listo para cerrar",
  bloqueado: "Bloqueado",
  espera: "Espera otra tarea",
  pausa: "En pausa",
  sueltos: "Cerrado con pendientes",
  trabajando: "Trabajando ahora",
  curso: "En curso",
  nuevo: "Sin empezar",
  cerrado: "Cerrado",
};

export const PEDIDO_HINTS: Record<PedidoState, string> = {
  toca: "Esperan una respuesta tuya",
  cerrar: "Todas sus subtareas están hechas y el pedido sigue abierto",
  bloqueado: "Marcados como bloqueados, sin una tarea que los frene",
  espera: "Frenados por una tarea de otro pedido",
  pausa: "Lo que falta está en backlog: nadie lo tiene tomado",
  sueltos: "El pedido se cerró y le quedan subtareas abiertas",
  trabajando: "Un agente está corriendo ahora",
  curso: "Con trabajo empezado o en cola, sin nadie corriendo en este momento",
  nuevo: "Nada empezado todavía",
  cerrado: "Hechos o cancelados",
};

/** Secciones que parten plegadas: suelen ser muchas y no piden nada. */
export const PEDIDO_FOLDED: ReadonlySet<PedidoState> = new Set(["nuevo", "cerrado"]);

/** Corridas activas (`queued` o `running`) por tarea. `live-runs` también trae corridas ya terminadas. */
export function liveByIssue(runs: readonly LiveRun[]): Map<string, LiveRun[]> {
  const live = new Map<string, LiveRun[]>();
  for (const run of runs) {
    if (!run.issueId || (run.status !== "running" && run.status !== "queued")) continue;
    const list = live.get(run.issueId);
    if (list) list.push(run);
    else live.set(run.issueId, [run]);
  }
  return live;
}

export interface PedidoRow {
  /** La tarea raíz. */
  issue: BoardIssue;
  state: PedidoState;
  /** Descendientes de cualquier nivel, sin las canceladas. */
  progress: { done: number; total: number };
  /** Descendientes abiertas por estado, para el desglose de la fila. */
  open: Array<{ status: IssueStatus; count: number }>;
  /** La actualización más reciente de cualquier tarea del pedido. */
  lastMove: string;
  /** Tareas del pedido que esperan tu respuesta (la raíz primero). */
  waits: BoardIssue[];
  /** Corridas activas sobre tareas del pedido. */
  live: Array<{ run: LiveRun; issue: BoardIssue }>;
  /** `espera` y `bloqueado`: la tarea del pedido que está frenada. */
  stuck: BoardIssue | null;
  /** `espera`: la tarea de fuera que lo frena; `null` si no está en el board. */
  blocker: BoardIssue | null;
  /** Descendientes que calzan con la búsqueda cuando la raíz no calza. */
  hits: BoardIssue[];
}

const isMoving = (issue: BoardIssue) => issue.status === "in_progress" || issue.status === "in_review";

/**
 * Resume un pedido. La primera regla que se cumple manda:
 * 1. alguna tarea espera tu respuesta → `toca`, aunque la raíz esté cerrada;
 * 2. hay una corrida activa → `trabajando`;
 * 3. raíz cerrada → `sueltos` si le quedan subtareas abiertas; si no, `cerrado`;
 * 4. todas las subtareas hechas y la raíz sin frenos → `cerrar`;
 * 5. el estado sale de la «frontera»: las tareas abiertas sin subtareas
 *    abiertas, que es donde está el trabajo pendiente de verdad (una tarea padre
 *    queda «en curso» mientras sus hijas trabajan). En curso o en revisión →
 *    `curso`; frenada por una tarea de fuera → `espera`; bloqueada sin
 *    bloqueador → `bloqueado`;
 * 6. con algo empezado o hecho: `pausa` si todo lo que falta está en backlog
 *    (nadie lo toma hasta que alguien lo mueva) y `curso` si no;
 * 7. nada empezado → `nuevo`.
 */
export function summarizePedido(
  index: BoardIndex,
  root: BoardIssue,
  live: ReadonlyMap<string, readonly LiveRun[]> = new Map(),
): PedidoRow {
  const kids = descendantsOf(index, root);
  const tasks = [root, ...kids];
  const inTree = new Set(tasks.map((issue) => issue.id));
  const counted = kids.filter((issue) => issue.status !== "cancelled");
  const done = counted.filter((issue) => issue.status === "done").length;
  const openTasks = tasks.filter((issue) => isOpenStatus(issue.status));

  /** Bloqueadores sin resolver: uno que el board ve cerrado ya no frena. */
  const unresolved = (issue: BoardIssue) =>
    issue.blockerIds.filter((id) => {
      const blocker = index.byId.get(id);
      return !blocker || isOpenStatus(blocker.status);
    });
  const external = (issue: BoardIssue) => unresolved(issue).filter((id) => !inTree.has(id));
  const frontier = openTasks.filter((issue) => !(index.kids.get(issue.id) ?? []).some((kid) => isOpenStatus(kid.status)));

  const waits = tasks.filter((issue) => index.waiting.has(issue.id));
  const running = tasks.flatMap((issue) => (live.get(issue.id) ?? []).map((run) => ({ run, issue })));

  let state: PedidoState;
  let stuck: BoardIssue | null = null;
  let blocker: BoardIssue | null = null;
  if (waits.length > 0) state = "toca";
  else if (running.length > 0) state = "trabajando";
  else if (!isOpenStatus(root.status)) state = openTasks.length > 0 ? "sueltos" : "cerrado";
  else if (counted.length > 0 && done === counted.length && root.status !== "blocked" && external(root).length === 0) state = "cerrar";
  else if (frontier.some(isMoving)) state = "curso";
  else {
    const waiting = frontier.find((issue) => external(issue).length > 0);
    const blocked = frontier.find((issue) => issue.status === "blocked" && unresolved(issue).length === 0);
    if (waiting) {
      state = "espera";
      stuck = waiting;
      blocker = external(waiting).map((id) => index.byId.get(id)).find((issue) => issue !== undefined) ?? null;
    } else if (blocked) {
      state = "bloqueado";
      stuck = blocked;
    } else if (done > 0 || openTasks.some(isMoving)) {
      state = frontier.every((issue) => issue.status === "backlog") ? "pausa" : "curso";
    } else {
      state = "nuevo";
    }
  }

  return {
    issue: root,
    state,
    progress: { done, total: counted.length },
    open: OPEN_STATUSES.map((status) => ({ status, count: kids.filter((issue) => issue.status === status).length })).filter(
      (entry) => entry.count > 0,
    ),
    lastMove: tasks.reduce((latest, issue) => (issue.updatedAt > latest ? issue.updatedAt : latest), root.updatedAt),
    waits,
    live: running,
    stuck,
    blocker,
    hits: [],
  };
}

// ---------------------------------------------------------------------------
// Qué pedidos se ven
// ---------------------------------------------------------------------------

/** Título que empieza con alguno de los prefijos de `ocu`, sin tildes ni mayúsculas. */
export function isHiddenTitle(title: string, hide: readonly string[]): boolean {
  const text = normalizeText(title.trim());
  return hide.some((prefix) => {
    const start = normalizeText(prefix.trim());
    return start.length > 0 && text.startsWith(start);
  });
}

const matchesText = (issue: BoardIssue, q: string) => normalizeText(`${issue.identifier ?? ""} ${issue.title}`).includes(q);

/**
 * Los filtros se aplican a la raíz, salvo tres que miran el pedido entero: la
 * búsqueda también encuentra por una descendiente («¿de qué pedido es ABC-40?»),
 * «Te toca» deja los pedidos donde alguna tarea espera tu respuesta y
 * «Actualizada» cuenta el último movimiento de cualquier tarea.
 */
function matchesPedido(index: BoardIndex, root: BoardIssue, tasks: readonly BoardIssue[], filters: BoardFilters, base: BoardFilters, now: number): boolean {
  if (!matchesFilters(index, root, base, undefined, now)) return false;
  if (filters.toca && index.tocaAvailable && !tasks.some((issue) => index.waiting.has(issue.id))) return false;
  if (filters.act && !tasks.some((issue) => updatedWithin(issue, filters.act!, now))) return false;
  const q = normalizeText(filters.q.trim());
  return !q || tasks.some((issue) => matchesText(issue, q)) || companyMatchesQuery(index.companyById.get(root.companyId), q);
}

export type PedidoQuery = Pick<BoardQuery, "filters" | "showClosed" | "hide">;

/**
 * Las raíces que muestra la vista con esta consulta. Un pedido cerrado sale con
 * `cerr=1`, al filtrar por un estado cerrado (como en el Kanban) o, siempre, si
 * le quedan cabos sueltos: subtareas abiertas o alguna que espera tu respuesta.
 */
export function pedidoRoots(index: BoardIndex, query: PedidoQuery, now: number = Date.now()): BoardIssue[] {
  const { filters } = query;
  const base: BoardFilters = { ...filters, q: "", toca: false, act: null };
  const hideClosed = filters.est.length === 0 && !query.showClosed;
  return index.issues.filter((issue) => {
    if (!isPedido(index, issue) || isHiddenTitle(issue.title, query.hide)) return false;
    const kids = descendantsOf(index, issue);
    if (hideClosed && !isOpenStatus(issue.status) && !kids.some((kid) => isOpenStatus(kid.status) || index.waiting.has(kid.id))) return false;
    return matchesPedido(index, issue, [issue, ...kids], filters, base, now);
  });
}

export function pedidoRows(
  index: BoardIndex,
  query: PedidoQuery,
  options: { live?: readonly LiveRun[]; now?: number } = {},
): PedidoRow[] {
  const live = liveByIssue(options.live ?? []);
  const q = normalizeText(query.filters.q.trim());
  return pedidoRoots(index, query, options.now).map((root) => {
    const row = summarizePedido(index, root, live);
    if (q && !matchesText(root, q)) row.hits = descendantsOf(index, root).filter((issue) => matchesText(issue, q));
    return row;
  });
}

export interface PedidoSection {
  state: PedidoState;
  rows: PedidoRow[];
}

/** Una sección por estado con pedidos, en el orden de `PEDIDO_STATES`; dentro, lo último que se movió primero. */
export function pedidoSections(rows: readonly PedidoRow[]): PedidoSection[] {
  return PEDIDO_STATES.map((state) => ({
    state,
    rows: rows.filter((row) => row.state === state).sort((a, b) => b.lastMove.localeCompare(a.lastMove)),
  })).filter((section) => section.rows.length > 0);
}

// ---------------------------------------------------------------------------
// Última novedad (comentario más reciente de la raíz)
// ---------------------------------------------------------------------------

export const NOTE_MAX = 160;

/**
 * Primera línea con texto de un comentario, sin Markdown y recortada. Los
 * agentes suelen abrir con el resumen («🙋 Te toca: …», «⏳ Avance: …»).
 */
export function commentLine(body: string, max: number = NOTE_MAX): string {
  let fenced = false;
  for (const raw of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(raw)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const text = raw
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/^\s*(#{1,6}|>+|[-*+]|\d+[.)])\s+/, "")
      .replace(/(\*\*|__|~~|`)/g, "")
      .replace(/(^|\s)[*_]([^*_\s][^*_]*)[*_](?=\s|$|[.,;:!?)])/g, "$1$2")
      .replace(/\s+/g, " ")
      .trim();
    if (!/[\p{L}\p{N}]/u.test(text)) continue;
    return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
  }
  return "";
}
