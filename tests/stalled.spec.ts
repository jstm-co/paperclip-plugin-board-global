import { describe, expect, it } from "vitest";
import { blockedBy, buildBoardIndex, filterIssues, emptyFilters, stalledCount, stalledGroups } from "../src/board.js";
import type { AttentionItem, BoardIssue, CompanyBoard } from "../src/shared.js";

function issue(id: string, companyId: string, extra: Partial<BoardIssue> = {}): BoardIssue {
  return {
    id,
    companyId,
    identifier: id.toUpperCase(),
    title: `Tarea ${id}`,
    status: "blocked",
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

const stall = (issueId: string, blockedTaskCount: number): AttentionItem =>
  ({ sourceKind: "blocker_attention", relatedIssue: { id: issueId }, detail: { blockedTaskCount } }) as AttentionItem;

const boards: CompanyBoard[] = [
  {
    companyId: "c-jst",
    name: "JSTM",
    issuePrefix: "JST",
    brandColor: null,
    elapsedMs: 1,
    projects: [],
    agents: [{ id: "a-eng", name: "Ingeniero" }],
    attention: [stall("jst-1", 1), stall("jst-2", 4), stall("jst-3", 4), stall("jst-9", 7)],
    issues: [
      issue("jst-1", "c-jst", { assigneeAgentId: "a-eng", updatedAt: "2026-10-05T00:00:00.000Z" }),
      issue("jst-2", "c-jst", { updatedAt: "2026-10-03T00:00:00.000Z" }),
      issue("jst-3", "c-jst", { updatedAt: "2026-10-02T00:00:00.000Z", blockerIds: ["jst-7"] }),
      // Cerrada: el feed todavía la trae, pero no cuenta.
      issue("jst-9", "c-jst", { status: "done" }),
      issue("jst-7", "c-jst", { status: "todo" }),
      // Las que jst-2 frena, directa y por la cadena.
      issue("jst-4", "c-jst", { blockerIds: ["jst-2"] }),
      issue("jst-5", "c-jst", { blockerIds: ["jst-4"] }),
      issue("jst-6", "c-jst", { status: "done", blockerIds: ["jst-2"] }),
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
    attention: [stall("bet-1", 2)],
    issues: [issue("bet-1", "c-bet", { assigneeUserId: "local-board" })],
  },
];

const index = buildBoardIndex(boards);

describe("bandeja «Paradas» (JST-424)", () => {
  it("agrupa por empresa y ordena por cuántas tareas frena; a igual número, la más antigua primero", () => {
    const groups = stalledGroups(index);
    expect(groups.map((g) => g.company.prefix)).toEqual(["BET", "JST"]);
    expect(groups[1]!.rows.map((r) => r.issue.id)).toEqual(["jst-3", "jst-2", "jst-1"]);
    expect(stalledCount(groups)).toBe(4);
  });

  it("no cuenta las cerradas aunque el feed las traiga", () => {
    expect(stalledGroups(index).flatMap((g) => g.rows.map((r) => r.issue.id))).not.toContain("jst-9");
  });

  it("solo respeta el filtro de empresas", () => {
    expect(stalledCount(stalledGroups(index, ["BET"]))).toBe(1);
    expect(stalledGroups(index, ["JST"]).map((g) => g.company.prefix)).toEqual(["JST"]);
    // La búsqueda y los demás filtros no la esconden: la bandeja ve todas las paradas.
    expect(filterIssues(index, { ...emptyFilters(), q: "nada que coincida" })).toEqual([]);
    expect(stalledCount(stalledGroups(index, []))).toBe(4);
  });

  it("dice qué espera: el primer bloqueador que sigue abierto", () => {
    const row = stalledGroups(index, ["JST"])[0]!.rows.find((r) => r.issue.id === "jst-3")!;
    expect(row.waitsOn?.id).toBe("jst-7");
    expect(stalledGroups(index, ["JST"])[0]!.rows.find((r) => r.issue.id === "jst-2")!.waitsOn).toBeNull();
  });

  it("sin paradas no hay grupos", () => {
    expect(stalledGroups(buildBoardIndex(boards.map((b) => ({ ...b, attention: [] }))))).toEqual([]);
    expect(stalledGroups(buildBoardIndex(boards.map((b) => ({ ...b, attention: null }))))).toEqual([]);
  });

  it("lista las tareas abiertas que frena, directa o por la cadena", () => {
    expect(blockedBy(index, index.byId.get("jst-2")!).map((i) => i.id)).toEqual(["jst-4", "jst-5"]);
    expect(blockedBy(index, index.byId.get("jst-1")!)).toEqual([]);
  });
});
