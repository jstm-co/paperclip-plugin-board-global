import { useCallback, useEffect, useRef, useState } from "react";
import { applyConfirmOp, parseConfirmations, type Confirmations } from "../confirm.js";
import { CONFIRM_ACTIONS, DATA_CONFIRMATIONS } from "../shared.js";
import { getCompanyData, runAction } from "./bridge.js";

export interface ConfirmationsApi {
  /** `null` mientras carga o si el worker no responde: el board sigue sin la columna «Por confirmar». */
  state: Confirmations | null;
  reload: () => Promise<void>;
  /** Optimistas: el cambio se ve al instante. Si la llamada falla, vuelve lo del servidor y el error se propaga. */
  confirm: (ids: readonly string[]) => Promise<void>;
  unconfirm: (ids: readonly string[]) => Promise<void>;
}

/**
 * «Por confirmar» (JST-407): qué cierres ya confirmó la persona. Vive en el
 * worker (`ctx.state`, compartido en la instancia). El host pide una empresa
 * para autorizar cada llamada: se usa la activa.
 */
export function useConfirmations(companyId: string | null): ConfirmationsApi {
  const [state, setState] = useState<Confirmations | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const loadId = useRef(0);
  /** Escrituras en vuelo: la respuesta de una no pisa el cambio optimista de la siguiente. */
  const inflight = useRef(0);

  const reload = useCallback(async () => {
    const id = ++loadId.current;
    try {
      if (!companyId) return;
      const data = parseConfirmations(await getCompanyData<unknown>(DATA_CONFIRMATIONS, companyId));
      if (id === loadId.current && inflight.current === 0 && data) setState(data);
    } catch {
      // Sin respuesta queda lo que había; la primera vez, el board sin la columna.
    }
  }, [companyId]);

  useEffect(() => {
    void reload();
    return () => {
      loadId.current += 1;
    };
  }, [reload]);

  const mutate = useCallback(
    async (op: keyof typeof CONFIRM_ACTIONS, ids: readonly string[]) => {
      if (ids.length === 0) return;
      if (!companyId) throw new Error("Sin empresa activa");
      // Una lectura en curso traería lo de antes del cambio.
      loadId.current += 1;
      inflight.current += 1;
      const before = stateRef.current;
      if (before) setState(applyConfirmOp(before, op, ids, Date.now()));
      try {
        const result = parseConfirmations(await runAction<unknown>(CONFIRM_ACTIONS[op], companyId, { ids: [...ids] }));
        inflight.current -= 1;
        if (inflight.current === 0 && result) setState(result);
      } catch (err) {
        inflight.current -= 1;
        if (inflight.current === 0) {
          setState(before);
          void reload();
        }
        throw err;
      }
    },
    [companyId, reload],
  );

  const confirm = useCallback((ids: readonly string[]) => mutate("confirm", ids), [mutate]);
  const unconfirm = useCallback((ids: readonly string[]) => mutate("unconfirm", ids), [mutate]);
  return { state, reload, confirm, unconfirm };
}
