import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { companyPaletteKeys, toBoardCompany } from "../board.js";
import {
  buildDashboard,
  type CompanyDashboardData,
  type CompanyDashboardLoad,
  type DashboardModel,
  type DashboardQuery,
} from "../dashboard.js";
import { DATA_COMPANY_ISSUES, type CompanyIssues } from "../shared.js";
import {
  getCompanyData,
  getDashboardSummary,
  listActivity,
  listAgents,
  listCompanies,
  listLiveRuns,
  listProjects,
  type CompanyRef,
} from "./bridge.js";

export interface RefreshResult {
  elapsedMs: number;
  ok: number;
  total: number;
}

/** Al volver a la pestaña se recarga si los datos tienen más de esto (igual que el Board global). */
const STALE_AFTER_MS = 60_000;

/**
 * Lee lo mismo que el Dashboard nativo de una empresa, con la sesión del
 * usuario: el host rechaza las empresas a las que no tiene acceso.
 */
export async function loadCompanyDashboard(companyId: string): Promise<CompanyDashboardData> {
  const [summary, issues, liveRuns, activity, agents, projects] = await Promise.all([
    getDashboardSummary(companyId),
    getCompanyData<CompanyIssues>(DATA_COMPANY_ISSUES, companyId),
    listLiveRuns(companyId),
    listActivity(companyId),
    listAgents(companyId),
    listProjects(companyId),
  ]);
  return { summary, issues: issues.issues, liveRuns, activity, agents, projects };
}

/** `all` es la lista completa de empresas: de ahí sale el color de la paleta fija. */
function companyOf(ref: CompanyRef, all: readonly CompanyRef[]) {
  return toBoardCompany(ref.id, ref.name, ref.issuePrefix, ref.brandColor ?? null, companyPaletteKeys(all).get(ref.id) ?? null);
}

function loadOne(ref: CompanyRef, all: readonly CompanyRef[]): Promise<CompanyDashboardLoad> {
  const company = companyOf(ref, all);
  return loadCompanyDashboard(ref.id).then(
    (data) => ({ company, status: "ok", data }),
    (err: Error) => ({ company, status: "err", error: err.message }),
  );
}

/**
 * Carga el Dashboard de todas las empresas en paralelo. Si una falla, el resto
 * se muestra igual y esa empresa queda marcada en `model.failed` y se puede
 * reintentar sola. El filtro de empresa solo cambia el modelo, no recarga.
 * `onVisibleRefresh` avisa cuando se recargó solo al volver a la pestaña.
 */
export function useDashboardData(query: DashboardQuery, options: { onVisibleRefresh?: (result: RefreshResult) => void } = {}) {
  const [refs, setRefs] = useState<CompanyRef[]>([]);
  const [loads, setLoads] = useState<Record<string, CompanyDashboardLoad>>({});
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const loadId = useRef(0);
  const loadedAtRef = useRef(0);
  const onVisibleRefreshRef = useRef(options.onVisibleRefresh);
  onVisibleRefreshRef.current = options.onVisibleRefresh;

  const loadAll = useCallback(async (mode: "initial" | "refresh"): Promise<RefreshResult | null> => {
    const id = ++loadId.current;
    const startedAt = performance.now();
    if (mode === "refresh") setRefreshing(true);
    try {
      const list = await listCompanies();
      if (id !== loadId.current) return null;
      if (mode === "initial") {
        setRefs(list);
        setLoads(Object.fromEntries(list.map((ref) => [ref.id, { company: companyOf(ref, list), status: "wait" as const }])));
      }
      const results = await Promise.all(
        list.map((ref) =>
          loadOne(ref, list).then((load) => {
            // En la carga inicial cada empresa aparece apenas responde.
            if (mode === "initial" && id === loadId.current) setLoads((prev) => ({ ...prev, [ref.id]: load }));
            return load;
          }),
        ),
      );
      if (id !== loadId.current) return null;
      setRefs(list);
      setLoads(Object.fromEntries(results.map((load) => [load.company.id, load])));
      loadedAtRef.current = Date.now();
      setLoadedAt(loadedAtRef.current);
      setListError(null);
      setReady(true);
      return {
        elapsedMs: Math.round(performance.now() - startedAt),
        ok: results.filter((load) => load.status === "ok").length,
        total: results.length,
      };
    } catch (err) {
      if (id === loadId.current) {
        setListError((err as Error).message);
        setReady(true);
      }
      return null;
    } finally {
      if (id === loadId.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAll("initial");
    const onVisible = () => {
      if (document.visibilityState === "visible" && loadedAtRef.current && Date.now() - loadedAtRef.current > STALE_AFTER_MS) {
        void loadAll("refresh").then((result) => {
          if (result) onVisibleRefreshRef.current?.(result);
        });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      loadId.current += 1;
    };
  }, [loadAll]);

  const refresh = useCallback(() => loadAll("refresh"), [loadAll]);

  const refsRef = useRef(refs);
  refsRef.current = refs;
  const retry = useCallback(async (companyId: string): Promise<CompanyDashboardLoad | null> => {
    const ref = refsRef.current.find((candidate) => candidate.id === companyId);
    if (!ref) return null;
    setLoads((prev) => ({ ...prev, [companyId]: { company: companyOf(ref, refsRef.current), status: "wait" } }));
    const load = await loadOne(ref, refsRef.current);
    setLoads((prev) => ({ ...prev, [companyId]: load }));
    return load;
  }, []);

  // La clave evita recalcular cuando la UI arma un `query` nuevo con las mismas empresas.
  const empKey = query.emp.join(",");
  const model: DashboardModel = useMemo(
    () => buildDashboard(Object.values(loads), { emp: empKey ? empKey.split(",") : [] }),
    [loads, empKey],
  );

  // Estado de carga de cada empresa, también de las que el filtro oculta (para los botones del filtro).
  const statusById = useMemo(
    () => new Map(Object.values(loads).map((load) => [load.company.id, load] as const)),
    [loads],
  );

  return { model, statusById, ready, refreshing, listError, loadedAt, refresh, retry };
}
