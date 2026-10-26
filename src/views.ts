// Vistas guardadas (Fase 2, design-spec §3 de JST-21): un nombre y los
// parámetros de la URL de §5. Lógica sin React: la usan la UI (pestañas,
// escrituras optimistas) y el worker (validación y `ctx.state`).
import {
  BOARD_USER,
  FILTER_DIMS,
  allBoardQuery,
  assigneeLabel,
  normalizeText,
  parseBoardQuery,
  serializeBoardQuery,
  visibleIssues,
  type BoardIndex,
  type BoardQuery,
} from "./board.js";
import type { IssuePriority, IssueStatus } from "./shared.js";

export const VIEW_NAME_MAX = 60;

export interface SavedView {
  id: string;
  name: string;
  /** `""` o `?…`, normalizado con `viewSearch`. */
  search: string;
  createdAt: string;
}

export function cleanViewName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

/** Por qué no sirve el nombre, o `null`. `exceptId` es la vista que se renombra. */
export function viewNameError(views: readonly SavedView[], name: string, exceptId?: string): string | null {
  const clean = cleanViewName(name);
  if (!clean) return "Escribe un nombre.";
  if (clean.length > VIEW_NAME_MAX) return `Máximo ${VIEW_NAME_MAX} caracteres.`;
  const key = normalizeText(clean);
  if (views.some((view) => view.id !== exceptId && normalizeText(view.name) === key)) return "Ya hay una vista con ese nombre.";
  return null;
}

function assertName(views: readonly SavedView[], name: string, exceptId?: string): string {
  const error = viewNameError(views, name, exceptId);
  if (error) throw new Error(error);
  return cleanViewName(name);
}

/**
 * Lo que guarda y compara una vista: la URL sin lo que no se ve. Los carriles son
 * solo del Kanban (§4.1): en la Lista, el `carr` que queda en la URL (para volver
 * al Kanban con sus carriles) no cuenta.
 */
export function viewSearch(query: BoardQuery): string {
  return serializeBoardQuery(query.view === "kanban" ? query : { ...query, lanes: null });
}

/** Normaliza un `search` cualquiera: así dos vistas con los mismos filtros coinciden. */
export function normalizeSearch(search: string): string {
  return viewSearch(parseBoardQuery(search));
}

/** Guarda la consulta actual con un nombre. Lanza el error de `viewNameError` si el nombre no sirve. */
export function createView(
  views: readonly SavedView[],
  name: string,
  query: BoardQuery,
  id: string,
  now: string = new Date().toISOString(),
): SavedView[] {
  return [...views, { id, name: assertName(views, name), search: viewSearch(query), createdAt: now }];
}

export function renameView(views: readonly SavedView[], id: string, name: string): SavedView[] {
  const clean = assertName(views, name, id);
  return views.map((view) => (view.id === id ? { ...view, name: clean } : view));
}

/** «Actualizar vista»: la vista pasa a guardar la consulta de ahora. */
export function updateView(views: readonly SavedView[], id: string, query: BoardQuery): SavedView[] {
  const search = viewSearch(query);
  return views.map((view) => (view.id === id ? { ...view, search } : view));
}

export function deleteView(views: readonly SavedView[], id: string): SavedView[] {
  return views.filter((view) => view.id !== id);
}

/** Abrir una vista es volver a su consulta. */
export function viewQuery(view: SavedView): BoardQuery {
  return parseBoardQuery(view.search);
}

/** La vista que coincide con la URL actual (su pestaña va marcada). Si se cambia un filtro, ya no hay ninguna. */
export function activeView(views: readonly SavedView[], query: BoardQuery): SavedView | null {
  const search = viewSearch(query);
  return views.find((view) => view.search === search) ?? null;
}

/** Conteo de la pestaña: las tareas que se ven al abrir la vista. Las vistas con fecha se cuentan respecto de `now`. */
export function viewCount(index: BoardIndex, view: SavedView, now: number = Date.now()): number {
  return visibleIssues(index, viewQuery(view), now).length;
}

// ---------------------------------------------------------------------------
// Pestaña marcada (§3.1 y §3.7)
// ---------------------------------------------------------------------------

/**
 * - `all`: «Todo el board» (sin filtros ni carriles).
 * - `view`: la URL coincide con una vista guardada.
 * - `mod`: la URL ya no coincide, pero viene de la última vista abierta (`originId`): «Cambios sin guardar».
 * - `unsaved`: filtros que no son de ninguna vista.
 */
export type ViewState =
  | { kind: "all" }
  | { kind: "view"; view: SavedView }
  | { kind: "mod"; view: SavedView }
  | { kind: "unsaved" };

/** Mientras las vistas no llegan del servidor (o fallaron), `views` es `null` y no hay pestaña que marcar. */
export function viewState(views: readonly SavedView[] | null, query: BoardQuery, originId: string | null): ViewState {
  const search = viewSearch(query);
  const all = viewSearch(allBoardQuery(query)) === search;
  if (!views) return all ? { kind: "all" } : { kind: "unsaved" };
  const active = views.find((view) => view.search === search);
  if (active) return { kind: "view", view: active };
  const origin = originId ? views.find((view) => view.id === originId) : undefined;
  if (origin) return { kind: "mod", view: origin };
  return all ? { kind: "all" } : { kind: "unsaved" };
}

// ---------------------------------------------------------------------------
// Nombre sugerido (§3.9)
// ---------------------------------------------------------------------------

const STATUS_PLURAL: Record<IssueStatus, string> = {
  backlog: "Backlog",
  todo: "Por hacer",
  in_progress: "En curso",
  in_review: "En revisión",
  blocked: "Bloqueadas",
  done: "Hechas",
  cancelled: "Canceladas",
};

const PRIORITY_PLURAL: Record<IssuePriority, string> = { critical: "Críticas", high: "Altas", medium: "Medias", low: "Bajas" };

/** «Críticas y altas», «Bloqueadas, en curso y en revisión». */
function joinY(words: string[]): string {
  if (words.length <= 1) return words.join("");
  const rest = words.slice(1).map((word) => word.toLowerCase());
  return `${[words[0], ...rest.slice(0, -1)].join(", ")} y ${rest[rest.length - 1]}`;
}

/**
 * Nombre a partir de los filtros: «Te toca», prioridades, estados, el proyecto,
 * el responsable o la etiqueta, el texto buscado y, al final, la empresa, la
 * fecha y los carriles. Responsable = Board es «Lo mío». No repite un nombre.
 */
export function suggestViewName(index: BoardIndex, query: BoardQuery, views: readonly SavedView[]): string {
  const { filters } = query;
  const parts: string[] = [];
  if (filters.toca) parts.push("Te toca");
  if (filters.pri.length) parts.push(filters.pri.length <= 2 ? joinY(filters.pri.map((p) => PRIORITY_PLURAL[p])) : `${filters.pri.length} prioridades`);
  if (filters.est.length) parts.push(filters.est.length <= 2 ? joinY(filters.est.map((s) => STATUS_PLURAL[s])) : `${filters.est.length} estados`);
  if (filters.prj.length) {
    parts.push(filters.prj.length === 1 ? (index.projectById.get(filters.prj[0])?.name ?? "Sin proyecto") : `${filters.prj.length} proyectos`);
  }
  const mine = filters.resp.length === 1 && filters.resp[0] === BOARD_USER;
  if (filters.resp.length) parts.push(mine ? "Lo mío" : filters.resp.length === 1 ? assigneeLabel(index, filters.resp[0]) : `${filters.resp.length} responsables`);
  if (filters.eti.length) parts.push(filters.eti.length === 1 ? filters.eti[0] : `${filters.eti.length} etiquetas`);
  const q = cleanViewName(filters.q);
  if (q) parts.push(`«${q}»`);

  let name = parts.join(" · ");
  if (filters.emp.length === 1) {
    const company = index.companies.find((c) => c.prefix === filters.emp[0])?.name ?? filters.emp[0];
    name = name ? `${name} de ${company}` : company;
  } else if (filters.emp.length > 1) {
    const prefixes = [...filters.emp].sort().join(", ");
    name = name ? `${name} · ${prefixes}` : prefixes;
  } else if (name && !(mine && parts.length === 1)) {
    name += " de todas las empresas";
  }
  if (filters.act) name = name ? `${name} · últimos 7 días` : "Actualizadas en los últimos 7 días";
  if (query.view === "kanban" && query.lanes) name = name ? `${name} · por ${query.lanes}` : `Por ${query.lanes}`;
  if (!name) name = query.view === "lista" ? `Lista por ${query.group}` : "Mi vista";

  let out = name.slice(0, VIEW_NAME_MAX).trim();
  for (let n = 2; viewNameError(views, out) !== null && n < 100; n++) out = `${name.slice(0, VIEW_NAME_MAX - 6).trim()} (${n})`;
  return out;
}

/** Hay algo que guardar además de lo que conserva «Todo el board». */
export function hasViewFilters(query: BoardQuery): boolean {
  const { filters } = query;
  return FILTER_DIMS.some((dim) => filters[dim].length > 0) || !!filters.q.trim() || filters.toca || filters.act !== null || (query.view === "kanban" && query.lanes !== null);
}

// ---------------------------------------------------------------------------
// En el servidor (§3.10 y §6): `ctx.state` de alcance instance
// ---------------------------------------------------------------------------

/** Clave en `ctx.state` (alcance `instance`): las mismas vistas desde cualquier empresa y navegador. */
export const VIEWS_STATE_KEY = "saved-views";
const STORE_VERSION = 1;

export interface StoredViews {
  version: number;
  views: SavedView[];
}

/** Lee lo guardado sin confiar en su forma: descarta lo que no sirve y normaliza la consulta. */
export function parseStoredViews(data: unknown): SavedView[] {
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }
  const list = (data as { views?: unknown } | null)?.views;
  if (!Array.isArray(list)) return [];
  const views: SavedView[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const { id, name, search, createdAt } = item as Record<string, unknown>;
    if (typeof id !== "string" || !id || views.some((view) => view.id === id)) continue;
    if (typeof name !== "string" || viewNameError(views, name) !== null) continue;
    views.push({
      id,
      name: cleanViewName(name),
      search: normalizeSearch(typeof search === "string" ? search : ""),
      createdAt: typeof createdAt === "string" ? createdAt : "",
    });
  }
  return views;
}

export function storedViews(views: readonly SavedView[]): StoredViews {
  return { version: STORE_VERSION, views: [...views] };
}

/**
 * Una operación por acción del worker, nunca «la lista entera»: así un
 * navegador con la lista vieja no borra lo que creó otro (§6).
 */
export type ViewOp =
  | { op: "create"; id: string; name: string; search: string }
  | { op: "rename"; id: string; name: string }
  | { op: "update"; id: string; search: string }
  | { op: "delete"; id: string };

/** Siempre devuelve la lista vigente, para que la UI reemplace la suya. */
export type ViewOpResult =
  | { ok: true; views: SavedView[] }
  | { ok: false; reason: "not_found" | "invalid"; message: string; views: SavedView[] };

/** Valida los parámetros de una acción del worker. Lanza si no tienen la forma esperada. */
export function parseViewOp(op: ViewOp["op"], params: Record<string, unknown>): ViewOp {
  const text = (key: string) => {
    const value = params[key];
    if (typeof value !== "string") throw new Error(`Falta "${key}"`);
    return value;
  };
  const id = text("id");
  if (!id) throw new Error('Falta "id"');
  switch (op) {
    case "create":
      return { op, id, name: text("name"), search: text("search") };
    case "rename":
      return { op, id, name: text("name") };
    case "update":
      return { op, id, search: text("search") };
    case "delete":
      return { op, id };
  }
}

/**
 * Aplica la operación sobre la lista guardada. Si otro navegador borró la vista,
 * renombrar, actualizar o borrar responde `not_found` con la lista vigente (§3.10).
 */
export function applyViewOp(views: readonly SavedView[], op: ViewOp, now: string = new Date().toISOString()): ViewOpResult {
  const current = [...views];
  const exists = current.some((view) => view.id === op.id);
  if (op.op === "create") {
    if (exists) return { ok: false, reason: "invalid", message: "Ya hay una vista con ese id.", views: current };
    const error = viewNameError(current, op.name);
    if (error) return { ok: false, reason: "invalid", message: error, views: current };
    return { ok: true, views: [...current, { id: op.id, name: cleanViewName(op.name), search: normalizeSearch(op.search), createdAt: now }] };
  }
  if (!exists) return { ok: false, reason: "not_found", message: "La vista ya no existe.", views: current };
  if (op.op === "delete") return { ok: true, views: deleteView(current, op.id) };
  if (op.op === "rename") {
    const error = viewNameError(current, op.name, op.id);
    if (error) return { ok: false, reason: "invalid", message: error, views: current };
    return { ok: true, views: renameView(current, op.id, op.name) };
  }
  return { ok: true, views: updateView(current, op.id, parseBoardQuery(op.search)) };
}
