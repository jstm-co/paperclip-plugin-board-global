import { describe, expect, it, vi } from "vitest";
import { buildBoardIndex, emptyFilters, type BoardFilters } from "../src/board.js";
import {
  afterCreate,
  buildCreateRequest,
  canCreateIn,
  defaultDraft,
  draftProblem,
  insertIssue,
  normalizeTitle,
  originKey,
  submitCreate,
  toBoardIssue,
  wakesAgent,
  withCompany,
  withStatus,
  withoutAgent,
  type CreateDraft,
  type CreatedIssue,
} from "../src/create.js";
import type { BoardIssue, CompanyBoard } from "../src/shared.js";

const USER = "user-1";

function board(companyId: string, name: string, prefix: string, extra: Partial<CompanyBoard> = {}): CompanyBoard {
  return { companyId, name, issuePrefix: prefix, brandColor: null, issues: [], elapsedMs: 1, projects: [], agents: [], attention: null, ...extra };
}

const index = buildBoardIndex([
  board("c-bet", "Betacorp", "BET", {
    projects: [{ id: "p-web", name: "Web", color: null }],
    agents: [{ id: "a-ana", name: "Ana" }],
  }),
  board("c-mol", "El Molino", "MOL", {
    projects: [{ id: "p-pan", name: "Pan", color: null }],
    agents: [{ id: "a-leo", name: "Leo" }],
  }),
  board("c-mig", "Mignon", "MIG"),
]);

const ctx = (patch: Partial<BoardFilters> = {}, userId: string | null = USER) => ({ index, filters: { ...emptyFilters(), ...patch }, userId });
const column = (status: "backlog" | "todo" | "in_progress" | "in_review") => ({ surface: "column" as const, status });

describe("columnas con «+»", () => {
  it("solo Backlog, Por hacer y En curso", () => {
    expect(["backlog", "todo", "in_progress"].every((s) => canCreateIn(s as never))).toBe(true);
    expect(["in_review", "blocked", "done", "cancelled"].some((s) => canCreateIn(s as never))).toBe(false);
  });
});

describe("valores por defecto (§4)", () => {
  it("sin filtro, carril ni grupo: sin empresa, estado de la columna, Media", () => {
    const draft = defaultDraft(column("backlog"), ctx());
    expect(draft).toMatchObject({ companyId: null, status: "backlog", priority: "medium", projectId: null, assignee: null });
  });

  it("un filtro de una sola empresa la pone, con el embudo del filtro", () => {
    const draft = defaultDraft(column("todo"), ctx({ emp: ["MOL"] }));
    expect(draft.companyId).toBe("c-mol");
    expect(draft.from.company).toBe("filtro");
  });

  it("dos empresas en el filtro no preseleccionan ninguna", () => {
    expect(defaultDraft(column("todo"), ctx({ emp: ["MOL", "BET"] })).companyId).toBeNull();
  });

  it("el filtro de un proyecto solo vale si es de esa empresa", () => {
    expect(defaultDraft(column("todo"), ctx({ emp: ["BET"], prj: ["p-web"] })).projectId).toBe("p-web");
    expect(defaultDraft(column("todo"), ctx({ emp: ["MOL"], prj: ["p-web"] })).projectId).toBeNull();
    expect(defaultDraft(column("todo"), ctx({ prj: ["p-web"] })).projectId).toBeNull();
  });

  it("el carril de empresa pone la empresa (gana al filtro)", () => {
    const draft = defaultDraft({ surface: "cell", status: "todo", by: "empresa", key: "c-mig" }, ctx({ emp: ["BET"] }));
    expect(draft.companyId).toBe("c-mig");
    expect(draft.from.company).toBe("carril");
  });

  it("el carril de proyecto pone el proyecto y su empresa", () => {
    const draft = defaultDraft({ surface: "cell", status: "todo", by: "proyecto", key: "p-pan" }, ctx());
    expect(draft).toMatchObject({ companyId: "c-mol", projectId: "p-pan" });
  });

  it("el carril de agente asigna al agente y pone su empresa", () => {
    const draft = defaultDraft({ surface: "cell", status: "todo", by: "responsable", key: "agent:a-ana" }, ctx());
    expect(draft).toMatchObject({ companyId: "c-bet", assignee: { kind: "agent", id: "a-ana" } });
    expect(draft.from.assignee).toBe("carril");
  });

  it("«Sin proyecto» y «Sin asignar» no ponen nada", () => {
    expect(defaultDraft({ surface: "group", status: "todo", by: "proyecto", key: "none" }, ctx()).companyId).toBeNull();
    expect(defaultDraft({ surface: "group", status: "todo", by: "responsable", key: "none" }, ctx()).assignee).toBeNull();
  });

  it("el grupo de prioridad y el de estado ponen su valor", () => {
    expect(defaultDraft({ surface: "group", status: "todo", by: "prioridad", key: "high" }, ctx()).priority).toBe("high");
    expect(defaultDraft({ surface: "group", status: "todo", by: "estado", key: "backlog" }, ctx()).status).toBe("backlog");
  });

  it("En curso sin agente queda en «Yo» (el servidor exige responsable)", () => {
    expect(defaultDraft(column("in_progress"), ctx()).assignee).toEqual({ kind: "user", id: USER });
    expect(defaultDraft(column("in_progress"), ctx({}, null)).assignee).toBeNull();
  });

  it("En curso con el carril de un agente conserva al agente", () => {
    const draft = defaultDraft({ surface: "cell", status: "in_progress", by: "responsable", key: "agent:a-leo" }, ctx());
    expect(draft.assignee).toEqual({ kind: "agent", id: "a-leo" });
  });

  it("la cabecera abre en Por hacer", () => {
    expect(defaultDraft({ surface: "head", status: "todo" }, ctx()).status).toBe("todo");
  });

  it("un estado que no admite «+» cae en Por hacer", () => {
    expect(defaultDraft(column("in_review"), ctx()).status).toBe("todo");
  });

  it("conserva el título al mover el compositor", () => {
    expect(defaultDraft(column("todo"), ctx(), "Algo").title).toBe("Algo");
  });

  it("la clave del origen distingue sitios", () => {
    expect(originKey(column("todo"))).not.toBe(originKey(column("backlog")));
    expect(originKey({ surface: "cell", status: "todo", by: "empresa", key: "a" })).not.toBe(originKey({ surface: "cell", status: "todo", by: "empresa", key: "b" }));
  });
});

describe("cambios del borrador", () => {
  const base = (patch: Partial<CreateDraft> = {}): CreateDraft => ({ ...defaultDraft(column("todo"), ctx()), title: "x", ...patch });

  it("cambiar de empresa vacía el proyecto y el agente de la otra", () => {
    const draft = base({ companyId: "c-bet", projectId: "p-web", assignee: { kind: "agent", id: "a-ana" } });
    const moved = withCompany(draft, "c-mol", index);
    expect(moved).toMatchObject({ companyId: "c-mol", projectId: null, assignee: null });
  });

  it("cambiar a la misma empresa conserva proyecto y agente; «Yo» siempre se queda", () => {
    const draft = base({ companyId: "c-bet", projectId: "p-web", assignee: { kind: "agent", id: "a-ana" } });
    expect(withCompany(draft, "c-bet", index)).toMatchObject({ projectId: "p-web", assignee: { kind: "agent", id: "a-ana" } });
    expect(withCompany(base({ assignee: { kind: "user", id: USER } }), "c-mol", index).assignee).toEqual({ kind: "user", id: USER });
  });

  it("pasar a En curso sin responsable pone «Yo»; salir de En curso lo deja", () => {
    const inProgress = withStatus(base(), "in_progress", USER);
    expect(inProgress.assignee).toEqual({ kind: "user", id: USER });
    expect(withStatus(inProgress, "todo", USER).assignee).toEqual({ kind: "user", id: USER });
  });

  it("pasar a En curso con un agente no lo cambia", () => {
    const agent = { kind: "agent" as const, id: "a-ana" };
    expect(withStatus(base({ assignee: agent }), "in_progress", USER).assignee).toEqual(agent);
  });

  it("quitar el agente deja «Sin responsable», o «Yo» en En curso", () => {
    const agent = { kind: "agent" as const, id: "a-ana" };
    expect(withoutAgent(base({ assignee: agent }), USER).assignee).toBeNull();
    expect(withoutAgent(base({ status: "in_progress", assignee: agent }), USER).assignee).toEqual({ kind: "user", id: USER });
  });

  it("asignar a un agente despierta salvo en Backlog; «Yo» nunca", () => {
    const agent = { kind: "agent" as const, id: "a-ana" };
    expect(wakesAgent({ status: "todo", assignee: agent })).toBe(true);
    expect(wakesAgent({ status: "in_progress", assignee: agent })).toBe(true);
    expect(wakesAgent({ status: "backlog", assignee: agent })).toBe(false);
    expect(wakesAgent({ status: "todo", assignee: { kind: "user", id: USER } })).toBe(false);
    expect(wakesAgent({ status: "todo", assignee: null })).toBe(false);
  });

  it("tras crear: título vacío, mismos datos y sin agente", () => {
    const agent = { kind: "agent" as const, id: "a-ana" };
    const next = afterCreate(base({ companyId: "c-bet", projectId: "p-web", priority: "high", assignee: agent }), USER);
    expect(next).toMatchObject({ title: "", companyId: "c-bet", projectId: "p-web", priority: "high", assignee: null });
    expect(afterCreate(base({ status: "in_progress", assignee: agent }), USER).assignee).toEqual({ kind: "user", id: USER });
  });
});

describe("armado de la petición (§7)", () => {
  const draft = (patch: Partial<CreateDraft> = {}): CreateDraft => ({
    ...defaultDraft(column("todo"), ctx({ emp: ["BET"] })),
    title: "  Revisar el pan \n del día  ",
    ...patch,
  });
  const opts = { idempotencyKey: "k-1" };

  it("manda empresa, estado de la columna y título normalizado", () => {
    expect(buildCreateRequest(draft(), opts)).toEqual({
      companyId: "c-bet",
      body: { title: "Revisar el pan del día", status: "todo", priority: "medium", idempotencyKey: "k-1" },
    });
  });

  it("el estado de la petición es el de la columna", () => {
    expect(buildCreateRequest(draft({ status: "backlog" }), opts).body.status).toBe("backlog");
  });

  it("manda proyecto y prioridad solo si hay", () => {
    const { body } = buildCreateRequest(draft({ projectId: "p-web", priority: "high" }), opts);
    expect(body).toMatchObject({ projectId: "p-web", priority: "high" });
    expect("projectId" in buildCreateRequest(draft(), opts).body).toBe(false);
  });

  it("un agente va en assigneeAgentId y «Yo» en assigneeUserId", () => {
    expect(buildCreateRequest(draft({ assignee: { kind: "agent", id: "a-ana" } }), opts).body).toMatchObject({ assigneeAgentId: "a-ana" });
    const self = buildCreateRequest(draft({ assignee: { kind: "user", id: USER } }), opts).body;
    expect(self).toMatchObject({ assigneeUserId: USER });
    expect("assigneeAgentId" in self).toBe(false);
  });

  it("«Crear igual» manda allowDuplicate", () => {
    expect(buildCreateRequest(draft(), { ...opts, allowDuplicate: true }).body.allowDuplicate).toBe(true);
    expect("allowDuplicate" in buildCreateRequest(draft(), opts).body).toBe(false);
  });

  it("sin empresa, sin título o En curso sin responsable no se arma", () => {
    expect(draftProblem(draft({ companyId: null }))).toBe("company");
    expect(draftProblem(draft({ title: "   " }))).toBe("title");
    expect(draftProblem(draft({ status: "in_progress", assignee: null }))).toBe("assignee");
    expect(draftProblem(draft())).toBeNull();
    expect(() => buildCreateRequest(draft({ companyId: null }), opts)).toThrow();
  });

  it("normaliza los saltos de línea", () => {
    expect(normalizeTitle("a\r\nb\n\n c ")).toBe("a b c");
  });
});

describe("inserción y refresco", () => {
  const created = (extra: Partial<CreatedIssue> = {}): CreatedIssue => ({
    id: "i-new",
    companyId: "c-bet",
    identifier: "BET-7",
    title: "Nueva",
    status: "todo",
    priority: "medium",
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    ...extra,
  });
  const existing = { id: "i-old" } as BoardIssue;
  const request = buildCreateRequest({ ...defaultDraft(column("todo"), ctx({ emp: ["BET"] })), title: "Nueva" }, { idempotencyKey: "k" });

  it("la tarea nueva queda primera y no duplica si ya estaba", () => {
    const issue = toBoardIssue(created());
    expect(insertIssue([existing], issue).map((i) => i.id)).toEqual(["i-new", "i-old"]);
    expect(insertIssue([issue, existing], { ...issue, title: "Otra" })).toHaveLength(2);
  });

  it("toBoardIssue completa lo que el POST no trae", () => {
    expect(toBoardIssue(created())).toMatchObject({ projectId: null, parentId: null, assigneeAgentId: null, labels: [], blockerIds: [] });
  });

  it("con 201 inserta al instante y después recarga solo esa empresa", async () => {
    const order: string[] = [];
    const io = {
      create: vi.fn(async () => created()),
      insert: vi.fn(() => void order.push("insert")),
      refresh: vi.fn(async () => void order.push("refresh")),
    };
    const outcome = await submitCreate(request, io);
    expect(outcome.kind).toBe("created");
    expect(io.create).toHaveBeenCalledWith("c-bet", request.body);
    expect(io.refresh).toHaveBeenCalledWith("c-bet");
    expect(order).toEqual(["insert", "refresh"]);
  });

  it("si la recarga falla, la tarea insertada se queda y el envío vale", async () => {
    const io = { create: async () => created(), insert: vi.fn(), refresh: async () => Promise.reject(new Error("red")) };
    await expect(submitCreate(request, io)).resolves.toMatchObject({ kind: "created" });
    expect(io.insert).toHaveBeenCalledOnce();
  });

  it("con deduplicated no inserta ni recarga", async () => {
    const io = { create: async () => created({ deduplicated: true }), insert: vi.fn(), refresh: vi.fn() };
    const outcome = await submitCreate(request, io);
    expect(outcome).toMatchObject({ kind: "duplicate", issue: { id: "i-new" } });
    expect(io.insert).not.toHaveBeenCalled();
    expect(io.refresh).not.toHaveBeenCalled();
  });

  it("un error del servidor se propaga tal cual y no toca el board", async () => {
    const io = { create: async () => Promise.reject(new Error("in_progress issues require an assignee")), insert: vi.fn(), refresh: vi.fn() };
    await expect(submitCreate(request, io)).rejects.toThrow("in_progress issues require an assignee");
    expect(io.insert).not.toHaveBeenCalled();
  });
});
