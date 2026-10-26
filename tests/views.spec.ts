import { describe, expect, it } from "vitest";
import { buildBoardIndex, defaultQuery, parseBoardQuery, toggleValue } from "../src/board.js";
import type { BoardIssue, CompanyBoard } from "../src/shared.js";
import {
  activeView,
  applyViewOp,
  createView,
  deleteView,
  hasViewFilters,
  normalizeSearch,
  parseStoredViews,
  parseViewOp,
  renameView,
  storedViews,
  suggestViewName,
  updateView,
  viewCount,
  viewNameError,
  viewQuery,
  viewState,
  type SavedView,
} from "../src/views.js";

function issue(id: string, companyId: string, extra: Partial<BoardIssue> = {}): BoardIssue {
  return {
    id,
    companyId,
    identifier: id.toUpperCase(),
    title: `Tarea ${id}`,
    status: "todo",
    priority: "medium",
    projectId: null,
    parentId: null,
    assigneeAgentId: null,
    assigneeUserId: null,
    labels: [],
    blockerIds: [],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...extra,
  };
}

function board(companyId: string, name: string, prefix: string, issues: BoardIssue[], extra: Partial<CompanyBoard> = {}): CompanyBoard {
  return { companyId, name, issuePrefix: prefix, brandColor: null, elapsedMs: 1, projects: [], agents: [], attention: [], issues, ...extra };
}

const NOW = "2026-10-17T03:00:00.000Z";
const NOW_MS = Date.parse(NOW);

const index = buildBoardIndex([
  board(
    "c-bet",
    "Betacorp",
    "BET",
    [
      issue("bet-1", "c-bet", { status: "blocked" }),
      issue("bet-2", "c-bet", { status: "in_progress", assigneeUserId: "local-board", updatedAt: "2026-10-15T00:00:00.000Z" }),
      issue("bet-3", "c-bet", { status: "done", assigneeUserId: "local-board" }),
    ],
    { projects: [{ id: "p-web", name: "Web", color: null }], agents: [{ id: "a-ux", name: "Diseñador/a" }] },
  ),
  board("c-mig", "Mignon", "MIG", [issue("mig-1", "c-mig", { status: "blocked", assigneeUserId: "local-board" })]),
]);

const blocked = parseBoardQuery("?est=blocked");
const mine = parseBoardQuery("?resp=user:local-board");

function sample(): SavedView[] {
  const one = createView([], "Bloqueadas de todas las empresas", blocked, "v1", NOW);
  return createView(one, "Lo mío", mine, "v2", NOW);
}

describe("vistas guardadas", () => {
  it("crear guarda el nombre limpio y la consulta normalizada", () => {
    const views = createView([], "  Bloqueadas   de todas  ", { ...blocked, view: "kanban" }, "v1", NOW);
    expect(views).toEqual([{ id: "v1", name: "Bloqueadas de todas", search: "?est=blocked", createdAt: NOW }]);
  });

  it("el nombre no puede ir vacío, pasar de 60 caracteres ni repetirse (sin distinguir mayúsculas ni tildes)", () => {
    const views = sample();
    expect(viewNameError(views, "   ")).toBe("Escribe un nombre.");
    expect(viewNameError(views, "x".repeat(61))).toBe("Máximo 60 caracteres.");
    expect(viewNameError(views, "lo MÍO")).toBe("Ya hay una vista con ese nombre.");
    expect(viewNameError(views, "lo MÍO", "v2")).toBeNull();
    expect(() => createView(views, "Lo mio", defaultQuery(), "v3")).toThrow("Ya hay una vista con ese nombre.");
  });

  it("renombrar cambia solo esa vista y no acepta el nombre de otra", () => {
    const views = renameView(sample(), "v2", "Lo mío esta semana");
    expect(views.map((view) => view.name)).toEqual(["Bloqueadas de todas las empresas", "Lo mío esta semana"]);
    expect(views[1].search).toBe("?resp=user:local-board");
    expect(() => renameView(views, "v2", "bloqueadas de todas las empresas")).toThrow();
  });

  it("actualizar guarda la consulta de ahora; borrar quita solo esa vista", () => {
    const updated = updateView(sample(), "v2", parseBoardQuery("?resp=user:local-board&act=7d"));
    expect(updated.map((view) => view.search)).toEqual(["?est=blocked", "?resp=user:local-board&act=7d"]);
    expect(deleteView(sample(), "v1").map((view) => view.id)).toEqual(["v2"]);
    expect(deleteView(sample(), "nada")).toHaveLength(2);
  });

  it("abrir devuelve la consulta guardada, con vista, agrupación, carriles y fecha", () => {
    const kanban = parseBoardQuery("?est=blocked&act=7d&carr=responsable&sub=0");
    const [porResponsable] = createView([], "Por responsable", kanban, "v1", NOW);
    expect(porResponsable.search).toBe("?est=blocked&act=7d&carr=responsable&sub=0");
    expect(viewQuery(porResponsable)).toEqual(kanban);
    const lista = parseBoardQuery("?v=lista&est=blocked&act=7d&grp=proyecto&cerr=1");
    const [porProyecto] = createView([], "Por proyecto", lista, "v2", NOW);
    expect(porProyecto.search).toBe("?v=lista&est=blocked&act=7d&grp=proyecto&cerr=1");
    expect(viewQuery(porProyecto)).toEqual(lista);
  });

  it("en la Lista, el `carr` que queda del Kanban no se guarda: los carriles son solo del Kanban", () => {
    const lista = parseBoardQuery("?v=lista&est=blocked&carr=empresa");
    const [view] = createView([], "Bloqueadas en lista", lista, "v1", NOW);
    expect(view.search).toBe("?v=lista&est=blocked");
    expect(updateView([view], "v1", parseBoardQuery("?v=lista&carr=proyecto"))[0].search).toBe("?v=lista");
    expect(normalizeSearch("?v=lista&carr=responsable&grp=proyecto")).toBe("?v=lista&grp=proyecto");
  });

  it("la pestaña activa es la vista que coincide con la URL; al cambiar un filtro, ninguna", () => {
    const views = sample();
    expect(activeView(views, parseBoardQuery("?v=kanban&est=blocked"))?.id).toBe("v1");
    expect(activeView(views, { ...blocked, filters: toggleValue(blocked.filters, "emp", "BET") })).toBeNull();
    expect(activeView(views, defaultQuery())).toBeNull();
  });

  it("el conteo es lo que se ve al abrir la vista; con fecha, respecto de ahora", () => {
    const [bloqueadas, mias] = sample();
    expect(viewCount(index, bloqueadas, NOW_MS)).toBe(2);
    // En el kanban, la hecha queda fuera de las columnas visibles.
    expect(viewCount(index, mias, NOW_MS)).toBe(2);
    const [lista] = createView([], "Lo mío en lista", { ...mine, view: "lista" }, "v3", NOW);
    expect(viewCount(index, lista, NOW_MS)).toBe(3);
    const [semana] = createView([], "Lo mío · últimos 7 días", parseBoardQuery("?resp=user:local-board&act=7d"), "v4", NOW);
    expect(viewCount(index, semana, NOW_MS)).toBe(1);
    // Una semana después, la misma vista ya no cuenta esa tarea.
    expect(viewCount(index, semana, NOW_MS + 7 * 24 * 3600 * 1000)).toBe(0);
  });
});

describe("pestaña marcada y «Cambios sin guardar»", () => {
  const views = sample();

  it("«Todo el board» es sin filtros ni carriles, aunque cambien la vista, la agrupación, las subtareas o las cerradas", () => {
    expect(viewState(views, defaultQuery(), null)).toEqual({ kind: "all" });
    expect(viewState(views, parseBoardQuery("?v=lista&grp=proyecto&sub=0&cerr=1"), null)).toEqual({ kind: "all" });
    expect(viewState(views, parseBoardQuery("?carr=empresa"), null)).toEqual({ kind: "unsaved" });
  });

  it("en la Lista, el `carr` que queda del Kanban no cuenta (JST-26)", () => {
    // Kanban con carriles → Lista: la URL guarda `carr` para volver con ellos, pero en la Lista no se ven.
    const lista = parseBoardQuery("?v=lista&carr=empresa");
    expect(viewState(views, lista, null)).toEqual({ kind: "all" });
    expect(hasViewFilters(lista)).toBe(false);
    const [enLista] = createView([], "Lista por empresa", parseBoardQuery("?v=lista"), "v9", NOW);
    expect(viewState([...views, enLista], lista, null)).toEqual({ kind: "view", view: enLista });
    expect(activeView([...views, enLista], parseBoardQuery("?v=lista&est=blocked&carr=proyecto"))).toBeNull();
    // De vuelta en el Kanban, los carriles vuelven a contar.
    expect(viewState([...views, enLista], parseBoardQuery("?carr=empresa"), null)).toEqual({ kind: "unsaved" });
  });

  it("si la URL coincide con una vista, esa queda marcada", () => {
    expect(viewState(views, blocked, null)).toEqual({ kind: "view", view: views[0] });
  });

  it("al cambiar un filtro, la última vista abierta queda con cambios; sin origen, son filtros sin guardar", () => {
    const changed = { ...blocked, filters: toggleValue(blocked.filters, "emp", "BET") };
    expect(viewState(views, changed, "v1")).toEqual({ kind: "mod", view: views[0] });
    expect(viewState(views, changed, null)).toEqual({ kind: "unsaved" });
    // Si la vista de origen se borró, no hay cambios que guardar en ella.
    expect(viewState(deleteView(views, "v1"), changed, "v1")).toEqual({ kind: "unsaved" });
  });

  it("mientras las vistas no llegan, no hay pestaña que marcar", () => {
    expect(viewState(null, blocked, "v1")).toEqual({ kind: "unsaved" });
    expect(viewState(null, defaultQuery(), "v1")).toEqual({ kind: "all" });
  });

  it("solo hay algo que guardar con filtros, fecha o carriles", () => {
    expect(hasViewFilters(defaultQuery())).toBe(false);
    expect(hasViewFilters(parseBoardQuery("?v=lista&sub=0"))).toBe(false);
    expect(hasViewFilters(parseBoardQuery("?act=7d"))).toBe(true);
    expect(hasViewFilters(parseBoardQuery("?carr=proyecto"))).toBe(true);
  });
});

describe("nombre sugerido", () => {
  const suggest = (search: string, views: SavedView[] = []) => suggestViewName(index, parseBoardQuery(search), views);

  it("estados, prioridades y empresas", () => {
    expect(suggest("?est=blocked")).toBe("Bloqueadas de todas las empresas");
    expect(suggest("?pri=critical,high")).toBe("Críticas y altas de todas las empresas");
    expect(suggest("?pri=critical,high&emp=BET")).toBe("Críticas y altas de Betacorp");
    expect(suggest("?est=in_review&emp=BET,MIG")).toBe("En revisión · BET, MIG");
    expect(suggest("?est=todo,in_progress,blocked")).toBe("3 estados de todas las empresas");
    expect(suggest("?toca=1&est=blocked")).toBe("Te toca · Bloqueadas de todas las empresas");
  });

  it("proyecto, responsable, etiqueta y texto", () => {
    expect(suggest("?prj=p-web")).toBe("Web de todas las empresas");
    expect(suggest("?resp=agent:a-ux&emp=BET")).toBe("Diseñador/a de Betacorp");
    expect(suggest("?eti=bug,ux")).toBe("2 etiquetas de todas las empresas");
    expect(suggest("?q=pago")).toBe("«pago» de todas las empresas");
  });

  it("Responsable = Board es «Lo mío», con o sin fecha", () => {
    expect(suggest("?resp=user:local-board")).toBe("Lo mío");
    expect(suggest("?resp=user:local-board&act=7d")).toBe("Lo mío · últimos 7 días");
    expect(suggest("?resp=user:local-board&emp=MIG")).toBe("Lo mío de Mignon");
  });

  it("fecha y carriles se agregan al final; solos tienen su propio nombre", () => {
    expect(suggest("?act=7d")).toBe("Actualizadas en los últimos 7 días");
    expect(suggest("?carr=empresa")).toBe("Por empresa");
    expect(suggest("?est=blocked&carr=responsable")).toBe("Bloqueadas de todas las empresas · por responsable");
    // En la Lista no hay carriles.
    expect(suggest("?v=lista&carr=empresa")).toBe("Lista por empresa");
  });

  it("no repite un nombre y no pasa de 60 caracteres", () => {
    expect(suggest("?est=blocked", sample())).toBe("Bloqueadas de todas las empresas (2)");
    expect(suggest(`?q=${"x".repeat(80)}`).length).toBeLessThanOrEqual(60);
  });
});

describe("vistas en el servidor", () => {
  it("descarta lo que no sirve y normaliza lo guardado", () => {
    expect(parseStoredViews(null)).toEqual([]);
    expect(parseStoredViews("no es json")).toEqual([]);
    expect(parseStoredViews({ views: 3 })).toEqual([]);
    const data = {
      version: 1,
      views: [
        { id: "v1", name: " Bloqueadas ", search: "?v=kanban&est=blocked,nope&act=30d", createdAt: NOW },
        { id: "v1", name: "Id repetido", search: "" },
        { id: "v2", name: "bloqueadas", search: "" },
        { id: "v3", name: "", search: "" },
        { id: "v4", name: "Sin consulta" },
        "basura",
      ],
    };
    expect(parseStoredViews(data)).toEqual([
      { id: "v1", name: "Bloqueadas", search: "?est=blocked", createdAt: NOW },
      { id: "v4", name: "Sin consulta", search: "", createdAt: "" },
    ]);
    expect(parseStoredViews(JSON.stringify(storedViews(sample())))).toEqual(sample());
  });

  it("una operación por acción: crear, renombrar, actualizar y borrar devuelven la lista vigente", () => {
    const created = applyViewOp([], { op: "create", id: "v1", name: " Bloqueadas ", search: "?v=kanban&est=blocked" }, NOW);
    expect(created).toEqual({ ok: true, views: [{ id: "v1", name: "Bloqueadas", search: "?est=blocked", createdAt: NOW }] });
    const renamed = applyViewOp(created.views, { op: "rename", id: "v1", name: "Bloqueadas de todas" });
    expect(renamed.ok && renamed.views[0].name).toBe("Bloqueadas de todas");
    const updated = applyViewOp(renamed.views, { op: "update", id: "v1", search: "?carr=empresa&est=blocked" });
    expect(updated.ok && updated.views[0].search).toBe("?est=blocked&carr=empresa");
    expect(applyViewOp(updated.views, { op: "delete", id: "v1" })).toEqual({ ok: true, views: [] });
  });

  it("si otro navegador cambió la lista: nombre repetido o vista que ya no existe", () => {
    const views = sample();
    expect(applyViewOp(views, { op: "create", id: "v3", name: "lo mio", search: "" })).toEqual({
      ok: false,
      reason: "invalid",
      message: "Ya hay una vista con ese nombre.",
      views,
    });
    for (const op of [
      { op: "rename", id: "nada", name: "Otra" },
      { op: "update", id: "nada", search: "" },
      { op: "delete", id: "nada" },
    ] as const) {
      expect(applyViewOp(views, op)).toMatchObject({ ok: false, reason: "not_found", views });
    }
  });

  it("valida los parámetros de cada acción", () => {
    expect(parseViewOp("delete", { id: "v1", companyId: "c-bet" })).toEqual({ op: "delete", id: "v1" });
    expect(parseViewOp("create", { id: "v1", name: "X", search: "?est=blocked" })).toEqual({
      op: "create",
      id: "v1",
      name: "X",
      search: "?est=blocked",
    });
    expect(() => parseViewOp("rename", { id: "v1" })).toThrow('Falta "name"');
    expect(() => parseViewOp("update", { id: "", search: "" })).toThrow('Falta "id"');
  });
});
