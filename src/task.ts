// Modal de tarea (JST-408): lo que no depende de React.
import { userLabel, type BoardIndex } from "./board.js";
import type { IssueComment } from "./shared.js";
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
