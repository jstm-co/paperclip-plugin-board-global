import { describe, expect, it } from "vitest";
import {
  CONFIRM_BACKFILL_MS,
  CONFIRM_WINDOW_MS,
  applyConfirmOp,
  closedTime,
  initialConfirmations,
  needsConfirmation,
  parseConfirmIds,
  parseConfirmations,
  pendingConfirmation,
  type Confirmations,
} from "../src/confirm.js";
import type { BoardIssue } from "../src/shared.js";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-10-20T12:00:00.000Z");
const at = (ms: number) => new Date(ms).toISOString();

function issue(id: string, extra: Partial<BoardIssue> = {}): BoardIssue {
  return {
    id,
    companyId: "c-bet",
    identifier: id.toUpperCase(),
    title: `Tarea ${id}`,
    status: "done",
    priority: "medium",
    projectId: null,
    parentId: null,
    assigneeAgentId: null,
    assigneeUserId: null,
    labels: [],
    blockerIds: [],
    createdAt: at(NOW - 30 * DAY),
    updatedAt: at(NOW - DAY),
    closedAt: at(NOW - DAY),
    ...extra,
  };
}

const state = (confirmed: Record<string, string> = {}): Confirmations => ({ version: 1, since: at(NOW - CONFIRM_BACKFILL_MS), confirmed });

describe("estado guardado", () => {
  it("al estrenar la columna entran los cierres de la última semana", () => {
    expect(initialConfirmations(NOW)).toEqual({ version: 1, since: at(NOW - 7 * DAY), confirmed: {} });
  });

  it("se lee sin confiar en su forma", () => {
    expect(parseConfirmations(null)).toBeNull();
    expect(parseConfirmations("no es json")).toBeNull();
    expect(parseConfirmations({ confirmed: {} })).toBeNull();
    expect(parseConfirmations({ since: "ayer", confirmed: {} })).toBeNull();
    const since = at(NOW - DAY);
    expect(parseConfirmations({ since })).toEqual({ version: 1, since, confirmed: {} });
    // Como texto (así puede venir del estado) y con entradas rotas, que se descartan.
    expect(parseConfirmations(JSON.stringify({ since, confirmed: { a: at(NOW), b: 5, c: "mañana", "": at(NOW) } }))).toEqual({
      version: 1,
      since,
      confirmed: { a: at(NOW) },
    });
  });

  it("los ids de una acción llegan como lista de textos, sin repetidos", () => {
    expect(parseConfirmIds({ ids: ["a", "b", "a"] })).toEqual(["a", "b"]);
    expect(() => parseConfirmIds({})).toThrow(/ids/);
    expect(() => parseConfirmIds({ ids: "a" })).toThrow(/ids/);
    expect(() => parseConfirmIds({ ids: ["a", ""] })).toThrow(/ids/);
    expect(() => parseConfirmIds({ ids: Array.from({ length: 2001 }, (_, i) => `t${i}`) })).toThrow(/Máximo/);
  });
});

describe("qué espera confirmación", () => {
  it("una tarea raíz hecha o cancelada, cerrada dentro de la ventana y sin confirmar", () => {
    expect(needsConfirmation(issue("a"), state(), NOW)).toBe(true);
    expect(needsConfirmation(issue("a", { status: "cancelled" }), state(), NOW)).toBe(true);
  });

  it("las subtareas y las abiertas no", () => {
    expect(needsConfirmation(issue("a", { parentId: "root" }), state(), NOW)).toBe(false);
    for (const status of ["backlog", "todo", "in_progress", "in_review", "blocked"] as const) {
      expect(needsConfirmation(issue("a", { status, closedAt: null }), state(), NOW)).toBe(false);
    }
  });

  it("lo cerrado antes de estrenar la columna no entra, ni lo que lleva más de un mes sin confirmar", () => {
    expect(needsConfirmation(issue("a", { closedAt: at(NOW - 8 * DAY) }), state(), NOW)).toBe(false);
    const old: Confirmations = { version: 1, since: at(NOW - 90 * DAY), confirmed: {} };
    expect(needsConfirmation(issue("a", { closedAt: at(NOW - CONFIRM_WINDOW_MS + DAY) }), old, NOW)).toBe(true);
    expect(needsConfirmation(issue("a", { closedAt: at(NOW - CONFIRM_WINDOW_MS - DAY) }), old, NOW)).toBe(false);
  });

  it("confirmada deja de pedirse; si se reabre y se vuelve a cerrar, se pide de nuevo", () => {
    const closed = issue("a", { closedAt: at(NOW - 2 * DAY) });
    const confirmed = state({ a: at(NOW - DAY) });
    expect(needsConfirmation(closed, confirmed, NOW)).toBe(false);
    expect(needsConfirmation({ ...closed, closedAt: at(NOW - 3600_000) }, confirmed, NOW)).toBe(true);
    // Un comentario posterior mueve `updatedAt`, no el cierre: sigue confirmada.
    expect(needsConfirmation({ ...closed, updatedAt: at(NOW) }, confirmed, NOW)).toBe(false);
  });

  it("sin fecha de cierre vale la última actualización; con fechas rotas, no se pide", () => {
    expect(closedTime(issue("a", { closedAt: null, updatedAt: at(NOW - DAY) }))).toBe(NOW - DAY);
    expect(needsConfirmation(issue("a", { closedAt: null, updatedAt: at(NOW - DAY) }), state(), NOW)).toBe(true);
    expect(needsConfirmation(issue("a", { closedAt: null, updatedAt: "" }), state(), NOW)).toBe(false);
  });

  it("devuelve los ids pendientes; sin estado (el worker no respondió), ninguno", () => {
    const issues = [issue("a"), issue("b", { parentId: "a" }), issue("c", { status: "in_progress", closedAt: null }), issue("d", { status: "cancelled" })];
    expect([...pendingConfirmation(issues, state({ d: at(NOW) }), NOW)]).toEqual(["a"]);
    expect([...pendingConfirmation(issues, state(), NOW)].sort()).toEqual(["a", "d"]);
    expect(pendingConfirmation(issues, null, NOW).size).toBe(0);
  });
});

describe("confirmar y deshacer", () => {
  it("confirmar guarda la hora; deshacer la quita; no toca `since`", () => {
    const confirmed = applyConfirmOp(state(), "confirm", ["a", "b"], NOW);
    expect(confirmed).toEqual({ ...state(), confirmed: { a: at(NOW), b: at(NOW) } });
    expect(applyConfirmOp(confirmed, "unconfirm", ["a", "zzz"], NOW + 1000).confirmed).toEqual({ b: at(NOW) });
  });

  it("volver a confirmar actualiza la hora, para cubrir un cierre más nuevo", () => {
    const first = applyConfirmOp(state(), "confirm", ["a"], NOW - DAY);
    expect(applyConfirmOp(first, "confirm", ["a"], NOW).confirmed).toEqual({ a: at(NOW) });
  });

  it("las confirmaciones de hace más de dos meses se descartan: su cierre ya salió de la ventana", () => {
    const old = state({ vieja: at(NOW - 61 * DAY), reciente: at(NOW - 10 * DAY) });
    expect(Object.keys(applyConfirmOp(old, "confirm", ["a"], NOW).confirmed).sort()).toEqual(["a", "reciente"]);
  });
});
