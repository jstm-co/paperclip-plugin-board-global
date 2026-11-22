// Modal de tarea (JST-408): lo que no depende de React.
import { normalizeText, userLabel, type BoardIndex } from "./board.js";
import type { BoardIssue, IssueComment } from "./shared.js";
import { t } from "./i18n.js";

/** Comentarios que el modal pide de una vez; los anteriores quedan en la página de la tarea. */
export const TASK_COMMENTS_LIMIT = 50;

/**
 * Un clic normal abre la tarea en el modal. Con Ctrl, ⌘, Mayús, Alt o el botón
 * del medio manda el navegador: la página de la tarea, en otra pestaña.
 */
export function opensInPlace(event: { button?: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  return (event.button ?? 0) === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export interface CommentAuthor {
  name: string;
  /** Lo escribió la persona que mira el board. */
  self: boolean;
  agent: boolean;
}

/** Quién escribió el comentario: la persona que mira, un agente, otra persona o el sistema. */
export function commentAuthor(index: BoardIndex, comment: IssueComment, userId: string | null): CommentAuthor {
  if (comment.authorAgentId) {
    return { name: index.agentById.get(comment.authorAgentId)?.name ?? t("Agente desconocido"), self: false, agent: true };
  }
  if (comment.authorUserId) {
    const self = userId !== null && comment.authorUserId === userId;
    return { name: self ? t("Tú") : userLabel(comment.authorUserId), self, agent: false };
  }
  return { name: t("Sistema"), self: false, agent: false };
}

/** Los comentarios que se muestran: sin borrados ni repetidos, del más nuevo al más antiguo. */
export function visibleComments(comments: readonly IssueComment[]): IssueComment[] {
  const seen = new Set<string>();
  return comments
    .filter((comment) => {
      if (comment.deletedAt || seen.has(comment.id)) return false;
      seen.add(comment.id);
      return true;
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** El texto a enviar, o `null` si no hay nada que comentar. */
export function commentBody(draft: string): string | null {
  const body = draft.trim();
  return body ? body : null;
}

// ---------------------------------------------------------------------------
// Reasignar desde el modal (JST-429)
// ---------------------------------------------------------------------------

/** A quién queda la tarea: un agente, la persona de la sesión o nadie. */
export type AssignTarget = { kind: "agent"; id: string } | { kind: "user"; id: string } | { kind: "none" };

/** Con más agentes que esto el menú trae su campo de búsqueda (como los filtros, que lo ponen con más de 7 opciones). */
export const ASSIGN_SEARCH_FROM = 8;

/** Agentes que no se ofrecen: dados de baja o esperando aprobación. */
const HIDDEN_AGENT_STATUSES = ["terminated", "pending_approval"];

export interface AssignCandidate {
  id: string;
  name: string;
  paused: boolean;
}

/** Cuerpo del PATCH: siempre manda los dos campos, para que el servidor quite al anterior. */
export function assignBody(target: AssignTarget): { assigneeAgentId: string | null; assigneeUserId: string | null } {
  if (target.kind === "agent") return { assigneeAgentId: target.id, assigneeUserId: null };
  if (target.kind === "user") return { assigneeAgentId: null, assigneeUserId: target.id };
  return { assigneeAgentId: null, assigneeUserId: null };
}

/** ¿La tarea ya está a cargo de ese destino? Entonces elegirlo no manda nada. */
export function isAssignedTo(issue: Pick<BoardIssue, "assigneeAgentId" | "assigneeUserId">, target: AssignTarget): boolean {
  if (target.kind === "agent") return issue.assigneeAgentId === target.id;
  if (target.kind === "user") return !issue.assigneeAgentId && issue.assigneeUserId === target.id;
  return !issue.assigneeAgentId && !issue.assigneeUserId;
}

/** La tarea con su nuevo responsable (la actualización al instante del tablero). */
export function withAssignee<T extends Pick<BoardIssue, "assigneeAgentId" | "assigneeUserId">>(issue: T, target: AssignTarget): T {
  return { ...issue, ...assignBody(target) };
}

/**
 * Agentes de la empresa de la tarea, por nombre. Quedan fuera los terminados y los
 * pendientes de aprobación, salvo el que ya tiene la tarea; sin `status` (la API no
 * lo trajo) se ofrecen todos.
 */
export function assignCandidates(index: BoardIndex, issue: Pick<BoardIssue, "companyId" | "assigneeAgentId">): AssignCandidate[] {
  return [...index.agentById.values()]
    .filter((agent) => agent.companyId === issue.companyId)
    .filter((agent) => agent.id === issue.assigneeAgentId || !agent.status || !HIDDEN_AGENT_STATUSES.includes(agent.status))
    .map((agent) => ({ id: agent.id, name: agent.name, paused: agent.status === "paused" }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Filtra por nombre, sin acentos ni mayúsculas. Con la búsqueda vacía devuelve todos. */
export function filterCandidates<T extends { name: string }>(candidates: readonly T[], search: string): T[] {
  const q = normalizeText(search.trim());
  return q ? candidates.filter((candidate) => normalizeText(candidate.name).includes(q)) : [...candidates];
}
