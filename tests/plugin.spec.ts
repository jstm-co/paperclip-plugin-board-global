import { describe, expect, it } from "vitest";
import type { Company, Issue } from "@paperclipai/plugin-sdk";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin, { toBoardIssue } from "../src/worker.js";
import { CONFIRM_STATE_KEY, type Confirmations } from "../src/confirm.js";
import {
  CONFIRM_ACTIONS,
  DASHBOARD_ROUTE,
  DATA_COMPANY_ISSUES,
  DATA_CONFIRMATIONS,
  DATA_SAVED_VIEWS,
  PAGE_ROUTE,
  VIEW_ACTIONS,
  type CompanyIssues,
} from "../src/shared.js";
import { VIEWS_STATE_KEY, type SavedView, type ViewOpResult } from "../src/views.js";

function company(id: string, name: string, issuePrefix: string): Company {
  return { id, name, issuePrefix, status: "active", brandColor: null } as unknown as Company;
}

function issue(id: string, companyId: string, status: Issue["status"], extra: Partial<Issue> = {}): Issue {
  return {
    id,
    companyId,
    status,
    identifier: id.toUpperCase(),
    title: `Tarea ${id}`,
    description: "texto largo que el board no necesita",
    priority: "medium",
    projectId: null,
    assigneeAgentId: null,
    assigneeUserId: null,
    createdAt: new Date("2026-09-30T09:00:00Z"),
    updatedAt: new Date("2026-10-01T12:00:00Z"),
    ...extra,
  } as unknown as Issue;
}

async function setup() {
  const harness = createTestHarness({ manifest });
  harness.seed({
    companies: [company("c-jst", "JSTM", "JST"), company("c-bet", "Betacorp", "BET")],
    issues: [
      issue("bet-1", "c-bet", "todo", {
        projectId: "p-web",
        assigneeAgentId: "a-dev",
        priority: "high",
        labels: [{ id: "l-1", companyId: "c-bet", name: "bug", color: "#00f" }] as Issue["labels"],
      }),
      issue("bet-2", "c-bet", "blocked", {
        parentId: "bet-1",
        blockerAttention: { directBlockerIssueId: "bet-1", terminalBlockerIssueId: "bet-1" },
      } as Partial<Issue>),
      issue("jst-1", "c-jst", "in_progress", { assigneeUserId: "local-board" }),
    ],
  });
  await plugin.definition.setup(harness.ctx);
  return harness;
}

describe("manifest", () => {
  it("registra las dos páginas, sus entradas del menú lateral y el botón de la barra de arriba; solo escribe su propio estado (vistas guardadas)", () => {
    const slots = manifest.ui?.slots ?? [];
    expect(slots.filter((slot) => slot.type === "page").map((slot) => slot.routePath)).toEqual([PAGE_ROUTE, DASHBOARD_ROUTE]);
    // «Dashboard global» va debajo de «Board global».
    expect(slots.filter((slot) => slot.type === "sidebar").map((slot) => slot.exportName)).toEqual([
      "BoardGlobalSidebarLink",
      "DashboardGlobalSidebarLink",
    ]);
    // El menú lateral del espacio «Coordinator» no dibuja los slots `sidebar`:
    // el botón de la barra de arriba es la entrada que se ve en los dos espacios.
    expect(slots.filter((slot) => slot.type === "globalToolbarButton").map((slot) => slot.exportName)).toEqual(["BoardGlobalToolbarButton"]);
    expect([...manifest.capabilities].sort()).toEqual(
      [
        "companies.read",
        "issues.read",
        "plugin.state.read",
        "plugin.state.write",
        "ui.page.register",
        "ui.sidebar.register",
        "ui.action.register",
      ].sort(),
    );
  });
});

describe("vistas guardadas en el servidor", () => {
  const SCOPE = { scopeKind: "instance", stateKey: VIEWS_STATE_KEY } as const;

  it("crear, renombrar, actualizar y borrar: una acción por operación, guardada en ctx.state de la instancia", async () => {
    const harness = await setup();
    expect(await harness.getData(DATA_SAVED_VIEWS, { companyId: "c-bet" })).toEqual({ views: [] });

    const created = await harness.performAction<ViewOpResult>(VIEW_ACTIONS.create, {
      companyId: "c-bet",
      id: "v1",
      name: "Bloqueadas de todas las empresas",
      search: "?v=kanban&est=blocked",
    });
    expect(created).toMatchObject({ ok: true, views: [{ id: "v1", name: "Bloqueadas de todas las empresas", search: "?est=blocked" }] });

    // La lista no depende de la empresa con que se invoque al worker.
    const fromJst = await harness.getData<{ views: SavedView[] }>(DATA_SAVED_VIEWS, { companyId: "c-jst" });
    expect(fromJst.views.map((view) => view.id)).toEqual(["v1"]);

    await harness.performAction(VIEW_ACTIONS.rename, { companyId: "c-jst", id: "v1", name: "Bloqueadas" });
    await harness.performAction(VIEW_ACTIONS.update, { companyId: "c-jst", id: "v1", search: "?est=blocked&carr=responsable" });
    expect(harness.getState(SCOPE)).toMatchObject({ version: 1, views: [{ id: "v1", name: "Bloqueadas", search: "?est=blocked&carr=responsable" }] });

    const deleted = await harness.performAction<ViewOpResult>(VIEW_ACTIONS.delete, { companyId: "c-jst", id: "v1" });
    expect(deleted).toEqual({ ok: true, views: [] });
  });

  it("no guarda un nombre repetido ni cambia una vista que ya no existe", async () => {
    const harness = await setup();
    await harness.performAction(VIEW_ACTIONS.create, { companyId: "c-bet", id: "v1", name: "Lo mío", search: "?resp=user:local-board" });
    const repeated = await harness.performAction<ViewOpResult>(VIEW_ACTIONS.create, { companyId: "c-bet", id: "v2", name: "lo mio", search: "" });
    expect(repeated).toMatchObject({ ok: false, reason: "invalid", message: "Ya hay una vista con ese nombre." });
    const gone = await harness.performAction<ViewOpResult>(VIEW_ACTIONS.rename, { companyId: "c-bet", id: "nada", name: "Otra" });
    expect(gone).toMatchObject({ ok: false, reason: "not_found", views: [{ id: "v1" }] });
  });

  it("las operaciones simultáneas no se pisan", async () => {
    const harness = await setup();
    await Promise.all(
      ["A", "B", "C", "D"].map((name, i) =>
        harness.performAction(VIEW_ACTIONS.create, { companyId: "c-bet", id: `v${i}`, name: `Vista ${name}`, search: "" }),
      ),
    );
    const { views } = await harness.getData<{ views: SavedView[] }>(DATA_SAVED_VIEWS, { companyId: "c-bet" });
    expect(views.map((view) => view.name).sort()).toEqual(["Vista A", "Vista B", "Vista C", "Vista D"]);
  });

  it("se conservan aunque el host agregue una fila en cada `set` y `get` lea la primera (Paperclip 2026.824.1)", async () => {
    const harness = createTestHarness({ manifest });
    // Como `plugin_state` con `scope_id` NULL: el upsert no choca con el índice único.
    const rows: Array<{ key: string; value: unknown }> = [];
    const keyOf = (scope: { namespace?: string; stateKey: string }) => `${scope.namespace ?? "default"}/${scope.stateKey}`;
    const state = {
      ...harness.ctx.state,
      get: async (scope: { namespace?: string; stateKey: string }) => rows.find((row) => row.key === keyOf(scope))?.value ?? null,
      set: async (scope: { namespace?: string; stateKey: string }, value: unknown) => void rows.push({ key: keyOf(scope), value }),
      delete: async (scope: { namespace?: string; stateKey: string }) => {
        for (let i = rows.length - 1; i >= 0; i--) if (rows[i].key === keyOf(scope)) rows.splice(i, 1);
      },
    };
    await plugin.definition.setup({ ...harness.ctx, state } as typeof harness.ctx);
    await harness.performAction(VIEW_ACTIONS.create, { companyId: "c-bet", id: "v1", name: "Primera", search: "" });
    await harness.performAction(VIEW_ACTIONS.create, { companyId: "c-bet", id: "v2", name: "Segunda", search: "?est=blocked" });
    await harness.performAction(VIEW_ACTIONS.rename, { companyId: "c-bet", id: "v1", name: "Lo mío" });
    await harness.performAction(VIEW_ACTIONS.delete, { companyId: "c-bet", id: "v2" });
    await harness.performAction(VIEW_ACTIONS.create, { companyId: "c-bet", id: "v3", name: "Tercera", search: "" });
    const { views } = await harness.getData<{ views: SavedView[] }>(DATA_SAVED_VIEWS, { companyId: "c-bet" });
    expect(views.map((view) => view.name)).toEqual(["Lo mío", "Tercera"]);
    expect(rows).toHaveLength(1);
  });
});

describe("«Por confirmar» en el servidor", () => {
  const SCOPE = { scopeKind: "instance", stateKey: CONFIRM_STATE_KEY } as const;

  it("la primera lectura fija desde cuándo se piden confirmaciones y lo guarda", async () => {
    const harness = await setup();
    const first = await harness.getData<Confirmations>(DATA_CONFIRMATIONS, { companyId: "c-bet" });
    expect(first.confirmed).toEqual({});
    // Una semana hacia atrás: la columna no arranca con todo el historial ni vacía.
    const age = Date.now() - Date.parse(first.since);
    expect(age).toBeGreaterThan(6.9 * 24 * 3600 * 1000);
    expect(age).toBeLessThan(7.1 * 24 * 3600 * 1000);
    expect(harness.getState(SCOPE)).toMatchObject({ since: first.since });
    // No depende de la empresa con que se invoque al worker, ni cambia al volver a leer.
    const again = await harness.getData<Confirmations>(DATA_CONFIRMATIONS, { companyId: "c-jst" });
    expect(again.since).toBe(first.since);
  });

  it("confirmar y deshacer: una acción cada una, guardada en ctx.state de la instancia", async () => {
    const harness = await setup();
    const confirmed = await harness.performAction<Confirmations>(CONFIRM_ACTIONS.confirm, { companyId: "c-bet", ids: ["bet-1", "jst-1", "bet-1"] });
    expect(Object.keys(confirmed.confirmed).sort()).toEqual(["bet-1", "jst-1"]);
    expect(harness.getState(SCOPE)).toMatchObject({ confirmed: { "bet-1": confirmed.confirmed["bet-1"] } });

    const undone = await harness.performAction<Confirmations>(CONFIRM_ACTIONS.unconfirm, { companyId: "c-jst", ids: ["bet-1"] });
    expect(Object.keys(undone.confirmed)).toEqual(["jst-1"]);
    expect(undone.since).toBe(confirmed.since);
    const read = await harness.getData<Confirmations>(DATA_CONFIRMATIONS, { companyId: "c-bet" });
    expect(read).toEqual(undone);
  });

  it("rechaza una llamada sin la lista de tareas", async () => {
    const harness = await setup();
    await expect(harness.performAction(CONFIRM_ACTIONS.confirm, { companyId: "c-bet" })).rejects.toThrow(/ids/);
    await expect(harness.performAction(CONFIRM_ACTIONS.confirm, { companyId: "c-bet", ids: ["ok", 7] })).rejects.toThrow(/ids/);
  });
});

describe("company-issues", () => {
  it("devuelve las tareas de la empresa autorizada", async () => {
    const harness = await setup();
    const bet = await harness.getData<CompanyIssues>(DATA_COMPANY_ISSUES, { companyId: "c-bet" });

    expect(bet).toMatchObject({ companyId: "c-bet", name: "Betacorp", issuePrefix: "BET", brandColor: null });
    expect(bet.issues.map((i) => i.id).sort()).toEqual(["bet-1", "bet-2"]);
  });

  it("manda a la UI solo los campos del board", async () => {
    const harness = await setup();
    const bet = await harness.getData<CompanyIssues>(DATA_COMPANY_ISSUES, { companyId: "c-bet" });
    const bet1 = bet.issues.find((i) => i.id === "bet-1");

    expect(bet1).toEqual({
      id: "bet-1",
      companyId: "c-bet",
      identifier: "BET-1",
      title: "Tarea bet-1",
      status: "todo",
      priority: "high",
      projectId: "p-web",
      parentId: null,
      assigneeAgentId: "a-dev",
      assigneeUserId: null,
      labels: [{ id: "l-1", name: "bug", color: "#00f" }],
      blockerIds: [],
      createdAt: "2026-09-30T09:00:00.000Z",
      updatedAt: "2026-10-01T12:00:00.000Z",
      closedAt: null,
    });
  });

  it("de una tarea cerrada manda cuándo se cerró: la base de «Por confirmar»", () => {
    const base = { id: "x", companyId: "c", title: "t", priority: "medium", createdAt: new Date("2026-10-01T00:00:00Z"), updatedAt: new Date("2026-10-09T00:00:00Z") };
    const done = toBoardIssue({ ...base, status: "done", completedAt: new Date("2026-10-05T10:00:00Z"), cancelledAt: null } as unknown as Issue);
    expect(done.closedAt).toBe("2026-10-05T10:00:00.000Z");
    const cancelled = toBoardIssue({ ...base, status: "cancelled", completedAt: null, cancelledAt: new Date("2026-10-06T10:00:00Z") } as unknown as Issue);
    expect(cancelled.closedAt).toBe("2026-10-06T10:00:00.000Z");
    // Reabierta: la fecha vieja de cierre ya no cuenta.
    const reopened = toBoardIssue({ ...base, status: "in_progress", completedAt: new Date("2026-10-05T10:00:00Z") } as unknown as Issue);
    expect(reopened.closedAt).toBeNull();
    // Cerrada sin fecha (datos viejos): `null`, y el board usa la última actualización.
    expect(toBoardIssue({ ...base, status: "done" } as unknown as Issue).closedAt).toBeNull();
  });

  it("incluye la tarea padre y el bloqueador (árbol y «Espera tu respuesta en…»)", async () => {
    const harness = await setup();
    const bet = await harness.getData<CompanyIssues>(DATA_COMPANY_ISSUES, { companyId: "c-bet" });
    expect(bet.issues.find((i) => i.id === "bet-2")).toMatchObject({ parentId: "bet-1", blockerIds: ["bet-1"] });
  });

  it("no mezcla empresas", async () => {
    const harness = await setup();
    const jst = await harness.getData<CompanyIssues>(DATA_COMPANY_ISSUES, { companyId: "c-jst" });
    expect(jst.issues.map((i) => i.id)).toEqual(["jst-1"]);
  });

  it("exige companyId", async () => {
    const harness = await setup();
    await expect(harness.getData(DATA_COMPANY_ISSUES)).rejects.toThrow(/companyId es obligatorio/);
  });
});
