// Cabecera (§3.1), contadores (§3.2) y «Abiertas por empresa» (§3.3). Con
// carriles, los contadores van en una línea (Fase 2, JST-21 §4.5).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  KPI_KEYS,
  applyKpi,
  companyPaletteKeys,
  computeKpis,
  isKpiActive,
  openByCompany,
  toBoardCompany,
  type BoardCompany,
  type BoardFilters,
  type BoardIndex,
  type BoardView,
  type KpiKey,
} from "../board.js";
import { OPEN_STATUSES, isOpenStatus, type BoardIssue, type IssueStatus } from "../shared.js";
import { CompanyTag, PriorityIcon, STATUS_LABELS, Skeleton, StatusIcon, companyClass, companyStyle, cx, plural } from "./common.js";
import { Icon } from "./icons.js";
import { FollowTip } from "./layer.js";
import type { CompanyLoad } from "./useBoardData.js";

function updatedLabel(loadedAt: number | null, now: number): string {
  if (!loadedAt) return "";
  const minutes = Math.floor((now - loadedAt) / 60_000);
  if (minutes < 1) return "Actualizado hace un momento";
  if (minutes < 60) return `Actualizado hace ${minutes} min`;
  return `Actualizado hace ${Math.floor(minutes / 60)} h`;
}

export function Header({
  loading,
  companyCount,
  loadedAt,
  now,
  refreshing,
  onRefresh,
  view,
  onView,
}: {
  loading: boolean;
  companyCount: number | null;
  loadedAt: number | null;
  now: number;
  refreshing: boolean;
  onRefresh: () => void;
  view: BoardView;
  onView: (view: BoardView) => void;
}) {
  const n = companyCount ?? 4;
  const subtitle = loading
    ? `Cargando las tareas de ${plural(n, "empresa", "empresas")}…`
    : `Tareas de ${n === 1 ? "1 empresa" : `las ${n} empresas`} · lo que necesita atención, arriba`;
  return (
    <div className="gb-head">
      <div>
        <h1>Board global</h1>
        <div className="gb-sub">{subtitle}</div>
      </div>
      <span className="gb-sp" />
      {!loading && loadedAt ? (
        <span className="gb-upd">
          <Icon name="clock" size={12} />
          {updatedLabel(loadedAt, now)}
        </span>
      ) : null}
      <button type="button" className={cx("gb-btn", refreshing && "is-spinning")} onClick={onRefresh} disabled={loading || refreshing}>
        <Icon name="refresh" size={14} />
        Actualizar
      </button>
      <div className="gb-seg" role="group" aria-label="Vista">
        <button type="button" className={cx(view === "kanban" && "is-on")} aria-pressed={view === "kanban"} onClick={() => onView("kanban")}>
          <Icon name="kanban" size={14} />
          Kanban
        </button>
        <button type="button" className={cx(view === "lista" && "is-on")} aria-pressed={view === "lista"} onClick={() => onView("lista")}>
          <Icon name="list" size={14} />
          Lista
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contadores
// ---------------------------------------------------------------------------

const KPI_META: Record<KpiKey, { label: string; icon: ReactNode }> = {
  toca: {
    label: "Te toca responder",
    icon: (
      <span className="gb-ic" style={{ color: "var(--gb-fg)" }}>
        <Icon name="reply" size={14} />
      </span>
    ),
  },
  bloq: { label: "Bloqueadas", icon: <StatusIcon status="blocked" /> },
  crit: { label: "Críticas y altas", icon: <PriorityIcon priority="critical" /> },
  rev: { label: "En revisión", icon: <StatusIcon status="in_review" /> },
};

interface PanelRow {
  company: BoardCompany;
  load: CompanyLoad | undefined;
  total: number;
  byStatus: Array<{ status: IssueStatus; count: number }>;
  issueCount: number;
}

function summarize(company: BoardCompany, load: CompanyLoad | undefined, issues: readonly BoardIssue[]): PanelRow {
  const open = issues.filter((issue) => isOpenStatus(issue.status));
  return {
    company,
    load,
    total: open.length,
    issueCount: issues.length,
    byStatus: OPEN_STATUSES.map((status) => ({ status, count: open.filter((issue) => issue.status === status).length })).filter(
      (entry) => entry.count > 0,
    ),
  };
}

export function Kpis({
  index,
  loads,
  loading,
  filters,
  onFilters,
  onRetry,
  onFold,
}: {
  index: BoardIndex | null;
  loads: Record<string, CompanyLoad>;
  loading: boolean;
  filters: BoardFilters;
  onFilters: (filters: BoardFilters) => void;
  onRetry: (companyId: string) => void;
  /** Con carriles: «⌃ Plegar» vuelve a los contadores en una línea (JST-21 §4.5). */
  onFold?: () => void;
}) {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const kpis = useMemo(() => (index ? computeKpis(index, filters.emp) : null), [index, filters.emp]);

  // Una fila por empresa visible, con su estado de carga (§4.1). Mientras carga
  // se arma con lo que ya respondió; después, con el índice.
  const rows: PanelRow[] = useMemo(() => {
    const paletteKeys = companyPaletteKeys(Object.values(loads).map((load) => load.company));
    const all = Object.values(loads)
      .map((load) => ({
        load,
        company:
          index?.companyById.get(load.company.id) ??
          toBoardCompany(
            load.company.id,
            load.company.name,
            load.company.issuePrefix,
            load.company.brandColor ?? null,
            paletteKeys.get(load.company.id) ?? null,
          ),
      }))
      .sort((a, b) => a.company.name.localeCompare(b.company.name, "es"));
    return all.map(({ company, load }) => summarize(company, load, load.status === "ok" ? (load.board?.issues ?? []) : []));
  }, [loads, index]);

  const tocaUnavailable = index !== null && !index.tocaAvailable;

  return (
    <div className="gb-kpis">
      {KPI_KEYS.map((key) => {
        const meta = KPI_META[key];
        const kpi = kpis?.[key];
        const count = kpi?.issues.length ?? 0;
        const active = isKpiActive(filters, key) && !(key === "toca" && tocaUnavailable);
        const unavailable = key === "toca" && tocaUnavailable;
        const critical = key === "crit" ? (kpi?.issues.filter((issue) => issue.priority === "critical").length ?? 0) : 0;
        return (
          <button
            key={key}
            type="button"
            className={cx(
              "gb-kpi",
              !loading && !unavailable && count > 0 && key === "bloq" && "is-alert",
              !loading && !unavailable && count > 0 && key === "toca" && "is-toca",
              active && "is-on",
            )}
            aria-pressed={active}
            disabled={loading || unavailable}
            title={unavailable ? "No disponible en esta instancia" : `Filtrar: ${meta.label.toLowerCase()}`}
            onClick={() => onFilters(applyKpi(filters, key))}
          >
            <span className="gb-lab">
              {meta.icon}
              {meta.label}
            </span>
            <span className="gb-val gb-tnum">
              {loading ? <Skeleton width={44} height={22} style={{ display: "inline-block", verticalAlign: "middle" }} /> : unavailable ? "—" : count}
            </span>
            <span className="gb-brk">
              {loading ? (
                <Skeleton width={110} height={8} />
              ) : unavailable ? (
                "No disponible"
              ) : key === "crit" ? (
                <span className="gb-crit">
                  <Icon name="triangle-alert" size={12} />
                  {plural(critical, "crítica", "críticas")}
                </span>
              ) : kpi && kpi.byCompany.length > 0 ? (
                kpi.byCompany.map(({ company, count: n }) => (
                  <span key={company.id} className={companyClass(company)} style={companyStyle(company)}>
                    <b>{company.prefix}</b>
                    {n}
                  </span>
                ))
              ) : (
                "Ninguna"
              )}
            </span>
          </button>
        );
      })}

      <div className="gb-kpi gb-dist">
        <span className="gb-lab">
          <Icon name="building" size={14} />
          Abiertas por empresa
          {filters.emp.length > 0 ? (
            <button type="button" className="gb-linkbtn gb-all" onClick={() => onFilters({ ...filters, emp: [] })}>
              Ver todas
            </button>
          ) : (
            <span className="gb-hint">clic para filtrar</span>
          )}
          {onFold ? (
            <button type="button" className="gb-linkbtn gb-kfold" title="Plegar los contadores a una línea" onClick={onFold}>
              <Icon name="chevron-up" size={12} />
              Plegar
            </button>
          ) : null}
        </span>
        <div
          className="gb-rows"
          onMouseMove={(event) => {
            const seg = (event.target as HTMLElement).closest<HTMLElement>("[data-tip]");
            setTip(seg ? { text: seg.dataset.tip ?? "", x: event.clientX, y: event.clientY } : null);
          }}
          onMouseLeave={() => setTip(null)}
        >
          {rows.map((row) => (
            <CompanyRow
              key={row.company.id}
              row={row}
              loading={loading}
              filters={filters}
              onToggle={() => {
                const selected = filters.emp.includes(row.company.prefix);
                onFilters({
                  ...filters,
                  emp: selected ? filters.emp.filter((p) => p !== row.company.prefix) : [...filters.emp, row.company.prefix],
                });
              }}
              onRetry={() => onRetry(row.company.id)}
            />
          ))}
          {rows.length === 0
            ? [0, 1, 2, 3].map((i) => (
                <div key={i} className="gb-corow">
                  <span className="gb-check" />
                  <Skeleton width={28} height={12} />
                  <span className="gb-bar">
                    <Skeleton width="100%" height={8} />
                  </span>
                  <span className="gb-tot" />
                </div>
              ))
            : null}
        </div>
        <div className="gb-legend">
          {OPEN_STATUSES.map((status) => (
            <span key={status}>
              <StatusIcon status={status} size={12} />
              {STATUS_LABELS[status]}
            </span>
          ))}
        </div>
      </div>
      <FollowTip tip={tip} />
    </div>
  );
}

function CompanyRow({
  row,
  loading,
  filters,
  onToggle,
  onRetry,
}: {
  row: PanelRow;
  loading: boolean;
  filters: BoardFilters;
  onToggle: () => void;
  onRetry: () => void;
}) {
  const { company, load } = row;
  const status = load?.status ?? "wait";
  const selected = filters.emp.includes(company.prefix);
  const className = cx("gb-corow", companyClass(company), selected ? "is-on" : filters.emp.length > 0 && "is-dim");
  const style = companyStyle(company);

  const bar =
    status === "wait" ? (
      <Skeleton width="100%" height={8} />
    ) : status === "err" ? (
      <span className="gb-err" title={load?.error}>
        <Icon name="circle-alert" size={12} />
        No respondió
        <button type="button" className="gb-linkbtn" onClick={onRetry}>
          Reintentar
        </button>
      </span>
    ) : (
      row.byStatus.map(({ status: s, count }) => (
        <span
          key={s}
          className="gb-seg-s"
          style={{ flex: count, "--sc": `var(--gb-st-${s})` } as CSSProperties}
          data-tip={`${company.prefix} · ${STATUS_LABELS[s]}: ${count}`}
        />
      ))
    );
  const total =
    status === "wait" ? (
      <span className="gb-wait">
        <Icon name="loader" size={12} />
        cargando
      </span>
    ) : status === "err" ? null : loading ? (
      <span className="gb-ok">
        <Icon name="check" size={12} />
        {plural(row.issueCount, "tarea", "tareas")}
      </span>
    ) : (
      <>
        <b className="gb-tnum">{row.total}</b> {row.total === 1 ? "abierta" : "abiertas"}
      </>
    );

  const content = (
    <>
      <span className="gb-check">
        <Icon name="check" size={12} />
      </span>
      <CompanyTag company={company} />
      <span className="gb-bar">{bar}</span>
      <span className="gb-tot">{total}</span>
    </>
  );

  // Mientras carga, o si la empresa falló, la fila no filtra: así «Reintentar»
  // no queda dentro de otro botón (§4.1).
  if (loading || status !== "ok") {
    return (
      <div className={className} style={style}>
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={className}
      style={style}
      aria-pressed={selected}
      title={`${selected ? "Quitar filtro" : "Filtrar"}: ${company.name}`}
      onClick={onToggle}
    >
      {content}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Contadores en una línea (con carriles, JST-21 §4.5)
// ---------------------------------------------------------------------------

/** Niveles de la regla de desborde (§4.5.1, rev 2): completa, sin check y dos filas. */
const KLINE_LEVELS = ["", "is-compact", "is-two"] as const;

/**
 * Los mismos 4 contadores y el filtro de empresa de «Abiertas por empresa», en
 * una fila de 30 px: así queda más alto para los carriles. «Ver contadores»
 * despliega los de D.
 */
export function KpiLine({
  index,
  loading,
  filters,
  onFilters,
  onExpand,
}: {
  index: BoardIndex | null;
  loading: boolean;
  filters: BoardFilters;
  onFilters: (filters: BoardFilters) => void;
  onExpand: () => void;
}) {
  const kpis = useMemo(() => (index ? computeKpis(index, filters.emp) : null), [index, filters.emp]);
  const open = useMemo(() => (index ? openByCompany(index) : []), [index]);
  const tocaUnavailable = index !== null && !index.tocaAvailable;

  // La fila nunca corta nada (§4.5.1). Si no cabe, las pastillas de empresa
  // pierden el check (nivel 1); si tampoco, se parte en dos filas completas
  // (nivel 2). Se mide cada nivel en orden y queda el primero que cabe, así que
  // al agrandar vuelve al anterior. Los umbrales dependen de los números: se
  // recalcula al cambiar el ancho de la fila o lo que muestra.
  const lineRef = useRef<HTMLDivElement>(null);
  const [level, setLevel] = useState(0);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const line = lineRef.current;
    if (!line) return;
    // También cambia al abrir o cerrar el menú lateral del host, sin `resize` de la ventana.
    const observer = new ResizeObserver(() => setWidth(line.clientWidth));
    observer.observe(line);
    return () => observer.disconnect();
  }, []);
  const content = [
    loading,
    tocaUnavailable,
    ...KPI_KEYS.map((key) => kpis?.[key].issues.length ?? 0),
    ...open.map(({ company, total }) => `${company.prefix}:${total}`),
  ].join("|");
  useLayoutEffect(() => {
    const line = lineRef.current;
    if (!line) return;
    const apply = (next: number) => {
      line.classList.remove(...KLINE_LEVELS.filter(Boolean));
      if (KLINE_LEVELS[next]) line.classList.add(KLINE_LEVELS[next]);
    };
    // Queda puesta la clase del nivel elegido, la misma que pinta React después.
    let next = 0;
    apply(next);
    while (next < KLINE_LEVELS.length - 1 && line.scrollWidth > line.clientWidth) apply(++next);
    setLevel(next);
  }, [content, width]);

  return (
    <div ref={lineRef} className={cx("gb-kline", KLINE_LEVELS[level])}>
      {KPI_KEYS.map((key) => {
        const meta = KPI_META[key];
        const count = kpis?.[key].issues.length ?? 0;
        const unavailable = key === "toca" && tocaUnavailable;
        const active = isKpiActive(filters, key) && !unavailable;
        return (
          <button
            key={key}
            type="button"
            className={cx(
              "gb-kl",
              !loading && !unavailable && count > 0 && key === "bloq" && "is-alert",
              !loading && !unavailable && count > 0 && key === "toca" && "is-toca",
              active && "is-on",
            )}
            aria-pressed={active}
            disabled={loading || unavailable}
            title={unavailable ? "No disponible en esta instancia" : `Filtrar: ${meta.label.toLowerCase()}`}
            onClick={() => onFilters(applyKpi(filters, key))}
          >
            {meta.icon}
            {meta.label}
            <b className="gb-tnum">{loading ? "…" : unavailable ? "—" : count}</b>
          </button>
        );
      })}
      <span className="gb-vsep" />
      <span className="gb-klab">Abiertas</span>
      {open.map(({ company, total }) => {
        const selected = filters.emp.includes(company.prefix);
        return (
          <button
            key={company.id}
            type="button"
            className={cx("gb-kc", companyClass(company), selected ? "is-on" : filters.emp.length > 0 && "is-dim")}
            style={companyStyle(company)}
            aria-pressed={selected}
            title={`${selected ? "Quitar filtro" : "Filtrar"}: ${company.name} · ${plural(total, "abierta", "abiertas")}`}
            onClick={() =>
              onFilters({
                ...filters,
                emp: selected ? filters.emp.filter((prefix) => prefix !== company.prefix) : [...filters.emp, company.prefix],
              })
            }
          >
            <span className="gb-check">
              <Icon name="check" size={12} />
            </span>
            <CompanyTag company={company} solid />
            <b className="gb-tnum">{total}</b>
          </button>
        );
      })}
      <span className="gb-sp" />
      <button
        type="button"
        className="gb-linkbtn gb-kopen"
        title="Ver los contadores completos"
        aria-label="Ver contadores"
        onClick={onExpand}
      >
        <Icon name="chevron-down" size={14} />
        Ver contadores
      </button>
    </div>
  );
}
