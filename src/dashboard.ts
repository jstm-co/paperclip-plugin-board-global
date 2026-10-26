// Lógica del Dashboard global sin React: filtro de empresa en la URL, totales y
// aporte por empresa, comparativa, gráficos de 14 días, agentes en vivo y
// actividad y tareas recientes mezcladas. La usa la UI y la cubren las pruebas.
//
// Replica los cálculos del Dashboard nativo de Paperclip v2026.824.1 (página
// `Dashboard` de la UI y `services/dashboard.js` del servidor) para que los
// números coincidan con los de cada empresa:
// - Contadores y aviso de presupuesto: los valores del resumen
//   (`GET /companies/:id/dashboard`), con las mismas sumas que hace la UI.
// - «Actividad de runs» y «Tasa de éxito»: `runActivity` del resumen, por día
//   UTC. Tasa = (exitosos + recuperados) / total.
// - «Tareas por estado»: las tareas creadas en cada uno de los últimos 14 días,
//   contadas por su estado actual.
// - Actividad y tareas recientes: las 10 más nuevas.
import { readList, readParams, userLabel, type BoardCompany } from "./board.js";
import {
  isIssuePriority,
  isIssueStatus,
  type ActivityEvent,
  type BoardAgent,
  type BoardIssue,
  type BoardProject,
  type DashboardSummary,
  type IssuePriority,
  type IssueStatus,
  type LiveRun,
  type RunActivityDay,
} from "./shared.js";

/** Días de los gráficos. */
export const CHART_DAYS = 14;
/** Filas de «Actividad reciente» y «Tareas recientes». */
export const RECENT_LIMIT = 10;

// ---------------------------------------------------------------------------
// Estado en la URL: filtro de empresa (`?emp=BET,JST`, igual que el Board
// global) y orden de la comparativa (`&ord=gasto&dir=asc`)
// ---------------------------------------------------------------------------

/** Columnas de la comparativa que se pueden ordenar, con su nombre en la URL. */
export const SORT_KEYS = ["agentes", "encurso", "abiertas", "bloq", "gasto", "aprob", "runs", "creadas", "exito"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

export interface DashboardQuery {
  /** Prefijos de empresa. Vacío = todas. */
  emp: string[];
  /** Columna ordenada; `null` o ausente = el orden de Paperclip. */
  ord?: SortKey | null;
  /** Solo cuenta si hay `ord`. Por defecto, descendente. */
  dir?: SortDir;
}

export function parseDashboardQuery(search: string): DashboardQuery {
  const params = readParams(search);
  const ord = params.get("ord") ?? "";
  const sort = (SORT_KEYS as readonly string[]).includes(ord) ? (ord as SortKey) : null;
  return {
    emp: readList(params, "emp").map((prefix) => prefix.toUpperCase()),
    ord: sort,
    dir: sort && params.get("dir") === "asc" ? "asc" : "desc",
  };
}

/** Devuelve `""` o `?emp=…&ord=…&dir=asc` con orden estable y sin los valores por defecto. */
export function serializeDashboardQuery(query: DashboardQuery): string {
  const parts: string[] = [];
  const emp = [...new Set(query.emp)].sort().map(encodeURIComponent);
  if (emp.length > 0) parts.push(`emp=${emp.join(",")}`);
  if (query.ord) {
    parts.push(`ord=${query.ord}`);
    if (query.dir === "asc") parts.push("dir=asc");
  }
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

/**
 * Clic en una empresa del filtro: desde «Todas» muestra solo esa; después
 * agrega o quita. Con todas elegidas, o sin ninguna, vuelve a «Todas» (`[]`).
 */
export function toggleCompanyFilter(selected: readonly string[], prefix: string, all: readonly string[]): string[] {
  const next =
    selected.length === 0 ? [prefix] : selected.includes(prefix) ? selected.filter((p) => p !== prefix) : [...selected, prefix];
  return next.length === 0 || all.every((p) => next.includes(p)) ? [] : all.filter((p) => next.includes(p));
}

/** Clic en un encabezado: descendente → ascendente → orden por defecto. */
export function nextSort(query: DashboardQuery, key: SortKey): Pick<DashboardQuery, "ord" | "dir"> {
  if (query.ord !== key) return { ord: key, dir: "desc" };
  return query.dir === "asc" ? { ord: null, dir: "desc" } : { ord: key, dir: "asc" };
}

// ---------------------------------------------------------------------------
// Datos de entrada: lo que se lee de cada empresa
// ---------------------------------------------------------------------------

export interface CompanyDashboardData {
  summary: DashboardSummary;
  /** Tareas de la empresa (worker del plugin, la misma lista del Board global). */
  issues: BoardIssue[];
  liveRuns: LiveRun[];
  activity: ActivityEvent[];
  agents: BoardAgent[];
  projects: BoardProject[];
}

export type CompanyLoadStatus = "wait" | "ok" | "err";

export interface CompanyDashboardLoad {
  company: BoardCompany;
  status: CompanyLoadStatus;
  data?: CompanyDashboardData;
  error?: string;
}

// ---------------------------------------------------------------------------
// Contadores y comparativa por empresa
// ---------------------------------------------------------------------------

/** Números de una empresa tal como los muestra su Dashboard. */
export interface CompanyMetrics {
  /** Contador «Agentes»: activos + corriendo + pausados + con error. */
  agentsEnabled: number;
  agentsRunning: number;
  agentsPaused: number;
  agentsError: number;
  /** Contador «Tareas en curso». */
  tasksInProgress: number;
  /** Todas menos hechas y canceladas. */
  tasksOpen: number;
  tasksBlocked: number;
  monthSpendCents: number;
  /** 0 = sin límite. */
  monthBudgetCents: number;
  /** Contador «Aprobaciones pendientes»: las de la empresa más las de presupuesto. */
  pendingApprovals: number;
  /** De las pendientes, las excepciones de presupuesto. */
  budgetApprovals: number;
  budgetIncidents: number;
  pausedAgents: number;
  pausedProjects: number;
}

export type MetricKey = keyof CompanyMetrics;

export function metricsFromSummary(summary: DashboardSummary): CompanyMetrics {
  const { agents, tasks, costs, budgets } = summary;
  return {
    agentsEnabled: agents.active + agents.running + agents.paused + agents.error,
    agentsRunning: agents.running,
    agentsPaused: agents.paused,
    agentsError: agents.error,
    tasksInProgress: tasks.inProgress,
    tasksOpen: tasks.open,
    tasksBlocked: tasks.blocked,
    monthSpendCents: costs.monthSpendCents,
    monthBudgetCents: costs.monthBudgetCents,
    pendingApprovals: summary.pendingApprovals + budgets.pendingApprovals,
    budgetApprovals: budgets.pendingApprovals,
    budgetIncidents: budgets.activeIncidents,
    pausedAgents: budgets.pausedAgents,
    pausedProjects: budgets.pausedProjects,
  };
}

const ZERO_METRICS: CompanyMetrics = {
  agentsEnabled: 0,
  agentsRunning: 0,
  agentsPaused: 0,
  agentsError: 0,
  tasksInProgress: 0,
  tasksOpen: 0,
  tasksBlocked: 0,
  monthSpendCents: 0,
  monthBudgetCents: 0,
  pendingApprovals: 0,
  budgetApprovals: 0,
  budgetIncidents: 0,
  pausedAgents: 0,
  pausedProjects: 0,
};

function sumMetrics(list: readonly CompanyMetrics[]): CompanyMetrics {
  const total = { ...ZERO_METRICS };
  for (const metrics of list) {
    for (const key of Object.keys(total) as MetricKey[]) total[key] += metrics[key];
  }
  return total;
}

/** % del presupuesto con 2 decimales, como el servidor. `null` = sin límite. */
export function utilizationPercent(spendCents: number, budgetCents: number): number | null {
  return budgetCents > 0 ? Number(((spendCents / budgetCents) * 100).toFixed(2)) : null;
}

export interface CompanyRow {
  company: BoardCompany;
  status: CompanyLoadStatus;
  error: string | null;
  /** `null` mientras carga o si falló. */
  metrics: CompanyMetrics | null;
  monthUtilizationPercent: number | null;
  /** Dashboard nativo de la empresa. */
  dashboardHref: string;
}

export interface DashboardTotals extends CompanyMetrics {
  /** % sobre las empresas con presupuesto; `null` si ninguna tiene. */
  monthUtilizationPercent: number | null;
  /** Gasto de las empresas con presupuesto: la base del %. */
  budgetedSpendCents: number;
  /** Empresas sin límite de presupuesto: su gasto suma, pero no entra en el %. */
  unlimitedBudget: BoardCompany[];
}

export interface BudgetAlertCompany {
  company: BoardCompany;
  incidents: number;
  pausedAgents: number;
  pausedProjects: number;
  budgetApprovals: number;
  /** Presupuestos de la empresa, donde el Dashboard nativo manda a resolver el incidente. */
  costsHref: string;
}

/** Suma de las empresas con incidentes de presupuesto activos. */
export interface BudgetAlert {
  incidents: number;
  pausedAgents: number;
  pausedProjects: number;
  budgetApprovals: number;
  companies: BudgetAlertCompany[];
}

// ---------------------------------------------------------------------------
// Gráficos de 14 días
// ---------------------------------------------------------------------------

export type RunBucket = Omit<RunActivityDay, "date">;

export interface RunDay extends RunBucket {
  date: string;
  byCompany: Array<{ company: BoardCompany; runs: RunBucket }>;
}

export interface SuccessRate {
  /** Exitosos + recuperados. */
  ok: number;
  total: number;
  /** 0 a 1; `null` si no hubo runs ese día. */
  rate: number | null;
}

export interface SuccessDay extends SuccessRate {
  date: string;
  byCompany: Array<{ company: BoardCompany } & SuccessRate>;
}

export interface StatusCount {
  total: number;
  byStatus: Partial<Record<IssueStatus, number>>;
}

export interface TaskDay extends StatusCount {
  date: string;
  byCompany: Array<{ company: BoardCompany } & StatusCount>;
}

/** Orden de la leyenda de «Tareas por estado» en el Dashboard nativo. */
export const TASK_CHART_STATUS_ORDER: readonly IssueStatus[] = [
  "todo",
  "in_progress",
  "in_review",
  "done",
  "blocked",
  "cancelled",
  "backlog",
];

export interface DashboardCharts {
  runActivity: RunDay[];
  successRate: SuccessDay[];
  tasksByStatus: TaskDay[];
  /** Estados con alguna tarea en el período, en el orden de la leyenda nativa. */
  taskStatuses: IssueStatus[];
}

function utcDateKey(time: number): string | null {
  return Number.isNaN(time) ? null : new Date(time).toISOString().slice(0, 10);
}

/**
 * Días de «Tareas por estado», calculados igual que la UI nativa: se restan
 * días en hora local y se toma la fecha UTC.
 */
export function recentDayKeys(now: Date, days: number = CHART_DAYS): string[] {
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(now.getTime());
    day.setDate(day.getDate() - (days - 1 - index));
    return day.toISOString().slice(0, 10);
  });
}

/** Días UTC de `runActivity`, igual que el servidor. Se usa si no hay datos de runs. */
export function recentUtcDayKeys(now: Date, days: number = CHART_DAYS): string[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: days }, (_, index) => new Date(today - (days - 1 - index) * 86_400_000).toISOString().slice(0, 10));
}

function emptyRunBucket(): RunBucket {
  return { succeeded: 0, failed: 0, recovered: 0, other: 0, total: 0, failedByErrorCode: {} };
}

function addRuns(target: RunBucket, runs: RunBucket): void {
  target.succeeded += runs.succeeded;
  target.failed += runs.failed;
  target.recovered += runs.recovered;
  target.other += runs.other;
  target.total += runs.total;
  for (const [code, count] of Object.entries(runs.failedByErrorCode ?? {})) {
    target.failedByErrorCode[code] = (target.failedByErrorCode[code] ?? 0) + count;
  }
}

export function successRate(runs: RunBucket): SuccessRate {
  const ok = runs.succeeded + runs.recovered;
  return { ok, total: runs.total, rate: runs.total > 0 ? ok / runs.total : null };
}

interface LoadedCompany {
  company: BoardCompany;
  data: CompanyDashboardData;
}

function buildCharts(loaded: readonly LoadedCompany[], now: Date): DashboardCharts {
  // Cada servidor arma sus 14 días al responder. Si las respuestas cruzan la
  // medianoche UTC, quedan los 14 más nuevos.
  const runDates = [...new Set(loaded.flatMap(({ data }) => data.summary.runActivity.map((day) => day.date)))].sort();
  const runDays = runDates.length > 0 ? runDates.slice(-CHART_DAYS) : recentUtcDayKeys(now);
  const runActivity: RunDay[] = runDays.map((date) => {
    const day: RunDay = { date, ...emptyRunBucket(), byCompany: [] };
    for (const { company, data } of loaded) {
      const runs = emptyRunBucket();
      const found = data.summary.runActivity.find((entry) => entry.date === date);
      if (found) addRuns(runs, found);
      addRuns(day, runs);
      day.byCompany.push({ company, runs });
    }
    return day;
  });
  const successRateDays: SuccessDay[] = runActivity.map((day) => ({
    date: day.date,
    ...successRate(day),
    byCompany: day.byCompany.map(({ company, runs }) => ({ company, ...successRate(runs) })),
  }));

  const taskDays = recentDayKeys(now);
  const present = new Set<IssueStatus>();
  const tasksByStatus: TaskDay[] = taskDays.map((date) => ({
    date,
    total: 0,
    byStatus: {},
    byCompany: loaded.map(({ company }) => ({ company, total: 0, byStatus: {} })),
  }));
  const dayIndex = new Map(taskDays.map((date, index) => [date, index]));
  loaded.forEach(({ data }, companyIndex) => {
    for (const issue of data.issues) {
      const index = dayIndex.get(utcDateKey(Date.parse(issue.createdAt)) ?? "");
      if (index === undefined) continue;
      const day = tasksByStatus[index];
      const companyDay = day.byCompany[companyIndex];
      for (const counts of [day, companyDay]) {
        counts.total += 1;
        counts.byStatus[issue.status] = (counts.byStatus[issue.status] ?? 0) + 1;
      }
      present.add(issue.status);
    }
  });

  return {
    runActivity,
    successRate: successRateDays,
    tasksByStatus,
    taskStatuses: TASK_CHART_STATUS_ORDER.filter((status) => present.has(status)),
  };
}

// ---------------------------------------------------------------------------
// Agentes en vivo, actividad y tareas recientes
// ---------------------------------------------------------------------------

export function isActiveRun(run: LiveRun): boolean {
  return run.status === "queued" || run.status === "running";
}

export interface LiveRunRow {
  company: BoardCompany;
  run: LiveRun;
  isActive: boolean;
  /** Tarea en la que trabaja el run. Si no está en la lista, el id corto y sin título. */
  issue: { identifier: string; title: string | null; href: string } | null;
  runHref: string;
}

export interface ActivityRow {
  company: BoardCompany;
  event: ActivityEvent;
  /** Agente, «Sistema» o persona («Board» en `local_trusted`). */
  actor: string;
  /** Identificador de la tarea o nombre del agente o proyecto, como en el Dashboard nativo. */
  entityLabel: string | null;
  /** Título de la tarea, si el evento es de una tarea. */
  entityTitle: string | null;
  /** Ruta en la empresa del evento; `null` si no lleva a ninguna parte. */
  href: string | null;
}

export interface RecentTaskRow {
  company: BoardCompany;
  issue: BoardIssue;
  href: string;
  /** Agente responsable (el Dashboard nativo solo muestra agentes). */
  agentName: string | null;
}

// Las rutas llevan el prefijo de la empresa y van en un `href` normal: la
// navegación del host antepone la empresa activa (ver README).
function companyPath(company: BoardCompany, path: string): string {
  return `/${company.prefix}${path}`;
}

function issuePath(company: BoardCompany, idOrIdentifier: string): string {
  return companyPath(company, `/issues/${encodeURIComponent(idOrIdentifier)}`);
}

function runPath(company: BoardCompany, agentId: string, runId: string): string {
  return companyPath(company, `/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}`);
}

function byNewest<T>(time: (item: T) => string): (a: T, b: T) => number {
  return (a, b) => (Date.parse(time(b)) || 0) - (Date.parse(time(a)) || 0);
}

function buildLiveRuns(loaded: readonly LoadedCompany[]): LiveRunRow[] {
  const rows = loaded.flatMap(({ company, data }) => {
    const issues = new Map(data.issues.map((issue) => [issue.id, issue]));
    return data.liveRuns.map((run): LiveRunRow => {
      const issue = run.issueId ? issues.get(run.issueId) : undefined;
      return {
        company,
        run,
        isActive: isActiveRun(run),
        issue: run.issueId
          ? {
              identifier: issue?.identifier ?? run.issueId.slice(0, 8),
              title: issue?.title ?? null,
              href: issuePath(company, issue?.identifier ?? run.issueId),
            }
          : null,
        runHref: runPath(company, run.agentId, run.id),
      };
    });
  });
  // Como en cada empresa: primero los activos y después los recientes, de más nuevo a más viejo.
  const newest = byNewest<LiveRunRow>((row) => row.run.createdAt);
  return rows.sort((a, b) => Number(b.isActive) - Number(a.isActive) || newest(a, b));
}

function activityRow(company: BoardCompany, data: CompanyDashboardData, event: ActivityEvent): ActivityRow {
  const agentName = (id: unknown) => data.agents.find((agent) => agent.id === id)?.name ?? null;
  const actor =
    event.actorType === "agent"
      ? agentName(event.actorId) ?? "Agente desconocido"
      : event.actorType === "system"
        ? "Sistema"
        : userLabel(event.actorId);
  let entityLabel: string | null = null;
  let entityTitle: string | null = null;
  let href: string | null = null;
  switch (event.entityType) {
    case "issue": {
      const issue = data.issues.find((candidate) => candidate.id === event.entityId);
      entityLabel = issue?.identifier ?? event.entityId.slice(0, 8);
      entityTitle = issue?.title ?? null;
      href = issuePath(company, issue?.identifier ?? event.entityId);
      break;
    }
    case "agent":
      entityLabel = agentName(event.entityId);
      href = companyPath(company, `/agents/${encodeURIComponent(event.entityId)}`);
      break;
    case "project":
      entityLabel = data.projects.find((project) => project.id === event.entityId)?.name ?? null;
      href = companyPath(company, `/projects/${encodeURIComponent(event.entityId)}`);
      break;
    case "goal":
      href = companyPath(company, `/goals/${encodeURIComponent(event.entityId)}`);
      break;
    case "approval":
      href = companyPath(company, `/approvals/${encodeURIComponent(event.entityId)}`);
      break;
    case "heartbeat_run": {
      const agentId = event.details?.agentId;
      if (typeof agentId === "string" && agentId) {
        entityLabel = agentName(agentId);
        href = runPath(company, agentId, event.entityId);
      }
      break;
    }
  }
  return { company, event, actor, entityLabel, entityTitle, href };
}

// ---------------------------------------------------------------------------
// Modelo completo
// ---------------------------------------------------------------------------

export interface DashboardModel {
  /** Todas las empresas visibles, sin aplicar el filtro (para el menú de empresa). */
  companies: BoardCompany[];
  /** Prefijos del filtro que existen. Vacío = todas. */
  selected: string[];
  /** Una fila por empresa del filtro, cargada o no. */
  rows: CompanyRow[];
  /** Empresas del filtro que no se pudieron leer: no suman en ningún bloque. */
  failed: CompanyRow[];
  /** Todas las empresas del filtro respondieron. */
  complete: boolean;
  totals: DashboardTotals;
  budgetAlert: BudgetAlert | null;
  charts: DashboardCharts;
  liveRuns: LiveRunRow[];
  recentActivity: ActivityRow[];
  recentTasks: RecentTaskRow[];
}

/**
 * Arma todo lo que muestra el Dashboard global con las empresas del filtro.
 * Las empresas que fallan o siguen cargando aparecen en `rows` y no suman.
 */
export function buildDashboard(loads: readonly CompanyDashboardLoad[], query: DashboardQuery, now: Date = new Date()): DashboardModel {
  const sorted = [...loads].sort((a, b) => a.company.name.localeCompare(b.company.name, "es"));
  const known = new Set(sorted.map((load) => load.company.prefix));
  // Un prefijo que no existe (o que el usuario no ve) se ignora; si no queda ninguno, se muestran todas.
  const selected = [...new Set(query.emp)].filter((prefix) => known.has(prefix)).sort();
  const scope = selected.length > 0 ? sorted.filter((load) => selected.includes(load.company.prefix)) : sorted;

  const rows: CompanyRow[] = scope.map((load) => {
    const metrics = load.status === "ok" && load.data ? metricsFromSummary(load.data.summary) : null;
    return {
      company: load.company,
      status: load.status,
      error: load.status === "err" ? load.error ?? "Error desconocido" : null,
      metrics,
      monthUtilizationPercent: metrics ? utilizationPercent(metrics.monthSpendCents, metrics.monthBudgetCents) : null,
      dashboardHref: companyPath(load.company, "/dashboard"),
    };
  });
  const loaded: LoadedCompany[] = scope.flatMap((load) =>
    load.status === "ok" && load.data ? [{ company: load.company, data: load.data }] : [],
  );

  const okRows = rows.filter((row): row is CompanyRow & { metrics: CompanyMetrics } => row.metrics !== null);
  const budgeted = okRows.filter((row) => row.metrics.monthBudgetCents > 0);
  const budgetedSpendCents = budgeted.reduce((sum, row) => sum + row.metrics.monthSpendCents, 0);
  const sums = sumMetrics(okRows.map((row) => row.metrics));
  const totals: DashboardTotals = {
    ...sums,
    monthUtilizationPercent: utilizationPercent(budgetedSpendCents, sums.monthBudgetCents),
    budgetedSpendCents,
    unlimitedBudget: okRows.filter((row) => row.metrics.monthBudgetCents <= 0).map((row) => row.company),
  };

  const incidents = okRows
    .filter((row) => row.metrics.budgetIncidents > 0)
    .map(
      ({ company, metrics }): BudgetAlertCompany => ({
        company,
        incidents: metrics.budgetIncidents,
        pausedAgents: metrics.pausedAgents,
        pausedProjects: metrics.pausedProjects,
        budgetApprovals: metrics.budgetApprovals,
        costsHref: companyPath(company, "/costs"),
      }),
    );
  const budgetAlert: BudgetAlert | null =
    incidents.length === 0
      ? null
      : {
          incidents: incidents.reduce((sum, entry) => sum + entry.incidents, 0),
          pausedAgents: incidents.reduce((sum, entry) => sum + entry.pausedAgents, 0),
          pausedProjects: incidents.reduce((sum, entry) => sum + entry.pausedProjects, 0),
          budgetApprovals: incidents.reduce((sum, entry) => sum + entry.budgetApprovals, 0),
          companies: incidents,
        };

  const recentActivity = loaded
    .flatMap(({ company, data }) => data.activity.map((event) => ({ company, data, event })))
    .sort(byNewest((entry) => entry.event.createdAt))
    .slice(0, RECENT_LIMIT)
    .map(({ company, data, event }) => activityRow(company, data, event));

  const recentTasks = loaded
    .flatMap(({ company, data }) => data.issues.map((issue) => ({ company, data, issue })))
    .sort(byNewest((entry) => entry.issue.updatedAt))
    .slice(0, RECENT_LIMIT)
    .map(
      ({ company, data, issue }): RecentTaskRow => ({
        company,
        issue,
        href: issuePath(company, issue.identifier ?? issue.id),
        agentName: issue.assigneeAgentId
          ? data.agents.find((agent) => agent.id === issue.assigneeAgentId)?.name ?? null
          : null,
      }),
    );

  const failed = rows.filter((row) => row.status === "err");
  return {
    companies: sorted.map((load) => load.company),
    selected,
    rows,
    failed,
    complete: rows.every((row) => row.status === "ok"),
    totals,
    budgetAlert,
    charts: buildCharts(loaded, now),
    liveRuns: buildLiveRuns(loaded),
    recentActivity,
    recentTasks,
  };
}

/** Aporte de cada empresa cargada a un contador, en el orden de la comparativa. */
export function contributions(model: DashboardModel, key: MetricKey): Array<{ company: BoardCompany; value: number }> {
  return model.rows.flatMap((row) => (row.metrics ? [{ company: row.company, value: row.metrics[key] }] : []));
}

// ---------------------------------------------------------------------------
// Comparativa: series de 14 días por empresa y orden de las filas
// ---------------------------------------------------------------------------

export interface CompanySeries {
  runs: RunBucket[];
  created: StatusCount[];
  success: SuccessRate[];
  runsTotal: number;
  createdTotal: number;
  /** Tasa de los 14 días. */
  rate: SuccessRate;
}

/** Los 14 días de una empresa (vacíos si no cargó): los minigráficos de su fila. */
export function companySeries(charts: DashboardCharts, companyId: string): CompanySeries {
  const runs = charts.runActivity.map(
    (day) => day.byCompany.find((entry) => entry.company.id === companyId)?.runs ?? emptyRunBucket(),
  );
  const created = charts.tasksByStatus.map((day): StatusCount => {
    const entry = day.byCompany.find((candidate) => candidate.company.id === companyId);
    return { total: entry?.total ?? 0, byStatus: entry?.byStatus ?? {} };
  });
  const total = emptyRunBucket();
  for (const day of runs) addRuns(total, day);
  return {
    runs,
    created,
    success: runs.map(successRate),
    runsTotal: total.total,
    createdTotal: created.reduce((sum, day) => sum + day.total, 0),
    rate: successRate(total),
  };
}

function sortValue(model: DashboardModel, row: CompanyRow, key: SortKey): number | null {
  const metrics = row.metrics;
  if (!metrics) return null;
  switch (key) {
    case "agentes":
      return metrics.agentsEnabled;
    case "encurso":
      return metrics.tasksInProgress;
    case "abiertas":
      return metrics.tasksOpen;
    case "bloq":
      return metrics.tasksBlocked;
    case "gasto":
      return metrics.monthSpendCents;
    case "aprob":
      return metrics.pendingApprovals;
    case "runs":
      return companySeries(model.charts, row.company.id).runsTotal;
    case "creadas":
      return companySeries(model.charts, row.company.id).createdTotal;
    case "exito":
      return companySeries(model.charts, row.company.id).rate.rate;
  }
}

/**
 * Filas de la comparativa en el orden pedido. Las empresas que no respondieron
 * (y, en «Éxito», las que no tuvieron runs) van siempre al final. Los empates
 * mantienen el orden de Paperclip.
 */
export function sortRows(model: DashboardModel, ord: SortKey | null | undefined, dir: SortDir = "desc"): CompanyRow[] {
  if (!ord) return model.rows;
  const sign = dir === "asc" ? 1 : -1;
  return model.rows
    .map((row, index) => ({ row, index, value: sortValue(model, row, ord) }))
    .sort((a, b) => {
      if (a.value === null || b.value === null) return Number(a.value === null) - Number(b.value === null) || a.index - b.index;
      return sign * (a.value - b.value) || a.index - b.index;
    })
    .map((entry) => entry.row);
}

// ---------------------------------------------------------------------------
// Formatos (los del Dashboard nativo, para que QA compare 1:1)
// ---------------------------------------------------------------------------

/** Dinero como el Dashboard nativo: `$1,234.50`. */
export function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Dinero redondeado a dólares, para el aporte de cada empresa: `$412`. */
export function formatMoneyShort(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

/** `0.917` → `92%`. */
export function formatRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** `2026-10-14` → `14 oct` o `mié 14 oct`. Son días UTC, como los de los gráficos. */
export function dayLabel(date: string, withWeekday = false): string {
  const day = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(day.getTime())) return date;
  const label = `${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]}`;
  return withWeekday ? `${WEEKDAYS[day.getUTCDay()]} ${label}` : label;
}

/** Tiempo desde `iso`, para un run en curso: `9 min` o `1 h 5 min`. */
export function durationLabel(iso: string | null | undefined, now: number = Date.now()): string {
  const at = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(at)) return "";
  const minutes = Math.max(1, Math.round((now - at) / 60_000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

// ---------------------------------------------------------------------------
// Texto de la actividad: el verbo que va entre el autor y la entidad
// ---------------------------------------------------------------------------

/** Los mismos eventos que nombra el Dashboard nativo, en español. */
const ACTIVITY_VERBS: Record<string, string> = {
  "issue.created": "creó",
  "issue.updated": "actualizó",
  "issue.deleted": "borró",
  "issue.checked_out": "tomó",
  "issue.released": "liberó",
  "issue.comment_added": "comentó en",
  "issue.commented": "comentó en",
  "issue.comment_cancelled": "canceló un comentario en",
  "issue.comment_deleted": "borró un comentario de",
  "issue.attachment_added": "adjuntó un archivo a",
  "issue.attachment_removed": "quitó un adjunto de",
  "issue.document_created": "creó un documento en",
  "issue.document_updated": "editó un documento de",
  "issue.document_deleted": "borró un documento de",
  "issue.document_locked": "bloqueó un documento de",
  "issue.document_unlocked": "desbloqueó un documento de",
  "issue.work_product_created": "entregó trabajo en",
  "issue.work_product_updated": "actualizó el trabajo de",
  "issue.work_product_deleted": "quitó trabajo de",
  "issue.read_marked": "marcó como leída",
  "issue.read_unmarked": "marcó como no leída",
  "issue.inbox_archived": "archivó del Inbox",
  "issue.inbox_unarchived": "devolvió al Inbox",
  "issue.blockers_updated": "cambió los bloqueadores de",
  "issue.blockers_resolved_wake_emitted": "despertó al responsable de",
  "issue.reviewers_updated": "cambió los revisores de",
  "issue.approvers_updated": "cambió los aprobadores de",
  "issue.cross_issue_influence_observed": "escribió en otra tarea desde",
  "issue.monitor_scheduled": "programó un monitor en",
  "issue.monitor_triggered": "disparó el monitor de",
  "issue.monitor_cleared": "quitó el monitor de",
  "issue.thread_interaction_created": "pidió una decisión en",
  "issue.thread_interaction_accepted": "aceptó la solicitud de",
  "issue.thread_interaction_rejected": "rechazó la solicitud de",
  "issue.thread_interaction_answered": "respondió la solicitud de",
  "issue.thread_interaction_withdrawn": "retiró la solicitud de",
  "issue.thread_interaction_cancelled": "canceló la solicitud de",
  "issue.thread_interaction_expired": "dio por vencida la solicitud de",
  "issue.successful_run_handoff_required": "marcó sin siguiente paso a",
  "issue.successful_run_handoff_resolved": "eligió el siguiente paso de",
  "issue.successful_run_handoff_escalated": "escaló la falta de siguiente paso de",
  "issue.recovery_action_opened": "abrió una recuperación en",
  "issue.recovery_action_resolved": "resolvió la recuperación de",
  "issue.recovery_action_escalated": "escaló la recuperación de",
  "issue.stale_lock_cleared": "liberó un bloqueo vencido de",
  "agent.created": "contrató a",
  "agent.updated": "actualizó a",
  "agent.paused": "pausó a",
  "agent.resumed": "reanudó a",
  "agent.terminated": "dio de baja a",
  "agent.error_cleared": "limpió el error de",
  "agent.budget_updated": "cambió el presupuesto de",
  "agent.skills_synced": "sincronizó las skills de",
  "heartbeat.invoked": "invocó un heartbeat de",
  "heartbeat.cancelled": "canceló un heartbeat de",
  "approval.created": "pidió una aprobación",
  "approval.approved": "aprobó una solicitud",
  "approval.rejected": "rechazó una solicitud",
  "project.created": "creó el proyecto",
  "project.updated": "actualizó el proyecto",
  "project.deleted": "borró el proyecto",
  "project.workspace_created": "creó un workspace en",
  "goal.created": "creó una meta",
  "goal.updated": "actualizó una meta",
  "goal.deleted": "borró una meta",
  "label.created": "creó una etiqueta",
  "label.deleted": "borró una etiqueta",
  "plugin.installed": "instaló un plugin",
  "plugin.upgraded": "actualizó un plugin",
  "plugin.uninstalled": "desinstaló un plugin",
  "plugin.enabled": "activó un plugin",
  "plugin.disabled": "desactivó un plugin",
  "environment.lease_acquired": "tomó un entorno",
  "environment.lease_released": "liberó un entorno",
  "routine.run_triggered": "lanzó una rutina",
  "decision_queue_item.seeded": "agregó una decisión pendiente",
  "cost.reported": "reportó un costo de",
  "cost.recorded": "registró un costo de",
  "company.updated": "actualizó la empresa",
  "company.budget_updated": "cambió el presupuesto de la empresa",
};

/**
 * Verbo de un evento de actividad, como el del Dashboard nativo: «cambió el
 * estado a En revisión de» + ACM-412. Los eventos que no conoce se muestran
 * con su nombre técnico.
 */
export function activityVerb(
  action: string,
  details: Record<string, unknown> | null,
  labels: { status: Record<IssueStatus, string>; priority: Record<IssuePriority, string> },
): string {
  if (action === "issue.updated" && details) {
    if (isIssueStatus(details.status)) return `cambió el estado a ${labels.status[details.status]} de`;
    if (isIssuePriority(details.priority)) return `cambió la prioridad a ${labels.priority[details.priority].toLowerCase()} de`;
    if (details.assigneeAgentId !== undefined || details.assigneeUserId !== undefined) return "cambió el responsable de";
  }
  return ACTIVITY_VERBS[action] ?? action.replace(/[._]/g, " ");
}
