// Endpoints HTTP del host que usa la UI. Quedan aislados aquí porque no son
// parte del SDK: si cambian en una actualización de Paperclip, se ajusta solo
// este archivo.
//
// `usePluginData` siempre envía la empresa activa, y el host limita cada
// invocación del worker a esa empresa. Para ver todas, la UI:
//   1. lista las empresas visibles para el usuario (`GET /api/companies`), y
//   2. llama al bridge una vez por empresa con su `companyId`, igual que hace el
//      cliente del host (`POST /api/plugins/:plugin/data/:key`). El host valida
//      que el usuario tenga acceso a esa empresa antes de llamar al worker.
//
// Los nombres de proyectos y agentes salen de la API nativa
// (`GET /api/companies/:id/projects|agents`), y el cambio de estado usa
// `PATCH /api/issues/:id`, lo mismo que el kanban nativo, para que apliquen
// todas las reglas del núcleo (runs, revisión, wakeups).
//
// «Te toca» sale del feed del Inbox (`GET /api/companies/:id/attention`). Pide
// sesión de board con usuario: funciona desde el navegador, no con la API key
// de un agente (403).
//
// La lista del worker trae `blockerAttention`, que nombra bloqueadores solo en
// las tareas Bloqueadas. Los de las demás salen de `blockedBy`
// (`GET /api/companies/:id/issues?includeBlockedBy=true`, como el kanban nativo).
//
// Las vistas guardadas (Fase 2) viven en el worker (`ctx.state`): se leen con
// el dato `saved-views` y se escriben con una acción por operación.
//
// El Dashboard global usa las mismas fuentes que el Dashboard nativo de cada
// empresa: el resumen (`/dashboard`), las tarjetas de agentes (`/live-runs`), la
// actividad (`/activity`) y la lista de tareas del worker.
import {
  OPEN_STATUSES,
  PLUGIN_KEY,
  type ActivityEvent,
  type AttentionItem,
  type BoardAgent,
  type BoardProject,
  type DashboardSummary,
  type IssueBlockedBy,
  type IssueStatus,
  type LiveRun,
} from "../shared.js";

export interface CompanyRef {
  id: string;
  name: string;
  issuePrefix: string | null;
  brandColor?: string | null;
  status: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message ?? body?.error ?? `HTTP ${response.status}`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return body as T;
}

/** Empresas visibles para el usuario, sin las archivadas. */
export async function listCompanies(): Promise<CompanyRef[]> {
  const companies = await request<CompanyRef[]>("/companies");
  return companies.filter((company) => company.status !== "archived");
}

export async function getCompanyData<T>(key: string, companyId: string, params: Record<string, unknown> = {}): Promise<T> {
  const body = await request<{ data: T }>(`/plugins/${PLUGIN_KEY}/data/${encodeURIComponent(key)}`, {
    method: "POST",
    body: JSON.stringify({ companyId, params }),
  });
  return body.data;
}

/**
 * Acción del worker (`POST /api/plugins/:plugin/actions/:key`), como
 * `usePluginAction`. Las vistas guardadas no dependen de la empresa: se manda
 * la activa solo porque el host pide una para autorizar la llamada.
 */
export async function runAction<T>(key: string, companyId: string, params: Record<string, unknown> = {}): Promise<T> {
  const body = await request<{ data: T }>(`/plugins/${PLUGIN_KEY}/actions/${encodeURIComponent(key)}`, {
    method: "POST",
    body: JSON.stringify({ companyId, params }),
  });
  return body.data;
}

export async function listProjects(companyId: string): Promise<BoardProject[]> {
  const projects = await request<Array<BoardProject>>(`/companies/${encodeURIComponent(companyId)}/projects`);
  return projects.map((project) => ({ id: project.id, name: project.name, color: project.color ?? null }));
}

export async function listAgents(companyId: string): Promise<BoardAgent[]> {
  const agents = await request<Array<BoardAgent>>(`/companies/${encodeURIComponent(companyId)}/agents`);
  return agents.map((agent) => ({ id: agent.id, name: agent.name }));
}

export async function listAttention(companyId: string): Promise<AttentionItem[]> {
  const feed = await request<{ items?: AttentionItem[] }>(`/companies/${encodeURIComponent(companyId)}/attention`);
  return Array.isArray(feed.items) ? feed.items : [];
}

/** Bloqueadores de las tareas abiertas (solo las que tienen alguno). */
export async function listOpenBlockedBy(companyId: string): Promise<IssueBlockedBy[]> {
  const query = new URLSearchParams({
    status: OPEN_STATUSES.join(","),
    includeBlockedBy: "true",
    view: "compact",
    limit: "1000",
  });
  const rows = await request<Array<{ id: string; blockedBy?: IssueBlockedBy["blockedBy"] | null }>>(
    `/companies/${encodeURIComponent(companyId)}/issues?${query}`,
  );
  return rows.flatMap((row) =>
    row.blockedBy?.length
      ? [{ id: row.id, blockedBy: row.blockedBy.map((blocker) => ({ id: blocker.id, status: blocker.status })) }]
      : [],
  );
}

/** Contadores, gasto del mes, aprobaciones, incidentes de presupuesto y runs de 14 días. */
export function getDashboardSummary(companyId: string): Promise<DashboardSummary> {
  return request(`/companies/${encodeURIComponent(companyId)}/dashboard`);
}

/** El Dashboard nativo pide `minCount=4`: los runs activos y, si son menos de 4, los más recientes. */
export function listLiveRuns(companyId: string, minCount = 4): Promise<LiveRun[]> {
  return request(`/companies/${encodeURIComponent(companyId)}/live-runs?minCount=${minCount}`);
}

/** Los últimos eventos, del más nuevo al más antiguo. El Dashboard nativo muestra 10. */
export function listActivity(companyId: string, limit = 10): Promise<ActivityEvent[]> {
  return request(`/companies/${encodeURIComponent(companyId)}/activity?limit=${limit}`);
}

export function updateIssueStatus(issueId: string, status: IssueStatus): Promise<{ id: string; status: IssueStatus }> {
  return request(`/issues/${encodeURIComponent(issueId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
