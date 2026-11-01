// «+ Crear tarea» (JST-333 design-spec, opción A · En línea): lógica pura de los
// valores por defecto, la petición y el refresco. Sin React ni red, para
// probarla sola. La UI está en `ui/create.tsx` y el POST en `ui/bridge.ts`.
import { NO_PROJECT, type BoardFilters, type BoardIndex, type GroupBy } from "./board.js";
import type { BoardIssue, IssuePriority, IssueStatus } from "./shared.js";

/**
 * Columnas con «+» (§1). Las demás necesitan contexto que un título no trae:
 * se crea en Por hacer y se arrastra.
 */
export const CREATE_STATUSES = ["backlog", "todo", "in_progress"] as const satisfies readonly IssueStatus[];
export type CreateStatus = (typeof CREATE_STATUSES)[number];

export function canCreateIn(status: IssueStatus): status is CreateStatus {
  return (CREATE_STATUSES as readonly string[]).includes(status);
}

export type CreateSurface = "column" | "cell" | "group" | "head";

/** Dónde se abrió el compositor: de ahí salen los valores por defecto. */
export interface CreateOrigin {
  surface: CreateSurface;
  status: IssueStatus;
  /** Carril (`cell`) o grupo (`group`): su dimensión y su clave. */
  by?: GroupBy;
  key?: string;
}

export function originKey(origin: CreateOrigin): string {
  return [origin.surface, origin.status, origin.by ?? "", origin.key ?? ""].join("|");
}

export type Assignee = { kind: "agent"; id: string } | { kind: "user"; id: string };

/** De dónde vino un valor por defecto: el icono de embudo del chip lo dice. */
export type FromSource = "filtro" | "carril" | "grupo";

export interface CreateDraft {
  title: string;
  /** `null`: no se adivina ni se recuerda la última (§4). */
  companyId: string | null;
  status: CreateStatus;
  priority: IssuePriority;
  projectId: string | null;
  assignee: Assignee | null;
  from: { company?: FromSource; project?: FromSource; assignee?: FromSource; priority?: FromSource };
}

export interface DefaultsContext {
  index: BoardIndex;
  filters: BoardFilters;
  /** `userId` de la sesión (`useHostContext()`), para «Yo». */
  userId: string | null;
}

const PRIORITIES: readonly string[] = ["critical", "high", "medium", "low"];

/** Valores por defecto al abrir (§4): gana el primero de cada fila de la tabla. */
export function defaultDraft(origin: CreateOrigin, ctx: DefaultsContext, title = ""): CreateDraft {
  const { index, filters } = ctx;
  const { by, key } = origin;
  const source: FromSource = origin.surface === "cell" ? "carril" : "grupo";
  const from: CreateDraft["from"] = {};

  let status: CreateStatus = canCreateIn(origin.status) ? origin.status : "todo";
  if (by === "estado" && key && canCreateIn(key as IssueStatus)) status = key as CreateStatus;

  let companyId: string | null = null;
  if (by === "empresa" && key && index.companyById.has(key)) companyId = key;
  else if (by === "proyecto" && key && key !== NO_PROJECT) companyId = index.projectById.get(key)?.companyId ?? null;
  else if (by === "responsable" && key?.startsWith("agent:")) companyId = index.agentById.get(key.slice(6))?.companyId ?? null;
  if (companyId) from.company = source;
  else if (filters.emp.length === 1) {
    companyId = index.companies.find((company) => company.prefix === filters.emp[0])?.id ?? null;
    if (companyId) from.company = "filtro";
  }

  let projectId: string | null = null;
  if (by === "proyecto" && key && key !== NO_PROJECT && index.projectById.has(key)) {
    projectId = key;
    from.project = source;
  } else if (filters.prj.length === 1 && filters.prj[0] !== NO_PROJECT && companyId) {
    const project = index.projectById.get(filters.prj[0]!);
    if (project && project.companyId === companyId) {
      projectId = project.id;
      from.project = "filtro";
    }
  }

  let assignee: Assignee | null = null;
  if (by === "responsable" && key?.startsWith("agent:") && index.agentById.has(key.slice(6))) {
    assignee = { kind: "agent", id: key.slice(6) };
    from.assignee = source;
  } else if (status === "in_progress" && ctx.userId) {
    assignee = { kind: "user", id: ctx.userId };
  }

  let priority: IssuePriority = "medium";
  if (by === "prioridad" && key && PRIORITIES.includes(key)) {
    priority = key as IssuePriority;
    from.priority = source;
  }

  return { title, companyId, status, priority, projectId, assignee, from };
}

/** Cambiar de empresa vacía el proyecto y el responsable si eran de la otra (§4). */
export function withCompany(draft: CreateDraft, companyId: string, index: BoardIndex): CreateDraft {
  const project = draft.projectId ? index.projectById.get(draft.projectId) : undefined;
  const agent = draft.assignee?.kind === "agent" ? index.agentById.get(draft.assignee.id) : undefined;
  const keepProject = project?.companyId === companyId;
  const keepAgent = agent?.companyId === companyId;
  return {
    ...draft,
    companyId,
    projectId: keepProject ? draft.projectId : null,
    assignee: draft.assignee?.kind === "agent" && !keepAgent ? null : draft.assignee,
    from: {
      ...draft.from,
      company: undefined,
      project: keepProject ? draft.from.project : undefined,
      assignee: draft.assignee?.kind === "agent" && !keepAgent ? undefined : draft.from.assignee,
    },
  };
}

/** En En curso sin responsable queda «Yo» (§5); al salir de En curso, «Yo» se queda. */
export function withStatus(draft: CreateDraft, status: CreateStatus, userId: string | null): CreateDraft {
  const needsSelf = status === "in_progress" && !draft.assignee && userId;
  return { ...draft, status, assignee: needsSelf ? { kind: "user", id: userId } : draft.assignee };
}

/** «Sin responsable»: en En curso vuelve a «Yo» (§5, «Quitar»). */
export function withoutAgent(draft: CreateDraft, userId: string | null): CreateDraft {
  const self: Assignee | null = draft.status === "in_progress" && userId ? { kind: "user", id: userId } : null;
  return { ...draft, assignee: self, from: { ...draft.from, assignee: undefined } };
}

/** Asignar a un agente lo despierta en todos los estados menos Backlog (spike JST-334). */
export function wakesAgent(draft: Pick<CreateDraft, "status" | "assignee">): boolean {
  return draft.assignee?.kind === "agent" && draft.status !== "backlog";
}

/**
 * Tras crear, el compositor sigue abierto para escribir otra (§6): se queda con
 * empresa, proyecto y prioridad, pero un agente vuelve a «Sin responsable» para
 * que un segundo Enter no despierte a otro sin querer.
 */
export function afterCreate(draft: CreateDraft, userId: string | null): CreateDraft {
  const next = draft.assignee?.kind === "agent" ? withoutAgent(draft, userId) : draft;
  return { ...next, title: "" };
}

export type DraftProblem = "company" | "title" | "assignee";

/** Lo que falta para poder enviar; `null` si el borrador está completo. */
export function draftProblem(draft: CreateDraft): DraftProblem | null {
  if (!draft.companyId) return "company";
  if (!draft.title.trim()) return "title";
  if (draft.status === "in_progress" && !draft.assignee) return "assignee";
  return null;
}

/** Los saltos de línea se mandan como espacios y el título va recortado (§7). */
export function normalizeTitle(title: string): string {
  return title.replace(/\s*[\r\n]+\s*/g, " ").trim();
}

export interface CreateRequest {
  companyId: string;
  body: {
    title: string;
    status: CreateStatus;
    priority: IssuePriority;
    projectId?: string;
    assigneeAgentId?: string;
    assigneeUserId?: string;
    idempotencyKey: string;
    allowDuplicate?: true;
  };
}

/** `POST /api/companies/:id/issues` (spike JST-334): la empresa y el estado salen de la columna. */
export function buildCreateRequest(draft: CreateDraft, opts: { idempotencyKey: string; allowDuplicate?: boolean }): CreateRequest {
  const problem = draftProblem(draft);
  if (problem || !draft.companyId) throw new Error(`Falta ${problem === "company" ? "la empresa" : problem === "title" ? "el título" : "el responsable"}`);
  const body: CreateRequest["body"] = {
    title: normalizeTitle(draft.title),
    status: draft.status,
    priority: draft.priority,
    idempotencyKey: opts.idempotencyKey,
  };
  if (draft.projectId) body.projectId = draft.projectId;
  if (draft.assignee?.kind === "agent") body.assigneeAgentId = draft.assignee.id;
  else if (draft.assignee?.kind === "user") body.assigneeUserId = draft.assignee.id;
  if (opts.allowDuplicate) body.allowDuplicate = true;
  return { companyId: draft.companyId, body };
}

/** La tarea que devuelve el POST (la fila completa; el board usa solo estos campos). */
export interface CreatedIssue {
  id: string;
  companyId: string;
  identifier?: string | null;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  projectId?: string | null;
  parentId?: string | null;
  assigneeAgentId?: string | null;
  assigneeUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** El servidor devolvió una tarea abierta con el mismo título de las últimas 48 h (spike JST-334 3c). */
  deduplicated?: boolean;
}

export function toBoardIssue(created: CreatedIssue, now: string = new Date().toISOString()): BoardIssue {
  return {
    id: created.id,
    companyId: created.companyId,
    identifier: created.identifier ?? null,
    title: created.title,
    status: created.status,
    priority: created.priority,
    projectId: created.projectId ?? null,
    parentId: created.parentId ?? null,
    assigneeAgentId: created.assigneeAgentId ?? null,
    assigneeUserId: created.assigneeUserId ?? null,
    labels: [],
    blockerIds: [],
    createdAt: created.createdAt ?? now,
    updatedAt: created.updatedAt ?? now,
  };
}

/** Inserta la tarea al instante, como `moveIssue`; si ya estaba, la reemplaza. */
export function insertIssue(issues: readonly BoardIssue[], issue: BoardIssue): BoardIssue[] {
  return issues.some((existing) => existing.id === issue.id)
    ? issues.map((existing) => (existing.id === issue.id ? issue : existing))
    : [issue, ...issues];
}

export type CreateOutcome = { kind: "created"; issue: BoardIssue } | { kind: "duplicate"; issue: BoardIssue };

/**
 * Envía y refresca (§7): con 201 inserta la tarea al instante y después
 * confirma con `retry(empresa)`, que recarga solo esa empresa. Con
 * `deduplicated` no inserta nada: la tarea que ya existía se marca. Un error
 * (4xx, 5xx o la red) se propaga y el compositor lo muestra sin perder nada.
 */
export async function submitCreate(
  request: CreateRequest,
  io: {
    create: (companyId: string, body: CreateRequest["body"]) => Promise<CreatedIssue>;
    insert: (issue: BoardIssue) => void;
    refresh: (companyId: string) => Promise<unknown>;
  },
): Promise<CreateOutcome> {
  const created = await io.create(request.companyId, request.body);
  const issue = toBoardIssue(created);
  if (created.deduplicated) return { kind: "duplicate", issue };
  io.insert(issue);
  // La inserción ya es visible: si la recarga falla, el board queda como está.
  await io.refresh(request.companyId).catch(() => undefined);
  return { kind: "created", issue };
}

/** Marca de una tarea recién creada o repetida (§7): vive en memoria hasta actualizar. */
export type NewMark = { kind: "new"; outside: boolean } | { kind: "dup" };
