import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildBoardIndex, companyPaletteKeys, withBlockedBy, type BoardIndex } from "../board.js";
import { DATA_COMPANY_ISSUES, type CompanyBoard, type CompanyIssues, type IssueStatus } from "../shared.js";
import {
  getCompanyData,
  listAgents,
  listAttention,
  listCompanies,
  listOpenBlockedBy,
  listProjects,
  updateIssueStatus,
  type CompanyRef,
} from "./bridge.js";

export type CompanyLoadStatus = "wait" | "ok" | "err";

export interface CompanyLoad {
  company: CompanyRef;
  status: CompanyLoadStatus;
  board?: CompanyBoard;
  error?: string;
}

export interface RefreshResult {
  elapsedMs: number;
  ok: number;
  total: number;
}

/** Al volver a la pestaña se recarga si los datos tienen más de esto. */
const STALE_AFTER_MS = 60_000;

async function loadCompanyBoard(companyId: string): Promise<CompanyBoard> {
  const [issues, projects, agents, attention, blockedBy] = await Promise.all([
    getCompanyData<CompanyIssues>(DATA_COMPANY_ISSUES, companyId),
    listProjects(companyId),
    listAgents(companyId),
    // Si el Inbox no responde, el board sigue sin «Te toca» (design-spec §4.4).
    listAttention(companyId).catch(() => null),
    // Si falla, quedan solo los bloqueadores de las tareas Bloqueadas.
    listOpenBlockedBy(companyId).catch(() => []),
  ]);
  return { ...issues, issues: withBlockedBy(issues.issues, blockedBy), projects, agents, attention };
}

function loadOne(company: CompanyRef): Promise<CompanyLoad> {
  return loadCompanyBoard(company.id).then(
    (board) => ({ company, status: "ok", board }),
    (err: Error) => ({ company, status: "err", error: err.message }),
  );
}

function setStatus(loads: Record<string, CompanyLoad>, issueId: string, status: IssueStatus): Record<string, CompanyLoad> {
  const next = { ...loads };
  for (const [companyId, load] of Object.entries(loads)) {
    if (!load.board?.issues.some((issue) => issue.id === issueId)) continue;
    next[companyId] = {
      ...load,
      board: {
        ...load.board,
        issues: load.board.issues.map((issue) =>
          issue.id === issueId ? { ...issue, status, updatedAt: new Date().toISOString() } : issue,
        ),
      },
    };
  }
  return next;
}

/**
 * Carga el board de todas las empresas en paralelo (una llamada al worker por
 * empresa). Mientras carga informa el estado de cada empresa; si una falla, el
 * resto del board sigue y esa empresa se puede reintentar sola.
 */
export function useBoardData() {
  const [companies, setCompanies] = useState<CompanyRef[] | null>(null);
  const [loads, setLoads] = useState<Record<string, CompanyLoad>>({});
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const loadId = useRef(0);
  const loadedAtRef = useRef(0);

  const loadAll = useCallback(async (mode: "initial" | "refresh"): Promise<RefreshResult | null> => {
    const id = ++loadId.current;
    const startedAt = performance.now();
    if (mode === "refresh") setRefreshing(true);
    try {
      const list = await listCompanies();
      if (id !== loadId.current) return null;
      if (mode === "initial") {
        setCompanies(list);
        setLoads(Object.fromEntries(list.map((company) => [company.id, { company, status: "wait" as const }])));
      }
      const results = await Promise.all(
        list.map((company) =>
          loadOne(company).then((load) => {
            // En la carga inicial cada empresa avisa apenas responde (§4.1).
            if (mode === "initial" && id === loadId.current) setLoads((prev) => ({ ...prev, [company.id]: load }));
            return load;
          }),
        ),
      );
      if (id !== loadId.current) return null;
      setCompanies(list);
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
        void loadAll("refresh");
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      loadId.current += 1;
    };
  }, [loadAll]);

  const refresh = useCallback(() => loadAll("refresh"), [loadAll]);

  const loadsRef = useRef(loads);
  loadsRef.current = loads;
  const retry = useCallback(async (companyId: string) => {
    const company = loadsRef.current[companyId]?.company;
    if (!company) return;
    setLoads((prev) => ({ ...prev, [companyId]: { company, status: "wait" } }));
    const load = await loadOne(company);
    setLoads((prev) => ({ ...prev, [companyId]: load }));
  }, []);

  /**
   * Mueve la tarjeta al instante y confirma con la API. Si la API falla, la
   * tarjeta vuelve a su estado anterior y el error se propaga.
   */
  const moveIssue = useCallback(async (issueId: string, from: IssueStatus, to: IssueStatus) => {
    setLoads((prev) => setStatus(prev, issueId, to));
    try {
      const updated = await updateIssueStatus(issueId, to);
      if (updated.status !== to) setLoads((prev) => setStatus(prev, issueId, updated.status));
      return updated.status;
    } catch (err) {
      setLoads((prev) => setStatus(prev, issueId, from));
      throw err;
    }
  }, []);

  const boards = useMemo(
    () => Object.values(loads).flatMap((load) => (load.status === "ok" && load.board ? [load.board] : [])),
    [loads],
  );
  // Los colores salen de la lista completa: una empresa que falla no le cambia el color a las demás.
  const index: BoardIndex | null = useMemo(
    () => (ready && boards.length > 0 ? buildBoardIndex(boards, companies ? companyPaletteKeys(companies) : undefined) : null),
    [ready, boards, companies],
  );
  const failed = useMemo(() => Object.values(loads).filter((load) => load.status === "err"), [loads]);

  return { companies, loads, index, failed, ready, refreshing, listError, loadedAt, refresh, retry, moveIssue };
}
