// Lecturas propias de la vista Pedidos, que solo se hacen con la vista abierta:
// las corridas activas («Trabajando ahora») y el último comentario de cada
// pedido visible («Última novedad»).
import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "../i18n.js";
import { userLabel, type BoardIndex } from "../board.js";
import { commentLine } from "../pedidos.js";
import type { BoardIssue, LiveRun } from "../shared.js";
import { listIssueComments, listLiveRuns } from "./bridge.js";

/** Las corridas cambian más rápido que las tareas: se vuelven a pedir con la pestaña a la vista. */
const LIVE_REFRESH_MS = 30_000;
const NO_RUNS: LiveRun[] = [];

/**
 * Corridas activas de todas las empresas (`minCount=0`: sin las ya terminadas).
 * Si una empresa falla, el resto sigue: sus pedidos quedan sin «Trabajando ahora».
 */
export function useLiveRuns(index: BoardIndex | null, enabled: boolean, loadedAt: number | null): LiveRun[] {
  const [runs, setRuns] = useState<LiveRun[]>(NO_RUNS);
  const companyIds = useMemo(() => (index ? index.companies.map((company) => company.id).join(",") : ""), [index]);
  useEffect(() => {
    if (!enabled || !companyIds) return;
    let alive = true;
    const load = async () => {
      const lists = await Promise.all(companyIds.split(",").map((id) => listLiveRuns(id, 0).catch(() => NO_RUNS)));
      if (alive) setRuns(lists.flat());
    };
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, LIVE_REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [enabled, companyIds, loadedAt]);
  return enabled ? runs : NO_RUNS;
}

export interface PedidoNote {
  /** Primera línea del comentario, sin Markdown. */
  text: string;
  at: string;
  /** Nombre del agente, «Tú» o la persona. */
  author: string;
}

const NOTE_CONCURRENCY = 4;

interface NoteEntry {
  /** `updatedAt` de la raíz al pedirlo: un comentario nuevo lo cambia. */
  stamp: string;
  note: PedidoNote | null;
}

/**
 * Último comentario de cada pedido de `roots` (los visibles). Se piden de a 4 y
 * quedan en memoria por tarea y `updatedAt`. Si la lectura falla o no hay
 * comentarios, el pedido queda sin novedad y no se reintenta hasta que cambie.
 */
export function usePedidoNotes(index: BoardIndex | null, roots: readonly BoardIssue[], userId: string | null): ReadonlyMap<string, PedidoNote> {
  const cache = useRef(new Map<string, NoteEntry>());
  const pending = useRef(new Set<string>());
  const [version, setVersion] = useState(0);
  const context = useRef({ index, userId });
  context.current = { index, userId };
  const wanted = roots.map((root) => `${root.id}@${root.updatedAt}`).join(",");

  useEffect(() => {
    const queue = roots.filter((root) => cache.current.get(root.id)?.stamp !== root.updatedAt && !pending.current.has(root.id));
    if (queue.length === 0) return;
    for (const root of queue) pending.current.add(root.id);
    const worker = async () => {
      for (let root = queue.shift(); root; root = queue.shift()) {
        const stamp = root.updatedAt;
        let note: PedidoNote | null = null;
        try {
          const [comment] = await listIssueComments(root.id, 1);
          const text = comment ? commentLine(comment.body ?? "") : "";
          if (comment && text) {
            const { index: current, userId: me } = context.current;
            const author = comment.authorAgentId
              ? (current?.agentById.get(comment.authorAgentId)?.name ?? t("Agente"))
              : comment.authorUserId
                ? comment.authorUserId === me
                  ? t("Tú")
                  : userLabel(comment.authorUserId)
                : t("Sistema");
            note = { text, at: comment.createdAt, author };
          }
        } catch {
          note = null;
        }
        pending.current.delete(root.id);
        cache.current.set(root.id, { stamp, note });
        setVersion((n) => n + 1);
      }
    };
    void Promise.all(Array.from({ length: Math.min(NOTE_CONCURRENCY, queue.length) }, worker));
    return () => {
      // Lo que quedó sin pedir se libera para el siguiente intento; lo que ya está en vuelo termina y queda en memoria.
      for (const root of queue) pending.current.delete(root.id);
      queue.length = 0;
    };
    // `wanted` resume qué raíces y con qué `updatedAt`: así no se relanza en cada pintado.
  }, [wanted]);

  return useMemo(() => {
    const notes = new Map<string, PedidoNote>();
    for (const [id, entry] of cache.current) if (entry.note) notes.set(id, entry.note);
    return notes;
  }, [version]);
}
