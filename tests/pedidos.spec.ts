import { describe, expect, it } from "vitest";
import { buildBoardIndex, defaultQuery, emptyFilters, parseBoardQuery, progressOf, type BoardFilters, type BoardQuery } from "../src/board.js";
import {
  PEDIDO_STATES,
  commentLine,
  descendantsOf,
  isHiddenTitle,
  isPedido,
  liveByIssue,
  pedidoRoots,
  pedidoRows,
  pedidoSections,
  pedidoTree,
  subtreeProgress,
  summarizePedido,
} from "../src/pedidos.js";
import type { AttentionItem, BoardIssue, CompanyBoard, LiveRun } from "../src/shared.js";
import { queryCount } from "../src/views.js";

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

function asks(issueId: string): AttentionItem {
  return {
    sourceKind: "issue_thread_interaction",
    subject: { kind: "interaction", title: "Confirmar el despliegue", href: `/X/issues/${issueId}#interaction-1`, metadata: { kind: "request_confirmation" } },
    relatedIssue: { id: issueId },
    createdAt: "2026-10-16T10:00:00.000Z",
  };
}

/** Tarea bloqueada sin nada vivo: el Inbox la avisa, pero no espera nada del usuario. */
function stalls(issueId: string): AttentionItem {
  return {
    sourceKind: "blocker_attention",
    subject: { kind: "issue", title: `Tarea ${issueId}` },
    relatedIssue: { id: issueId },
    detail: { blockedTaskCount: 2 },
    createdAt: "2026-10-16T10:00:00.000Z",
  };
}

function run(id: string, issueId: string | null, status = "running"): LiveRun {
  return {
    id,
    companyId: "c-mol",
    status,
    invocationSource: "assignment",
    agentId: "a-ing",
    agentName: "Ingeniera",
    issueId,
    createdAt: "2026-10-16T09:00:00.000Z",
    startedAt: status === "queued" ? null : "2026-10-16T09:00:05.000Z",
    finishedAt: status === "succeeded" ? "2026-10-16T09:10:00.000Z" : null,
  };
}

const mol = (id: string, extra: Partial<BoardIssue> = {}) => issue(id, "c-mol", extra);

const boards: CompanyBoard[] = [
  {
    companyId: "c-mol",
    name: "El Molino",
    issuePrefix: "MOL",
    brandColor: null,
    elapsedMs: 1,
    projects: [{ id: "p-web", name: "Web", color: null }],
    agents: [{ id: "a-ing", name: "Ingeniera" }],
    attention: [asks("mol-10"), asks("mol-98"), stalls("mol-25"), stalls("mol-90"), stalls("mol-31")],
    issues: [
      // Pedido con tres niveles: MOL-1 > MOL-3 > MOL-4 > MOL-6.
      mol("mol-1", { status: "in_progress", title: "Tienda en línea", projectId: "p-web" }),
      mol("mol-2", { status: "done", parentId: "mol-1" }),
      mol("mol-3", { status: "in_progress", parentId: "mol-1" }),
      mol("mol-4", { status: "todo", parentId: "mol-3" }),
      mol("mol-5", { status: "cancelled", parentId: "mol-1" }),
      mol("mol-6", { status: "done", parentId: "mol-4", title: "Migrar facturas", updatedAt: "2026-10-16T00:00:00.000Z" }),
      // Todo hecho y la raíz espera una respuesta.
      mol("mol-10", { status: "blocked", updatedAt: "2026-10-12T00:00:00.000Z" }),
      mol("mol-11", { status: "done", parentId: "mol-10" }),
      mol("mol-12", { status: "done", parentId: "mol-11" }),
      // Todo hecho y la raíz sigue abierta.
      mol("mol-20", { status: "in_progress" }),
      mol("mol-21", { status: "done", parentId: "mol-20" }),
      mol("mol-22", { status: "done", parentId: "mol-20" }),
      mol("mol-23", { status: "cancelled", parentId: "mol-20" }),
      // Todo hecho, pero la raíz quedó bloqueada sin bloqueador.
      mol("mol-25", { status: "blocked" }),
      mol("mol-26", { status: "done", parentId: "mol-25" }),
      // Frenado por una tarea de otro pedido.
      mol("mol-30", { status: "in_progress" }),
      mol("mol-31", { status: "blocked", parentId: "mol-30", blockerIds: ["mol-60"] }),
      // El bloqueador es del mismo pedido: no cuenta como freno.
      mol("mol-40", { status: "in_progress" }),
      mol("mol-41", { status: "blocked", parentId: "mol-40", blockerIds: ["mol-42"] }),
      mol("mol-42", { status: "todo", parentId: "mol-40" }),
      // El bloqueador ya está hecho.
      mol("mol-50", { status: "todo", blockerIds: ["mol-2"] }),
      // El bloqueador no está en el board.
      mol("mol-55", { status: "blocked", blockerIds: ["fuera-del-board"] }),
      mol("mol-60", { status: "backlog", updatedAt: "2026-09-20T00:00:00.000Z" }),
      mol("mol-61", { status: "todo" }),
      mol("mol-62", { status: "todo", parentId: "mol-61" }),
      mol("mol-70", { status: "done" }),
      mol("mol-80", { status: "todo", title: "Aviso automático: revisar el cupo" }),
      mol("mol-90", { status: "blocked" }),
      // Algo hecho y lo que falta quedó en backlog.
      mol("mol-91", { status: "backlog" }),
      mol("mol-92", { status: "done", parentId: "mol-91" }),
      mol("mol-93", { status: "backlog", parentId: "mol-91" }),
      // Cerrados con cabos sueltos: una subtarea abierta, o una que espera tu respuesta.
      mol("mol-94", { status: "done" }),
      mol("mol-95", { status: "backlog", parentId: "mol-94" }),
      mol("mol-96", { status: "done" }),
      mol("mol-97", { status: "done", parentId: "mol-96" }),
      mol("mol-98", { status: "done", parentId: "mol-97" }),
    ],
  },
  {
    companyId: "c-bet",
    name: "Betacorp",
    issuePrefix: "BET",
    brandColor: null,
    elapsedMs: 1,
    projects: [],
    agents: [],
    attention: [],
    issues: [issue("bet-1", "c-bet", { status: "todo" }), issue("bet-2", "c-bet", { status: "in_review", parentId: "bet-1" })],
  },
];

const index = buildBoardIndex(boards);
const get = (id: string) => index.byId.get(id)!;
const ids = (list: readonly BoardIssue[]) => list.map((i) => i.id).sort();
const query = (patch: Partial<BoardQuery> = {}, filters: Partial<BoardFilters> = {}): BoardQuery => ({
  ...defaultQuery(),
  view: "pedidos",
  ...patch,
  filters: { ...emptyFilters(), ...filters },
});
const NOW = Date.parse("2026-10-17T03:00:00.000Z");
const stateOf = (id: string, live: readonly LiveRun[] = []) => summarizePedido(index, get(id), liveByIssue(live)).state;

describe("subárbol del pedido", () => {
  it("un pedido es una tarea sin padre en el board", () => {
    expect(isPedido(index, get("mol-1"))).toBe(true);
    expect(isPedido(index, get("mol-4"))).toBe(false);
    // El padre no llegó al board (otra empresa falló, o no se ve): la tarea queda como pedido.
    const huerfana = buildBoardIndex([{ ...boards[1], issues: [issue("bet-9", "c-bet", { parentId: "no-esta" })] }]);
    expect(isPedido(huerfana, huerfana.byId.get("bet-9")!)).toBe(true);
  });

  it("trae las descendientes de cualquier nivel", () => {
    expect(ids(descendantsOf(index, get("mol-1")))).toEqual(["mol-2", "mol-3", "mol-4", "mol-5", "mol-6"]);
    expect(descendantsOf(index, get("mol-60"))).toEqual([]);
  });

  it("un ciclo de padres no lo cuelga", () => {
    const ciclo = buildBoardIndex([
      { ...boards[1], issues: [issue("bet-1", "c-bet", { parentId: "bet-2" }), issue("bet-2", "c-bet", { parentId: "bet-1" })] },
    ]);
    expect(ids(descendantsOf(ciclo, ciclo.byId.get("bet-1")!))).toEqual(["bet-2"]);
    expect(pedidoTree(ciclo, ciclo.byId.get("bet-1")!).map((row) => row.issue.id)).toEqual(["bet-2"]);
  });

  it("el avance cuenta todo el subárbol sin las canceladas, no solo las hijas directas", () => {
    expect(progressOf(index, get("mol-1"))).toEqual({ done: 1, total: 2 });
    expect(subtreeProgress(index, get("mol-1"))).toEqual({ done: 2, total: 4 });
    expect(subtreeProgress(index, get("mol-20"))).toEqual({ done: 2, total: 2 });
    expect(subtreeProgress(index, get("mol-60"))).toEqual({ done: 0, total: 0 });
  });

  it("el árbol va en profundidad, con las abiertas primero en cada nivel", () => {
    expect(pedidoTree(index, get("mol-1")).map((row) => [row.issue.id, row.depth])).toEqual([
      ["mol-3", 0],
      ["mol-4", 1],
      ["mol-6", 2],
      ["mol-2", 0],
      ["mol-5", 0],
    ]);
  });
});

describe("quién tiene la pelota", () => {
  it("clasifica cada pedido por su subárbol", () => {
    expect(stateOf("mol-1")).toBe("curso");
    expect(stateOf("mol-10")).toBe("toca");
    expect(stateOf("mol-20")).toBe("cerrar");
    expect(stateOf("mol-25")).toBe("bloqueado");
    expect(stateOf("mol-30")).toBe("espera");
    expect(stateOf("mol-40")).toBe("curso");
    expect(stateOf("mol-50")).toBe("nuevo");
    expect(stateOf("mol-55")).toBe("espera");
    expect(stateOf("mol-60")).toBe("nuevo");
    expect(stateOf("mol-61")).toBe("nuevo");
    expect(stateOf("mol-70")).toBe("cerrado");
    expect(stateOf("mol-90")).toBe("bloqueado");
    expect(stateOf("mol-91")).toBe("pausa");
    expect(stateOf("bet-1")).toBe("curso");
  });

  it("un pedido cerrado con cabos sueltos no pasa por cerrado", () => {
    expect(stateOf("mol-70")).toBe("cerrado");
    expect(stateOf("mol-94")).toBe("sueltos");
    // La raíz está hecha, pero una bisnieta espera tu respuesta.
    expect(stateOf("mol-96")).toBe("toca");
    expect(ids(summarizePedido(index, get("mol-96")).waits)).toEqual(["mol-98"]);
    expect(stateOf("mol-94", [run("r1", "mol-95")])).toBe("trabajando");
  });

  it("dice qué tarea espera tu respuesta, cuál está frenada y por cuál", () => {
    const toca = summarizePedido(index, get("mol-10"));
    expect(ids(toca.waits)).toEqual(["mol-10"]);
    expect(toca.progress).toEqual({ done: 2, total: 2 });

    const espera = summarizePedido(index, get("mol-30"));
    expect(espera.stuck?.id).toBe("mol-31");
    expect(espera.blocker?.id).toBe("mol-60");

    // El bloqueador no está en el board: se sabe que espera, no a quién.
    const fuera = summarizePedido(index, get("mol-55"));
    expect(fuera.stuck?.id).toBe("mol-55");
    expect(fuera.blocker).toBeNull();

    expect(summarizePedido(index, get("mol-25")).stuck?.id).toBe("mol-25");
  });

  it("una corrida activa manda sobre todo, menos sobre lo que te toca", () => {
    expect(stateOf("mol-1", [run("r1", "mol-4")])).toBe("trabajando");
    expect(stateOf("mol-20", [run("r1", "mol-20", "queued")])).toBe("trabajando");
    expect(stateOf("mol-10", [run("r1", "mol-11")])).toBe("toca");
    const row = summarizePedido(index, get("mol-1"), liveByIssue([run("r1", "mol-4")]));
    expect(row.live.map((entry) => [entry.run.agentName, entry.issue.id])).toEqual([["Ingeniera", "mol-4"]]);
  });

  it("no cuenta las corridas terminadas ni las que no son de una tarea", () => {
    const live = liveByIssue([run("r1", "mol-4", "succeeded"), run("r2", null), run("r3", "mol-4", "failed")]);
    expect(live.size).toBe(0);
    expect(stateOf("mol-1", [run("r1", "mol-4", "succeeded")])).toBe("curso");
  });

  it("resume el desglose de abiertas y el último movimiento del pedido completo", () => {
    const row = summarizePedido(index, get("mol-1"));
    expect(row.open).toEqual([
      { status: "todo", count: 1 },
      { status: "in_progress", count: 1 },
    ]);
    // La raíz se actualizó el 1-oct; la bisnieta, el 16-oct.
    expect(row.lastMove).toBe("2026-10-16T00:00:00.000Z");
  });
});

describe("qué pedidos se ven", () => {
  it("muestra las raíces abiertas y las cerradas con cabos sueltos", () => {
    const roots = pedidoRoots(index, query(), NOW);
    expect(roots.every((root) => isPedido(index, root))).toBe(true);
    expect(ids(roots)).toEqual(
      [
        "bet-1", "mol-1", "mol-10", "mol-20", "mol-25", "mol-30", "mol-40", "mol-50", "mol-55", "mol-60", "mol-61", "mol-80", "mol-90", "mol-91",
        // Cerradas, pero con una subtarea abierta (MOL-94) o una que espera tu respuesta (MOL-96).
        "mol-94", "mol-96",
      ].sort(),
    );
    expect(ids(roots)).not.toContain("mol-70");
  });

  it("los cerrados salen con cerr=1 o al filtrar por un estado cerrado", () => {
    expect(ids(pedidoRoots(index, query({ showClosed: true }), NOW))).toContain("mol-70");
    expect(ids(pedidoRoots(index, query({}, { est: ["done"] }), NOW))).toEqual(["mol-70", "mol-94", "mol-96"]);
    // Con filtro de estado manda el filtro: las cerradas con cabos sueltos no se cuelan.
    expect(ids(pedidoRoots(index, query({}, { est: ["blocked"] }), NOW))).toEqual(["mol-10", "mol-25", "mol-55", "mol-90"]);
  });

  it("oculta los títulos que empiezan con un prefijo de ocu, sin tildes ni mayúsculas", () => {
    expect(isHiddenTitle("Aviso automático: revisar el cupo", ["aviso automatico"])).toBe(true);
    expect(isHiddenTitle("Revisar el aviso automático", ["aviso automatico"])).toBe(false);
    expect(isHiddenTitle("Cualquier título", ["", "  "])).toBe(false);
    expect(ids(pedidoRoots(index, query({ hide: ["AVISO AUTOMÁTICO"] }), NOW))).not.toContain("mol-80");
    expect(ids(pedidoRoots(index, parseBoardQuery("?v=pedidos&ocu=Aviso%20autom%C3%A1tico,Otro"), NOW))).not.toContain("mol-80");
  });

  it("los filtros miran la raíz", () => {
    expect(ids(pedidoRoots(index, query({}, { emp: ["BET"] }), NOW))).toEqual(["bet-1"]);
    expect(ids(pedidoRoots(index, query({}, { prj: ["p-web"] }), NOW))).toEqual(["mol-1"]);
    // BET-2 está en revisión, pero es una subtarea: el filtro de estado mira BET-1.
    expect(ids(pedidoRoots(index, query({}, { est: ["in_review"] }), NOW))).toEqual([]);
  });

  it("la búsqueda encuentra el pedido por una descendiente y dice cuál", () => {
    const rows = pedidoRows(index, query({}, { q: "facturas" }), { now: NOW });
    expect(rows.map((row) => row.issue.id)).toEqual(["mol-1"]);
    expect(ids(rows[0].hits)).toEqual(["mol-6"]);
    // Si la raíz calza, no hace falta decir por dónde.
    const directo = pedidoRows(index, query({}, { q: "tienda" }), { now: NOW });
    expect(directo.map((row) => row.issue.id)).toEqual(["mol-1"]);
    expect(directo[0].hits).toEqual([]);
    expect(ids(pedidoRoots(index, query({}, { q: "betacorp" }), NOW))).toEqual(["bet-1"]);
  });

  it("«Te toca» deja los pedidos donde alguna tarea espera tu respuesta", () => {
    expect(ids(pedidoRoots(index, query({}, { toca: true }), NOW))).toEqual(["mol-10", "mol-96"]);
  });

  it("un blocker_attention no enciende «Te toca» en el pedido, ni solo ni con otras tareas", () => {
    expect([...index.stalled.keys()].sort()).toEqual(["mol-25", "mol-31", "mol-90"]);
    expect(index.waiting.has("mol-25")).toBe(false);
    expect(index.waiting.has("mol-90")).toBe(false);
    expect(ids(pedidoRoots(index, query({}, { toca: true }), NOW))).not.toContain("mol-25");
    expect(ids(pedidoRoots(index, query({}, { toca: true }), NOW))).not.toContain("mol-90");
    expect(ids(pedidoRoots(index, query({}, { toca: true }), NOW))).not.toContain("mol-30");
    for (const id of ["mol-25", "mol-30", "mol-90"]) expect(summarizePedido(index, index.byId.get(id)!).state).not.toBe("toca");
    // Una tarjeta pendiente sí cuenta.
    expect(summarizePedido(index, index.byId.get("mol-10")!).state).toBe("toca");
  });

  it("«Actualizada» cuenta el último movimiento de cualquier tarea del pedido", () => {
    // Solo MOL-6 (bisnieta de MOL-1) y MOL-10 se movieron en los últimos 7 días.
    expect(ids(pedidoRoots(index, query({}, { act: "7d" }), NOW))).toEqual(["mol-1", "mol-10"]);
  });

  it("arma las secciones en orden, con lo último que se movió primero", () => {
    const sections = pedidoSections(pedidoRows(index, query({ showClosed: true }), { live: [run("r1", "mol-42")], now: NOW }));
    expect(sections.map((section) => section.state)).toEqual(PEDIDO_STATES.filter((state) => sections.some((s) => s.state === state)));
    const bySection = Object.fromEntries(sections.map((section) => [section.state, section.rows.map((row) => row.issue.id)]));
    expect(bySection.toca).toEqual(["mol-10", "mol-96"]);
    expect(bySection.pausa).toEqual(["mol-91"]);
    expect(bySection.sueltos).toEqual(["mol-94"]);
    expect(bySection.cerrar).toEqual(["mol-20"]);
    expect(bySection.trabajando).toEqual(["mol-40"]);
    expect(bySection.espera?.slice().sort()).toEqual(["mol-30", "mol-55"]);
    expect(bySection.cerrado).toEqual(["mol-70"]);
    // MOL-1 se movió el 16-oct (por su bisnieta); BET-1, el 1-oct.
    expect(bySection.curso).toEqual(["mol-1", "bet-1"]);
    expect(bySection.nuevo?.[bySection.nuevo.length - 1]).toBe("mol-60");
  });

  it("el conteo de una vista guardada en Pedidos cuenta pedidos, no tareas", () => {
    expect(queryCount(index, query(), NOW)).toBe(16);
    expect(queryCount(index, query({ hide: ["aviso"] }), NOW)).toBe(15);
    expect(queryCount(index, { ...query(), view: "lista" }, NOW)).toBe(index.issues.length);
  });
});

describe("última novedad", () => {
  it("toma la primera línea con texto", () => {
    expect(commentLine("🙋 Te toca: confirmar el despliegue\n\nEl detalle va abajo.")).toBe("🙋 Te toca: confirmar el despliegue");
    expect(commentLine("\n\n---\n⏳ Avance: 3 de 5 listas")).toBe("⏳ Avance: 3 de 5 listas");
  });

  it("quita el Markdown y salta los bloques de código", () => {
    expect(commentLine("## Resumen\n\n- **Listo**")).toBe("Resumen");
    expect(commentLine("```\nnpm test\n```\n- **⏳ Avance:** el `build` pasó y el [PR](https://example.com/pr/1) quedó _abierto_.")).toBe(
      "⏳ Avance: el build pasó y el PR quedó abierto.",
    );
    expect(commentLine("> 1. Cita con `snake_case_intacto`")).toBe("1. Cita con snake_case_intacto");
  });

  it("recorta lo largo y devuelve vacío si no hay texto", () => {
    const largo = commentLine("palabra ".repeat(60));
    expect(largo.length).toBeLessThanOrEqual(160);
    expect(largo.endsWith("…")).toBe(true);
    expect(commentLine("")).toBe("");
    expect(commentLine("---\n***\n```\nsolo código\n```")).toBe("");
  });
});
