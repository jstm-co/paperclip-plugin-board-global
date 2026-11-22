import { describe, expect, it } from "vitest";
import { buildBoardIndex } from "../src/board.js";
import type { IssueComment } from "../src/shared.js";
import { assignBody, assignCandidates, commentAuthor, commentBody, filterCandidates, isAssignedTo, opensInPlace, visibleComments, withAssignee } from "../src/task.js";

const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

function comment(id: string, createdAt: string, extra: Partial<IssueComment> = {}): IssueComment {
  return { id, issueId: "i1", body: `texto ${id}`, authorAgentId: null, authorUserId: null, createdAt, ...extra };
}

describe("modal de tarea (JST-408)", () => {
  it("un clic normal abre la tarea en el modal", () => {
    expect(opensInPlace(plain)).toBe(true);
    expect(opensInPlace({ ...plain, button: undefined })).toBe(true);
  });

  it("los gestos del navegador van a la página de la tarea", () => {
    expect(opensInPlace({ ...plain, metaKey: true })).toBe(false);
    expect(opensInPlace({ ...plain, ctrlKey: true })).toBe(false);
    expect(opensInPlace({ ...plain, shiftKey: true })).toBe(false);
    expect(opensInPlace({ ...plain, altKey: true })).toBe(false);
    expect(opensInPlace({ ...plain, button: 1 })).toBe(false);
  });

  it("muestra los comentarios del más nuevo al más antiguo, sin borrados ni repetidos", () => {
    const shown = visibleComments([
      comment("a", "2026-03-01T10:00:00.000Z"),
      comment("c", "2026-03-03T10:00:00.000Z"),
      comment("b", "2026-03-02T10:00:00.000Z", { deletedAt: "2026-03-02T11:00:00.000Z" }),
      comment("c", "2026-03-03T10:00:00.000Z"),
    ]);
    expect(shown.map((item) => item.id)).toEqual(["c", "a"]);
  });

  it("nombra a quien comentó: la persona que mira, un agente, otra persona o el sistema", () => {
    const index = buildBoardIndex([]);
    index.agentById.set("agent-1", { id: "agent-1", name: "Analista", companyId: "co-1" });
    const at = "2026-03-01T10:00:00.000Z";
    expect(commentAuthor(index, comment("1", at, { authorUserId: "user-1" }), "user-1")).toEqual({ name: "Tú", self: true, agent: false });
    expect(commentAuthor(index, comment("2", at, { authorAgentId: "agent-1" }), "user-1")).toEqual({ name: "Analista", self: false, agent: true });
    expect(commentAuthor(index, comment("3", at, { authorAgentId: "agent-9" }), "user-1").name).toBe("Agente desconocido");
    expect(commentAuthor(index, comment("4", at, { authorUserId: "user-2-abcdef" }), "user-1")).toMatchObject({ self: false, agent: false });
    expect(commentAuthor(index, comment("5", at, { authorUserId: "user-1" }), null).self).toBe(false);
    expect(commentAuthor(index, comment("6", at), "user-1").name).toBe("Sistema");
  });

  it("no envía comentarios vacíos y recorta los espacios", () => {
    expect(commentBody("   \n ")).toBeNull();
    expect(commentBody("  listo, sigue  \n")).toBe("listo, sigue");
  });
});

describe("reasignar desde el modal (JST-429)", () => {
  const agent = (id: string, name: string, companyId: string, status?: string) => ({ id, name, companyId, ...(status ? { status } : {}) });
  const index = () => {
    const idx = buildBoardIndex([]);
    for (const a of [
      agent("a-zeta", "Zeta", "betacorp", "active"),
      agent("a-ana", "Álvaro", "betacorp", "paused"),
      agent("a-baja", "Baja", "betacorp", "terminated"),
      agent("a-pend", "Pendiente", "betacorp", "pending_approval"),
      agent("a-sin", "Beto", "betacorp"),
      agent("a-otro", "Otro", "el-molino", "active"),
    ]) idx.agentById.set(a.id, a);
    return idx;
  };
  const issue = (assigneeAgentId: string | null, assigneeUserId: string | null) => ({ companyId: "betacorp", assigneeAgentId, assigneeUserId });

  it("ofrece solo los agentes de la empresa de la tarea, por nombre, sin terminados ni pendientes", () => {
    const names = assignCandidates(index(), issue(null, null)).map((c) => c.name);
    expect(names).toEqual(["Álvaro", "Beto", "Zeta"]);
  });

  it("marca los pausados y deja al terminado si ya tiene la tarea", () => {
    const list = assignCandidates(index(), issue("a-baja", null));
    expect(list.map((c) => c.name)).toEqual(["Álvaro", "Baja", "Beto", "Zeta"]);
    expect(list.find((c) => c.id === "a-ana")?.paused).toBe(true);
    expect(list.find((c) => c.id === "a-zeta")?.paused).toBe(false);
  });

  it("busca por nombre sin acentos ni mayúsculas", () => {
    const list = assignCandidates(index(), issue(null, null));
    expect(filterCandidates(list, " alvaro ").map((c) => c.name)).toEqual(["Álvaro"]);
    expect(filterCandidates(list, "ZE").map((c) => c.name)).toEqual(["Zeta"]);
    expect(filterCandidates(list, "").length).toBe(3);
    expect(filterCandidates(list, "nadie")).toEqual([]);
  });

  it("el cuerpo del PATCH quita siempre al responsable anterior", () => {
    expect(assignBody({ kind: "agent", id: "a-zeta" })).toEqual({ assigneeAgentId: "a-zeta", assigneeUserId: null });
    expect(assignBody({ kind: "user", id: "u-1" })).toEqual({ assigneeAgentId: null, assigneeUserId: "u-1" });
    expect(assignBody({ kind: "none" })).toEqual({ assigneeAgentId: null, assigneeUserId: null });
  });

  it("elegir al responsable actual no cambia nada", () => {
    expect(isAssignedTo(issue("a-zeta", null), { kind: "agent", id: "a-zeta" })).toBe(true);
    expect(isAssignedTo(issue("a-zeta", null), { kind: "agent", id: "a-ana" })).toBe(false);
    expect(isAssignedTo(issue(null, "u-1"), { kind: "user", id: "u-1" })).toBe(true);
    expect(isAssignedTo(issue("a-zeta", "u-1"), { kind: "user", id: "u-1" })).toBe(false);
    expect(isAssignedTo(issue(null, null), { kind: "none" })).toBe(true);
    expect(isAssignedTo(issue(null, "u-1"), { kind: "none" })).toBe(false);
  });

  it("aplica el cambio al instante y vuelve atrás con el responsable anterior", () => {
    const before = issue("a-zeta", null);
    const after = withAssignee(before, { kind: "user", id: "u-1" });
    expect(after).toEqual({ companyId: "betacorp", assigneeAgentId: null, assigneeUserId: "u-1" });
    expect(withAssignee(after, { kind: "agent", id: before.assigneeAgentId! })).toEqual(before);
  });
});
