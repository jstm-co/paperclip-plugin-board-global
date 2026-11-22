import { describe, expect, it } from "vitest";
import {
  BACKLOG_STATUSES,
  BOARD_STATUSES,
  CONFIRM_COLUMN,
  FLAT_LANE,
  HOT_PRIORITIES,
  allBoardQuery,
  ancestorsOf,
  boardColumns,
  columnOf,
  clearFilter,
  companyMatchesQuery,
  dateCounts,
  hasChipFilters,
  hiddenLaneCount,
  laneKeyOf,
  buildBoardIndex,
  defaultQuery,
  dependentsOf,
  emptyFilters,
  facetCounts,
  filterIssues,
  kanbanFlat,
  kanbanLanes,
  kanbanStatuses,
  groupIssues,
  isHotFilter,
  parseBoardQuery,
  pinFreshRows,
  progressOf,
  relativeTime,
  relaxSuggestions,
  serializeBoardQuery,
  sortIssues,
  splitTree,
  companyPaletteKeys,
  toBoardCompany,
  treeRows,
  waitBlockerOf,
  visibleIssues,
  stalledFromAttention,
  waitingFromAttention,
  withBlockedBy,
  type BoardFilters,
} from "../src/board.js";
import { ISSUE_STATUSES, OPEN_STATUSES, type AttentionItem, type BoardIssue, type CompanyBoard } from "../src/shared.js";

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

function interaction(issueId: string, kind: string, title: string): AttentionItem {
  return {
    sourceKind: "issue_thread_interaction",
    subject: { kind: "interaction", title, href: `/X/issues/${issueId}#interaction-1`, metadata: { kind } },
    relatedIssue: { id: issueId },
    createdAt: "2026-10-16T10:00:00.000Z",
  };
}

const boards: CompanyBoard[] = [
  {
    companyId: "c-jst",
    name: "JSTM",
    issuePrefix: "JST",
    brandColor: null,
    elapsedMs: 1,
    projects: [{ id: "p-board", name: "Board global", color: null }],
    agents: [{ id: "a-eng", name: "Ingeniero" }],
    attention: [interaction("jst-9", "ask_user_questions", "Elegir propuesta")],
    issues: [
      issue("jst-1", "c-jst", { status: "in_progress", priority: "high", projectId: "p-board", assigneeAgentId: "a-eng" }),
      issue("jst-2", "c-jst", { status: "done", priority: "low", title: "Revisión del diseño" }),
      issue("jst-9", "c-jst", { status: "in_review", projectId: "p-board" }),
      // Bloqueada por JST-9, que espera tu respuesta.
      issue("jst-4", "c-jst", { status: "blocked", blockerIds: ["jst-9"], projectId: "p-board" }),
    ],
  },
  {
    companyId: "c-bet",
    name: "Betacorp",
    issuePrefix: "BET",
    brandColor: null,
    elapsedMs: 1,
    projects: [{ id: "p-web", name: "Web", color: "#f00" }],
    agents: [{ id: "a-dev", name: "Dev" }],
    attention: null,
    issues: [
      issue("bet-1", "c-bet", {
        projectId: "p-web",
        assigneeAgentId: "a-dev",
        priority: "critical",
        labels: [{ id: "l1", name: "bug", color: "#f00" }],
        updatedAt: "2026-10-02T00:00:00.000Z",
      }),
      issue("bet-2", "c-bet", { status: "blocked", parentId: "bet-1", assigneeUserId: "local-board" }),
      issue("bet-3", "c-bet", { status: "done", parentId: "bet-1" }),
      issue("bet-4", "c-bet", { status: "cancelled", parentId: "bet-1" }),
      issue("bet-5", "c-bet", { status: "todo", parentId: "bet-2", title: "Nieta" }),
    ],
  },
];

const index = buildBoardIndex(boards);
const ids = (list: BoardIssue[]) => list.map((i) => i.id).sort();
const filters = (patch: Partial<BoardFilters>): BoardFilters => ({ ...emptyFilters(), ...patch });

describe("estado en la URL", () => {
  it("usa los parámetros del design-spec y no escribe los valores por defecto", () => {
    expect(serializeBoardQuery(defaultQuery())).toBe("");
    const query = {
      view: "lista" as const,
      group: "responsable" as const,
      lanes: "proyecto" as const,
      subtasksCollapsed: true,
      showClosed: true,
      hide: [] as string[],
      filters: filters({
        emp: ["MIG", "BET"],
        prj: ["p-web"],
        est: ["blocked", "todo"],
        resp: ["agent:a-dev", "none"],
        pri: ["low", "critical"],
        eti: ["bug, urgente"],
        q: "diseño",
        toca: true,
      }),
    };
    const search = serializeBoardQuery(query);
    expect(search).toBe(
      "?v=lista&q=dise%C3%B1o&emp=BET,MIG&prj=p-web&est=todo,blocked&resp=agent:a-dev,none&pri=critical,low&eti=bug%2C%20urgente&toca=1&grp=responsable&carr=proyecto&sub=0&cerr=1",
    );
    expect(parseBoardQuery(search)).toEqual({
      ...query,
      filters: { ...query.filters, emp: ["BET", "MIG"], est: ["todo", "blocked"], pri: ["critical", "low"], resp: ["agent:a-dev", "none"] },
    });
  });

  it("la vista Pedidos y sus títulos ocultos viajan en la URL", () => {
    const query = parseBoardQuery("?v=pedidos&ocu=Recordatorio,Aviso%20autom%C3%A1tico%2C%20semanal&cerr=1");
    expect(query.view).toBe("pedidos");
    expect(query.hide).toEqual(["Recordatorio", "Aviso automático, semanal"]);
    // Orden estable y cada prefijo codificado por separado: la coma de un prefijo no parte la lista.
    expect(serializeBoardQuery(query)).toBe("?v=pedidos&cerr=1&ocu=Aviso%20autom%C3%A1tico%2C%20semanal,Recordatorio");
    expect(parseBoardQuery("").hide).toEqual([]);
    // «Todo el board» conserva la vista y quita los títulos ocultos, como cualquier filtro.
    expect(allBoardQuery(query)).toEqual({ ...defaultQuery(), view: "pedidos", showClosed: true });
  });

  it("el Board abre agrupado por empresa: `carr` solo viaja si es otra cosa, y «sin agrupar» es carr=no", () => {
    expect(defaultQuery().lanes).toBe("empresa");
    expect(parseBoardQuery("").lanes).toBe("empresa");
    expect(parseBoardQuery("?carr=empresa").lanes).toBe("empresa");
    expect(serializeBoardQuery(parseBoardQuery("?carr=empresa"))).toBe("");
    expect(parseBoardQuery("?carr=no").lanes).toBeNull();
    expect(serializeBoardQuery({ ...defaultQuery(), lanes: null })).toBe("?carr=no");
    expect(serializeBoardQuery({ ...defaultQuery(), lanes: "proyecto" })).toBe("?carr=proyecto");
    // La vista Backlog viaja como las demás.
    expect(parseBoardQuery("?v=backlog").view).toBe("backlog");
    expect(serializeBoardQuery({ ...defaultQuery(), view: "backlog" })).toBe("?v=backlog");
  });

  it("ignora valores desconocidos", () => {
    const query = parseBoardQuery("?v=tabla&grp=color&carr=estado&est=nope,todo&pri=urgente&toca=si&emp=bet");
    expect(query.view).toBe("kanban");
    expect(query.group).toBe("empresa");
    // Un `carr` desconocido cae en el de siempre: por empresa.
    expect(query.lanes).toBe("empresa");
    expect(query.filters.est).toEqual(["todo"]);
    expect(query.filters.pri).toEqual([]);
    expect(query.filters.toca).toBe(false);
    expect(query.filters.emp).toEqual(["BET"]);
  });
});

describe("índice multiempresa", () => {
  it("ordena las empresas por nombre y les da la paleta fija en ese orden", () => {
    expect(index.companies.map((c) => [c.prefix, c.paletteKey])).toEqual([
      ["BET", "p1"],
      ["JST", "p2"],
    ]);
    expect(index.issues).toHaveLength(9);
  });

  it("la paleta sale de la lista completa: una empresa que no respondió no cambia los colores", () => {
    const all = [
      { id: "c-jst", name: "JSTM" },
      { id: "c-alfa", name: "Alfa" },
      { id: "c-bet", name: "Betacorp" },
    ];
    const keys = companyPaletteKeys(all);
    expect([...keys]).toEqual([
      ["c-alfa", "p1"],
      ["c-bet", "p2"],
      ["c-jst", "p3"],
    ]);
    // Alfa no respondió: el índice solo trae BET y JST, pero con los colores de la lista completa.
    const partial = buildBoardIndex(boards, keys);
    expect(partial.companies.map((c) => [c.prefix, c.paletteKey])).toEqual([
      ["BET", "p2"],
      ["JST", "p3"],
    ]);
  });

  it("desde la 5.ª empresa no hay color fijo (gris)", () => {
    const names = ["F", "A", "E", "B", "C", "D"];
    const keys = companyPaletteKeys(names.map((name) => ({ id: name, name })));
    expect(["A", "B", "C", "D", "E", "F"].map((name) => keys.get(name))).toEqual(["p1", "p2", "p3", "p4", undefined, undefined]);
    const six: CompanyBoard[] = names.map((name) => ({
      companyId: name,
      name,
      issuePrefix: name,
      brandColor: null,
      elapsedMs: 1,
      projects: [],
      agents: [],
      attention: null,
      issues: [],
    }));
    expect(buildBoardIndex(six).companies.map((c) => [c.prefix, c.paletteKey])).toEqual([
      ["A", "p1"],
      ["B", "p2"],
      ["C", "p3"],
      ["D", "p4"],
      ["E", null],
      ["F", null],
    ]);
  });

  it("sin clave de paleta, la empresa queda sin color fijo", () => {
    expect(toBoardCompany("c", "Nueva", "NUE", null).paletteKey).toBeNull();
    expect(toBoardCompany("c", "Nueva", "NUE", "#ff0000", "p1")).toMatchObject({ brandColor: "#ff0000", paletteKey: "p1" });
  });

  it("arma el árbol con parentId", () => {
    expect(index.kids.get("bet-1")?.map((i) => i.id)).toEqual(["bet-2", "bet-3", "bet-4"]);
    expect(ancestorsOf(index, index.byId.get("bet-5")!).map((i) => i.id)).toEqual(["bet-1", "bet-2"]);
  });

  it("«Te toca» está disponible si alguna empresa respondió el Inbox", () => {
    expect(index.tocaAvailable).toBe(true);
    expect([...index.waiting.keys()]).toEqual(["jst-9"]);
    const sinInbox = buildBoardIndex(boards.map((b) => ({ ...b, attention: null })));
    expect(sinInbox.tocaAvailable).toBe(false);
    // Sin el dato, el filtro no se aplica (§4.4).
    expect(filterIssues(sinInbox, filters({ toca: true }))).toHaveLength(9);
  });
});

describe("«Te toca»", () => {
  it("traduce el feed del Inbox a qué se te pide, una entrada por tarea", () => {
    const waiting = waitingFromAttention([
      interaction("t1", "ask_user_questions", "¿Qué hacemos con la app?"),
      interaction("t1", "request_confirmation", "Duplicado"),
      interaction("t2", "request_confirmation", "Aprobar la semana 3"),
      { sourceKind: "approval", subject: { kind: "approval", title: "Aprobar el gasto" }, relatedIssue: { id: "t3" } },
      { sourceKind: "decision", subject: { kind: "decision", title: "Elegir proveedor" }, relatedIssue: { id: "t4" } },
      { sourceKind: "blocker_attention", subject: { kind: "issue", title: "Título de la tarea" }, relatedIssue: { id: "t5" }, detail: { blockedTaskCount: 6 } },
      { sourceKind: "budget_alert", subject: { kind: "company", title: "Presupuesto" } },
    ]);
    expect([...waiting.keys()]).toEqual(["t1", "t2", "t3", "t4"]);
    expect(waiting.get("t1")).toMatchObject({ kind: "pregunta", what: "¿Qué hacemos con la app?", href: "/X/issues/t1#interaction-1" });
    expect(waiting.get("t2")).toMatchObject({ kind: "confirmacion", what: "Aprobar la semana 3" });
    expect(waiting.get("t3")).toMatchObject({ kind: "aprobacion", what: "Aprobar el gasto" });
    expect(waiting.get("t4")).toMatchObject({ kind: "pregunta", what: "Elegir proveedor" });
  });

  it("un blocker_attention no es «Te toca»: va al mapa de paradas", () => {
    const feed: AttentionItem[] = [
      { sourceKind: "blocker_attention", subject: { kind: "issue", title: "Título de la tarea" }, relatedIssue: { id: "t5" }, detail: { blockedTaskCount: 6 }, createdAt: "2026-10-16T10:00:00.000Z" },
      { sourceKind: "blocker_attention", subject: { kind: "issue", title: "Otra" }, relatedIssue: { id: "t6" } },
    ];
    expect(waitingFromAttention(feed).size).toBe(0);
    expect([...stalledFromAttention(feed).entries()]).toEqual([
      ["t5", { blockedTaskCount: 6, since: "2026-10-16T10:00:00.000Z" }],
      ["t6", { blockedTaskCount: 0, since: null }],
    ]);
    // Si la misma tarea tiene además una tarjeta pendiente, esa sí cuenta aunque el bloqueo venga primero.
    const both = [feed[0]!, interaction("t5", "request_confirmation", "Aprobar")];
    expect(waitingFromAttention(both).get("t5")).toMatchObject({ kind: "confirmacion", what: "Aprobar" });
    expect(stalledFromAttention(both).has("t5")).toBe(true);
  });

  it("en el índice, las paradas no encienden el distintivo, el filtro ni el contador", () => {
    const withStall = buildBoardIndex(
      boards.map((b) =>
        b.companyId === "c-jst"
          ? { ...b, attention: [...(b.attention ?? []), { sourceKind: "blocker_attention", relatedIssue: { id: "jst-1" }, detail: { blockedTaskCount: 3 } } as AttentionItem] }
          : b,
      ),
    );
    expect([...withStall.waiting.keys()]).toEqual(["jst-9"]);
    expect([...withStall.stalled.keys()]).toEqual(["jst-1"]);
    expect(filterIssues(withStall, filters({ toca: true })).map((i) => i.id)).toEqual(["jst-9"]);
    // Una parada fuera del board se descarta, igual que «Te toca».
    const orphan = buildBoardIndex(boards.map((b) => ({ ...b, attention: [{ sourceKind: "blocker_attention", relatedIssue: { id: "no-existe" } } as AttentionItem] })));
    expect(orphan.stalled.size).toBe(0);
  });

  it("sigue la cadena de bloqueos hasta lo que espera tu respuesta", () => {
    expect(waitBlockerOf(index, index.byId.get("jst-4")!)?.id).toBe("jst-9");
    expect(waitBlockerOf(index, index.byId.get("jst-9")!)).toBeNull();
    expect(ids(dependentsOf(index))).toEqual(["jst-4"]);
  });

  it("cuenta también las que esperan sin estar Bloqueadas, con los bloqueadores de blockedBy (JST-19)", () => {
    const [jst, bet] = boards;
    const issues = withBlockedBy(
      [...jst.issues, issue("jst-5", "c-jst", { status: "backlog" }), issue("jst-6", "c-jst")],
      [
        // Como BET-214: en Backlog y bloqueada por JST-4, que espera a JST-9. No trae `blockerAttention`.
        { id: "jst-5", blockedBy: [{ id: "jst-4", status: "blocked" }, { id: "jst-2", status: "done" }] },
        { id: "jst-6", blockedBy: [{ id: "jst-2", status: "done" }] },
        { id: "jst-4", blockedBy: [{ id: "jst-9", status: "in_review" }, { id: "jst-1", status: "in_progress" }] },
      ],
    );
    const withBacklog = buildBoardIndex([{ ...jst, issues }, bet]);
    expect(withBacklog.byId.get("jst-4")!.blockerIds).toEqual(["jst-9", "jst-1"]);
    expect(withBacklog.byId.get("jst-5")!.blockerIds).toEqual(["jst-4"]);
    expect(withBacklog.byId.get("jst-6")!.blockerIds).toEqual([]);
    expect(waitBlockerOf(withBacklog, withBacklog.byId.get("jst-5")!)?.id).toBe("jst-9");
    expect(ids(dependentsOf(withBacklog))).toEqual(["jst-4", "jst-5"]);
  });

  it("con filtros, solo nombra lo que desbloquean las tareas «Te toca» que quedan", () => {
    // BET-1 también espera tu respuesta y bloquea a BET-2.
    const twoCompanies = buildBoardIndex(
      boards.map((b) =>
        b.companyId === "c-bet"
          ? {
              ...b,
              attention: [interaction("bet-1", "request_confirmation", "Aprobar")],
              issues: b.issues.map((i) => (i.id === "bet-2" ? { ...i, blockerIds: ["bet-1"] } : i)),
            }
          : b,
      ),
    );
    expect(ids(dependentsOf(twoCompanies))).toEqual(["bet-2", "jst-4"]);
    const soloJst = filterIssues(twoCompanies, filters({ toca: true, emp: ["JST"] }));
    expect(ids(soloJst)).toEqual(["jst-9"]);
    expect(ids(dependentsOf(twoCompanies, soloJst))).toEqual(["jst-4"]);
    expect(dependentsOf(twoCompanies, [])).toEqual([]);
  });

  it("filtra solo lo que te toca", () => {
    expect(ids(filterIssues(index, filters({ toca: true })))).toEqual(["jst-9"]);
  });
});

describe("filtros", () => {
  it("combina valores con O y filtros con Y", () => {
    expect(ids(filterIssues(index, filters({ emp: ["BET"] })))).toEqual(["bet-1", "bet-2", "bet-3", "bet-4", "bet-5"]);
    expect(ids(filterIssues(index, filters({ prj: ["p-web", "p-board"] })))).toEqual(["bet-1", "jst-1", "jst-4", "jst-9"]);
    expect(ids(filterIssues(index, filters({ prj: ["none"], emp: ["JST"] })))).toEqual(["jst-2"]);
    expect(ids(filterIssues(index, filters({ est: ["blocked"] })))).toEqual(["bet-2", "jst-4"]);
    expect(ids(filterIssues(index, filters({ resp: ["agent:a-dev", "user:local-board"] })))).toEqual(["bet-1", "bet-2"]);
    expect(ids(filterIssues(index, filters({ pri: ["critical", "high"] })))).toEqual(["bet-1", "jst-1"]);
    expect(ids(filterIssues(index, filters({ eti: ["bug"] })))).toEqual(["bet-1"]);
  });

  it("busca por ID o título sin distinguir tildes", () => {
    expect(ids(filterIssues(index, filters({ q: "revision" })))).toEqual(["jst-2"]);
    expect(ids(filterIssues(index, filters({ q: "bet-5" })))).toEqual(["bet-5"]);
  });

  it("cuenta por faceta con el resto de los filtros", () => {
    const counts = facetCounts(index, filters({ est: ["blocked"], emp: ["BET"] }), "est");
    expect(counts.get("todo")).toBe(2);
    expect(counts.get("blocked")).toBe(1);
  });

  it("sugiere qué filtro quitar cuando no hay resultados", () => {
    expect(relaxSuggestions(index, filters({ emp: ["JST"], pri: ["critical"] }))).toEqual([
      { key: "emp", count: 1 },
      { key: "pri", count: 4 },
    ]);
  });

  it("en el kanban sin cerr=1 no cuenta las cerradas que quedan en el riel", () => {
    const empty = filters({ emp: ["BET"], est: ["backlog"] });
    expect(relaxSuggestions(index, empty)).toEqual([{ key: "est", count: 5 }]);
    expect(relaxSuggestions(index, empty, { view: "lista", showClosed: false })).toEqual([{ key: "est", count: 5 }]);
    expect(relaxSuggestions(index, empty, { view: "kanban", showClosed: false })).toEqual([{ key: "est", count: 3 }]);
    expect(relaxSuggestions(index, empty, { view: "kanban", showClosed: true })).toEqual([{ key: "est", count: 5 }]);
    // Si queda un filtro de estado, sus columnas se ven aunque sean cerradas.
    expect(relaxSuggestions(index, filters({ q: "zzz", est: ["done"] }), { view: "kanban", showClosed: false })).toEqual([
      { key: "q", count: 2 },
    ]);
  });
});

describe("búsqueda por empresa (JST-60)", () => {
  const [jstBoard] = boards;
  const withMolino = buildBoardIndex([
    { ...jstBoard, issues: [...jstBoard.issues, issue("jst-5", "c-jst"), issue("jst-50", "c-jst")] },
    boards[1],
    {
      companyId: "c-elm",
      name: "El Molino",
      issuePrefix: "ELM",
      brandColor: null,
      elapsedMs: 1,
      projects: [],
      agents: [],
      attention: null,
      issues: [
        issue("elm-1", "c-elm"),
        issue("elm-2", "c-elm", { status: "done" }),
        // Su título nombra a JSTM: buscar `jstm` también la trae.
        issue("elm-3", "c-elm", { title: "Conectar con JSTM" }),
      ],
    },
  ]);
  const jst = ["jst-1", "jst-2", "jst-4", "jst-5", "jst-50", "jst-9"];
  const elm = ["elm-1", "elm-2", "elm-3"];
  const search = (q: string) => ids(filterIssues(withMolino, filters({ q })));

  it("`jstm` y `JSTM` traen todas las de JSTM y, de otra empresa, solo las que lo tienen en el título", () => {
    expect(search("jstm")).toEqual(["elm-3", ...jst]);
    expect(search("JSTM")).toEqual(["elm-3", ...jst]);
  });

  it("`molino` y `el mo` traen las de El Molino", () => {
    expect(search("molino")).toEqual(elm);
    expect(search("El Mo")).toEqual(elm);
    expect(search("mól")).toEqual(elm);
  });

  it("`el` y `corp` no traen empresas enteras", () => {
    const elMolino = withMolino.companies.find((company) => company.prefix === "ELM");
    const betacorp = withMolino.companies.find((company) => company.prefix === "BET");
    expect(companyMatchesQuery(elMolino, "el")).toBe(false);
    expect(companyMatchesQuery(betacorp, "corp")).toBe(false);
    expect(search("corp")).toEqual([]);
    expect(search("mo")).toEqual([]);
    // Los ID ELM-… contienen «el»: esas aparecen por el ID, como antes.
    expect(search("el")).toEqual([...elm, "jst-2"]);
  });

  it("`jst-5` sigue buscando por ID", () => {
    expect(search("jst-5")).toEqual(["jst-5", "jst-50"]);
  });

  it("compara con el nombre, cada palabra y el prefijo; nunca dentro del nombre", () => {
    const company = (name: string, prefix: string) => toBoardCompany("c", name, prefix, null);
    expect(companyMatchesQuery(company("El Molino", "ELM"), "elm")).toBe(true);
    expect(companyMatchesQuery(company("Betacorp", "BET"), "bet")).toBe(true);
    expect(companyMatchesQuery(company("Mignon", "MIG"), "MIG")).toBe(true);
    expect(companyMatchesQuery(company("Educación Ágil", "EDU"), "agil")).toBe(true);
    expect(companyMatchesQuery(company("El Molino", "ELM"), "olino")).toBe(false);
    expect(companyMatchesQuery(company("El Molino", "ELM"), "molinos")).toBe(false);
    expect(companyMatchesQuery(undefined, "jstm")).toBe(false);
  });

  it("los conteos de los menús y las sugerencias del estado vacío usan la misma regla", () => {
    const counts = facetCounts(withMolino, filters({ q: "jstm" }), "emp");
    expect(Object.fromEntries(counts)).toEqual({ JST: 6, ELM: 1 });
    expect(facetCounts(withMolino, filters({ q: "molino" }), "est").get("todo")).toBe(2);
    expect(relaxSuggestions(withMolino, filters({ q: "jstm", emp: ["BET"] }))).toEqual([
      { key: "emp", count: 7 },
      { key: "q", count: 5 },
    ]);
  });
});

describe("columnas del kanban", () => {
  it("las del filtro de estado o las del Board (sin Backlog), más las cerradas con cerr=1", () => {
    expect(kanbanStatuses(filters({}), false)).toEqual(["todo", "in_progress", "in_review", "blocked"]);
    expect(kanbanStatuses(filters({}), false)).toEqual([...BOARD_STATUSES]);
    expect(kanbanStatuses(filters({}), true)).toEqual(["todo", "in_progress", "in_review", "blocked", "done", "cancelled"]);
    expect(kanbanStatuses(filters({ est: ["done", "todo"] }), false)).toEqual(["todo", "done"]);
    // El filtro de estado manda: con él, el Backlog sí puede ser una columna.
    expect(kanbanStatuses(filters({ est: ["backlog", "todo"] }), false)).toEqual(["backlog", "todo"]);
  });

  it("«Por confirmar» va después de la última columna abierta y no aparece con filtro de estado", () => {
    expect(boardColumns(filters({}), false, true)).toEqual(["todo", "in_progress", "in_review", "blocked", CONFIRM_COLUMN]);
    expect(boardColumns(filters({}), true, true)).toEqual(["todo", "in_progress", "in_review", "blocked", CONFIRM_COLUMN, "done", "cancelled"]);
    expect(boardColumns(filters({}), false, false)).toEqual(["todo", "in_progress", "in_review", "blocked"]);
    expect(boardColumns(filters({ est: ["done"] }), true, true)).toEqual(["done"]);
  });

  it("una tarea cerrada que espera confirmación va en «Por confirmar»; las demás, en su estado", () => {
    const jst2 = index.byId.get("jst-2")!;
    expect(columnOf(jst2)).toBe("done");
    expect(columnOf(jst2, new Set(["jst-2"]))).toBe(CONFIRM_COLUMN);
    expect(columnOf(index.byId.get("jst-1")!, new Set(["jst-2"]))).toBe("in_progress");
  });
});

describe("lo que muestra una consulta", () => {
  it("en el kanban, solo las columnas visibles; en la lista, todo lo filtrado", () => {
    const kanban = defaultQuery();
    expect(visibleIssues(index, kanban)).toHaveLength(6);
    expect(visibleIssues(index, { ...kanban, showClosed: true })).toHaveLength(9);
    expect(visibleIssues(index, { ...kanban, view: "lista" })).toHaveLength(9);
    // El Backlog lista lo suyo y lo que ya está en «Por hacer», aunque el filtro de estado pida otra cosa.
    expect(ids(visibleIssues(index, { ...kanban, view: "backlog" }))).toEqual(["bet-1", "bet-5"]);
    expect(BACKLOG_STATUSES).toEqual(["todo", "backlog"]);
    const conBacklog = buildBoardIndex([{ ...boards[0], issues: [...boards[0].issues, issue("jst-7", "c-jst", { status: "backlog" })] }]);
    expect(ids(visibleIssues(conBacklog, kanban))).toEqual(["jst-1", "jst-4", "jst-9"]);
    expect(ids(visibleIssues(conBacklog, { ...kanban, view: "backlog" }))).toEqual(["jst-7"]);
    expect(ids(visibleIssues(index, { ...kanban, filters: filters({ est: ["done"] }) }))).toEqual(["bet-3", "jst-2"]);
  });
});

describe("carriles del kanban", () => {
  it("por empresa: un carril por empresa con una celda por columna, ordenada como cada grupo", () => {
    const lanes = kanbanLanes(index, index.issues, "empresa", OPEN_STATUSES);
    expect(lanes.map((lane) => [lane.label, lane.total])).toEqual([
      ["Betacorp", 3],
      ["JSTM", 3],
    ]);
    expect(lanes[0].cells.map((cell) => cell.status)).toEqual([...OPEN_STATUSES]);
    expect(lanes[0].cells.find((cell) => cell.status === "todo")!.issues.map((i) => i.id)).toEqual(["bet-1", "bet-5"]);
    expect(lanes[1].cells.find((cell) => cell.status === "blocked")!.issues.map((i) => i.id)).toEqual(["jst-4"]);
  });

  it("por proyecto: proyectos por empresa y «Sin proyecto» al final", () => {
    const lanes = kanbanLanes(index, index.issues, "proyecto", OPEN_STATUSES);
    expect(lanes.map((lane) => [lane.label, lane.companyId, lane.total])).toEqual([
      ["Web", "c-bet", 1],
      ["Board global", "c-jst", 3],
      ["Sin proyecto", "c-bet", 2],
    ]);
    // Con las cerradas, «Sin proyecto» junta tareas de las dos empresas y no lleva color.
    const all = kanbanLanes(index, index.issues, "proyecto", ISSUE_STATUSES);
    expect(all.at(-1)).toMatchObject({ label: "Sin proyecto", companyId: null, total: 5 });
  });

  it("un carril sin tareas en las columnas visibles no aparece", () => {
    const lanes = kanbanLanes(index, index.issues, "responsable", ["done"]);
    expect(lanes.map((lane) => [lane.label, lane.total])).toEqual([["Sin asignar", 2]]);
    expect(kanbanLanes(index, [], "empresa", OPEN_STATUSES)).toEqual([]);
  });

  it("la nota al pie cuenta los carriles ocultos de las empresas del filtro, sin «Sin proyecto» ni personas", () => {
    const done = (laneBy: "empresa" | "proyecto" | "responsable", statuses: Parameters<typeof kanbanLanes>[3]) =>
      kanbanLanes(index, index.issues, laneBy, statuses);
    expect(hiddenLaneCount(index, done("proyecto", ["done"]), "proyecto", [])).toBe(2);
    expect(hiddenLaneCount(index, done("proyecto", ["done"]), "proyecto", ["JST"])).toBe(1);
    expect(hiddenLaneCount(index, done("responsable", OPEN_STATUSES), "responsable", [])).toBe(0);
    expect(hiddenLaneCount(index, done("empresa", ["cancelled"]), "empresa", [])).toBe(1);
  });

  it("con «Por confirmar», las cerradas pendientes entran a su carril y salen de su columna de estado", () => {
    const pending = new Set(["jst-2"]);
    const columns = boardColumns(filters({}), true, true);
    const jst = kanbanLanes(index, index.issues, "empresa", columns, pending).find((lane) => lane.companyId === "c-jst")!;
    expect(jst.total).toBe(4);
    expect(jst.cells.find((cell) => cell.status === CONFIRM_COLUMN)!.issues.map((i) => i.id)).toEqual(["jst-2"]);
    expect(jst.cells.find((cell) => cell.status === "done")!.issues).toEqual([]);
    // Sin la columna de las cerradas, la pendiente igual se ve.
    const open = kanbanLanes(index, index.issues, "empresa", boardColumns(filters({}), false, true), pending);
    expect(open.find((lane) => lane.companyId === "c-jst")!.total).toBe(4);
    expect(open.find((lane) => lane.companyId === "c-bet")!.total).toBe(3);
  });

  it("sin agrupar es un solo carril con todas las tareas de las columnas visibles", () => {
    const [lane, ...rest] = kanbanFlat(index, index.issues, BOARD_STATUSES);
    expect(rest).toEqual([]);
    expect(lane).toMatchObject({ key: FLAT_LANE, companyId: null, total: 6 });
    expect(lane.cells.map((cell) => [cell.status, cell.issues.length])).toEqual([
      ["todo", 2],
      ["in_progress", 1],
      ["in_review", 1],
      ["blocked", 2],
    ]);
  });

  it("al arrastrar, el carril de la tarjeta sale de su empresa, proyecto o responsable", () => {
    const bet2 = index.byId.get("bet-2")!;
    expect(laneKeyOf(bet2, "empresa")).toBe("c-bet");
    expect(laneKeyOf(bet2, "proyecto")).toBe("none");
    expect(laneKeyOf(bet2, "responsable")).toBe("user:local-board");
  });
});

describe("filtro «Actualizada» (act)", () => {
  // Ocho días después del 1 de octubre: solo BET-1 (2 de octubre) entra en los últimos 7 días.
  const NOW = Date.parse("2026-10-08T12:00:00.000Z");

  it("va en la URL como act=7d, después de toca; otros valores se ignoran", () => {
    expect(parseBoardQuery("?act=7d").filters.act).toBe("7d");
    expect(parseBoardQuery("?act=30d").filters.act).toBeNull();
    const query = { ...defaultQuery(), lanes: "responsable" as const, filters: filters({ est: ["blocked"], toca: true, act: "7d" }) };
    expect(serializeBoardQuery(query)).toBe("?est=blocked&toca=1&act=7d&carr=responsable");
  });

  it("filtra por updatedAt contado hacia atrás desde ahora", () => {
    expect(ids(filterIssues(index, filters({ act: "7d" }), undefined, NOW))).toEqual(["bet-1"]);
    // Un día después ya no queda ninguna.
    expect(filterIssues(index, filters({ act: "7d" }), undefined, NOW + 24 * 3600 * 1000)).toEqual([]);
  });

  it("conteo facetado de «Cualquier fecha» y «En los últimos 7 días»", () => {
    expect(dateCounts(index, filters({ act: "7d" }), NOW)).toEqual({ any: 9, "7d": 1 });
    expect(dateCounts(index, filters({ emp: ["JST"] }), NOW)).toEqual({ any: 4, "7d": 0 });
  });

  it("es un chip: «Limpiar todo» y «Quitar fecha» lo sacan", () => {
    expect(hasChipFilters(filters({ act: "7d" }))).toBe(true);
    expect(clearFilter(filters({ act: "7d", est: ["done"] }), "act")).toEqual(filters({ est: ["done"] }));
    expect(relaxSuggestions(index, filters({ act: "7d", est: ["done"] }), undefined, NOW)).toEqual([
      { key: "est", count: 1 },
      { key: "act", count: 2 },
    ]);
  });
});

describe("«Todo el board»", () => {
  it("quita filtros y carriles; conserva Kanban/Lista, agrupación, subtareas y cerradas", () => {
    const query = parseBoardQuery("?v=lista&est=blocked&act=7d&toca=1&grp=proyecto&carr=empresa&sub=0&cerr=1");
    expect(serializeBoardQuery(allBoardQuery(query))).toBe("?v=lista&grp=proyecto&sub=0&cerr=1");
  });
});

describe("orden", () => {
  it("lo que te toca, prioridad, padres antes que sueltas y lo más reciente", () => {
    const jst = sortIssues(index, index.issues.filter((i) => i.companyId === "c-jst"));
    expect(jst.map((i) => i.id)).toEqual(["jst-9", "jst-1", "jst-4", "jst-2"]);
    const parentFirst = buildBoardIndex([
      {
        ...boards[1]!,
        issues: [issue("a", "c-bet", { updatedAt: "2026-10-09T00:00:00.000Z" }), issue("b", "c-bet"), issue("c", "c-bet", { parentId: "b" })],
      },
    ]);
    expect(sortIssues(parentFirst, parentFirst.issues).map((i) => i.id)).toEqual(["b", "a", "c"]);
  });
});

describe("tareas nuevas en la Lista (JST-341)", () => {
  const row = (id: string, tree: { depth: number; kidCount: number } | null, updatedAt = "2026-10-09T00:00:00.000Z") => ({
    issue: issue(id, "c-bet", { updatedAt }),
    tree,
  });
  const leaf = { depth: 0, kidCount: 0 };

  it("fija las nuevas sueltas al inicio, aunque el árbol las ponga después", () => {
    const rows = [row("p", { depth: 0, kidCount: 2 }), row("k", { depth: 1, kidCount: 0 }), row("x", leaf), row("n", leaf), row("f", null)];
    const { pinned, rest } = pinFreshRows(rows, new Set(["n"]));
    expect(pinned.map((r) => r.issue.id)).toEqual(["n"]);
    expect(rest.map((r) => r.issue.id)).toEqual(["p", "k", "x", "f"]);
  });

  it("la más reciente va primera y las filas con jerarquía conservan su lugar", () => {
    const rows = [
      row("p", { depth: 0, kidCount: 1 }),
      row("old", leaf, "2026-10-10T00:00:00.000Z"),
      row("new", null, "2026-10-12T00:00:00.000Z"),
      row("kid", { depth: 1, kidCount: 0 }, "2026-10-13T00:00:00.000Z"),
    ];
    const { pinned, rest } = pinFreshRows(rows, new Set(["old", "new", "kid", "p"]));
    expect(pinned.map((r) => r.issue.id)).toEqual(["new", "old"]);
    expect(rest.map((r) => r.issue.id)).toEqual(["p", "kid"]);
  });

  it("sin nuevas no cambia nada", () => {
    const rows = [row("a", leaf), row("b", null)];
    expect(pinFreshRows(rows, undefined)).toEqual({ pinned: [], rest: rows });
    expect(pinFreshRows(rows, new Set()).rest).toEqual(rows);
  });
});

describe("filtros rápidos", () => {
  it("«Críticas y altas» está encendido cuando la prioridad es exactamente esas dos", () => {
    expect(isHotFilter(filters({ pri: [...HOT_PRIORITIES] }))).toBe(true);
    expect(isHotFilter(filters({ pri: ["high", "critical"] }))).toBe(true);
    expect(isHotFilter(filters({ pri: ["critical"] }))).toBe(false);
    expect(isHotFilter(filters({ pri: ["critical", "high", "low"] }))).toBe(false);
    expect(isHotFilter(filters({}))).toBe(false);
    // Los conteos de la barra salen de lo que mostraría la vista con el filtro encendido.
    expect(ids(visibleIssues(index, { ...defaultQuery(), filters: filters({ pri: [...HOT_PRIORITIES] }) }))).toEqual(["bet-1", "jst-1"]);
    expect(ids(visibleIssues(index, { ...defaultQuery(), filters: filters({ toca: true }) }))).toEqual(["jst-9"]);
  });
});

describe("árbol de subtareas", () => {
  it("avance como en Jira: hechas sobre el total, sin canceladas", () => {
    expect(progressOf(index, index.byId.get("bet-1")!)).toEqual({ done: 1, total: 2 });
  });

  it("en la lista muestra al padre como contexto si no cumple el filtro", () => {
    const rows = treeRows(index, [index.byId.get("bet-5")!], new Set());
    expect(rows.map((r) => [r.issue.id, r.depth, r.context])).toEqual([
      ["bet-1", 0, true],
      ["bet-2", 1, true],
      ["bet-5", 2, false],
    ]);
    const closed = treeRows(index, [index.byId.get("bet-5")!], new Set(["bet-1"]));
    expect(closed.map((r) => r.issue.id)).toEqual(["bet-1"]);
  });

  it("en la lista, un padre cerrado con subtareas abiertas va una sola vez, en el árbol (JST-15)", () => {
    const elm = buildBoardIndex([
      {
        ...boards[1],
        companyId: "c-elm",
        name: "El Molino",
        issuePrefix: "ELM",
        issues: [
          issue("elm-1", "c-elm", { status: "done" }),
          issue("elm-2", "c-elm", { status: "in_review", parentId: "elm-1" }),
          issue("elm-3", "c-elm", { status: "done", parentId: "elm-1" }),
          issue("elm-7", "c-elm", { status: "cancelled", parentId: "elm-3" }),
          issue("elm-6", "c-elm", { status: "done" }),
        ],
      },
    ]);
    const { tree, flat } = splitTree(elm, elm.issues);
    expect(ids(tree)).toEqual(["elm-1", "elm-2", "elm-3", "elm-7"]);
    expect(ids(flat)).toEqual(["elm-6"]);
    expect(treeRows(elm, tree, new Set()).map((r) => [r.issue.id, r.depth, r.context])).toEqual([
      ["elm-1", 0, false],
      ["elm-2", 1, false],
      ["elm-3", 1, false],
      ["elm-7", 2, false],
    ]);
    // Si el filtro deja fuera al padre, sigue como contexto.
    const filtered = splitTree(elm, [elm.byId.get("elm-2")!]);
    expect(treeRows(elm, filtered.tree, new Set()).map((r) => [r.issue.id, r.context])).toEqual([
      ["elm-1", true],
      ["elm-2", false],
    ]);
  });
});

describe("agrupación de la lista", () => {
  const labels = { status: { todo: "Por hacer", blocked: "Bloqueada" }, priority: {} };

  it("por empresa en el orden de las empresas", () => {
    expect(groupIssues(index, index.issues, "empresa", labels).map((g) => g.label)).toEqual(["Betacorp", "JSTM"]);
  });

  it("por responsable: agentes por empresa, luego personas y «Sin asignar» al final", () => {
    const groups = groupIssues(index, index.issues, "responsable", labels);
    expect(groups.map((g) => g.label)).toEqual(["Dev", "Ingeniero", "Board", "Sin asignar"]);
  });

  it("por estado en el orden del flujo", () => {
    const groups = groupIssues(index, index.issues, "estado", labels);
    expect(groups.map((g) => g.key)).toEqual(["todo", "in_progress", "in_review", "blocked", "done", "cancelled"]);
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-10-16T12:00:00.000Z");
  it("minutos, horas y días", () => {
    expect(relativeTime("2026-10-16T11:57:00.000Z", now)).toBe("hace 3 min");
    expect(relativeTime("2026-10-16T09:00:00.000Z", now)).toBe("hace 3 h");
    expect(relativeTime("2026-10-13T12:00:00.000Z", now)).toBe("hace 3 d");
    expect(relativeTime(null, now)).toBe("");
  });
});
