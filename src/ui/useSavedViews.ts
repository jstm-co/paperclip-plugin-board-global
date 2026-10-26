import { useCallback, useEffect, useRef, useState } from "react";
import { DATA_SAVED_VIEWS, VIEW_ACTIONS } from "../shared.js";
import { applyViewOp, type SavedView, type ViewOp, type ViewOpResult } from "../views.js";
import { getCompanyData, runAction } from "./bridge.js";

export type SavedViewsStatus = "loading" | "ok" | "error";

export interface SavedViews {
  status: SavedViewsStatus;
  views: SavedView[];
  /** Vuelve a leer la lista. `silent`: sin pasar por «Cargando» (con «Actualizar»). */
  reload: (silent?: boolean) => Promise<void>;
  /**
   * Escritura optimista (§3.10): la operación se aplica al instante sobre la
   * lista vigente y la lista del servidor la reemplaza al responder. Si la
   * llamada falla, vuelve la lista de antes y el error se propaga.
   */
  mutate: (op: ViewOp) => Promise<ViewOpResult>;
}

/**
 * Vistas guardadas en el servidor (`ctx.state` del worker, compartidas en la
 * instancia). Se leen al abrir el board, en paralelo con las tareas. El host
 * pide una empresa para autorizar cada llamada: se usa la activa.
 */
export function useSavedViews(companyId: string | null): SavedViews {
  const [status, setStatus] = useState<SavedViewsStatus>("loading");
  const [views, setViews] = useState<SavedView[]>([]);
  const viewsRef = useRef(views);
  viewsRef.current = views;
  const loadId = useRef(0);

  const reload = useCallback(
    async (silent = false) => {
      const id = ++loadId.current;
      if (!silent) setStatus("loading");
      try {
        if (!companyId) throw new Error("Sin empresa activa");
        const data = await getCompanyData<{ views: SavedView[] }>(DATA_SAVED_VIEWS, companyId);
        if (id !== loadId.current) return;
        setViews(data.views);
        setStatus("ok");
      } catch {
        // Con «Actualizar» se conserva la lista que ya había.
        if (id === loadId.current && !silent) setStatus("error");
      }
    },
    [companyId],
  );

  useEffect(() => {
    void reload();
    return () => {
      loadId.current += 1;
    };
  }, [reload]);

  const mutate = useCallback(
    async (op: ViewOp) => {
      const before = viewsRef.current;
      // Una lectura en curso traería la lista de antes del cambio.
      loadId.current += 1;
      // Sobre la lista de ahora (no la del primer intento, si es un «Reintentar»).
      setViews(applyViewOp(before, op).views);
      try {
        if (!companyId) throw new Error("Sin empresa activa");
        const { op: kind, ...params } = op;
        const result = await runAction<ViewOpResult>(VIEW_ACTIONS[kind], companyId, params);
        setViews(result.views);
        return result;
      } catch (err) {
        setViews(before);
        throw err;
      }
    },
    [companyId],
  );

  return { status, views, reload, mutate };
}
