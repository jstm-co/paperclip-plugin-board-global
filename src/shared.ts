// Tipos y constantes compartidos entre el worker y la UI (sin dependencias de runtime).

export const PLUGIN_KEY = "jstm.board-global";

/** Segmento de ruta de la página: `/:companyPrefix/board-global`. */
export const PAGE_ROUTE = "board-global";

/** Segmento de ruta del Dashboard global: `/:companyPrefix/dashboard-global`. */
export const DASHBOARD_ROUTE = "dashboard-global";

export const ISSUE_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/** Estados abiertos: las columnas del kanban por defecto. */
export const OPEN_STATUSES = ["backlog", "todo", "in_progress", "in_review", "blocked"] as const satisfies readonly IssueStatus[];

export function isOpenStatus(status: IssueStatus): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(status);
}

/** De mayor a menor, igual que el orden del núcleo. */
export const ISSUE_PRIORITIES = ["critical", "high", "medium", "low"] as const;

export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

/**
 * Tareas de **una** empresa. El host limita cada invocación del worker a una
 * empresa (`companyId` autorizado por el bridge), así que la UI las pide
 * empresa por empresa y las junta.
 */
export const DATA_COMPANY_ISSUES = "company-issues";

/**
 * Vistas guardadas (Fase 2, JST-21 §3.10 y §6): se leen con un dato y se
 * escriben con una acción por operación. Viven en `ctx.state` de alcance
 * `instance`, así que no dependen de la empresa con que se invoque al worker.
 */
export const DATA_SAVED_VIEWS = "saved-views";
export const VIEW_ACTIONS = {
  create: "view-create",
  rename: "view-rename",
  update: "view-update",
  delete: "view-delete",
} as const;

export interface BoardLabel {
  id: string;
  name: string;
  color: string;
}

/** Solo los campos que usa el board (la fila completa de la tarea pesa mucho más). */
export interface BoardIssue {
  id: string;
  companyId: string;
  identifier: string | null;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  projectId: string | null;
  /** Tarea padre (árbol de subtareas). */
  parentId: string | null;
  assigneeAgentId: string | null;
  assigneeUserId: string | null;
  labels: BoardLabel[];
  /**
   * Bloqueadores sin resolver. El worker trae los de `blockerAttention` (el
   * directo y el final de la cadena, solo en las Bloqueadas) y la UI suma los de
   * `blockedBy` (`withBlockedBy`). Sirve para «Espera tu respuesta en…».
   */
  blockerIds: string[];
  /** Fecha de creación: el gráfico «Tareas por estado» del Dashboard cuenta por día de creación. */
  createdAt: string;
  updatedAt: string;
}

export interface BoardProject {
  id: string;
  name: string;
  color: string | null;
}

export interface BoardAgent {
  id: string;
  name: string;
}

/** Respuesta del worker para una empresa. */
export interface CompanyIssues {
  companyId: string;
  name: string;
  issuePrefix: string | null;
  brandColor: string | null;
  issues: BoardIssue[];
  elapsedMs: number;
}

/**
 * Ítem del feed del Inbox (`GET /api/companies/:id/attention`) con los campos
 * que usa «Te toca». El resto del ítem se ignora.
 */
export interface AttentionItem {
  sourceKind: string;
  subject?: { kind?: string; title?: string | null; href?: string | null; metadata?: { kind?: string } | null } | null;
  relatedIssue?: { id: string } | null;
  detail?: { kind?: string; blockedTaskCount?: number } | null;
  createdAt?: string | null;
}

/**
 * Bloqueadores de una tarea según `GET /api/companies/:id/issues?includeBlockedBy=true`.
 * El resto de la fila se ignora.
 */
export interface IssueBlockedBy {
  id: string;
  blockedBy: Array<{ id: string; status?: string }>;
}

/**
 * Board de una empresa: las tareas del worker más los nombres de proyectos y
 * agentes, que la UI lee de la API nativa para no pedir capacidades extra.
 * `attention` es `null` si el feed del Inbox no se pudo leer («Te toca» no
 * disponible).
 */
export interface CompanyBoard extends CompanyIssues {
  projects: BoardProject[];
  agents: BoardAgent[];
  attention: AttentionItem[] | null;
}

// ---------------------------------------------------------------------------
// Dashboard global: respuestas de la API nativa, con los campos que se usan
// ---------------------------------------------------------------------------

/** Runs de un día UTC (`runActivity` del resumen del Dashboard). */
export interface RunActivityDay {
  /** `YYYY-MM-DD` en UTC. */
  date: string;
  succeeded: number;
  /** Fallidos sin reintento exitoso. */
  failed: number;
  /** Fallidos cuyo reintento terminó bien. */
  recovered: number;
  other: number;
  total: number;
  failedByErrorCode: Record<string, number>;
}

/** `GET /api/companies/:id/dashboard`: los mismos datos que pinta el Dashboard nativo. */
export interface DashboardSummary {
  companyId: string;
  agents: { active: number; running: number; paused: number; error: number };
  tasks: { open: number; inProgress: number; blocked: number; done: number };
  /** `monthBudgetCents = 0` es presupuesto sin límite. */
  costs: { monthSpendCents: number; monthBudgetCents: number; monthUtilizationPercent: number };
  pendingApprovals: number;
  budgets: { activeIncidents: number; pendingApprovals: number; pausedAgents: number; pausedProjects: number };
  /** Los últimos 14 días UTC, del más antiguo al de hoy. */
  runActivity: RunActivityDay[];
}

/** Run de `GET /api/companies/:id/live-runs`: los activos y, si faltan, los más recientes. */
export interface LiveRun {
  id: string;
  companyId: string;
  /** `queued` y `running` son los activos. */
  status: string;
  invocationSource: string | null;
  agentId: string;
  agentName: string;
  issueId: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

/** Evento de `GET /api/companies/:id/activity`. */
export interface ActivityEvent {
  id: string;
  companyId: string;
  /** `agent`, `user` o `system`. */
  actorType: string;
  actorId: string;
  /** Por ejemplo `issue.updated`. El texto lo arma la UI. */
  action: string;
  entityType: string;
  entityId: string;
  agentId: string | null;
  runId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export function isIssueStatus(value: unknown): value is IssueStatus {
  return typeof value === "string" && (ISSUE_STATUSES as readonly string[]).includes(value);
}

export function isIssuePriority(value: unknown): value is IssuePriority {
  return typeof value === "string" && (ISSUE_PRIORITIES as readonly string[]).includes(value);
}
