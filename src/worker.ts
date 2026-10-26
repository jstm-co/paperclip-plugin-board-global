import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { Issue, PluginContext } from "@paperclipai/plugin-sdk";
import { DATA_COMPANY_ISSUES, DATA_SAVED_VIEWS, VIEW_ACTIONS, type BoardIssue, type CompanyIssues } from "./shared.js";
import { VIEWS_STATE_KEY, applyViewOp, parseStoredViews, parseViewOp, storedViews, type SavedView, type ViewOp, type ViewOpResult } from "./views.js";

function requireCompanyId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("companyId es obligatorio: llama al bridge con la empresa a consultar");
  }
  return value;
}

function toIso(value: Date | string | null | undefined): string {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : String(value);
}

/** La lista no trae `blockedBy`, pero sí `blockerAttention` con el bloqueador directo y el final. */
function blockerIds(issue: Issue): string[] {
  const attention = issue.blockerAttention;
  const ids = [attention?.directBlockerIssueId, attention?.terminalBlockerIssueId].filter(
    (id): id is string => typeof id === "string" && id.length > 0 && id !== issue.id,
  );
  return [...new Set(ids)];
}

export function toBoardIssue(issue: Issue): BoardIssue {
  return {
    id: issue.id,
    companyId: issue.companyId,
    identifier: issue.identifier ?? null,
    title: issue.title,
    status: issue.status as BoardIssue["status"],
    priority: issue.priority as BoardIssue["priority"],
    projectId: issue.projectId ?? null,
    parentId: issue.parentId ?? null,
    assigneeAgentId: issue.assigneeAgentId ?? null,
    assigneeUserId: issue.assigneeUserId ?? null,
    labels: (issue.labels ?? []).map((label) => ({ id: label.id, name: label.name, color: label.color })),
    blockerIds: blockerIds(issue),
    createdAt: toIso(issue.createdAt),
    updatedAt: toIso(issue.updatedAt),
  };
}

const VIEWS_SCOPE = { scopeKind: "instance", stateKey: VIEWS_STATE_KEY } as const;

/**
 * Vistas guardadas en `ctx.state` (alcance instance). `set` reemplaza el valor
 * entero, así que las operaciones van de a una: leer, aplicar y escribir sin
 * que otra se meta en medio.
 */
function registerSavedViews(ctx: PluginContext) {
  let queue: Promise<unknown> = Promise.resolve();
  const serialized = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => undefined);
    return run;
  };
  const read = async (): Promise<SavedView[]> => parseStoredViews(await ctx.state.get(VIEWS_SCOPE));

  ctx.data.register(DATA_SAVED_VIEWS, async (): Promise<{ views: SavedView[] }> => ({ views: await read() }));

  for (const op of Object.keys(VIEW_ACTIONS) as Array<ViewOp["op"]>) {
    ctx.actions.register(VIEW_ACTIONS[op], async (params): Promise<ViewOpResult> => {
      const request = parseViewOp(op, params);
      return serialized(async () => {
        const result = applyViewOp(await read(), request);
        if (result.ok) {
          // Paperclip 2026.824.1: en el estado de instancia `scope_id` es NULL y el
          // índice único no lo ve como conflicto, así que `set` agrega otra fila y
          // `get` devuelve la primera. Borrar antes deja siempre una sola.
          await ctx.state.delete(VIEWS_SCOPE);
          await ctx.state.set(VIEWS_SCOPE, storedViews(result.views));
        }
        return result;
      });
    });
  }
}

const plugin = definePlugin({
  async setup(ctx) {
    registerSavedViews(ctx);

    // `params.companyId` lo inyecta el host: es la empresa autorizada para esta
    // invocación. Leer otra empresa aquí lo rechaza el host (INVOCATION_SCOPE_DENIED).
    ctx.data.register(DATA_COMPANY_ISSUES, async (params): Promise<CompanyIssues> => {
      const companyId = requireCompanyId(params.companyId);
      const startedAt = Date.now();
      // Sin limit/offset: el host aplica la ventana dos veces y la paginación con
      // offset > 0 devuelve resultados incorrectos (ver nota técnica del spike).
      const [company, issues] = await Promise.all([ctx.companies.get(companyId), ctx.issues.list({ companyId })]);
      if (!company) throw new Error(`Empresa no encontrada: ${companyId}`);
      return {
        companyId,
        name: company.name,
        issuePrefix: company.issuePrefix ?? null,
        brandColor: company.brandColor ?? null,
        issues: issues.map(toBoardIssue),
        elapsedMs: Date.now() - startedAt,
      };
    });
  },

  async onHealth() {
    return { status: "ok", message: "Board global worker activo" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
