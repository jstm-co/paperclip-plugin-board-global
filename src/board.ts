// Lógica del board sin React: estado en la URL, índice multiempresa, «Te toca»,
// árbol de subtareas, filtrado, orden, agrupación, carriles y columnas del
// Board. La usa la UI y la cubren las pruebas.
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  isOpenStatus,
  type AttentionItem,
  type BoardIssue,
  type CompanyBoard,
  type IssueBlockedBy,
  type IssuePriority,
  type IssueStatus,
} from "./shared.js";
import { localeTag, t } from "./i18n.js";

// ---------------------------------------------------------------------------
// Estado en la URL (design-spec §5)
// ---------------------------------------------------------------------------

/**
 * `kanban` es el Board; `backlog`, la lista de lo que todavía no entra al Board
 * (JST-407); `pedidos`, una fila por tarea raíz con el resumen de su subárbol
 * (`pedidos.ts`).
 */
export const BOARD_VIEWS = ["kanban", "backlog", "lista", "pedidos"] as const;
export type BoardView = (typeof BOARD_VIEWS)[number];

export const GROUP_BY_OPTIONS = ["empresa", "estado", "proyecto", "responsable", "prioridad"] as const;
export type GroupBy = (typeof GROUP_BY_OPTIONS)[number];

/** Carriles del kanban (Fase 2, design-spec §8): filas por empresa, proyecto o responsable. */
export const LANE_OPTIONS = ["empresa", "proyecto", "responsable"] as const satisfies readonly GroupBy[];
export type LaneBy = (typeof LANE_OPTIONS)[number];
/** El Board abre agrupado por empresa (JST-407). Sin agrupar viaja en la URL como `carr=no`. */
export const DEFAULT_LANES: LaneBy = "empresa";
const NO_LANES_PARAM = "no";

/** Filtros de selección múltiple. La clave es el parámetro de la URL. */
export const FILTER_DIMS = ["emp", "prj", "est", "resp", "pri", "eti"] as const;
export type FilterDim = (typeof FILTER_DIMS)[number];

/** Responsable sin asignar en `resp`. */
export const UNASSIGNED = "none";
/** Tarea sin proyecto en `prj`. */
export const NO_PROJECT = "none";

/** Filtro «Actualizada» (Fase 2, design-spec §5 de JST-21): una sola opción, relativa a ahora. */
export const DATE_RANGES = ["7d"] as const;
export type DateRange = (typeof DATE_RANGES)[number];
const DATE_RANGE_MS: Record<DateRange, number> = { "7d": 7 * 24 * 60 * 60 * 1000 };

/** El usuario del board en `local_trusted`: «Lo mío» es `resp=user:local-board`. */
export const BOARD_USER = "user:local-board";

export interface BoardFilters {
  /** Prefijos de empresa (`BET`, `JST`…). */
  emp: string[];
  /** Ids de proyecto; `none` = sin proyecto. */
  prj: string[];
  est: IssueStatus[];
  /** `agent:<id>`, `user:<id>` o `none`. */
  resp: string[];
  pri: IssuePriority[];
  /** Nombres de etiqueta: las etiquetas son por empresa y el nombre las une. */
  eti: string[];
  q: string;
  /** Solo lo que espera tu respuesta. */
  toca: boolean;
  /** `act`: actualizadas en el rango, contado hacia atrás desde ahora; `null` = cualquier fecha. */
  act: DateRange | null;
}

export interface BoardQuery {
  view: BoardView;
  group: GroupBy;
  /** `carr`: carriles del kanban; por empresa si no viene y `null` (`carr=no`) = sin agrupar. */
  lanes: LaneBy | null;
  filters: BoardFilters;
  /**
   * `sub=0`. Desde JST-407 las tarjetas no despliegan subtareas, así que no cambia
   * nada en pantalla; se conserva para no alterar las URL y vistas ya guardadas.
   */
  subtasksCollapsed: boolean;
  /** `cerr=1`: columnas Hecha y Cancelada visibles; en Pedidos, los pedidos cerrados. */
  showClosed: boolean;
  /** `ocu`: la vista Pedidos oculta las raíces cuyo título empieza con alguno de estos textos. */
  hide: string[];
}

export function emptyFilters(): BoardFilters {
  return { emp: [], prj: [], est: [], resp: [], pri: [], eti: [], q: "", toca: false, act: null };
}

export function defaultQuery(): BoardQuery {
  return { view: "kanban", group: "empresa", lanes: DEFAULT_LANES, filters: emptyFilters(), subtasksCollapsed: false, showClosed: false, hide: [] };
}

/**
 * «Todo el board» (§3.1 de JST-21): sin filtros ni títulos ocultos y agrupado
 * por empresa. Conserva la vista (Board, Backlog, Lista o Pedidos), la
 * agrupación de la Lista, las subtareas plegadas y las cerradas.
 */
export function allBoardQuery(query: BoardQuery): BoardQuery {
  return { ...defaultQuery(), view: query.view, group: query.group, subtasksCollapsed: query.subtasksCollapsed, showClosed: query.showClosed };
}

/** Filtros que se muestran como chips (todo menos «Te toca», que tiene su aviso). */
export function hasChipFilters(filters: BoardFilters): boolean {
  return FILTER_DIMS.some((dim) => filters[dim].length > 0) || filters.q.trim().length > 0 || filters.act !== null;
}

export function hasActiveFilters(filters: BoardFilters): boolean {
  return hasChipFilters(filters) || filters.toca;
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

/**
 * Los valores de un filtro van separados por coma y cada uno codificado por
 * separado, así que una coma dentro de un valor (p. ej. una etiqueta) viaja como
 * `%2C` y no rompe la lista.
 */
export function readParams(search: string): Map<string, string> {
  const params = new Map<string, string>();
  for (const part of search.replace(/^\?/, "").split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const key = decode(eq === -1 ? part : part.slice(0, eq));
    params.set(key, eq === -1 ? "" : part.slice(eq + 1));
  }
  return params;
}

export function readList(params: Map<string, string>, key: string): string[] {
  const raw = params.get(key);
  if (!raw) return [];
  const values = raw.split(",").map(decode).map((value) => value.trim()).filter(Boolean);
  return [...new Set(values)];
}

export function parseBoardQuery(search: string): BoardQuery {
  const params = readParams(search);
  const view = params.get("v");
  const group = params.get("grp");
  const lanes = params.get("carr");
  const act = params.get("act");
  return {
    view: (BOARD_VIEWS as readonly string[]).includes(view ?? "") ? (view as BoardView) : "kanban",
    group: (GROUP_BY_OPTIONS as readonly string[]).includes(group ?? "") ? (group as GroupBy) : "empresa",
    lanes: lanes === NO_LANES_PARAM ? null : (LANE_OPTIONS as readonly string[]).includes(lanes ?? "") ? (lanes as LaneBy) : DEFAULT_LANES,
    filters: {
      emp: readList(params, "emp").map((prefix) => prefix.toUpperCase()),
      prj: readList(params, "prj"),
      est: ISSUE_STATUSES.filter((status) => readList(params, "est").includes(status)),
      resp: readList(params, "resp"),
      pri: ISSUE_PRIORITIES.filter((priority) => readList(params, "pri").includes(priority)),
      eti: readList(params, "eti"),
      q: decode(params.get("q") ?? "").trim(),
      toca: params.get("toca") === "1",
      act: (DATE_RANGES as readonly string[]).includes(act ?? "") ? (act as DateRange) : null,
    },
    subtasksCollapsed: params.get("sub") === "0",
    showClosed: params.get("cerr") === "1",
    hide: readList(params, "ocu"),
  };
}

/** Devuelve `""` o `?…` con orden estable y sin los valores por defecto. */
export function serializeBoardQuery(query: BoardQuery): string {
  const parts: string[] = [];
  // `:` queda legible (`resp=agent:<id>`); es válido en el query string.
  const encode = (value: string) => encodeURIComponent(value).replace(/%3A/gi, ":");
  const add = (key: string, values: readonly string[]) => {
    if (values.length > 0) parts.push(`${key}=${values.map(encode).join(",")}`);
  };
  const { filters } = query;
  if (query.view !== "kanban") parts.push(`v=${query.view}`);
  const q = filters.q.trim();
  if (q) parts.push(`q=${encode(q)}`);
  add("emp", [...filters.emp].sort());
  add("prj", [...filters.prj].sort());
  add("est", ISSUE_STATUSES.filter((status) => filters.est.includes(status)));
  add("resp", [...filters.resp].sort());
  add("pri", ISSUE_PRIORITIES.filter((priority) => filters.pri.includes(priority)));
  add("eti", [...filters.eti].sort((a, b) => a.localeCompare(b, "es")));
  if (filters.toca) parts.push("toca=1");
  if (filters.act) parts.push(`act=${filters.act}`);
  if (query.group !== "empresa") parts.push(`grp=${query.group}`);
  if (query.lanes !== DEFAULT_LANES) parts.push(`carr=${query.lanes ?? NO_LANES_PARAM}`);
  if (query.subtasksCollapsed) parts.push("sub=0");
  if (query.showClosed) parts.push("cerr=1");
  add("ocu", [...query.hide].sort((a, b) => a.localeCompare(b, "es")));
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

// ---------------------------------------------------------------------------
// «Te toca»: tareas que esperan una respuesta del usuario (feed del Inbox)
// ---------------------------------------------------------------------------

export type WaitKind = "pregunta" | "confirmacion" | "aprobacion" | "desbloqueo" | "otro";

export const WAIT_LABELS: Record<WaitKind, string> = {
  pregunta: t("Responder pregunta"),
  confirmacion: t("Confirmar"),
  aprobacion: t("Aprobar"),
  desbloqueo: t("Desbloquear"),
  otro: t("Atender"),
};

export interface Waiting {
  kind: WaitKind;
  /** Qué se te pide, en una línea. */
  what: string;
  since: string | null;
  /** Enlace directo a la tarjeta del hilo, si la hay. */
  href: string | null;
}

function waitKind(item: AttentionItem): WaitKind {
  switch (item.sourceKind) {
    case "blocker_attention":
      return "desbloqueo";
    case "approval":
    case "review":
      return "aprobacion";
    case "decision":
      return "pregunta";
    case "issue_thread_interaction":
      return item.subject?.metadata?.kind === "ask_user_questions" ? "pregunta" : "confirmacion";
    default:
      return "otro";
  }
}

function waitWhat(item: AttentionItem, kind: WaitKind): string {
  if (kind === "desbloqueo") {
    const blocked = item.detail?.blockedTaskCount ?? 0;
    return blocked > 0
      ? blocked === 1
        ? t("Bloquea {n} tarea y necesita tu atención", { n: blocked })
        : t("Bloquea {n} tareas y necesita tu atención", { n: blocked })
      : t("Necesita tu atención para destrabarse");
  }
  // Si el sujeto es la propia tarea, su título no dice qué se pide.
  const title = item.subject?.kind !== "issue" ? item.subject?.title?.trim() : "";
  return title || WAIT_LABELS[kind];
}

/** Una entrada por tarea: si el feed trae varias, gana la primera (la más reciente). */
export function waitingFromAttention(items: readonly AttentionItem[]): Map<string, Waiting> {
  const waiting = new Map<string, Waiting>();
  for (const item of items) {
    const issueId = item.relatedIssue?.id;
    if (!issueId || waiting.has(issueId)) continue;
    const kind = waitKind(item);
    waiting.set(issueId, {
      kind,
      what: waitWhat(item, kind),
      since: item.createdAt ?? null,
      href: item.subject?.kind === "interaction" ? (item.subject.href ?? null) : null,
    });
  }
  return waiting;
}

// ---------------------------------------------------------------------------
// Índice multiempresa
// ---------------------------------------------------------------------------

/** Colores de la paleta fija (design-spec §3.7) para las empresas sin `brandColor`. */
export const COMPANY_PALETTE_SIZE = 4;

/**
 * Clave de la paleta fija (`p1`…`p4`) de cada empresa: se reparten por orden
 * alfabético del nombre entre las 4 primeras. Desde la 5.ª no tienen clave y
 * quedan en gris, como cualquier empresa fuera de la paleta del design-spec;
 * para darles color hay que ponerles color de marca en Paperclip.
 * Hay que pasarle la lista completa de empresas, así cada una tiene el mismo
 * color en el Board, en el Dashboard y mientras carga.
 */
export function companyPaletteKeys(companies: readonly { id: string; name: string }[]): Map<string, string> {
  const sorted = [...companies].sort((a, b) => a.name.localeCompare(b.name, "es"));
  return new Map(sorted.slice(0, COMPANY_PALETTE_SIZE).map((company, i) => [company.id, `p${i + 1}`]));
}

export interface BoardCompany {
  id: string;
  name: string;
  /** Prefijo de las tareas; es la clave del filtro de empresa en la URL. */
  prefix: string;
  brandColor: string | null;
  /** Clave de la paleta fija (`p1`…`p4`) o `null` si no tiene. */
  paletteKey: string | null;
}

export interface BoardIndex {
  companies: BoardCompany[];
  issues: BoardIssue[];
  byId: Map<string, BoardIssue>;
  /** Subtareas directas por id de la tarea padre. */
  kids: Map<string, BoardIssue[]>;
  companyById: Map<string, BoardCompany>;
  projectById: Map<string, { id: string; name: string; color: string | null; companyId: string }>;
  agentById: Map<string, { id: string; name: string; companyId: string }>;
  waiting: Map<string, Waiting>;
  /** Alguna empresa devolvió el feed del Inbox. Si no, «Te toca» no está disponible (§4.4). */
  tocaAvailable: boolean;
  /** Tareas recién creadas (JST-333): van primeras en su grupo hasta que se actualiza el board. */
  fresh?: ReadonlySet<string>;
}

export function toBoardCompany(
  id: string,
  name: string,
  issuePrefix: string | null,
  brandColor: string | null,
  paletteKey: string | null = null,
): BoardCompany {
  const prefix = (issuePrefix ?? name).toUpperCase();
  return { id, name, prefix, brandColor: brandColor || null, paletteKey };
}

/**
 * `paletteKeys` sale de la lista completa de empresas. Por defecto se calcula
 * con las que respondieron.
 */
export function buildBoardIndex(
  boards: readonly CompanyBoard[],
  paletteKeys: ReadonlyMap<string, string> = companyPaletteKeys(boards.map((board) => ({ id: board.companyId, name: board.name }))),
): BoardIndex {
  const sorted = [...boards].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const index: BoardIndex = {
    companies: [],
    issues: [],
    byId: new Map(),
    kids: new Map(),
    companyById: new Map(),
    projectById: new Map(),
    agentById: new Map(),
    waiting: new Map(),
    tocaAvailable: boards.some((board) => board.attention !== null),
  };
  for (const board of sorted) {
    const company = toBoardCompany(
      board.companyId,
      board.name,
      board.issuePrefix,
      board.brandColor,
      paletteKeys.get(board.companyId) ?? null,
    );
    index.companies.push(company);
    index.companyById.set(company.id, company);
    for (const project of board.projects) index.projectById.set(project.id, { ...project, companyId: board.companyId });
    for (const agent of board.agents) index.agentById.set(agent.id, { ...agent, companyId: board.companyId });
    for (const issue of board.issues) {
      index.issues.push(issue);
      index.byId.set(issue.id, issue);
    }
    for (const [issueId, waiting] of waitingFromAttention(board.attention ?? [])) index.waiting.set(issueId, waiting);
  }
  for (const issue of index.issues) {
    if (!issue.parentId || !index.byId.has(issue.parentId)) continue;
    const siblings = index.kids.get(issue.parentId);
    if (siblings) siblings.push(issue);
    else index.kids.set(issue.parentId, [issue]);
  }
  for (const issueId of [...index.waiting.keys()]) if (!index.byId.has(issueId)) index.waiting.delete(issueId);
  return index;
}

export function assigneeKey(issue: BoardIssue): string {
  if (issue.assigneeAgentId) return `agent:${issue.assigneeAgentId}`;
  if (issue.assigneeUserId) return `user:${issue.assigneeUserId}`;
  return UNASSIGNED;
}

/** En `local_trusted` el usuario del board es `local-board`; el SDK no expone nombres de personas. */
export function userLabel(userId: string): string {
  return userId === "local-board" ? t("Board") : t("Persona {id}", { id: userId.slice(0, 8) });
}

export function assigneeLabel(index: BoardIndex, key: string): string {
  if (key === UNASSIGNED) return t("Sin asignar");
  if (key.startsWith("agent:")) return index.agentById.get(key.slice("agent:".length))?.name ?? t("Agente desconocido");
  return userLabel(key.slice("user:".length));
}

export function projectLabel(index: BoardIndex, projectId: string | null): string {
  if (!projectId || projectId === NO_PROJECT) return t("Sin proyecto");
  return index.projectById.get(projectId)?.name ?? t("Proyecto desconocido");
}

/** Ruta de la tarea en su empresa. Va en un `href` normal: la navegación del host antepone la empresa activa. */
export function issueHref(index: BoardIndex, issue: BoardIssue): string {
  const prefix = index.companyById.get(issue.companyId)?.prefix ?? "";
  return `/${prefix}/issues/${encodeURIComponent(issue.identifier ?? issue.id)}`;
}

export function compareIdentifiers(a: BoardIssue, b: BoardIssue): number {
  return (a.identifier ?? a.id).localeCompare(b.identifier ?? b.id, "es", { numeric: true });
}

// ---------------------------------------------------------------------------
// Árbol de subtareas (parentId)
// ---------------------------------------------------------------------------

export function childrenOf(index: BoardIndex, issue: BoardIssue): BoardIssue[] {
  return index.kids.get(issue.id) ?? [];
}

export function ancestorsOf(index: BoardIndex, issue: BoardIssue): BoardIssue[] {
  const out: BoardIssue[] = [];
  const seen = new Set([issue.id]);
  let parent = issue.parentId ? index.byId.get(issue.parentId) : undefined;
  while (parent && !seen.has(parent.id)) {
    out.unshift(parent);
    seen.add(parent.id);
    parent = parent.parentId ? index.byId.get(parent.parentId) : undefined;
  }
  return out;
}

/** Como en Jira: subtareas directas hechas sobre el total. Las canceladas no cuentan. */
export function progressOf(index: BoardIndex, issue: BoardIssue): { done: number; total: number } {
  const kids = childrenOf(index, issue).filter((kid) => kid.status !== "cancelled");
  return { done: kids.filter((kid) => kid.status === "done").length, total: kids.length };
}

const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** Orden de las subtareas: abiertas, las que te tocan, prioridad e ID. */
export function sortSubtasks(index: BoardIndex, issues: readonly BoardIssue[]): BoardIssue[] {
  return [...issues].sort(
    (a, b) =>
      Number(!isOpenStatus(a.status)) - Number(!isOpenStatus(b.status)) ||
      Number(index.waiting.has(b.id)) - Number(index.waiting.has(a.id)) ||
      (PRIORITY_RANK[a.priority] ?? 4) - (PRIORITY_RANK[b.priority] ?? 4) ||
      compareIdentifiers(a, b),
  );
}

// ---------------------------------------------------------------------------
// Dependencias de «Te toca»
// ---------------------------------------------------------------------------

/**
 * Suma a `blockerIds` los bloqueadores sin resolver de `blockedBy`.
 * `blockerAttention` solo trae IDs en las tareas Bloqueadas: una en Backlog que
 * espera a otra llegaba sin bloqueadores y no se contaba (JST-19).
 */
export function withBlockedBy(issues: readonly BoardIssue[], rows: readonly IssueBlockedBy[]): BoardIssue[] {
  const extra = new Map(
    rows.map((row) => [
      row.id,
      row.blockedBy.filter((blocker) => blocker.status !== "done" && blocker.status !== "cancelled").map((blocker) => blocker.id),
    ]),
  );
  return issues.map((issue) => {
    const ids = extra.get(issue.id);
    if (!ids?.length) return issue;
    return { ...issue, blockerIds: [...new Set([...issue.blockerIds, ...ids])].filter((id) => id !== issue.id) };
  });
}

/** Tarea que espera tu respuesta y bloquea a esta, siguiendo la cadena de bloqueos. */
export function waitBlockerOf(index: BoardIndex, issue: BoardIssue): BoardIssue | null {
  if (!isOpenStatus(issue.status) || index.waiting.has(issue.id)) return null;
  const queue = [...issue.blockerIds];
  const seen = new Set([issue.id]);
  while (queue.length > 0 && seen.size <= 12) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const blocker = index.byId.get(id);
    if (!blocker) continue;
    if (index.waiting.has(id)) return blocker;
    queue.push(...blocker.blockerIds);
  }
  return null;
}

/** Tareas abiertas que se desbloquean al responder (todas, o solo las de `waitingIssues`). */
export function dependentsOf(index: BoardIndex, waitingIssues?: readonly BoardIssue[]): BoardIssue[] {
  const waitingIds = waitingIssues ? new Set(waitingIssues.map((issue) => issue.id)) : null;
  return index.issues.filter((issue) => {
    const blocker = waitBlockerOf(index, issue);
    return blocker !== null && (!waitingIds || waitingIds.has(blocker.id));
  });
}

// ---------------------------------------------------------------------------
// Filtrado y orden
// ---------------------------------------------------------------------------

export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Mínimo de caracteres para que la búsqueda encuentre por empresa: `el` no trae todo El Molino. */
export const COMPANY_SEARCH_MIN = 3;

/**
 * La búsqueda encuentra a la empresa si su nombre, alguna palabra del nombre o su prefijo
 * empieza con el texto, sin tildes ni mayúsculas (JST-60). Nunca «contiene»: `corp` no trae Betacorp.
 */
export function companyMatchesQuery(company: BoardCompany | undefined, query: string): boolean {
  const q = normalizeText(query.trim());
  if (!company || q.length < COMPANY_SEARCH_MIN) return false;
  const name = normalizeText(company.name.trim());
  return name.startsWith(q) || name.split(/\s+/).some((word) => word.startsWith(q)) || normalizeText(company.prefix).startsWith(q);
}

/** Valores de la tarea en una dimensión de filtro (una tarea puede tener varias etiquetas). */
export function dimValues(index: BoardIndex, issue: BoardIssue, dim: FilterDim): string[] {
  switch (dim) {
    case "emp":
      return [index.companyById.get(issue.companyId)?.prefix ?? ""];
    case "prj":
      return [issue.projectId ?? NO_PROJECT];
    case "est":
      return [issue.status];
    case "resp":
      return [assigneeKey(issue)];
    case "pri":
      return [issue.priority];
    case "eti":
      return issue.labels.map((label) => label.name);
  }
}

export type FilterKey = FilterDim | "q" | "toca" | "act";

/** Actualizada dentro del rango, contado hacia atrás desde `now`. */
export function updatedWithin(issue: BoardIssue, range: DateRange, now: number): boolean {
  return Date.parse(issue.updatedAt) >= now - DATE_RANGE_MS[range];
}

/**
 * Dentro de un filtro los valores se combinan con O; entre filtros, con Y. `except` ignora uno.
 * `now` es el ahora del filtro de fecha: se recalcula cada vez que se pinta.
 */
export function matchesFilters(
  index: BoardIndex,
  issue: BoardIssue,
  filters: BoardFilters,
  except?: FilterKey,
  now: number = Date.now(),
): boolean {
  for (const dim of FILTER_DIMS) {
    const selected = filters[dim] as readonly string[];
    if (dim === except || selected.length === 0) continue;
    if (!dimValues(index, issue, dim).some((value) => selected.includes(value))) return false;
  }
  if (except !== "toca" && filters.toca && index.tocaAvailable && !index.waiting.has(issue.id)) return false;
  if (except !== "act" && filters.act && !updatedWithin(issue, filters.act, now)) return false;
  const q = except === "q" ? "" : normalizeText(filters.q.trim());
  if (
    q &&
    !normalizeText(`${issue.identifier ?? ""} ${issue.title}`).includes(q) &&
    !companyMatchesQuery(index.companyById.get(issue.companyId), q)
  ) {
    return false;
  }
  return true;
}

export function filterIssues(index: BoardIndex, filters: BoardFilters, except?: FilterKey, now: number = Date.now()): BoardIssue[] {
  return index.issues.filter((issue) => matchesFilters(index, issue, filters, except, now));
}

/** Orden de cada grupo (§5): lo que te toca, prioridad, padres antes que sueltas y lo más reciente. */
export function sortIssues(index: BoardIndex, issues: readonly BoardIssue[]): BoardIssue[] {
  return [...issues].sort(
    (a, b) =>
      Number(index.fresh?.has(b.id) ?? false) - Number(index.fresh?.has(a.id) ?? false) ||
      Number(index.waiting.has(b.id)) - Number(index.waiting.has(a.id)) ||
      (PRIORITY_RANK[a.priority] ?? 4) - (PRIORITY_RANK[b.priority] ?? 4) ||
      Number(index.kids.has(b.id)) - Number(index.kids.has(a.id)) ||
      b.updatedAt.localeCompare(a.updatedAt),
  );
}

/** Conteo facetado: cuántas tareas hay por valor con el resto de los filtros. */
export function facetCounts(index: BoardIndex, filters: BoardFilters, dim: FilterDim, now: number = Date.now()): Map<string, number> {
  const counts = new Map<string, number>();
  for (const issue of filterIssues(index, filters, dim, now)) {
    for (const value of dimValues(index, issue, dim)) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

/** Conteo facetado del filtro de fecha: «Cualquier fecha» y cada rango, con el resto de los filtros. */
export function dateCounts(index: BoardIndex, filters: BoardFilters, now: number = Date.now()): { any: number } & Record<DateRange, number> {
  const base = filterIssues(index, filters, "act", now);
  const counts = { any: base.length } as { any: number } & Record<DateRange, number>;
  for (const range of DATE_RANGES) counts[range] = base.filter((issue) => updatedWithin(issue, range, now)).length;
  return counts;
}

/** Columnas del Board sin filtro de estado: el Backlog tiene su propia vista (JST-407). */
export const BOARD_STATUSES = ["todo", "in_progress", "in_review", "blocked"] as const satisfies readonly IssueStatus[];
/** Lo que lista la vista Backlog: lo que espera entrar y, arriba, lo que ya está en «Por hacer». */
export const BACKLOG_STATUSES = ["todo", "backlog"] as const satisfies readonly IssueStatus[];

/** Columnas del kanban: las del filtro de estado o, si no hay, las del Board (más las cerradas con `cerr=1`). */
export function kanbanStatuses(filters: BoardFilters, showClosed: boolean): readonly IssueStatus[] {
  if (filters.est.length > 0) return ISSUE_STATUSES.filter((status) => filters.est.includes(status));
  return showClosed ? ISSUE_STATUSES.filter((status) => status !== "backlog") : BOARD_STATUSES;
}

/** Estados que muestra cada vista: las columnas del Board, lo del Backlog o todo. */
function viewStatuses(query: Pick<BoardQuery, "view" | "filters" | "showClosed">): readonly IssueStatus[] {
  if (query.view === "kanban") return kanbanStatuses(query.filters, query.showClosed);
  if (query.view === "backlog") return BACKLOG_STATUSES;
  return ISSUE_STATUSES;
}

/** Lo que muestra una consulta: en el Board, solo las tareas de las columnas visibles; en el Backlog, las suyas. */
export function visibleIssues(
  index: BoardIndex,
  query: Pick<BoardQuery, "view" | "filters" | "showClosed">,
  now: number = Date.now(),
): BoardIssue[] {
  const issues = filterIssues(index, query.filters, undefined, now);
  if (query.view !== "kanban" && query.view !== "backlog") return issues;
  const statuses = viewStatuses(query);
  return issues.filter((issue) => statuses.includes(issue.status));
}

/**
 * Sugerencias del estado vacío (§4.3): cuántas tareas aparecen al quitar cada filtro.
 * Con `layout` en kanban solo cuentan las de las columnas visibles: sin `cerr=1`,
 * Hecha y Cancelada quedan en el riel.
 */
export function relaxSuggestions(
  index: BoardIndex,
  filters: BoardFilters,
  layout?: Pick<BoardQuery, "view" | "showClosed">,
  now: number = Date.now(),
): Array<{ key: FilterKey; count: number }> {
  const keys: FilterKey[] = [...FILTER_DIMS.filter((dim) => filters[dim].length > 0)];
  if (filters.q.trim()) keys.push("q");
  if (filters.toca && index.tocaAvailable) keys.push("toca");
  if (filters.act) keys.push("act");
  return keys
    .map((key) => {
      const columns = layout ? viewStatuses({ ...layout, filters: clearFilter(filters, key) }) : ISSUE_STATUSES;
      return { key, count: filterIssues(index, filters, key, now).filter((issue) => columns.includes(issue.status)).length };
    })
    .filter((suggestion) => suggestion.count > 0);
}

export function clearFilter(filters: BoardFilters, key: FilterKey): BoardFilters {
  if (key === "q") return { ...filters, q: "" };
  if (key === "toca") return { ...filters, toca: false };
  if (key === "act") return { ...filters, act: null };
  return { ...filters, [key]: [] };
}

export function toggleValue(filters: BoardFilters, dim: FilterDim, value: string): BoardFilters {
  const current = filters[dim] as readonly string[];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return { ...filters, [dim]: next };
}

// ---------------------------------------------------------------------------
// Filtros rápidos (JST-407)
// ---------------------------------------------------------------------------

/** «Críticas y altas»: el filtro de prioridad con exactamente esas dos. */
export const HOT_PRIORITIES = ["critical", "high"] as const satisfies readonly IssuePriority[];

export function isHotFilter(filters: BoardFilters): boolean {
  return filters.pri.length === HOT_PRIORITIES.length && HOT_PRIORITIES.every((priority) => filters.pri.includes(priority));
}

// ---------------------------------------------------------------------------
// Lista: grupos y árbol (§3.11)
// ---------------------------------------------------------------------------

export interface IssueGroup {
  key: string;
  label: string;
  /** Empresa del grupo (empresa, proyecto o agente), para su etiqueta. */
  companyId: string | null;
  issues: BoardIssue[];
}

function groupKey(issue: BoardIssue, groupBy: GroupBy): string {
  switch (groupBy) {
    case "empresa":
      return issue.companyId;
    case "proyecto":
      return issue.projectId ?? NO_PROJECT;
    case "responsable":
      return assigneeKey(issue);
    case "estado":
      return issue.status;
    case "prioridad":
      return issue.priority;
  }
}

/** Agrupa tareas ya ordenadas; el orden dentro de cada grupo se conserva. */
export function groupIssues(
  index: BoardIndex,
  issues: readonly BoardIssue[],
  groupBy: GroupBy,
  labels: { status: Record<string, string>; priority: Record<string, string> },
): IssueGroup[] {
  const groups = new Map<string, IssueGroup>();
  for (const issue of issues) {
    const key = groupKey(issue, groupBy);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: key, companyId: null, issues: [] };
      switch (groupBy) {
        case "empresa":
          group.label = index.companyById.get(key)?.name ?? key;
          group.companyId = key;
          break;
        case "proyecto":
          group.label = projectLabel(index, key);
          group.companyId = index.projectById.get(key)?.companyId ?? issue.companyId;
          break;
        case "responsable":
          group.label = assigneeLabel(index, key);
          group.companyId = key.startsWith("agent:") ? (index.agentById.get(key.slice(6))?.companyId ?? null) : null;
          break;
        case "estado":
          group.label = labels.status[key] ?? key;
          break;
        case "prioridad":
          group.label = labels.priority[key] ?? key;
          break;
      }
      groups.set(key, group);
    }
    group.issues.push(issue);
  }

  const list = [...groups.values()];
  const companyOrder = (id: string | null) => {
    const position = id ? index.companies.findIndex((c) => c.id === id) : -1;
    return position === -1 ? index.companies.length : position;
  };
  const isEmptyKey = (key: string) => key === NO_PROJECT || key === UNASSIGNED;
  switch (groupBy) {
    case "estado":
      return list.sort((a, b) => ISSUE_STATUSES.indexOf(a.key as IssueStatus) - ISSUE_STATUSES.indexOf(b.key as IssueStatus));
    case "prioridad":
      return list.sort(
        (a, b) => ISSUE_PRIORITIES.indexOf(a.key as IssuePriority) - ISSUE_PRIORITIES.indexOf(b.key as IssuePriority),
      );
    case "empresa":
      return list.sort((a, b) => companyOrder(a.key) - companyOrder(b.key));
    default:
      // Proyecto y responsable: por empresa y nombre; "Sin proyecto"/"Sin asignar" al final.
      return list.sort(
        (a, b) =>
          Number(isEmptyKey(a.key)) - Number(isEmptyKey(b.key)) ||
          companyOrder(a.companyId) - companyOrder(b.companyId) ||
          a.label.localeCompare(b.label, "es"),
      );
  }
}

// ---------------------------------------------------------------------------
// Kanban con carriles (Fase 2, design-spec §4 de JST-21)
// ---------------------------------------------------------------------------

/** Carril de la tarea: con carriles, arrastrar solo cambia el estado dentro del mismo carril (§4.4). */
export function laneKeyOf(issue: BoardIssue, laneBy: LaneBy): string {
  return groupKey(issue, laneBy);
}

/**
 * «Por confirmar» (JST-407): columna del Board que no es un estado de Paperclip.
 * Junta las tareas cerradas que esperan el visto bueno de la persona (`confirm.ts`).
 */
export const CONFIRM_COLUMN = "confirm";
export type BoardColumn = IssueStatus | typeof CONFIRM_COLUMN;

/** Columna de la tarea: su estado, salvo las cerradas que esperan confirmación. */
export function columnOf(issue: BoardIssue, pending?: ReadonlySet<string>): BoardColumn {
  return pending?.has(issue.id) ? CONFIRM_COLUMN : issue.status;
}

/**
 * Columnas del Board: los estados de `kanbanStatuses` y, sin filtro de estado,
 * «Por confirmar» después de la última columna abierta.
 */
export function boardColumns(filters: BoardFilters, showClosed: boolean, withConfirm: boolean): BoardColumn[] {
  const statuses = kanbanStatuses(filters, showClosed);
  if (!withConfirm || filters.est.length > 0) return [...statuses];
  const open = statuses.filter(isOpenStatus);
  return [...open, CONFIRM_COLUMN, ...statuses.filter((status) => !isOpenStatus(status))];
}

export interface KanbanLane {
  key: string;
  label: string;
  /** Empresa del carril (empresa, proyecto o agente), para su color. */
  companyId: string | null;
  /** Tareas del carril en las columnas visibles. */
  total: number;
  /** Una celda por columna, en el orden de `columns`, ordenada como cada grupo (§5). */
  cells: Array<{ status: BoardColumn; issues: BoardIssue[] }>;
}

/** Celdas de un carril. En «Por confirmar», lo cerrado más recientemente va primero. */
function laneCells(
  index: BoardIndex,
  issues: readonly BoardIssue[],
  columns: readonly BoardColumn[],
  pending?: ReadonlySet<string>,
): KanbanLane["cells"] {
  return columns.map((column) => {
    const inColumn = issues.filter((issue) => columnOf(issue, pending) === column);
    return {
      status: column,
      issues:
        column === CONFIRM_COLUMN
          ? [...inColumn].sort((a, b) => (b.closedAt ?? b.updatedAt).localeCompare(a.closedAt ?? a.updatedAt))
          : sortIssues(index, inColumn),
    };
  });
}

/**
 * Carriles × columnas. Los carriles salen de `groupIssues`, así que van en el
 * mismo orden que los grupos de la lista. Un carril sin tareas en las columnas
 * visibles no aparece. `pending` son las tareas de «Por confirmar».
 */
export function kanbanLanes(
  index: BoardIndex,
  issues: readonly BoardIssue[],
  laneBy: LaneBy,
  columns: readonly BoardColumn[],
  pending?: ReadonlySet<string>,
): KanbanLane[] {
  const visible = issues.filter((issue) => columns.includes(columnOf(issue, pending)));
  // «Sin proyecto» y «Sin asignar» juntan empresas: solo llevan color si todas sus tareas son de una.
  const soleCompany = (lane: readonly BoardIssue[]) => {
    const companies = new Set(lane.map((issue) => issue.companyId));
    return companies.size === 1 ? [...companies][0] : null;
  };
  return groupIssues(index, visible, laneBy, { status: {}, priority: {} }).map((group) => ({
    key: group.key,
    label: group.label,
    companyId: group.key === NO_PROJECT || group.key === UNASSIGNED ? soleCompany(group.issues) : group.companyId,
    total: group.issues.length,
    cells: laneCells(index, group.issues, columns, pending),
  }));
}

/** Clave del único carril del Board sin agrupar. */
export const FLAT_LANE = "all";

/** Board sin agrupar: un solo carril con todas las tareas de las columnas visibles. */
export function kanbanFlat(
  index: BoardIndex,
  issues: readonly BoardIssue[],
  columns: readonly BoardColumn[],
  pending?: ReadonlySet<string>,
): KanbanLane[] {
  const visible = issues.filter((issue) => columns.includes(columnOf(issue, pending)));
  return [{ key: FLAT_LANE, label: "", companyId: null, total: visible.length, cells: laneCells(index, visible, columns, pending) }];
}

/**
 * Carriles que no se muestran porque no tienen tareas en las columnas visibles
 * (nota al pie, §4.2): empresas del filtro, o proyectos y agentes de esas empresas.
 * «Sin proyecto», «Sin asignar» y las personas no cuentan.
 */
export function hiddenLaneCount(index: BoardIndex, lanes: readonly KanbanLane[], laneBy: LaneBy, companies: readonly string[]): number {
  const scope = new Set(
    index.companies.filter((company) => companies.length === 0 || companies.includes(company.prefix)).map((company) => company.id),
  );
  const shown = new Set(lanes.map((lane) => lane.key));
  const universe =
    laneBy === "empresa"
      ? [...scope]
      : laneBy === "proyecto"
        ? [...index.projectById.values()].filter((project) => scope.has(project.companyId)).map((project) => project.id)
        : [...index.agentById.values()].filter((agent) => scope.has(agent.companyId)).map((agent) => `agent:${agent.id}`);
  return universe.filter((key) => !shown.has(key)).length;
}

export interface TreeRow {
  issue: BoardIssue;
  depth: number;
  /** Subtareas visibles bajo esta fila. */
  kidCount: number;
  /** Ancestro que no cumple los filtros: se muestra atenuado como contexto. */
  context: boolean;
  open: boolean;
  /** Último hijo de su padre (para los conectores). */
  last: boolean;
  /** `rails[L]`: seguir la línea vertical del nivel L. */
  rails: boolean[];
}

/**
 * Reparte un grupo de la lista (§3.11). Al árbol van las abiertas, sus ancestros
 * del grupo aunque estén cerrados (así no se repiten al final) y las cerradas que
 * cuelgan de un padre abierto o del árbol. Las demás hechas y canceladas van al
 * final, sin árbol.
 */
export function splitTree(index: BoardIndex, issues: readonly BoardIssue[]): { tree: BoardIssue[]; flat: BoardIssue[] } {
  const inGroup = new Set(issues.map((issue) => issue.id));
  const anchored = new Set<string>();
  for (const issue of issues) {
    if (!isOpenStatus(issue.status)) continue;
    anchored.add(issue.id);
    for (const ancestor of ancestorsOf(index, issue)) if (inGroup.has(ancestor.id)) anchored.add(ancestor.id);
  }
  // Sube por los padres cerrados del grupo hasta dar con uno abierto o del árbol.
  const hangs = (issue: BoardIssue): boolean => {
    for (const ancestor of ancestorsOf(index, issue).reverse()) {
      if (isOpenStatus(ancestor.status) || anchored.has(ancestor.id)) return true;
      if (!inGroup.has(ancestor.id)) return false;
    }
    return false;
  };
  const tree: BoardIssue[] = [];
  const flat: BoardIssue[] = [];
  for (const issue of issues) (anchored.has(issue.id) || hangs(issue) ? tree : flat).push(issue);
  return { tree, flat };
}

/**
 * Filas en orden de árbol: cada tarea con sus ancestros como contexto (atenuados
 * si no cumplen los filtros). `closed` son las tareas con las subtareas plegadas.
 */
export function treeRows(index: BoardIndex, issues: readonly BoardIssue[], closed: ReadonlySet<string>): TreeRow[] {
  const inList = new Set(issues.map((issue) => issue.id));
  const shown = new Set(inList);
  for (const issue of issues) for (const ancestor of ancestorsOf(index, issue)) shown.add(ancestor.id);
  const subtreeWaits = (issue: BoardIssue): boolean =>
    index.waiting.has(issue.id) || childrenOf(index, issue).some(subtreeWaits);
  const roots = [...shown]
    .map((id) => index.byId.get(id)!)
    .filter((issue) => !(issue.parentId && shown.has(issue.parentId)))
    .sort(
      (a, b) =>
        Number(index.kids.has(b.id)) - Number(index.kids.has(a.id)) ||
        Number(subtreeWaits(b)) - Number(subtreeWaits(a)) ||
        (PRIORITY_RANK[a.priority] ?? 4) - (PRIORITY_RANK[b.priority] ?? 4) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
  const rows: TreeRow[] = [];
  const walk = (issue: BoardIssue, depth: number, last: boolean, rails: boolean[]) => {
    const kids = sortSubtasks(index, childrenOf(index, issue).filter((kid) => shown.has(kid.id)));
    const open = !closed.has(issue.id);
    rows.push({ issue, depth, kidCount: kids.length, context: !inList.has(issue.id), open, last, rails });
    const childRails = depth >= 1 ? [...rails, !last] : [];
    if (open) kids.forEach((kid, i) => walk(kid, depth + 1, i === kids.length - 1, childRails));
  };
  for (const root of roots) walk(root, 0, true, []);
  return rows;
}

/**
 * Tareas recién creadas («Nueva»): van primero en su grupo de la Lista y fuera del
 * límite de filas, aunque el árbol las ponga después (JST-341). Solo se fijan las que
 * no cuelgan de otra ni tienen subtareas: una tarea con jerarquía conserva su lugar.
 */
export function pinFreshRows<T extends { issue: BoardIssue; tree: Pick<TreeRow, "depth" | "kidCount"> | null }>(
  rows: readonly T[],
  fresh: ReadonlySet<string> | undefined,
): { pinned: T[]; rest: T[] } {
  if (!fresh || fresh.size === 0) return { pinned: [], rest: [...rows] };
  const pinned: T[] = [];
  const rest: T[] = [];
  for (const row of rows) {
    const loose = !row.tree || (row.tree.depth === 0 && row.tree.kidCount === 0);
    (fresh.has(row.issue.id) && loose ? pinned : rest).push(row);
  }
  pinned.sort((a, b) => b.issue.updatedAt.localeCompare(a.issue.updatedAt));
  return { pinned, rest };
}

// ---------------------------------------------------------------------------
// Utilidades de presentación
// ---------------------------------------------------------------------------

export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  const at = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(at)) return "";
  const minutes = Math.max(1, Math.round((now - at) / 60_000));
  if (minutes < 60) return t("hace {n} min", { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("hace {n} h", { n: hours });
  const days = Math.round(hours / 24);
  if (days < 30) return t("hace {n} d", { n: days });
  return new Date(at).toLocaleDateString(localeTag(), { day: "numeric", month: "short" });
}
