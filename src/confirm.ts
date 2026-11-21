// «Por confirmar» (JST-407): las tareas raíz que alguien cerró (hecha o
// cancelada) quedan en una columna propia del board hasta que la persona las
// confirma. Para Paperclip siguen cerradas; el plugin solo recuerda cuáles ya
// se confirmaron. Lógica sin React: la usan la UI y el worker.
import type { BoardIssue } from "./shared.js";
import { t } from "./i18n.js";

/** Clave en `ctx.state` (alcance `instance`). */
export const CONFIRM_STATE_KEY = "confirmations";
const STORE_VERSION = 1;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Al estrenar la columna entran los cierres de la última semana, no todo el historial. */
export const CONFIRM_BACKFILL_MS = 7 * DAY_MS;
/** Un cierre sin confirmar deja de pedirse al mes: la columna no crece sin fin. */
export const CONFIRM_WINDOW_MS = 30 * DAY_MS;
/** Las confirmaciones más viejas que esto ya no hacen falta (su cierre salió de la ventana). */
const CONFIRM_KEEP_MS = 2 * CONFIRM_WINDOW_MS;
/** Tope de ids por acción, para que una llamada rota no llene el estado. */
const MAX_IDS = 2000;

export interface Confirmations {
  version: number;
  /** Desde cuándo se piden confirmaciones (ISO). Lo cerrado antes no entra. */
  since: string;
  /** Id de la tarea → cuándo se confirmó (ISO). Un cierre posterior la vuelve a pedir. */
  confirmed: Record<string, string>;
}

export function initialConfirmations(now: number): Confirmations {
  return { version: STORE_VERSION, since: new Date(now - CONFIRM_BACKFILL_MS).toISOString(), confirmed: {} };
}

/** Lee lo guardado sin confiar en su forma. `null` si no hay nada que sirva. */
export function parseConfirmations(data: unknown): Confirmations | null {
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const { since, confirmed } = data as Record<string, unknown>;
  if (typeof since !== "string" || Number.isNaN(Date.parse(since))) return null;
  const clean: Record<string, string> = {};
  if (confirmed && typeof confirmed === "object") {
    for (const [id, at] of Object.entries(confirmed as Record<string, unknown>)) {
      if (id && typeof at === "string" && !Number.isNaN(Date.parse(at))) clean[id] = at;
    }
  }
  return { version: STORE_VERSION, since, confirmed: clean };
}

/** Ids de una acción del worker. Lanza si no vienen como lista de textos. */
export function parseConfirmIds(params: Record<string, unknown>): string[] {
  const ids = params.ids;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !id)) throw new Error(t('Falta "{key}"', { key: "ids" }));
  if (ids.length > MAX_IDS) throw new Error(t("Máximo {max} tareas por vez", { max: MAX_IDS }));
  return [...new Set(ids as string[])];
}

/** Cuándo se cerró la tarea. Las filas viejas no traen `closedAt`: vale la última actualización. */
export function closedTime(issue: BoardIssue): number {
  return Date.parse(issue.closedAt || issue.updatedAt);
}

/**
 * La tarea espera confirmación: es raíz, está hecha o cancelada, se cerró
 * dentro de la ventana y después de la última vez que se confirmó.
 */
export function needsConfirmation(issue: BoardIssue, state: Confirmations, now: number): boolean {
  if (issue.parentId) return false;
  if (issue.status !== "done" && issue.status !== "cancelled") return false;
  const closedAt = closedTime(issue);
  if (Number.isNaN(closedAt)) return false;
  if (closedAt < Date.parse(state.since) || closedAt < now - CONFIRM_WINDOW_MS) return false;
  const confirmedAt = state.confirmed[issue.id];
  return !confirmedAt || Date.parse(confirmedAt) < closedAt;
}

/** Ids de las tareas que esperan confirmación. */
export function pendingConfirmation(issues: readonly BoardIssue[], state: Confirmations | null, now: number): Set<string> {
  const pending = new Set<string>();
  if (!state) return pending;
  for (const issue of issues) if (needsConfirmation(issue, state, now)) pending.add(issue.id);
  return pending;
}

/** Las confirmadas guardan la hora: si la tarea se reabre y se vuelve a cerrar, se pide de nuevo. */
export function applyConfirmOp(state: Confirmations, op: "confirm" | "unconfirm", ids: readonly string[], now: number): Confirmations {
  const confirmed: Record<string, string> = {};
  for (const [id, at] of Object.entries(state.confirmed)) {
    if (Date.parse(at) >= now - CONFIRM_KEEP_MS) confirmed[id] = at;
  }
  if (op === "confirm") {
    const at = new Date(now).toISOString();
    for (const id of ids) confirmed[id] = at;
  } else {
    for (const id of ids) delete confirmed[id];
  }
  return { ...state, confirmed };
}
