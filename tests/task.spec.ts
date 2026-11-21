import { describe, expect, it } from "vitest";
import { buildBoardIndex } from "../src/board.js";
import type { IssueComment } from "../src/shared.js";
import { commentAuthor, commentBody, opensInPlace, visibleComments } from "../src/task.js";

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
